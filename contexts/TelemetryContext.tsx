"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export type TelemetryFrame = {
  type: 'initial_state' | 'update' | 'execution_flow' | 'batch' | 'connected' | 'heartbeat';
  // Actual backend format (execution_flow)
  source?: string;
  target?: string;
  duration_ms?: number;
  success?: boolean;
  conversation_id?: string;
  intent_type?: string;
  timestamp?: number;
  // Heartbeat fields
  status?: string;
  queue_size?: number;
  // Batch format
  events?: Array<{
    source: string;
    target: string;
    duration_ms?: number;
    success?: boolean;
  }>;
  // Legacy format
  active_traces?: any[];
  metrics?: Record<string, any>;
};

type TelemetryContextValue = {
  latestFrame: TelemetryFrame | null;
  connectionStatus: 'connecting' | 'open' | 'closed' | 'error' | 'stale';
  connectionHealth: {
    lastHeartbeat: number | null;
    reconnectAttempts: number;
    serverQueueSize: number | null;
  };
};

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

// Reconnection config
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_TIMEOUT = 15000; // Server sends every 10s, allow 5s buffer
const HEARTBEAT_CHECK_INTERVAL = 5000;

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [latestFrame, setLatestFrame] = useState<TelemetryFrame | null>(null);
  const [status, setStatus] = useState<TelemetryContextValue['connectionStatus']>('connecting');
  const [health, setHealth] = useState<TelemetryContextValue['connectionHealth']>({
    lastHeartbeat: null,
    reconnectAttempts: 0,
    serverQueueSize: null,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatCheckRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const lastMessageTimeRef = useRef<number>(Date.now());

  // Heartbeat monitor - detects stale connections
  const startHeartbeatMonitor = useCallback(() => {
    if (heartbeatCheckRef.current) {
      window.clearInterval(heartbeatCheckRef.current);
    }
    
    heartbeatCheckRef.current = window.setInterval(() => {
      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
      
      if (timeSinceLastMessage > HEARTBEAT_TIMEOUT) {
        console.warn(`[TelemetryProvider] ⚠️ No heartbeat for ${Math.round(timeSinceLastMessage / 1000)}s, connection may be stale`);
        setStatus('stale');
        
        // Force reconnect if connection appears stale
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log('[TelemetryProvider] Forcing reconnect due to stale connection');
          wsRef.current.close();
        }
      }
    }, HEARTBEAT_CHECK_INTERVAL);
  }, []);

  const stopHeartbeatMonitor = useCallback(() => {
    if (heartbeatCheckRef.current) {
      window.clearInterval(heartbeatCheckRef.current);
      heartbeatCheckRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      setStatus('connecting');
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://localhost:8000/v1/telemetry/stream`;
      
      console.log(`[TelemetryProvider] Connecting to ${wsUrl} (attempt delay: ${reconnectDelayRef.current}ms)`);
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('[TelemetryProvider] ✅ Connected');
          setStatus('open');
          
          // Reset reconnect delay on successful connection
          reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
          setHealth(prev => ({ ...prev, reconnectAttempts: 0 }));
          
          // Start heartbeat monitoring
          lastMessageTimeRef.current = Date.now();
          startHeartbeatMonitor();
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          
          // Update last message time for heartbeat monitoring
          lastMessageTimeRef.current = Date.now();
          
          // If we were stale, we're healthy again
          if (status === 'stale') {
            setStatus('open');
          }
          
          try {
            const data: TelemetryFrame = JSON.parse(event.data);
            
            // Track heartbeat-specific data
            if (data.type === 'heartbeat') {
              setHealth(prev => ({
                ...prev,
                lastHeartbeat: Date.now(),
                serverQueueSize: data.queue_size ?? prev.serverQueueSize,
              }));
              // Don't propagate heartbeats to latestFrame - they're internal
              return;
            }
            
            setLatestFrame(data);
          } catch (e) {
            console.error('[TelemetryProvider] Parse error:', e);
          }
        };

        ws.onerror = () => {
          if (isUnmounted) return;
          // WebSocket error events don't contain details for security reasons
          // Don't set error state here - let onclose handle reconnection
          console.debug('[TelemetryProvider] WebSocket error, will reconnect...');
        };

        ws.onclose = (event) => {
          if (isUnmounted) return;
          
          stopHeartbeatMonitor();
          
          // Calculate next reconnect delay with exponential backoff
          const nextDelay = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY
          );
          
          setHealth(prev => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1,
          }));
          
          console.debug(
            `[TelemetryProvider] Connection closed (code: ${event.code}), ` +
            `reconnecting in ${reconnectDelayRef.current}ms...`
          );
          setStatus('connecting');
          
          const timeout = window.setTimeout(() => {
            reconnectDelayRef.current = nextDelay;
            connect();
          }, reconnectDelayRef.current);
          reconnectTimeoutRef.current = timeout;
        };
      } catch (e) {
        console.error('[TelemetryProvider] Failed to create WebSocket:', e);
        setStatus('error');
        
        // Schedule retry with backoff
        const timeout = window.setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY
          );
          connect();
        }, reconnectDelayRef.current);
        reconnectTimeoutRef.current = timeout;
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      stopHeartbeatMonitor();
      if (reconnectTimeoutRef.current != null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [startHeartbeatMonitor, stopHeartbeatMonitor]);

  const value: TelemetryContextValue = {
    latestFrame,
    connectionStatus: status,
    connectionHealth: health,
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = () => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider');
  return ctx;
};
