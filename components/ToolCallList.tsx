'use client';

import React, { useState } from 'react';
import { ToolCall } from '@/lib/types';

interface ToolCallListProps {
  toolCalls: ToolCall[];
}

interface ToolCallItemProps {
  toolCall: ToolCall;
  index: number;
}

function ToolCallItem({ toolCall, index }: ToolCallItemProps) {
  const [expanded, setExpanded] = useState(false);

  const formatArguments = () => {
    try {
      return JSON.stringify(toolCall.arguments, null, 2);
    } catch {
      return String(toolCall.arguments);
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
            <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded">
              {toolCall.name}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            Tool ID: <span className="font-mono text-gray-500">{toolCall.id}</span>
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Arguments */}
      {expanded && (
        <div className="border-t border-gray-700 px-4 py-3">
          <div className="text-xs font-semibold text-gray-400 mb-2">Arguments:</div>
          <div className="bg-black rounded p-3 overflow-x-auto">
            <pre className="text-xs font-mono text-gray-300">
              {formatArguments()}
            </pre>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            This tool call represents a request from the agent. The backend would execute this tool and return results.
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  if (toolCalls.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No tool calls in this response
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 mb-3">
        {toolCalls.length} {toolCalls.length === 1 ? 'tool call' : 'tool calls'} requested
      </div>
      {toolCalls.map((toolCall, index) => (
        <ToolCallItem key={toolCall.id} toolCall={toolCall} index={index} />
      ))}
    </div>
  );
}
