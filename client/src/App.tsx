import { useState } from 'react';
import AIStreamer from './components/AIStreamer';
import HistoryView from './components/HistoryView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation Bar */}
        <div className="flex space-x-2 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'generate'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            New Feature Generator
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Saved Database Records
          </button>
        </div>

        {/* View Selection */}
        {activeTab === 'generate' ? <AIStreamer /> : <HistoryView />}
      </div>
    </div>
  );
}