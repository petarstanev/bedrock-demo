# About the project:
"I built a serverless AI scoping tool that demonstrates modern asynchronous and streaming patterns. The frontend uses React and TypeScript to consume Bedrock's token stream via FastAPI Server-Sent Events, keeping Time-to-First-Token well under a second and avoiding API Gateway timeouts.

Once generated, I implemented a human-in-the-loop approval step: the approved specification is persisted to DynamoDB for audit history, and the downstream processing job is decoupled using Amazon SQS so background tasks never block the client response cycle."

# How to start:
In server folder:
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
Open: http://localhost:8000/docs

In client folder:
npm run dev