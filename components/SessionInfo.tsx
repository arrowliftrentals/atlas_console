"use client";

import React from 'react';

interface SessionInfoProps {
  sessionId: string;
  sessionName: string;
  status: 'idle' | 'active' | 'completed';
  duration?: number;  // milliseconds
  messageCount?: number;
  model?: string;
  isLocal?: boolean;
}

const SessionInfo: React.FC<SessionInfoProps> = ({
  sessionId,
  sessionName,
  status,
  duration,
  messageCount = 0,
  model = 'GPT-4o-mini',
  isLocal = true
}) => {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <div 
      className="px-3 py-2 border-b text-xs"
      style={{
        backgroundColor: 'var(--atlas-bg-elevated)',
        borderColor: 'var(--atlas-border)'
      }}
    >
      {/* Session Name */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Status Indicator */}
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: 
                status === 'active' ? 'var(--atlas-success)' :
                status === 'completed' ? 'var(--atlas-text-muted)' :
                'var(--atlas-border)'
            }}
          />
          <span 
            className="font-medium"
            style={{ color: 'var(--atlas-text-primary)' }}
          >
            {sessionName}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3" style={{ color: 'var(--atlas-text-muted)' }}>
        {/* Completion Status */}
        {status === 'completed' && duration && (
          <span>Completed in {formatDuration(duration)}</span>
        )}
        {status === 'active' && (
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Active
          </span>
        )}

        {/* Location */}
        <span>{isLocal ? 'Local' : 'Cloud'}</span>

        {/* Message Count */}
        {messageCount > 0 && (
          <span>{messageCount} {messageCount === 1 ? 'message' : 'messages'}</span>
        )}

        {/* Model */}
        <span className="flex items-center gap-1">
          {model} • 1x
        </span>
      </div>
    </div>
  );
};

export default SessionInfo;
