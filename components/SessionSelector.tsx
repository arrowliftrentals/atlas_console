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
    <div 
      className="p-4 border-b" 
      style={{ 
        borderColor: 'var(--atlas-border)',
        borderLeft: '3px solid var(--atlas-accent-primary)',
        paddingLeft: '1rem'
      }}
    >
      <div 
        className="mb-2 text-xs font-semibold uppercase" 
        style={{ color: 'var(--atlas-text-accent)' }}
      >
        Console Session
      </div>
      
      {loadingSessions ? (
        <div className="text-sm text-gray-400">Loading sessions...</div>
      ) : error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : (
        <>
          <select
            value={activeSessionId || ''}
            onChange={(e) => setActiveSessionId(e.target.value || null)}
            className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            style={{ 
              backgroundColor: 'var(--atlas-bg-subtle)',
              color: 'var(--atlas-text-primary)',
              borderColor: 'var(--atlas-border)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--atlas-border-accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--atlas-border)'}          >
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
            className="mt-2 w-full px-2 py-1.5 text-xs text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_2px_0_0_rgba(255,255,255,0.3)]"
            style={{ background: creating ? 'var(--atlas-btn-secondary)' : 'var(--atlas-btn-primary)' }}
            onMouseEnter={(e) => !creating && (e.currentTarget.style.background = 'var(--atlas-btn-primary-hover)')}
            onMouseLeave={(e) => !creating && (e.currentTarget.style.background = 'var(--atlas-btn-primary)')}
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
