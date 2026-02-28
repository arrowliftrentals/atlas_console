"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import EnhancedCodeBlock from './EnhancedCodeBlock';

interface MarkdownRendererProps {
  content: string;
}

// ---------------------------------------------------------------------------
// Plugin safety: Turbopack ESM/CJS interop can resolve remark plugins as
// module wrappers { __esModule, default } instead of the bare function.
// unified then rejects them as "empty presets".  Unwrap .default if needed
// and filter out anything that isn't a callable function.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolvePlugin(mod: any): any {
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod === 'object' && typeof mod.default === 'function') {
    return mod.default;
  }
  return null;
}

const safePlugins: PluggableList = [
  resolvePlugin(remarkGfm),
  resolvePlugin(remarkBreaks),
].filter(Boolean);

// Pre-process content to improve formatting
// LLMs often produce inline numbered lists and other patterns that
// standard markdown parsers can't handle. This fixes them.
function preprocessContent(content: string): string {
  let processed = content;
  
  // Fix inline numbered lists: "...sentence. 1. **Item**: text 2. **Item**: text"
  // Insert newlines before numbered items that follow a sentence or another item
  processed = processed.replace(/([.!?:])\s+(\d+\.\s)/g, '$1\n\n$2');
  
  // Also catch numbered items that follow other numbered items without newlines
  // e.g., "...end of item 1 text. 2. Next item"
  processed = processed.replace(/(\S)\s+(\d+\.\s+\*\*)/g, '$1\n\n$2');
  
  // Fix inline bullet points: "...sentence. - Item text - Another item"
  processed = processed.replace(/([.!?:])\s+([-•]\s)/g, '$1\n\n$2');
  
  // Convert patterns like "L1 (Working Memory):" to markdown headers
  processed = processed.replace(/\b(L\d+)\s*\(([^)]+)\):/g, '\n\n### $1 ($2)\n');
  
  // Convert "Status:" followed by data into formatted blocks
  processed = processed.replace(/Status:\s*([^\n]+)/g, '\n> **Status:** $1\n');
  
  // Add line breaks before emoji checkmarks for better list formatting
  processed = processed.replace(/(✅|❌|⚠️|✓|✗)/g, '\n$1');
  
  // Ensure a blank line before the first list item if preceded by text
  // This is required for markdown parsers to recognize lists
  processed = processed.replace(/([^\n])\n(\d+\.\s)/g, '$1\n\n$2');
  processed = processed.replace(/([^\n])\n([-•]\s)/g, '$1\n\n$2');
  
  // Clean up excessive newlines
  processed = processed.replace(/\n{4,}/g, '\n\n\n');
  
  return processed.trim();
}

