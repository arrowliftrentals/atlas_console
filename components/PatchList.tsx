'use client';

import React, { useState } from 'react';
import { Patch } from '@/lib/types';

interface PatchListProps {
  patches: Patch[];
}

interface PatchItemProps {
  patch: Patch;
  index: number;
}

function PatchItem({ patch, index }: PatchItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleApply = async () => {
    setApplying(true);
    setResult(null);

    try {
      const res = await fetch('/api/console/files/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: patch.file_path,
          diff: patch.diff,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message || 'Patch applied successfully' });
      } else {
        setResult({ success: false, message: data.error || 'Failed to apply patch' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setApplying(false);
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
            <span className="text-sm font-medium text-blue-400 font-mono">{patch.file_path}</span>
          </div>
          {patch.description && (
            <div className="text-xs text-gray-400 mt-1">{patch.description}</div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleApply();
            }}
            disabled={applying}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {applying ? 'Applying...' : 'Apply'}
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

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-700 px-4 py-3">
          {result && (
            <div
              className={`mb-3 p-2 rounded text-xs ${
                result.success
                  ? 'bg-green-900/20 border border-green-800 text-green-400'
                  : 'bg-red-900/20 border border-red-800 text-red-400'
              }`}
            >
              {result.message}
            </div>
          )}

          {/* Diff Display */}
          <div className="bg-black rounded p-3 overflow-x-auto">
            <pre className="text-xs font-mono">
              {patch.diff.split('\n').map((line, i) => (
                <div
                  key={i}
                  className={
                    line.startsWith('+')
                      ? 'text-green-400 bg-green-900/20'
                      : line.startsWith('-')
                      ? 'text-red-400 bg-red-900/20'
                      : line.startsWith('@@')
                      ? 'text-cyan-400'
                      : 'text-gray-400'
                  }
                >
                  {line || '\u00A0'}
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function PatchList({ patches }: PatchListProps) {
  if (patches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No patches in this response
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 mb-3">
        {patches.length} {patches.length === 1 ? 'patch' : 'patches'} proposed
      </div>
      {patches.map((patch, index) => (
        <PatchItem key={index} patch={patch} index={index} />
      ))}
    </div>
  );
}
