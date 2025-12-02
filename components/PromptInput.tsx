'use client';

import React, { useState } from 'react';
import { useConsole } from './ConsoleProvider';
import { sendAtlasChat } from '@/lib/atlasConsoleClient';

export function PromptInput() {
  const { activeSessionId, addMessage } = useConsole();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;
    if (!activeSessionId) {
      setError('Please select a session first');
      return;
    }

    setLoading(true);
    setError(null);

    // Add user message
    addMessage(activeSessionId, { type: 'user', content: prompt });

    try {
      const response = await sendAtlasChat(prompt, activeSessionId);
      addMessage(activeSessionId, { type: 'assistant', content: response.answer, response });
      setPrompt(''); // Clear input after successful send
    } catch (err: any) {
      setError(err.message || 'Failed to send prompt');
      console.error('Error sending prompt:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-gray-700 bg-gray-800 p-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex items-start gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={activeSessionId ? "Ask ATLAS anything..." : "Select a session to start"}
            disabled={loading || !activeSessionId}
            className="flex-1 min-h-[80px] px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
            onKeyDown={(e) => {
              // Submit on Ctrl+Enter or Cmd+Enter
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim() || !activeSessionId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
        
        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {error}
          </div>
        )}
        
        <div className="text-xs text-gray-500">
          Press Ctrl+Enter (⌘+Enter on Mac) to send
        </div>
      </form>
    </div>
  );
}
