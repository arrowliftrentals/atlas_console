'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { ConsoleSession, AgentResponse } from '@/lib/types';

const EMPTY_MESSAGES: ChatMessage[] = [];
import { fetchConsoleSessions, createConsoleSession } from '@/lib/atlasConsoleClient';
import type { ThinkingStep } from '@/lib/atlasConsoleClient';
import { getStoredSessionId, storeSessionId } from '@/lib/session';

export interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  response?: AgentResponse;
  thinkingSteps?: ThinkingStep[];
  tasks?: Array<{
    id: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    tool?: string;
    startTime?: number;
    endTime?: number;
  }>;
}

interface ConsoleContextType {
  sessions: ConsoleSession[];
  activeSessionId: string | null;
  loadingSessions: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  createSession: () => Promise<void>;
  setActiveSessionId: (id: string | null) => void;
  // Chat message state
  messagesBySession: Map<string, ChatMessage[]>;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  updateLastMessage: (sessionId: string, content: string, response?: AgentResponse) => void;
  updateLastMessageThinking: (sessionId: string, step: ThinkingStep) => void;
  getMessages: (sessionId: string) => ChatMessage[];
  clearMessages: (sessionId: string) => void;
  // File viewer state
  selectedFile: string | null;
  setSelectedFile: (filePath: string | null) => void;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

export const useConsole = () => {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('useConsole must be used within ConsoleProvider');
  return ctx;
};

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ConsoleSession[]>([]);
  
  // Initialize as null to avoid hydration mismatch
  // localStorage will be read in useEffect after mount
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Map<string, ChatMessage[]>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // --- Streaming throttle: buffer high-frequency updates, flush at ~150ms ---
  const pendingThinkingRef = useRef<Map<string, ThinkingStep[]>>(new Map());
  const pendingContentRef = useRef<Map<string, { content: string; response?: AgentResponse }>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingUpdates = useCallback(() => {
    const hasPendingThinking = pendingThinkingRef.current.size > 0;
    const hasPendingContent = pendingContentRef.current.size > 0;
    if (!hasPendingThinking && !hasPendingContent) return;

    setMessagesBySession(prev => {
      const updated = new Map(prev);

      // Flush buffered thinking steps
      for (const [sessionId, steps] of pendingThinkingRef.current) {
        const existing = updated.get(sessionId) || [];
        if (existing.length > 0) {
          const lastIndex = existing.length - 1;
          const lastMsg = existing[lastIndex];
          if (lastMsg.type === 'assistant') {
            const updatedMessages = [...existing];
            updatedMessages[lastIndex] = {
              ...lastMsg,
              thinkingSteps: [...(lastMsg.thinkingSteps || []), ...steps],
            };
            updated.set(sessionId, updatedMessages);
          }
        }
      }

      // Flush buffered content updates
      for (const [sessionId, { content, response }] of pendingContentRef.current) {
        const existing = updated.get(sessionId) || [];
        if (existing.length > 0) {
          const lastIndex = existing.length - 1;
          const updatedMessages = [...existing];
          updatedMessages[lastIndex] = {
            ...updatedMessages[lastIndex],
            content,
            response,
          };
          updated.set(sessionId, updatedMessages);
        }
      }

      pendingThinkingRef.current.clear();
      pendingContentRef.current.clear();
      return updated;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return; // already scheduled
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushPendingUpdates();
    }, 150);
  }, [flushPendingUpdates]);

