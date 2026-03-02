
import React, { useState } from 'react';

// Task interface matching existing console types.ts pattern
export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tool?: string;
  startTime?: number;
  endTime?: number;
}

interface TaskProgressProps {
  tasks: Task[];
  collapsible?: boolean;
}

const TaskProgress: React.FC<TaskProgressProps> = ({ tasks, collapsible = true }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const hasRunning = tasks.some(t => t.status === 'running');

  return (
    <div 
      className="my-3 rounded-lg border"
      style={{
        backgroundColor: 'var(--atlas-bg-elevated)',
        borderColor: 'var(--atlas-border)'
      }}
    >
      {/* Header */}
      {collapsible && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-[var(--atlas-bg-hover)] transition-colors"
          style={{ color: 'var(--atlas-text-secondary)' }}
        >
          <div className="flex items-center gap-2">
            <span>{isExpanded ? '▼' : '▶'}</span>
            <span>Thinking process</span>
            <span style={{ color: 'var(--atlas-text-muted)' }}>({completedCount}/{tasks.length})</span>
          </div>
          {hasRunning && (
            <div className="flex items-center gap-1" style={{ color: 'var(--atlas-accent-primary)' }}>
              <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
              <span>Working...</span>
            </div>
          )}
        </button>
      )}

      {/* Task List */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2 text-xs">
              {/* Status Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {task.status === 'completed' && (
                  <svg className="w-4 h-4" fill="none" stroke="var(--atlas-success)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {task.status === 'running' && (
                  <div className="w-4 h-4 border-2 border-[var(--atlas-accent-primary)] border-t-transparent rounded-full animate-spin" />
                )}
                {task.status === 'pending' && (
                  <div className="w-4 h-4 border-2 border-[var(--atlas-border)] rounded-full" />
                )}
                {task.status === 'failed' && (
                  <svg className="w-4 h-4" fill="none" stroke="var(--atlas-error)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              {/* Task Description */}
              <div className="flex-1">
                <span style={{ color: 'var(--atlas-text-primary)' }}>
                  {task.description}
                </span>
                {task.tool && (
                  <span 
                    className="ml-2 px-1.5 py-0.5 rounded font-mono"
                    style={{ 
                      backgroundColor: 'var(--atlas-bg-subtle)',
                      color: 'var(--atlas-accent-primary)',
                      fontSize: '11px'
                    }}
                  >
                    {task.tool}
                  </span>
                )}
              </div>

              {/* Duration */}
              {task.status === 'completed' && task.startTime && task.endTime && (
                <span style={{ color: 'var(--atlas-text-muted)', fontSize: '11px' }}>
                  {((task.endTime - task.startTime) / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskProgress;
