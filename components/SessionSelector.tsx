'use client';

import React, { useState } from 'react';
import { useConsole } from './ConsoleProvider';
import { createConsoleSession } from '@/lib/atlasConsoleClient';

export default function SessionSelector() {
  const { sessions, activeSessionId, loadingSessions, error, refreshSessions, setActiveSessionId } = useConsole();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateSession = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await createConsoleSession({});
      await refreshSessions();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create session');
      console.error('Error creating session:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 border-b border-gray-700">
      <div className="mb-2 text-xs font-semibold text-gray-400 uppercase">Console Session</div>
      
      {loadingSessions ? (
        <div className="text-sm text-gray-400">Loading sessions...</div>
      ) : error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : (
        <>
          <select
            value={activeSessionId || ''}
            onChange={(e) => setActiveSessionId(e.target.value || null)}
            className="w-full px-2 py-1 text-sm bg-[#3c3c3c] text-gray-200 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            {sessions.length === 0 && (
              <option value="">No sessions available</option>
            )}
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_id}
              </option>
            ))}
          </select>

          <button
            onClick={handleCreateSession}
            disabled={creating}
            className="mt-2 w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : '+ New Session'}
          </button>

          {createError && (
            <div className="mt-2 text-xs text-red-400">{createError}</div>
          )}
        </>
      )}
    </div>
  );
}
