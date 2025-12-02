'use client';

import React, { useState } from 'react';
import { TestInstruction } from '@/lib/types';

interface TestPlanListProps {
  tests: TestInstruction[];
}

interface TestItemProps {
  test: TestInstruction;
  index: number;
}

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

function TestItem({ test, index }: TestItemProps) {
  const [status, setStatus] = useState<TestStatus>('pending');
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
          command: test.command,
          timeout: 120, // Tests might take longer
        }),
      });

      const data = await res.json();

      if (res.ok && data.exit_code === 0) {
        setStatus('passed');
        setOutput(data.stdout || 'Test passed');
      } else {
        setStatus('failed');
        setOutput(data.stderr || data.stdout || data.error || 'Test failed');
      }
    } catch (err: any) {
      setStatus('failed');
      setOutput(err.message || 'Network error');
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">Pending</span>;
      case 'running':
        return <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded animate-pulse">Running</span>;
      case 'passed':
        return <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">✓ Passed</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">✗ Failed</span>;
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
            <span className="text-xs font-mono text-gray-400">Test #{index + 1}</span>
            {getStatusBadge()}
          </div>
          <div className="text-sm font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded">
            {test.command}
          </div>
          {test.description && (
            <div className="text-xs text-gray-400 mt-2">{test.description}</div>
          )}
          {test.expected_outcome && (
            <div className="text-xs text-gray-500 mt-1">
              <span className="font-semibold">Expected:</span> {test.expected_outcome}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRun();
            }}
            disabled={status === 'running'}
            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'running' ? 'Running...' : 'Run Test'}
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
          <div className="text-xs font-semibold text-gray-400 mb-2">Test Output:</div>
          <div className="bg-black rounded p-3 overflow-x-auto">
            <pre className={`text-xs font-mono whitespace-pre-wrap ${
              status === 'passed' ? 'text-green-300' : status === 'failed' ? 'text-red-300' : 'text-gray-300'
            }`}>
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function TestPlanList({ tests }: TestPlanListProps) {
  if (tests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No tests in this response
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400 mb-3">
        {tests.length} {tests.length === 1 ? 'test' : 'tests'} suggested
      </div>
      {tests.map((test, index) => (
        <TestItem key={index} test={test} index={index} />
      ))}
    </div>
  );
}