// ---------------------------------------------------------------------------
// Error boundary — falls back to plain text if ReactMarkdown crashes
// ---------------------------------------------------------------------------
class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackContent: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallbackContent: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('[MarkdownRenderer] Render error, falling back to plain text:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="whitespace-pre-wrap" style={{ color: 'var(--atlas-text-primary)' }}>
          {this.props.fallbackContent}
        </div>
      );
    }
    return this.props.children;
  }
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const processedContent = preprocessContent(content);
  
  return (
    <MarkdownErrorBoundary fallbackContent={processedContent}>
      <div className="markdown-body leading-relaxed">
        <ReactMarkdown
          remarkPlugins={safePlugins}
          components={{
            // Enhanced code blocks
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const code = String(children).replace(/\n$/, '');
              // Inline code has no className with language prefix
              const isInline = !className || !match;
              
              if (!isInline && match) {
                return (
                  <EnhancedCodeBlock
                    code={code}
                    language={match[1]}
                    showLineNumbers={true}
                  />
                );
              }
              
              // Inline code - VS Code style
              return (
                <code
                  className="px-1.5 py-0.5 rounded font-mono text-[0.85em]"
                  style={{
                    backgroundColor: 'rgba(110, 118, 129, 0.2)',
                    color: '#e6edf3',
                    border: '1px solid rgba(110, 118, 129, 0.3)'
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            },
            
            // Paragraphs with proper spacing
            p({ children, ...props }) {
              return (
                <p
                  className="my-2 leading-relaxed"
                  style={{ color: 'var(--atlas-text-primary)' }}
                  {...props}
                >
                  {children}
                </p>
              );
            },
            
            // Enhanced links
            a({ children, href, ...props }) {
              return (
                <a
                  href={href}
                  className="underline hover:no-underline transition-all"
                  style={{ color: 'var(--atlas-accent-primary)' }}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              );
            },
            
            // Enhanced lists - VS Code style
            ul({ children, ...props }) {
              return (
                <ul
                  className="my-2 ml-4 space-y-1"
                  style={{ 
                    color: 'var(--atlas-text-primary)',
                    listStyleType: 'disc'
                  }}
                  {...props}
                >
                  {children}
                </ul>
              );
            },
            
            ol({ children, ...props }) {
              return (
                <ol
                  className="my-2 ml-4 space-y-1"
                  style={{ 
                    color: 'var(--atlas-text-primary)',
                    listStyleType: 'decimal'
                  }}
                  {...props}
                >
                  {children}
                </ol>
              );
            },
            
            li({ children, ...props }) {
              return (
                <li
                  className="pl-1"
                  style={{ color: 'var(--atlas-text-primary)' }}
                  {...props}
                >
                  {children}
                </li>
              );
            },
            
            // Enhanced blockquotes - status/info blocks
            blockquote({ children, ...props }) {
              return (
                <blockquote
                  className="border-l-3 pl-3 py-1.5 my-2 text-sm"
                  style={{
                    borderLeft: '3px solid var(--atlas-accent-secondary)',
                    backgroundColor: 'rgba(88, 166, 255, 0.05)',
                    color: 'var(--atlas-text-secondary)',
                    borderRadius: '0 4px 4px 0'
                  }}
                  {...props}
                >
                  {children}
                </blockquote>
              );
            },
            
            // Strong/bold - accent color
            strong({ children, ...props }) {
              return (
                <strong
                  className="font-semibold"
                  style={{ color: 'var(--atlas-accent-primary)' }}
                  {...props}
                >
                  {children}
                </strong>
              );
            },
            
            // Headings - VS Code/Warp style
            h1({ children, ...props }) {
              return (
                <h1 
                  className="text-lg font-semibold mt-4 mb-2 pb-1 border-b"
                  style={{ 
                    color: 'var(--atlas-text-primary)',
                    borderColor: 'var(--atlas-border-subtle)'
                  }} 
                  {...props}
                >
                  {children}
                </h1>
              );
            },
            h2({ children, ...props }) {
              return (
                <h2 
                  className="text-base font-semibold mt-3 mb-1.5"
                  style={{ color: 'var(--atlas-text-primary)' }} 
                  {...props}
                >
                  {children}
                </h2>
              );
            },
            h3({ children, ...props }) {
              return (
                <h3 
                  className="text-sm font-semibold mt-2 mb-1 flex items-center gap-2"
                  style={{ color: 'var(--atlas-accent-primary)' }} 
                  {...props}
                >
                  {children}
                </h3>
              );
            },
            h4({ children, ...props }) {
              return (
                <h4 
                  className="text-sm font-medium mt-2 mb-1"
                  style={{ color: 'var(--atlas-text-secondary)' }} 
                  {...props}
                >
                  {children}
                </h4>
              );
            },
            
            // Horizontal rule
            hr({ ...props }) {
              return (
                <hr
                  className="my-3 border-0 h-px"
                  style={{ backgroundColor: 'var(--atlas-border-subtle)' }}
                  {...props}
                />
              );
            },
            
            // Tables - VS Code style
            table({ children, ...props }) {
              return (
                <div className="overflow-x-auto my-2">
                  <table
                    className="min-w-full text-sm border-collapse"
                    style={{ borderColor: 'var(--atlas-border-subtle)' }}
                    {...props}
                  >
                    {children}
                  </table>
                </div>
              );
            },
            th({ children, ...props }) {
              return (
                <th
                  className="px-3 py-1.5 text-left font-medium border"
                  style={{ 
                    backgroundColor: 'var(--atlas-bg-elevated)',
                    borderColor: 'var(--atlas-border-subtle)',
                    color: 'var(--atlas-text-primary)'
                  }}
                  {...props}
                >
                  {children}
                </th>
              );
            },
            td({ children, ...props }) {
              return (
                <td
                  className="px-3 py-1.5 border"
                  style={{ 
                    borderColor: 'var(--atlas-border-subtle)',
                    color: 'var(--atlas-text-secondary)'
                  }}
                  {...props}
                >
                  {children}
                </td>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
};

export default MarkdownRenderer;
