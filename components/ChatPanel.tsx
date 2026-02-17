"use client";

import React, { useState, useRef, useEffect } from "react";
import { sendAtlasChat, clearConsoleSession, atlasChatStream } from "@/lib/atlasConsoleClient";
import { useConsole } from "./ConsoleProvider";
import { AgentResponsePanel } from "./AgentResponsePanel";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentResponse } from "@/lib/types";
import FeedbackPrompt from "./FeedbackPrompt";
import { TTSProviderFactory, type TTSProvider } from "@/lib/tts/providers";
import VoiceInputButton from "./VoiceInputButton";

const CHAT_PANEL_WIDTH_KEY = "atlas_console_chat_panel_width";
const CHAT_PANEL_COLLAPSED_KEY = "atlas_console_chat_panel_collapsed";
const DEFAULT_CHAT_PANEL_WIDTH = 460;
const COLLAPSED_CHAT_PANEL_WIDTH = 48;

const ChatPanel: React.FC = () => {
  const { activeSessionId, getMessages, addMessage, updateLastMessage, clearMessages } = useConsole();
  const messages = activeSessionId ? getMessages(activeSessionId) : [];
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState<number>(DEFAULT_CHAT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [attachments, setAttachments] = useState<Array<{name: string, type: string, content: string, size?: number}>>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // STT language mode (SSR-safe)
  const [languageMode, setLanguageMode] = useState<'auto'|'en'|'es'>('auto');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSpokenMessageRef = useRef<number>(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamingAudioContextRef = useRef<AudioContext | null>(null);
  const playbackBusRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const lastSpokenLengthRef = useRef(0);
  const currentMessageRef = useRef<{content: string; index: number} | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isSynthesizingRef = useRef<boolean>(false);

  // Load initial width and collapsed state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Load collapse state
    const collapsedStored = window.localStorage.getItem(CHAT_PANEL_COLLAPSED_KEY);
    const collapsed = collapsedStored === "true";
    setIsCollapsed(collapsed);
    
    // Load width
    const stored = window.localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed > 200 && parsed < 1000) {
        setWidth(parsed);
        const actualWidth = collapsed ? COLLAPSED_CHAT_PANEL_WIDTH : parsed;
        document.documentElement.style.setProperty("--chat-panel-width", `${actualWidth}px`);
      }
    } else {
      const actualWidth = collapsed ? COLLAPSED_CHAT_PANEL_WIDTH : DEFAULT_CHAT_PANEL_WIDTH;
      document.documentElement.style.setProperty("--chat-panel-width", `${actualWidth}px`);
    }
  }, []);

  // Load language mode (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem('stt_language');
    if (v === 'en' || v === 'es' || v === 'auto') setLanguageMode(v as 'auto'|'en'|'es');
  }, []);

  // Keep CSS variable in sync when width or collapsed state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const actualWidth = isCollapsed ? COLLAPSED_CHAT_PANEL_WIDTH : width;
    document.documentElement.style.setProperty("--chat-panel-width", `${actualWidth}px`);
    window.localStorage.setItem(CHAT_PANEL_WIDTH_KEY, String(width));
  }, [width, isCollapsed]);
  
  // Save collapsed state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_PANEL_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };


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

  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Track user scroll to prevent auto-scroll when user is viewing history
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setUserHasScrolled(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Only auto-scroll if user hasn't manually scrolled up
  useEffect(() => {
    if (!userHasScrolled) {
      scrollToBottom();
    }
  }, [messages, userHasScrolled]);

  // Streaming TTS - speak while response is being generated
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length === 0) return;

    const voiceEnabled = localStorage.getItem('voice_enabled') === 'true';
    if (!voiceEnabled) return;

    // Find the last assistant message
    const assistantMessages = messages.filter(m => m.type === 'assistant');
    if (assistantMessages.length === 0) return;

    const lastMessage = assistantMessages[assistantMessages.length - 1];
    const messageIndex = messages.indexOf(lastMessage);

    // Update current message ref
    currentMessageRef.current = { content: lastMessage.content, index: messageIndex };

    // Skip if this is a different message
    if (messageIndex !== lastSpokenMessageRef.current) {
      lastSpokenMessageRef.current = messageIndex;
      lastSpokenLengthRef.current = 0;
      isPlayingRef.current = false;
      
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    }

    // Don't process if already spoken or no content
    if (!lastMessage.content || lastMessage.content.length <= lastSpokenLengthRef.current) return;
    if (isPlayingRef.current) return;

    const speakNext = async () => {
      // Check if there's queued audio to play
      if (audioQueueRef.current.length > 0 && !isPlayingRef.current) {
        const audioData = audioQueueRef.current.shift()!;
        await playAudio(audioData);
        return;
      }
      
      // Don't synthesize if already synthesizing or no more content
      if (!currentMessageRef.current || isSynthesizingRef.current) return;
      if (currentMessageRef.current.content.length <= lastSpokenLengthRef.current) return;
      
      const provider = (localStorage.getItem('tts_provider') as TTSProvider) || 'cartesia';
      const remaining = currentMessageRef.current.content.slice(lastSpokenLengthRef.current);
      
      const sentenceMatch = /[^.!?]+[.!?]+\s*/.exec(remaining);
      let textToSpeak = '';
      
      if (sentenceMatch) {
        textToSpeak = sentenceMatch[0];
      } else if (!loading && remaining.length > 0) {
        textToSpeak = remaining;
      } else if (remaining.length > 150) {
        textToSpeak = remaining.slice(0, 100);
      } else {
        return;
      }
      
      if (!textToSpeak) return;
      
      lastSpokenLengthRef.current += textToSpeak.length;
      isSynthesizingRef.current = true;
      
      try {
        const ttsProvider = TTSProviderFactory.getProvider(provider);
        const audioData = await ttsProvider.synthesize(textToSpeak);
        isSynthesizingRef.current = false;
        
        // If already playing, queue this audio
        if (isPlayingRef.current) {
          audioQueueRef.current.push(audioData);
          // Trigger next synthesis immediately
          if (currentMessageRef.current && currentMessageRef.current.content.length > lastSpokenLengthRef.current) {
            speakNext();
          }
        } else {
          // Start playback (non-blocking) and immediately trigger next synthesis
          playAudio(audioData);
          // Trigger next synthesis while this plays
          if (currentMessageRef.current && currentMessageRef.current.content.length > lastSpokenLengthRef.current) {
            speakNext();
          }
        }
      } catch (error) {
        console.error('[TTS] Synthesis error:', error);
        isSynthesizingRef.current = false;
        isPlayingRef.current = false;
      }
    };
    
    const playAudio = async (audioData: ArrayBuffer) => {
      const provider = (localStorage.getItem('tts_provider') as TTSProvider) || 'cartesia';
      isPlayingRef.current = true;
      
      try {
        
        if (provider === 'cartesia') {
          if (!streamingAudioContextRef.current) {
            streamingAudioContextRef.current = new AudioContext();
          }

          const audioContext = streamingAudioContextRef.current;
          // Ensure a dedicated playback bus exists (for echo correlation + future output routing)
          if (!playbackBusRef.current) {
            playbackBusRef.current = audioContext.createGain();
            playbackBusRef.current.connect(audioContext.destination);
          }

          const audioBuffer = audioContext.createBuffer(1, audioData.byteLength / 4, 44100);
          const channelData = audioBuffer.getChannelData(0);
          const dataView = new DataView(audioData);
          
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] = dataView.getFloat32(i * 4, true);
          }
          
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          // Route through playback bus (enables echo-aware mic gating)
          if (playbackBusRef.current) {
            source.connect(playbackBusRef.current);
          } else {
            source.connect(audioContext.destination);
          }
          source.start(0);
          
          await new Promise<void>((resolve) => {
            source.onended = resolve;
          });
        } else {
          const blob = new Blob([audioData], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          
          await new Promise<void>((resolve) => {
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              resolve();
            };
            audio.play();
          });
        }
      } catch (error) {
        console.error('[TTS] Playback error:', error);
      } finally {
        isPlayingRef.current = false;
        // Immediately check for queued audio or trigger next synthesis
        speakNext();
      }
    };

    // Kick off initial synthesis and set up continuous processing
    speakNext();
    
    // Also trigger synthesis of next sentence when content changes
    if (!isSynthesizingRef.current && !isPlayingRef.current && lastMessage.content.length > lastSpokenLengthRef.current) {
      setTimeout(() => speakNext(), 0);
    }
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    // Use provided text or get from input state
    const trimmed = (messageText || input).trim();
    if (!trimmed || !activeSessionId || loading) return; // Prevent duplicate sends while loading

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

    // Add user message
    addMessage(activeSessionId, { type: 'user', content: trimmed });

    try {
      // Create initial empty assistant message for streaming
      addMessage(activeSessionId, { type: 'assistant', content: '' });
      
      let streamedContent = '';

      // Let ATLAS load conversation history from its memory layers
      // Session Memory (L1) automatically retrieves prior messages by session_id
      await atlasChatStream(
        { 
          query: messageContent, 
          session_id: activeSessionId
        },
        // onChunk - append to streaming message
        (chunk: string) => {
          console.log('[ChatPanel] Received chunk:', chunk);
          streamedContent += chunk;
          console.log('[ChatPanel] Total content now:', streamedContent.length, 'chars');
          updateLastMessage(activeSessionId, streamedContent);
        },
        // onToolCall
        (toolName: string, status: string) => {
          console.log(`[Stream] Tool: ${toolName} - ${status}`);
        },
        // onDone
        (sessionId: string) => {
          console.log(`[Stream] Complete, session: ${sessionId}`);
          setLoading(false);
        },
        // onError
        (error: string) => {
          setError(error);
          console.error("ATLAS streaming error:", error);
          setLoading(false);
        }
      );
    } catch (err: any) {
      setError(err.message || "Failed to send message");
      console.error("ATLAS chat error:", err);
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

  const handleCopyConversation = async () => {
    if (!activeSessionId || messages.length === 0) return;

    let conversationText = 'ATLAS Conversation\n';
    conversationText += '='.repeat(50) + '\n\n';

    messages.forEach((msg) => {
      if (msg.type === 'user') {
        conversationText += `User:\n${msg.content}\n\n`;
      } else if (msg.type === 'assistant') {
        const content = msg.content || (msg.response?.answer || '');
        conversationText += `ATLAS:\n${content}\n\n`;
      }
    });

    conversationText += '='.repeat(50) + '\n';
    conversationText += `Exported: ${new Date().toLocaleString()}`;

    try {
      await navigator.clipboard.writeText(conversationText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy conversation to clipboard');
    }
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
      <div className="h-full w-full flex flex-col border-l" style={{ backgroundColor: 'var(--atlas-bg-primary)', borderColor: 'var(--atlas-border-subtle)' }}>
      {!isCollapsed ? (
        <>
        {/* Header */}
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--atlas-border-subtle)', backgroundColor: 'var(--atlas-bg-elevated)' }}>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={toggleCollapse}
              className="text-gray-400 hover:text-gray-200 text-xs"
              title="Collapse chat panel"
            >
              ▶
            </button>
            <span className="text-xs text-gray-300 font-medium">Chat</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* ATLAS Badge */}
              <span 
                className="text-sm font-semibold"
                style={{
                  background: `linear-gradient(135deg, var(--atlas-accent-primary) 0%, var(--atlas-accent-secondary) 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                ATLAS
              </span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] transition-colors"
              aria-label="Clear conversation"
            >
              Clear
            </button>
          </div>
        </div>

      {/* Responses */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto atlas-scrollbar">
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

                  {/* User message */}
                  {message.type === 'user' && (
                    <div className="px-3 pb-4 flex justify-end">
                      <div 
                        className="text-sm px-4 py-2 rounded-lg max-w-[90%] select-text"
                        style={{
                          background: 'var(--atlas-bg-subtle)',
                          borderLeft: '3px solid var(--atlas-accent-primary)',
                          color: 'var(--atlas-text-primary)'
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  )}

                  {/* Agent response with full response object */}
                  {message.response && (
                    <div className="px-3 pb-4">
                      <AgentResponsePanel response={message.response} index={index} />
                      {/* Feedback prompt for active learning */}
                      {message.response.metadata?.feedback_request && (
                        <FeedbackPrompt
                          query={message.response.metadata.feedback_request.query}
                          predictedIntent={message.response.metadata.feedback_request.predicted_intent}
                          confidence={message.response.metadata.feedback_request.confidence}
                          message={message.response.metadata.feedback_request.message}
                          sessionId={activeSessionId || undefined}
                        />
                      )}
                    </div>
                  )}

                  {/* Agent message with just content (streaming) - VS Code style with Markdown */}
                  {message.type === 'assistant' && message.content && !message.response && (
                    <div className="px-4 pb-3">
                      <div 
                        className="rounded-lg px-4 py-2 text-sm inline-block max-w-[90%] select-text"
                        style={{
                          background: 'var(--atlas-bg-card)',
                          borderLeft: '3px solid var(--atlas-accent-secondary)',
                          color: 'var(--atlas-text-primary)'
                        }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
              type="button"
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
            <button
              type="button"
              onClick={handleCopyConversation}
              disabled={!activeSessionId || messages.length === 0}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                copySuccess 
                  ? 'bg-green-600 text-white' 
                  : 'hover:bg-[var(--atlas-bg-hover)] text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-primary)]'
              }`}
              title="Copy entire conversation to clipboard"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
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
            placeholder={activeSessionId ? (loading ? "Add follow-up or refinement..." : "Ask ATLAS anything...") : "Select a session to start"}
            className="atlas-textarea min-h-[60px] max-h-[120px] text-xs"
            disabled={!activeSessionId}
            rows={2}
          />
          <div className="flex gap-2">
            {/* Voice controls */}
            <VoiceToggleButton />
            <LanguageToggleButton
              value={languageMode}
              onChange={(m) => {
                setLanguageMode(m);
                if (typeof window !== 'undefined') window.localStorage.setItem('stt_language', m);
              }}
            />
            <VoiceInputButton
              languageMode={languageMode}
              onTranscript={(text, isFinal) => {
                console.log('[ChatPanel] onTranscript callback received:', { text, isFinal });
                
                if (!activeSessionId) {
                  console.log('[ChatPanel] No active session');
                  return;
                }
                
                // Always show the transcript in the input (interim or final)
                setInput(text);
                console.log('[ChatPanel] Input updated to:', text);
                
                // Auto-send immediately when final
                if (isFinal && text.trim()) {
                  console.log('[ChatPanel] Final transcript - auto-sending immediately');
                  handleSend(text);
                  setInput(''); // Clear input after sending
                  // Note: VoiceInputButton will auto-restart listening after ATLAS finishes speaking
                } else if (!isFinal) {
                  console.log('[ChatPanel] Interim transcript - showing in input field');
                }
              }}
              onInterrupt={() => {
                console.log('[ChatPanel] ⚡ User interrupted ATLAS - stopping playback');
                // Stop current TTS playback
                isPlayingRef.current = false;
                isSynthesizingRef.current = false;
                // Clear audio queue
                audioQueueRef.current = [];
                // Stop any playing audio
                if (streamingAudioContextRef.current) {
                  streamingAudioContextRef.current.close();
                  streamingAudioContextRef.current = null;
                }
                console.log('[ChatPanel] ✅ ATLAS stopped - ready for user input');
              }}
              autoRestart={true}
              pauseWhileSpeaking={isPlayingRef.current || loading}
              onError={(error) => {
                console.error('[ChatPanel] Voice input error:', error);
              }}
            />
            
            <button
              type="button"
              onClick={handleSend}
              disabled={!activeSessionId}
              className="flex-1 text-white font-medium rounded-lg px-4 py-2.5 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[inset_0_2px_0_0_rgba(255,255,255,0.3)]"
              style={{ background: 'var(--atlas-btn-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--atlas-btn-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--atlas-btn-primary)'}
            >
              {loading ? "Send Follow-up" : "Send"}
            </button>
          </div>
        </div>
      </div>
      </>
      ) : (
        <div className="flex flex-col h-full">
          <div className="px-3 py-2 bg-[#252526] border-b border-gray-700 flex items-center justify-center">
            <button
              onClick={toggleCollapse}
              className="text-gray-400 hover:text-gray-200 text-xs"
              title="Expand chat panel"
            >
              ◀
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

// Compact Voice Toggle Button Component
function VoiceToggleButton() {
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [showTooltip, setShowTooltip] = React.useState(false);
  
  React.useEffect(() => {
    const stored = localStorage.getItem('voice_enabled');
    setVoiceEnabled(stored === 'true');
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'voice_enabled') {
        setVoiceEnabled(e.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  const handleToggle = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    localStorage.setItem('voice_enabled', String(newState));
  };
  
  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="px-3 py-2.5 rounded-lg transition-all"
        style={{
          backgroundColor: voiceEnabled ? 'var(--atlas-accent-primary)' : 'var(--atlas-bg-subtle)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: voiceEnabled ? 'var(--atlas-accent-primary)' : 'var(--atlas-border)',
        }}
        title={voiceEnabled ? 'Voice enabled' : 'Voice disabled'}
      >
        <svg 
          className="w-5 h-5" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          style={{ color: voiceEnabled ? 'white' : 'var(--atlas-text-muted)' }}
        >
          {voiceEnabled ? (
            // Speaker icon (on)
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
          ) : (
            // Speaker muted icon (off)
            <>
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
              <path d="M14.5 6.5l3 3m0-3l-3 3" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>
      
      {/* Tooltip */}
      {showTooltip && (
        <div 
          className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs rounded whitespace-nowrap z-50"
          style={{
            backgroundColor: 'var(--atlas-bg-elevated)',
            border: '1px solid var(--atlas-border)',
            color: 'var(--atlas-text-primary)',
          }}
        >
          {voiceEnabled ? 'Voice: ON' : 'Voice: OFF'}
        </div>
      )}
    </div>
  );
}

export default ChatPanel;

// Language toggle (Auto / EN / ES)
function LanguageToggleButton({ value, onChange }: { value: 'auto'|'en'|'es'; onChange: (m: 'auto'|'en'|'es') => void }) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const next = (m: 'auto'|'en'|'es') => (m === 'auto' ? 'en' : m === 'en' ? 'es' : 'auto');
  const label = value === 'auto' ? 'AUTO' : value.toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => onChange(next(value))}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="px-2.5 py-2.5 rounded-lg border text-xs font-semibold"
        style={{
          backgroundColor: 'var(--atlas-bg-subtle)',
          borderColor: 'var(--atlas-border)',
          color: 'var(--atlas-text-primary)'
        }}
        title="Toggle STT language: Auto / EN / ES"
      >
        {label}
      </button>
      {showTooltip && (
        <div
          className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs rounded whitespace-nowrap z-50"
          style={{ backgroundColor: 'var(--atlas-bg-elevated)', border: '1px solid var(--atlas-border)', color: 'var(--atlas-text-primary)' }}
        >
          STT language: {value === 'auto' ? 'Auto-detect (EN/ES)' : (value === 'en' ? 'English' : 'Spanish')}
        </div>
      )}
    </div>
  );
}
