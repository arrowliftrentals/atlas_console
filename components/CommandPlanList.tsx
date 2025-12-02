'use client';

import React, { useState } from 'react';
import { Command } from '@/lib/types';

interface CommandPlanListProps {
  commands: Command[];
}

interface CommandItemProps {
  command: Command;
  index: number;
}

type CommandStatus = 'pending' | 'running' | 'success' | 'error';

function CommandItem({ command, index }: CommandItemProps) {
  const [status, setStatus] = useState<CommandStatus>('pending');
  const [output, setOutput] = useState<string>('');
  const [expanded, setExpanded] = useState(false);

  const handleRun = async () => {
    setStatus('running');
    setOutput('');
    setExpanded(true);

    try {
      const res = await fetch('/api/console/commands/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: command.command,
          cwd: command.cwd,
          timeout: 60,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setOutput(data.stdout || '');
      } else {
        setStatus('error');
        setOutput(data.error || data.stderr || 'Command failed');
      }
    } catch (err: any) {
      setStatus('error');
      setOutput(err.message || 'Network error');
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Pending</span>;
      case 'running':
        return <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded animate-pulse">Running</span>;
      case 'success':
        return <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">Success</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">Error</span>;
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-900">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
            {getStatusBadge()}
          </div>
          <div className="text-sm font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded">
            {command.command}
          </div>
          {command.description && (
            <div className="text-xs text-gray-400 mt-2">{command.description}</div>
          )}
          {command.cwd && (
            <div className="text-xs text-gray-500 mt-1">Working directory: {command.cwd}</div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRun();
            }}
            disabled={status === 'running'}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'running' ? 'Running...' : 'Run'}
          </button>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Output */}
      {expanded && output && (
        <div className="border-t border-gray-700 px-4 py-3">
          <div className="text-xs font-semibold text-gray-400 mb-2">Output:</div>
          <div className="bg-black rounded p-3 overflow-x-auto">
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommandPlanList({ commands }: CommandPlanListProps) {
  if (commands.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No commands in this response
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 mb-3">
        {commands.length} {commands.length === 1 ? 'command' : 'commands'} suggested
      </div>
      {commands.map((command, index) => (
        <CommandItem key={index} command={command} index={index} />
      ))}
    </div>
  );
}
