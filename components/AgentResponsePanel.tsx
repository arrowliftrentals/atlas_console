'use client';

import React, { useState } from 'react';
import { AgentResponse } from '@/lib/types';
import { PatchList } from './PatchList';
import { CommandPlanList } from './CommandPlanList';
import { TestPlanList } from './TestPlanList';
import { ToolCallList } from './ToolCallList';

interface AgentResponsePanelProps {
  response: AgentResponse;
  index: number;
}

export function AgentResponsePanel({ response, index }: AgentResponsePanelProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'patches' | 'commands' | 'tests' | 'tools'>('summary');

  // Check if response has any structured content
  const hasPatches = (response.patches?.length || 0) > 0;
  const hasCommands = (response.commands?.length || 0) > 0;
  const hasTests = (response.tests?.length || 0) > 0;
  const hasTools = (response.tool_calls?.length || 0) > 0;
  const hasStructuredContent = hasPatches || hasCommands || hasTests || hasTools;

  // Extract unique file paths from patches
  const getModifiedFiles = () => {
    if (!response.patches) return [];
    const files = response.patches.map(p => p.file_path);
    return [...new Set(files)]; // Remove duplicates
  };

  const getFileIcon = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'ts': 'TS', 'tsx': 'TSX', 'js': 'JS', 'jsx': 'JSX',
      'py': 'PY', 'json': 'JSON', 'md': 'MD', 'yaml': 'YAML',
      'yml': 'YML', 'txt': 'TXT', 'sh': 'SH', 'css': 'CSS',
      'html': 'HTML', 'sql': 'SQL', 'toml': 'TOML', 'xml': 'XML',
    };
    return iconMap[ext || ''] || 'FILE';
  };

  const getFileName = (filePath: string): string => {
    return filePath.split('/').pop() || filePath;
  };

  const modifiedFiles = getModifiedFiles();

  // If no structured content, show only text
  if (!hasStructuredContent) {
    return (
      <div className="text-xs text-[var(--atlas-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {response.answer}
      </div>
    );
  }

  const tabs = [
    { id: 'summary' as const, label: 'Response', count: null },
    { id: 'patches' as const, label: 'Changes', count: response.patches?.length || 0 },
    { id: 'commands' as const, label: 'Commands', count: response.commands?.length || 0 },
    { id: 'tests' as const, label: 'Tests', count: response.tests?.length || 0 },
    { id: 'tools' as const, label: 'References', count: response.tool_calls?.length || 0 },
  ].filter(tab => tab.id === 'summary' || (tab.count && tab.count > 0));

  // Generate action details from tool calls - VS Code style
  const getActionDetails = () => {
    if (!response.tool_calls || response.tool_calls.length === 0) {
      return [];
    }
    
    return response.tool_calls.map(tool => {
      const args = tool.arguments as Record<string, any>;
      const filePath = args.filePath || args.path || args.file_path;
      const offset = args.offset;
      const limit = args.limit;
      const query = args.query;
      
      let actionText = '';
      
      switch (tool.name) {
        case 'read_file':
          if (filePath) {
            const fileName = String(filePath).split('/').pop();
            if (offset && limit) {
              actionText = `Read ${fileName}, lines ${offset} to ${Number(offset) + Number(limit)}`;
            } else {
              actionText = `Read ${fileName}`;
            }
          }
          break;
        case 'grep_search':
        case 'semantic_search':
          actionText = query ? `Searched for "${String(query).substring(0, 40)}${String(query).length > 40 ? '...' : ''}"` : 'Searched workspace';
          break;
        case 'file_search':
          actionText = query ? `Searched files matching "${String(query)}"` : 'Searched files';
          break;
        case 'replace_string_in_file':
          if (filePath) {
            const fileName = String(filePath).split('/').pop();
            actionText = `${fileName}+1-1`;
          }
          break;
        case 'create_file':
          if (filePath) {
            const fileName = String(filePath).split('/').pop();
            actionText = `Created ${fileName}`;
          }
          break;
        case 'list_dir':
          actionText = `Listed directory`;
          break;
        case 'run_in_terminal':
          const cmd = args.command ? String(args.command).substring(0, 30) : '';
          actionText = cmd ? `Ran "${cmd}${String(args.command).length > 30 ? '...' : ''}"` : 'Ran command';
          break;
        case 'get_errors':
          actionText = 'Checked for errors';
          break;
        default:
          actionText = tool.name.replace(/_/g, ' ');
      }
      
      return actionText;
    }).filter(text => text.length > 0);
  };

  const actionDetails = getActionDetails();

  return (
    <div className="space-y-2">
      {/* Action Details - VS Code style boxes */}
      {actionDetails.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 bg-[#2d2d30] rounded-lg p-3">
          {actionDetails.map((action, idx) => (
            <div key={idx} className="text-[13px] text-[var(--atlas-text-primary)]">
              {action}
            </div>
          ))}
        </div>
      )}

      {/* Modified files badges with +/- like VS Code */}
      {modifiedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {modifiedFiles.map((filePath, idx) => {
            const patchCount = response.patches?.filter(p => p.file_path === filePath).length || 0;
            return (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-[#2b2b30] border border-[var(--atlas-border-subtle)] rounded px-2 py-1 text-[11px]"
                title={filePath}
              >
                <svg className="w-3.5 h-3.5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                <span className="text-[var(--atlas-text-primary)] font-medium">{getFileName(filePath)}</span>
                {patchCount > 0 && (
                  <>
                    <span className="text-green-400 font-semibold">+{patchCount}</span>
                    <span className="text-red-400 font-semibold">-{patchCount}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs - minimal style */}
      {tabs.length > 1 && (
        <div className="flex gap-3 border-b border-[var(--atlas-border-subtle)] pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--atlas-accent-primary)]'
                  : 'text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)]'
              }`}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="text-xs">
        {activeTab === 'summary' && (
          <div className="space-y-2">
            {/* Tool Operations - VS Code style */}
            {hasTools && (
              <div className="space-y-0.5 mb-3">
                <div className="text-[10px] font-semibold text-[var(--atlas-text-muted)] mb-1.5">
                  Used {response.tool_calls?.length} reference{response.tool_calls?.length !== 1 ? 's' : ''}
                </div>
                {response.tool_calls?.map((tool, idx) => {
                  const args = tool.arguments as Record<string, any>;
                  const filePath = args.filePath || args.path || args.file_path;
                  const offset = args.offset;
                  const limit = args.limit;
                  
                  return (
                    <div key={idx} className="flex items-center gap-2 text-[11px] font-mono text-[var(--atlas-text-muted)] py-0.5">
                      <span className="text-blue-400">{tool.name}</span>
                      {filePath && (
                        <>
                          <span>→</span>
                          <span className="text-[var(--atlas-text-secondary)]">{String(filePath)}</span>
                          {offset && limit && (
                            <span className="text-[var(--atlas-text-muted)]">
                              #{offset}-{Number(offset) + Number(limit)}
                            </span>
                          )}
                        </>
                      )}
                      {!filePath && Object.keys(args).length > 0 && (
                        <>
                          <span>with</span>
                          <span className="text-[10px] opacity-70">
                            {Object.keys(args).join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Response Text */}
            <div className="whitespace-pre-wrap text-[var(--atlas-text-secondary)] leading-relaxed">
              {response.answer}
            </div>

            {response.notes && (
              <div className="mt-3 pl-3 border-l-2 border-blue-500">
                <div className="text-[10px] font-semibold text-blue-400 mb-1">Note</div>
                <div className="text-xs text-[var(--atlas-text-secondary)]">{response.notes}</div>
              </div>
            )}

            {response.unresolved_assumptions.length > 0 && (
              <div className="mt-3 pl-3 border-l-2 border-yellow-500">
                <div className="text-[10px] font-semibold text-yellow-400 mb-1">Needs clarification</div>
                <ul className="space-y-1 text-xs text-[var(--atlas-text-secondary)]">
                  {response.unresolved_assumptions.map((a, i) => (
                    <li key={i} className="text-[11px]">• {a.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'patches' && (
          <PatchList patches={response.patches || []} />
        )}

        {activeTab === 'commands' && (
          <CommandPlanList commands={response.commands || []} />
        )}

        {activeTab === 'tests' && (
          <TestPlanList tests={response.tests || []} />
        )}

        {activeTab === 'tools' && (
          <ToolCallList toolCalls={response.tool_calls || []} />
        )}
      </div>
    </div>
  );
}
