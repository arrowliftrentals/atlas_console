'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConsoleSession, AgentResponse } from '@/lib/types';
import { listConsoleSessions } from '@/lib/atlasConsoleClient';

export interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  response?: AgentResponse;
}

interface ConsoleContextType {
  sessions: ConsoleSession[];
  activeSessionId: string | null;
  loadingSessions: boolean;
  error: string | null;
  refreshSessions: () => Promise<void>;
  setActiveSessionId: (id: string | null) => void;
  // Chat message state
  messagesBySession: Map<string, ChatMessage[]>;
  addMessage: (sessionId: string, message: ChatMessage) => void;
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Map<string, ChatMessage[]>>(new Map());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const refreshSessions = async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const data = await listConsoleSessions();
      setSessions(data.sessions);
      
      // Auto-select first session if none selected
      if (!activeSessionId && data.sessions.length > 0) {
        setActiveSessionId(data.sessions[0].session_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
      console.error('Error loading sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const addMessage = (sessionId: string, message: ChatMessage) => {
    setMessagesBySession(prev => {
      const updated = new Map(prev);
      const existing = updated.get(sessionId) || [];
      updated.set(sessionId, [...existing, message]);
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

  useEffect(() => {
    refreshSessions();
  }, []);

  return (
    <ConsoleContext.Provider
      value={{
        sessions,
        activeSessionId,
        loadingSessions,
        error,
        refreshSessions,
        setActiveSessionId,
        messagesBySession,
        addMessage,
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
