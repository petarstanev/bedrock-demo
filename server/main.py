from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
import json
import time
import uuid
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS Clients
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='eu-central-1')
sqs = boto3.client('sqs', region_name='eu-central-1')

MODEL_ID = "amazon.nova-micro-v1:0"
QUEUE_NAME = "FeatureApprovalsQueue"

class AIRequest(BaseModel):
    prompt: str

class ApprovalRequest(BaseModel):
    prompt: str
    generated_document: str

@app.post("/api/generate")
async def generate_document(req: AIRequest):
    def bedrock_stream_generator():
        try:
            messages = [{"role": "user", "content": [{"text": req.prompt}]}]
            
            response = bedrock.converse_stream(
                modelId=MODEL_ID,
                messages=messages
            )
            
            for event in response.get('stream'):
                if 'contentBlockDelta' in event:
                    text_chunk = event['contentBlockDelta']['delta']['text']
                    yield f"data: {json.dumps({'type': 'text', 'content': text_chunk})}\n\n"
                    
                elif 'metadata' in event:
                    usage = event['metadata']['usage']
                    yield f"data: {json.dumps({'type': 'usage', 'content': usage})}\n\n"
                    
        except NoCredentialsError:
            error_msg = "AWS credentials not found. Check your .env file."
            print(f"\n❌ ERROR: {error_msg}\n")
            yield f"data: {json.dumps({'type': 'text', 'content': error_msg})}\n\n"
            
        except ClientError as e:
            error_msg = e.response['Error']['Message']
            print(f"\n❌ AWS API ERROR: {error_msg}\n")
            yield f"data: {json.dumps({'type': 'text', 'content': f'AWS API Error: {error_msg}'})}\n\n"
            
        except Exception as e:
            print(f"\n❌ UNEXPECTED ERROR: {str(e)}\n")
            yield f"data: {json.dumps({'type': 'text', 'content': 'An unexpected backend error occurred.'})}\n\n"

    return StreamingResponse(bedrock_stream_generator(), media_type="text/event-stream")

@app.post("/api/approve")
async def approve_document(req: ApprovalRequest):
    try:
        session_id = str(uuid.uuid4())
        timestamp = int(time.time())

        # 1. Save to DynamoDB
        table = dynamodb.Table('SessionHistory')
        table.put_item(
            Item={
                'sessionId': session_id,
                'timestamp': timestamp,
                'prompt': req.prompt,
                'document': req.generated_document,
                'status': 'APPROVED'
            }
        )

        # 2. Get the SQS Queue URL dynamically
        queue_url_response = sqs.get_queue_url(QueueName=QUEUE_NAME)
        queue_url = queue_url_response['QueueUrl']

        # 3. Send Message to SQS
        sqs_payload = {
            "sessionId": session_id,
            "action": "CREATE_TICKETS",
            "documentLength": len(req.generated_document)
        }
        
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(sqs_payload)
        )

        return {"status": "success", "sessionId": session_id, "message": "Saved to DB and queued for processing."}

    except ClientError as e:
        print(f"AWS Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to interact with AWS services")

@app.get("/api/history")
async def get_session_history():
    try:
        table = dynamodb.Table('SessionHistory')
        response = table.scan()
        items = response.get('Items', [])
        
        # Sort newest first based on the timestamp
        items.sort(key=lambda x: int(x.get('timestamp', 0)), reverse=True)
        
        formatted_items = [
            {
                "sessionId": str(item.get("sessionId")),
                "timestamp": int(item.get("timestamp", 0)),
                "prompt": item.get("prompt", ""),
                "document": item.get("document", ""),
                "status": item.get("status", "APPROVED")
            }
            for item in items
        ]
        
        return {"items": formatted_items}

    except ClientError as e:
        error_msg = e.response['Error'].get('Message', str(e))
        print(f"DynamoDB Scan Error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.delete("/api/history/{session_id}/{timestamp}")
async def delete_session_record(session_id: str, timestamp: int):
    try:
        table = dynamodb.Table('SessionHistory')
        table.delete_item(
            Key={
                'sessionId': session_id,
                'timestamp': timestamp
            }
        )
        return {"status": "success", "message": f"Deleted session {session_id}"}

    except ClientError as e:
        error_msg = e.response['Error'].get('Message', str(e))
        print(f"DynamoDB Delete Error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)