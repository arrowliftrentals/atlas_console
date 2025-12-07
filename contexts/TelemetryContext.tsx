"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type TelemetryFrame = {
  type: 'initial_state' | 'update';
  active_traces?: any[];
  metrics?: Record<string, any>;
};

type TelemetryContextValue = {
  latestFrame: TelemetryFrame | null;
  connectionStatus: 'connecting' | 'open' | 'closed' | 'error';
};

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [latestFrame, setLatestFrame] = useState<TelemetryFrame | null>(null);
  const [status, setStatus] = useState<TelemetryContextValue['connectionStatus']>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      setStatus('connecting');
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://localhost:8000/v1/telemetry/stream`;
      
      console.log('[TelemetryProvider] Connecting to', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        console.log('[TelemetryProvider] ✅ Connected');
        setStatus('open');
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const data = JSON.parse(event.data);
          setLatestFrame(data);
        } catch (e) {
          console.error('[TelemetryProvider] Parse error:', e);
        }
      };

      ws.onerror = (error) => {
        if (isUnmounted) return;
        console.error('[TelemetryProvider] ❌ Error:', error);
        setStatus('error');
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        console.log('[TelemetryProvider] Connection closed, reconnecting in 2s...');
        setStatus('closed');
        
        const timeout = window.setTimeout(connect, 2000);
        reconnectTimeoutRef.current = timeout;
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current != null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const value: TelemetryContextValue = {
    latestFrame,
    connectionStatus: status,
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = () => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider');
  return ctx;
};
