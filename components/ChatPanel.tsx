"use client";

import React, { useState, useRef, useEffect } from "react";
import { sendAtlasChat, clearConsoleSession } from "@/lib/atlasConsoleClient";
import { useConsole } from "./ConsoleProvider";
import { AgentResponsePanel } from "./AgentResponsePanel";
import ProgressIndicator from "./ProgressIndicator";
import type { AgentResponse } from "@/lib/types";

const CHAT_PANEL_WIDTH_KEY = "atlas_console_chat_panel_width";
const DEFAULT_CHAT_PANEL_WIDTH = 460;

const ChatPanel: React.FC = () => {
  const { activeSessionId, getMessages, addMessage, clearMessages } = useConsole();
  const messages = activeSessionId ? getMessages(activeSessionId) : [];
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [width, setWidth] = useState<number>(DEFAULT_CHAT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null); // null = checking, true = healthy, false = unhealthy
  const [attachments, setAttachments] = useState<Array<{name: string, type: string, content: string, size?: number}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial width from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed > 200 && parsed < 1000) {
        setWidth(parsed);
        document.documentElement.style.setProperty("--chat-panel-width", `${parsed}px`);
      }
    } else {
      document.documentElement.style.setProperty("--chat-panel-width", `${DEFAULT_CHAT_PANEL_WIDTH}px`);
    }
  }, []);

  // Keep CSS variable in sync when width changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.style.setProperty("--chat-panel-width", `${width}px`);
    window.localStorage.setItem(CHAT_PANEL_WIDTH_KEY, String(width));
  }, [width]);

  // Health check - poll backend immediately and every 30 seconds
  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Check both health endpoint and try a simple chat endpoint verification
        const healthResponse = await fetch('http://localhost:8000/health');
        if (healthResponse.ok) {
          setIsHealthy(true);
        } else {
          setIsHealthy(false);
        }
      } catch (err) {
        setIsHealthy(false);
      }
    };

    // Check immediately on mount
    checkHealth();

    // Then check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !activeSessionId) return;

    // Build message with attachments as context
    let messageContent = trimmed;
    if (attachments.length > 0) {
      messageContent += '\n\n--- Attached Context ---\n';
      attachments.forEach(att => {
        messageContent += `\nFile: ${att.name}`;
        if (att.size) {
          const sizeMB = (att.size / (1024 * 1024)).toFixed(2);
          messageContent += ` (${sizeMB} MB)`;
        }
        messageContent += '\n';
        if (att.type.startsWith('image/')) {
          messageContent += `[Image data: ${att.content.substring(0, 100)}...]\n`;
        } else if (att.type.startsWith('video/')) {
          const sizeMB = ((att.size || 0) / (1024 * 1024)).toFixed(2);
          messageContent += `[Video file: ${att.type}, ${sizeMB} MB]\n`;
        } else {
          messageContent += `${att.content}\n`;
        }
      });
    }

    setInput("");
    setAttachments([]); // Clear attachments after sending
    setLoading(true);
    setError(null);

    // Check if this is a long-running task
    const longTaskKeywords = [
      "implement", "create", "build", "develop", "write", "generate",
      "refactor", "analyze all", "complete", "full", "entire system"
    ];
    const isLongTask = longTaskKeywords.some(keyword => 
      trimmed.toLowerCase().includes(keyword)
    );

    if (isLongTask) {
      setShowProgress(true);
    }

    // Add user message
    addMessage(activeSessionId, { type: 'user', content: trimmed });

    try {
      const response = await sendAtlasChat(messageContent, activeSessionId);
      // Add assistant response
      addMessage(activeSessionId, { type: 'assistant', content: response.answer, response });
      // Mark as healthy on successful chat
      setIsHealthy(true);
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      console.error("ATLAS chat error:", err);
      // Mark as unhealthy on chat error
      setIsHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    if (activeSessionId) {
      try {
        // Clear backend session history
        await clearConsoleSession(activeSessionId);
        // Clear frontend message cache
        clearMessages(activeSessionId);
        setError(null);
      } catch (err: any) {
        console.error('Error clearing session:', err);
        setError('Failed to clear session');
      }
    }
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setError(`File "${file.name}" is too large (${sizeMB} MB). Maximum size is 20 MB.`);
        continue;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type || 'text/plain',
          content: content,
          size: file.size
        }]);
      };

      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 h-full cursor-col-resize hover:bg-yellow-300 transition-colors duration-200 delay-[400ms] ${
          isResizing ? "bg-yellow-300" : "bg-transparent"
        }`}
        style={{ flexShrink: 0 }}
      />
      
      {/* Chat Panel Content */}
      <div className="h-full w-full flex flex-col bg-black border-l border-[var(--atlas-border-subtle)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--atlas-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status Indicator - Green for operational, Red for not, Yellow for checking */}
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${
              isHealthy === null ? 'bg-yellow-500' : 
              isHealthy ? 'bg-green-500' : 'bg-red-500'
            } animate-pulse`}></div>
          </div>
          {/* ATLAS Badge */}
          <span className="text-sm font-semibold text-[var(--atlas-text-primary)]">ATLAS</span>
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] transition-colors"
          aria-label="Clear conversation"
        >
          Clear
        </button>
      </div>

      {/* Responses */}
      <div className="flex-1 overflow-y-auto atlas-scrollbar">
        {!activeSessionId ? (
          <div className="flex items-center justify-center h-full text-center text-xs text-[var(--atlas-text-muted)]">
            <div>
              <div className="mb-2">No Session Selected</div>
              <div>Select a session from the sidebar to start</div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-xs text-[var(--atlas-text-muted)]">
            <div>Interactive chat window</div>
          </div>
        ) : (
          <div>
            {messages.map((message, index) => {
              // Show restore point before each user message
              const showRestorePoint = message.type === 'user';
              
              return (
                <div key={index}>
                  {/* Restore point separator - shown before each user message */}
                  {showRestorePoint && (
                    <div className="flex items-center px-3 py-3">
                      <button
                        onClick={async () => {
                          if (!activeSessionId) return;
                          const confirmed = window.confirm(`Restore conversation to this point? This will remove ${messages.length - index} message(s).`);
                          if (confirmed) {
                            try {
                              await clearConsoleSession(activeSessionId);
                              const messagesToKeep = messages.slice(0, index);
                              clearMessages(activeSessionId);
                              messagesToKeep.forEach(msg => addMessage(activeSessionId, msg));
                            } catch (err) {
                              console.error('Failed to restore:', err);
                            }
                          }
                        }}
                        className="flex items-center transition-opacity"
                        title="Restore to this point"
                      >
                        <svg className="w-4 h-4 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-primary)] mr-2 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                      <div className="flex-1 border-t border-dashed border-[var(--atlas-text-muted)] opacity-40"></div>
                    </div>
                  )}

                  {/* User message as button */}
                  {message.type === 'user' && (
                    <div className="px-3 pb-4 flex justify-end">
                      <button 
                        onClick={async () => {
                          if (!activeSessionId) return;
                          const confirmed = window.confirm(`Restore conversation to this point? This will remove ${messages.length - index} message(s).`);
                          if (confirmed) {
                            try {
                              await clearConsoleSession(activeSessionId);
                              const messagesToKeep = messages.slice(0, index);
                              clearMessages(activeSessionId);
                              messagesToKeep.forEach(msg => addMessage(activeSessionId, msg));
                            } catch (err) {
                              console.error('Failed to restore:', err);
                            }
                          }
                        }}
                        className="bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm px-4 py-2 rounded-lg max-w-[90%] text-left transition-colors"
                        title="Click to restore conversation to this point"
                      >
                        {message.content}
                      </button>
                    </div>
                  )}

                  {/* Agent response */}
                  {message.response && (
                    <div className="px-3 pb-4">
                      <AgentResponsePanel response={message.response} index={index} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {loading && showProgress && activeSessionId && (
          <ProgressIndicator 
            sessionId={activeSessionId}
            onComplete={() => setShowProgress(false)}
          />
        )}
        
        {loading && !showProgress && (
          <div className="flex items-center justify-center py-4">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[var(--atlas-border-subtle)]">
        <div className="flex flex-col gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,text/*,.pdf,.doc,.docx,.json,.xml,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {/* Attachment toolbar */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleFileAttach}
              disabled={!activeSessionId}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--atlas-bg-hover)] text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Attach files, images, videos, or context"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>Attach</span>
            </button>
          </div>

          {/* Attachments display */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-[var(--atlas-bg-elevated)] border border-[var(--atlas-border-subtle)] rounded px-2 py-1 text-xs"
                >
                  {att.type.startsWith('image/') ? (
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : att.type.startsWith('video/') ? (
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="text-[var(--atlas-text-primary)]">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="text-[var(--atlas-text-muted)] hover:text-red-400 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeSessionId ? "Ask ATLAS anything..." : "Select a session to start"}
            className="atlas-textarea min-h-[60px] max-h-[120px] text-xs"
            disabled={loading || !activeSessionId}
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || !activeSessionId}
              className="flex-1 atlas-btn-primary text-xs py-1.5"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ChatPanel;