  // Cleanup flush timer on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushPendingUpdates(); // final flush
      }
    };
  }, [flushPendingUpdates]);
  
  // Use ref to track latest activeSessionId for refreshSessions
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Hydration effect: restore session from localStorage after mount
  useEffect(() => {
    if (!hasHydrated) {
      const stored = getStoredSessionId();
      console.log('[ConsoleProvider] Hydration - stored session:', stored);
      if (stored) {
        setActiveSessionIdState(stored);
      }
      setHasHydrated(true);
    }
  }, [hasHydrated]);

  // Wrapper to persist activeSessionId to localStorage whenever it changes
  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
    if (id) {
      storeSessionId(id);
    }
  }, []);

  // Simplified refreshSessions - only fetches data, no session selection logic
  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const data = await fetchConsoleSessions();
      console.log('[ConsoleProvider] Fetched sessions:', data.sessions.length, data.sessions.map(s => s.session_id));
      
      // Deduplicate sessions by session_id to prevent React key warnings
      const uniqueSessions = data.sessions.reduce((acc, session) => {
        if (!acc.find(s => s.session_id === session.session_id)) {
          acc.push(session);
        }
        return acc;
      }, [] as ConsoleSession[]);
      
      if (uniqueSessions.length < data.sessions.length) {
        console.warn(`[ConsoleProvider] Removed ${data.sessions.length - uniqueSessions.length} duplicate sessions`);
      }
      
      setSessions(uniqueSessions);
      
      // Use ref to get current activeSessionId without adding it to dependencies
      const currentActiveId = activeSessionIdRef.current;
      
      // If no sessions exist at all, create a default one
      if (data.sessions.length === 0) {
        console.log('[ConsoleProvider] No sessions found, creating default');
        const newSession = await createConsoleSession({
          session_id: `session_${Date.now()}`,
        });
        setActiveSessionId(newSession.session_id);
        // Fetch again to update sessions list
        const updatedData = await fetchConsoleSessions();
        setSessions(updatedData.sessions);
      } else if (!currentActiveId || !data.sessions.some(s => s.session_id === currentActiveId)) {
        // If current activeSessionId is invalid or null, set to first session
        console.log('[ConsoleProvider] Setting active session to first available:', data.sessions[0].session_id);
        setActiveSessionId(data.sessions[0].session_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
      console.error('[ConsoleProvider] Error loading sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [setActiveSessionId]); // Removed activeSessionId from deps, using ref instead

  // Removed complex validation effect - all logic now in refreshSessions

  const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setMessagesBySession(prev => {
      const updated = new Map(prev);
      const existing = updated.get(sessionId) || EMPTY_MESSAGES;
      const newMessages = [...existing, message];
      // Keep only last 100 messages per session to prevent memory bloat
      const trimmed = newMessages.slice(-100);
      updated.set(sessionId, trimmed);
      return updated;
    });
  }, []);

  const updateLastMessage = useCallback((sessionId: string, content: string, response?: AgentResponse) => {
    pendingContentRef.current.set(sessionId, { content, response });
    scheduleFlush();
  }, [scheduleFlush]);

  const updateLastMessageThinking = useCallback((sessionId: string, step: ThinkingStep) => {
    const existing = pendingThinkingRef.current.get(sessionId) || [];
    existing.push(step);
    pendingThinkingRef.current.set(sessionId, existing);
    scheduleFlush();
  }, [scheduleFlush]);

  const getMessages = useCallback((sessionId: string): ChatMessage[] => {
    return messagesBySession.get(sessionId) ?? EMPTY_MESSAGES;
  }, [messagesBySession]);

  const clearMessages = useCallback((sessionId: string) => {
    setMessagesBySession(prev => {
      const updated = new Map(prev);
      updated.delete(sessionId);
      return updated;
    });
  }, []);

  const createSession = useCallback(async () => {
    try {
      const sessionId = `session_${Date.now()}`;
      const newSession = await createConsoleSession({ session_id: sessionId });
      
      // Add to local state immediately
      const createdSession: ConsoleSession = {
        session_id: newSession.session_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setSessions(prev => [createdSession, ...prev]);
      setActiveSessionId(newSession.session_id);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
      throw err;
    }
  }, [setActiveSessionId]);

  // Initial session load after hydration
  useEffect(() => {
    if (hasHydrated) {
      console.log('[ConsoleProvider] Hydrated, calling refreshSessions');
      refreshSessions();
    }
  }, [hasHydrated, refreshSessions]); // Run after hydration or when refreshSessions changes
  
  // Guarantee: if we have sessions but no active session, select first
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId && !loadingSessions) {
      console.log('[ConsoleProvider] GUARANTEE: Forcing first session selection:', sessions[0].session_id);
      setActiveSessionId(sessions[0].session_id);
    }
  }, [sessions, activeSessionId, loadingSessions, setActiveSessionId]);

  const contextValue = useMemo(() => ({
    sessions,
    activeSessionId,
    loadingSessions,
    error,
    refreshSessions,
    createSession,
    setActiveSessionId,
    messagesBySession,
    addMessage,
    updateLastMessage,
    updateLastMessageThinking,
    getMessages,
    clearMessages,
    selectedFile,
    setSelectedFile,
  }), [
    sessions,
    activeSessionId,
    loadingSessions,
    error,
    refreshSessions,
    createSession,
    setActiveSessionId,
    messagesBySession,
    addMessage,
    updateLastMessage,
    updateLastMessageThinking,
    getMessages,
    clearMessages,
    selectedFile,
    setSelectedFile,
  ]);

  return (
    <ConsoleContext.Provider value={contextValue}>
      {children}
    </ConsoleContext.Provider>
  );
}
