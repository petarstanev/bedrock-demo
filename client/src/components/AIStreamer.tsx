import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

export default function AIStreamer() {
    const [prompt, setPrompt] = useState("What is Next.js?");
    const [output, setOutput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [approvalStatus, setApprovalStatus] = useState("");
    const [usage, setUsage] = useState<TokenUsage | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setIsDone(false);
        setOutput("");
        setApprovalStatus("");
        setUsage(null);

        try {
            const response = await fetch("http://localhost:8000/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = JSON.parse(line.replace("data: ", ""));
                        if (data.type === "text") {
                            setOutput(prev => prev + data.content);
                        } else if (data.type === "usage") {
                            setUsage(data.content);
                        }
                    }
                }
            }
            // Stream finished successfully
            setIsDone(true);
        } catch (error) {
            console.error("Stream failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApprove = async () => {
        setApprovalStatus("Saving...");
        try {
            const response = await fetch("http://localhost:8000/api/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, generated_document: output })
            });

            const data = await response.json();
            if (data.status === "success") {
                setApprovalStatus(`Approved! Saved to DynamoDB and sent to SQS (Session: ${data.sessionId})`);
            }
        } catch (error) {
            setApprovalStatus("Error saving document.");
        }
    };

    return (
        <div className="p-8 max-w-3xl mx-auto font-sans">
            <h1 className="text-2xl font-bold mb-4">AI Feature Scoping Assistant</h1>

            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-2 border rounded mb-4 text-black"
                rows={3}
            />

            <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded mb-4 disabled:bg-gray-400"
            >
                {isGenerating ? "Generating..." : "Generate API Spec"}
            </button>

            <div className="whitespace-pre-wrap bg-gray-100 text-gray-800 p-4 rounded min-h-[200px] border border-gray-300 shadow-inner">
                <ReactMarkdown>{output || "AI response will stream here..."}</ReactMarkdown>
            </div>
            {usage && (
                <div className="mt-3 flex gap-4 font-mono text-gray-400">
                    <span>Input: {usage.inputTokens}</span>
                    <span>Output: {usage.outputTokens}</span>
                    <span className="font-semibold text-gray-500">Total: {usage.totalTokens}</span>
                </div>
            )}

            {isDone && output && (
                <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
                    <button
                        onClick={handleApprove}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
                    >
                        Save to DynamoDB & Queue response to SQS
                    </button>
                    {approvalStatus && <p className="mt-2 text-sm font-semibold text-blue-700">{approvalStatus}</p>}
                </div>
            )}
        </div>
    );
}