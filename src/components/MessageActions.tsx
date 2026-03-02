
import React, { useState } from 'react';

interface MessageActionsProps {
  messageContent: string;
  messageId: string;
  onRegenerate?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  showInsert?: boolean;
  onInsert?: () => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({
  messageContent,
  messageId,
  onRegenerate,
  onFeedback,
  showInsert = false,
  onInsert
}) => {
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedbackGiven(type);
    onFeedback?.(type);
  };

  return (
    <div 
      className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      style={{ fontSize: '12px' }}
    >
      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--atlas-bg-hover)] transition-colors"
        style={{ color: copied ? 'var(--atlas-success)' : 'var(--atlas-text-muted)' }}
        title="Copy message"
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

      {/* Regenerate Button */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--atlas-bg-hover)] transition-colors"
          style={{ color: 'var(--atlas-text-muted)' }}
          title="Regenerate response"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Regenerate</span>
        </button>
      )}

      {/* Divider */}
      <div className="w-px h-4 bg-[var(--atlas-border)]" />

      {/* Thumbs Up */}
      <button
        onClick={() => handleFeedback('positive')}
        className="p-1.5 rounded hover:bg-[var(--atlas-bg-hover)] transition-colors"
        style={{ 
          color: feedbackGiven === 'positive' ? 'var(--atlas-success)' : 'var(--atlas-text-muted)'
        }}
        title="Good response"
      >
        <svg className="w-3.5 h-3.5" fill={feedbackGiven === 'positive' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      </button>

      {/* Thumbs Down */}
      <button
        onClick={() => handleFeedback('negative')}
        className="p-1.5 rounded hover:bg-[var(--atlas-bg-hover)] transition-colors"
        style={{ 
          color: feedbackGiven === 'negative' ? 'var(--atlas-error)' : 'var(--atlas-text-muted)'
        }}
        title="Bad response"
      >
        <svg className="w-3.5 h-3.5" fill={feedbackGiven === 'negative' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
        </svg>
      </button>

      {/* Insert at Cursor (optional for code) */}
      {showInsert && onInsert && (
        <>
          <div className="w-px h-4 bg-[var(--atlas-border)]" />
          <button
            onClick={onInsert}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--atlas-bg-hover)] transition-colors"
            style={{ color: 'var(--atlas-text-muted)' }}
            title="Insert at cursor"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Insert</span>
          </button>
        </>
      )}
    </div>
  );
};

export default MessageActions;
