
import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface EnhancedCodeBlockProps {
  code: string;
  language: string;
  filename?: string;
  showLineNumbers?: boolean;
}

const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({
  code,
  language,
  filename,
  showLineNumbers = true
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div 
      className="my-3 rounded-lg overflow-hidden border group"
      style={{
        backgroundColor: 'var(--atlas-bg-elevated)',
        borderColor: 'var(--atlas-border)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{
          backgroundColor: 'var(--atlas-bg-subtle)',
          borderColor: 'var(--atlas-border)'
        }}
      >
        <div className="flex items-center gap-2">
          {filename && (
            <span 
              className="text-xs font-medium"
              style={{ color: 'var(--atlas-text-primary)' }}
            >
              {filename}
            </span>
          )}
          <span 
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{
              backgroundColor: 'var(--atlas-bg-hover)',
              color: 'var(--atlas-text-secondary)'
            }}
          >
            {language}
          </span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--atlas-bg-hover)]"
          style={{ color: copied ? 'var(--atlas-success)' : 'var(--atlas-text-muted)' }}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            padding: '12px',
            backgroundColor: 'var(--atlas-bg-elevated)',
            fontSize: '13px'
          }}
          lineNumberStyle={{
            color: 'var(--atlas-text-muted)',
            minWidth: '2.5em'
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default EnhancedCodeBlock;
