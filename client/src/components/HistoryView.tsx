import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface SavedSession {
    sessionId: string;
    timestamp: number;
    prompt: string;
    document: string;
    status: string;
}

export default function HistoryView() {
    const [sessions, setSessions] = useState<SavedSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchHistory = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("http://localhost:8000/api/history");
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            const data = await res.json();
            setSessions(data.items);
        } catch (err) {
            setError("Failed to load records from DynamoDB.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (sessionId: string, timestamp: number) => {
        // Optimistic UI update: remove item from screen immediately
        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));

        try {
            const res = await fetch(`http://localhost:8000/api/history/${sessionId}/${timestamp}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Failed to delete from database");
        } catch (err) {
            console.error(err);
            // Re-fetch to restore data if delete failed
            fetchHistory();
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading DynamoDB records...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Saved Specifications ({sessions.length})</h2>
                <button
                    onClick={fetchHistory}
                    className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-medium"
                >
                    Refresh Table
                </button>
            </div>

            {sessions.length === 0 ? (
                <p className="text-gray-500">No specifications saved in DynamoDB yet.</p>
            ) : (
                sessions.map((item) => (
                    <div key={item.sessionId} className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm space-y-3 relative group">

                        {/* Delete Button (appears on hover) */}
                        <button
                            onClick={() => handleDelete(item.sessionId, item.timestamp)}
                            className="absolute top-4 right-4 text-xs font-bold px-2 py-1 bg-red-50 text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                        >
                            Delete
                        </button>

                        <div className="flex justify-between items-start pr-16">
                            <span className="text-xs font-mono text-gray-400">ID: {item.sessionId}</span>
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 font-semibold text-xs rounded-full">
                                {item.status}
                            </span>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prompt</p>
                            <p className="text-sm font-medium text-gray-800">{item.prompt}</p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Output</p>
                            <pre className="mt-1 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto border border-gray-100">
                                <ReactMarkdown>{item.document}</ReactMarkdown>
                            </pre>
                        </div>

                        <p className="text-xs text-gray-400 text-right">
                            Saved on: {new Date(item.timestamp * 1000).toLocaleString()}
                        </p>
                    </div>
                ))
            )}
        </div>
    );
}