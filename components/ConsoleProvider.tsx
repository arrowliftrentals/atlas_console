'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ConsoleSession, AgentResponse } from '@/lib/types';
import { fetchConsoleSessions, createConsoleSession } from '@/lib/atlasConsoleClient';
import { getStoredSessionId, storeSessionId } from '@/lib/session';

export interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  response?: AgentResponse;
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

  const addMessage = (sessionId: string, message: ChatMessage) => {
    setMessagesBySession(prev => {
      const updated = new Map(prev);
      const existing = updated.get(sessionId) || [];
      const newMessages = [...existing, message];
      // Keep only last 100 messages per session to prevent memory bloat
      const trimmed = newMessages.slice(-100);
      updated.set(sessionId, trimmed);
      return updated;
    });
  };

  const updateLastMessage = (sessionId: string, content: string, response?: AgentResponse) => {
    setMessagesBySession(prev => {
      const updated = new Map(prev);
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
      return updated;
    });
  };

  const getMessages = (sessionId: string): ChatMessage[] => {
    return messagesBySession.get(sessionId) || [];
  };

  const clearMessages = (sessionId: string) => {
    setMessagesBySession(prev => {
      const updated = new Map(prev);
      updated.delete(sessionId);
      return updated;
    });
  };

  const createSession = async () => {
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
  };

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

  return (
    <ConsoleContext.Provider
      value={{
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
        getMessages,
        clearMessages,
        selectedFile,
        setSelectedFile,
      }}
    >
      {children}
    </ConsoleContext.Provider>
  );
}
