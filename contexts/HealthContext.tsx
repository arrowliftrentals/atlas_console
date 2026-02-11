'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

type HealthState = 'connected' | 'disconnected' | 'error';

/**
 * Silent fetch wrapper with built-in timeout that suppresses all errors.
 * Returns null on any error (including abort) to avoid console spam.
 * Uses custom AbortController to prevent AbortSignal.timeout() browser issues.
 */
async function silentFetch(url: string, timeoutMs: number = 2000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch {
    // Silently ignore ALL errors (AbortError, network errors, etc.)
    // This prevents "Fetch is aborted" console spam
    clearTimeout(timeoutId);
    return null;
  }
}

interface HealthStatus {
  backend: HealthState;          // /health endpoint
  chat: HealthState;             // /api/atlas/chat endpoint (ATLAS chat)
  architecture: HealthState;      // /v1/architecture/graph endpoint
  telemetry: HealthState;         // WebSocket connection
  logs: HealthState;             // /v1/atlas/logs endpoint
  skills: HealthState;           // /v1/atlas/skills endpoint
  learning: HealthState;         // /api/learning/patterns endpoint
  tasks: HealthState;            // Tasks/goals functionality
  meta: HealthState;             // /v1/meta/assess endpoint
  sandbox: HealthState;          // /api/sandbox/health endpoint
  lastCheck: number;
}

interface HealthContextType {
  health: HealthStatus;
  refreshHealth: () => void;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

const BACKEND_URL = 'http://localhost:8000';
const CHECK_INTERVAL = 15000; // 15 seconds between checks
const BACKEND_TIMEOUT = 10000; // 10s timeout for backend - generous for loaded systems
const REQUIRED_FAILURES_FOR_OFFLINE = 4; // Require 4 consecutive failures (1 minute) before showing offline
const REQUIRED_SUCCESS_FOR_ONLINE = 1; // Single success is enough to show online

export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthStatus>({
    backend: 'disconnected',
    chat: 'disconnected',
    architecture: 'disconnected',
    telemetry: 'disconnected',
    logs: 'disconnected',
    skills: 'disconnected',
    learning: 'disconnected',
    tasks: 'disconnected',
    meta: 'disconnected',
    sandbox: 'disconnected',
    lastCheck: Date.now(),
  });
  
  // Track consecutive failures using ref (avoids state update complexity)
  const failureCountRef = useRef<Record<string, number>>({});

  const checkHealth = useCallback(async () => {
    const newHealth: HealthStatus = {
      backend: 'disconnected',
      chat: 'disconnected',
      architecture: 'disconnected',
      telemetry: 'disconnected',
      logs: 'disconnected',
      skills: 'disconnected',
      learning: 'disconnected',
      tasks: 'disconnected',
      meta: 'disconnected',
      sandbox: 'disconnected',
      lastCheck: Date.now(),
    };

    // Run all health checks in parallel for faster response
    // Using silentFetch with built-in timeout to suppress AbortError console spam
    const checks = await Promise.allSettled([
      // Priority 1: Backend health (most critical) - generous timeout for loaded systems
      silentFetch(`${BACKEND_URL}/health`, BACKEND_TIMEOUT)
        .then(res => ({ key: 'backend' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      // Priority 2: Chat endpoint (same as backend for stability)
      silentFetch(`${BACKEND_URL}/health`, BACKEND_TIMEOUT)
        .then(res => ({ key: 'chat' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      // Priority 3: Architecture
      silentFetch(`${BACKEND_URL}/v1/architecture/graph`, 2000)
        .then(res => ({ key: 'architecture' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      // Lower priority checks
      silentFetch(`${BACKEND_URL}/v1/atlas/logs`, 2000)
        .then(res => ({ key: 'logs' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      silentFetch(`${BACKEND_URL}/v1/atlas/skills`, 2000)
        .then(res => ({ key: 'skills' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      // Learning endpoint
      silentFetch(`${BACKEND_URL}/api/learning/patterns`, 2000)
        .then(res => ({ key: 'learning' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      // Tasks endpoint (L8 Planning Memory)
      silentFetch(`${BACKEND_URL}/v1/atlas/tasks`, 2000)
        .then(res => ({ key: 'tasks' as const, status: res?.ok ? 'connected' as const : 'disconnected' as const })),
      
      silentFetch(`${BACKEND_URL}/v1/meta/latest`, 2000)
        .then(res => ({
          key: 'meta' as const,
          // 404 is OK - means no assessments exist yet, endpoint is working
          // null response means timeout/error -> disconnected
          status: res ? ((res.ok || res.status === 404) ? 'connected' as const : 'error' as const) : 'disconnected' as const
        })),
      
      // Sandbox health - needs special handling for JSON parsing
      (async () => {
        const res = await silentFetch(`${BACKEND_URL}/api/sandbox/health`, 2000);
        if (!res) return { key: 'sandbox' as const, status: 'disconnected' as const };
        try {
          const data = await res.json();
          return {
            key: 'sandbox' as const,
            status: (data.status === 'healthy' && data.docker_available) ? 'connected' as const : 'error' as const
          };
        } catch {
          return { key: 'sandbox' as const, status: 'disconnected' as const };
        }
      })(),
    ]);

    // Process results into temporary state
    const rawHealth: Partial<HealthStatus> = {};
    checks.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        rawHealth[result.value.key] = result.value.status;
      }
    });

    // Telemetry WebSocket check - check if WebSocket is actually open
    const wsState = typeof window !== 'undefined' ? (window as any).__atlasWebSocketState : null;
    if (wsState && wsState.connected) {
      rawHealth.telemetry = 'connected';
    } else if (wsState && wsState.error) {
      rawHealth.telemetry = 'error';
    } else {
      rawHealth.telemetry = 'disconnected';
    }

    // Apply asymmetric debouncing: quick online, slow offline
    setHealth(prev => {
      const updatedHealth = { ...prev, lastCheck: Date.now() };
      
      Object.keys(rawHealth).forEach((key) => {
        const typedKey = key as keyof HealthStatus;
        if (typedKey === 'lastCheck') return;
        
        const currentState = rawHealth[typedKey] as HealthState;
        
        if (currentState === 'connected') {
          // Single success = show online immediately, reset failure count
          updatedHealth[typedKey] = 'connected';
          failureCountRef.current[key] = 0;
        } else {
          // Increment failure count
          failureCountRef.current[key] = (failureCountRef.current[key] || 0) + 1;
          
          // Only show offline after enough consecutive failures
          if (failureCountRef.current[key] >= REQUIRED_FAILURES_FOR_OFFLINE) {
            updatedHealth[typedKey] = currentState;
          }
          // Otherwise keep previous state (stays green)
        }
      });
      
      return updatedHealth;
    });
  }, []);

  const updateTelemetryStatus = useCallback((connected: boolean) => {
    setHealth(prev => ({ ...prev, telemetry: connected ? 'connected' : 'disconnected' }));
  }, []);

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up interval
    const interval = setInterval(checkHealth, CHECK_INTERVAL);

    // Listen for telemetry status updates from window events
    const handleTelemetryStatus = (event: CustomEvent) => {
      updateTelemetryStatus(event.detail.connected);
    };

    window.addEventListener('telemetry-status', handleTelemetryStatus as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('telemetry-status', handleTelemetryStatus as EventListener);
    };
  }, [checkHealth, updateTelemetryStatus]);

  return (
    <HealthContext.Provider value={{ health, refreshHealth: checkHealth }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within HealthProvider');
  }
  return context;
}
