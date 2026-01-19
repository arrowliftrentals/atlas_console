'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type HealthState = 'connected' | 'disconnected' | 'error';

interface HealthStatus {
  backend: HealthState;          // /health endpoint
  chat: HealthState;             // /api/atlas/chat endpoint (ATLAS chat)
  architecture: HealthState;      // /v1/architecture/graph endpoint
  telemetry: HealthState;         // WebSocket connection
  logs: HealthState;             // /v1/atlas/logs endpoint
  skills: HealthState;           // /v1/atlas/skills endpoint
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
const CHECK_INTERVAL = 10000; // Check every 10 seconds
const REQUIRED_CONSISTENT_CHECKS = 3; // Require 3 consecutive checks before changing state

export function HealthProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthStatus>({
    backend: 'disconnected',
    chat: 'disconnected',
    architecture: 'disconnected',
    telemetry: 'disconnected',
    logs: 'disconnected',
    skills: 'disconnected',
    tasks: 'disconnected',
    meta: 'disconnected',
    sandbox: 'disconnected',
    lastCheck: Date.now(),
  });
  
  // Track consecutive check results to debounce flickering
  const [checkHistory, setCheckHistory] = useState<Record<string, HealthState[]>>({});

  const checkHealth = async () => {
    const newHealth: HealthStatus = {
      backend: 'disconnected',
      chat: 'disconnected',
      architecture: 'disconnected',
      telemetry: 'disconnected',
      logs: 'disconnected',
      skills: 'disconnected',
      tasks: 'disconnected',
      meta: 'disconnected',
      sandbox: 'disconnected',
      lastCheck: Date.now(),
    };

    // Run all health checks in parallel for faster response
    const checks = await Promise.allSettled([
      // Priority 1: Backend health (most critical)
      fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) })
        .then(res => ({ key: 'backend' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'backend' as const, status: 'disconnected' as const })),
      
      // Priority 2: Chat endpoint (use backend health as simpler proxy)
      fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(5000) })
        .then(res => ({ key: 'chat' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'chat' as const, status: 'disconnected' as const })),
      
      // Priority 3: Architecture
      fetch(`${BACKEND_URL}/v1/architecture/graph`, { signal: AbortSignal.timeout(2000) })
        .then(res => ({ key: 'architecture' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'architecture' as const, status: 'disconnected' as const })),
      
      // Lower priority checks
      fetch(`${BACKEND_URL}/v1/atlas/logs`, { signal: AbortSignal.timeout(2000) })
        .then(res => ({ key: 'logs' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'logs' as const, status: 'disconnected' as const })),
      
      fetch(`${BACKEND_URL}/v1/atlas/skills`, { signal: AbortSignal.timeout(2000) })
        .then(res => ({ key: 'skills' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'skills' as const, status: 'disconnected' as const })),
      
      // Tasks endpoint (L8 Planning Memory)
      fetch(`${BACKEND_URL}/v1/atlas/tasks`, { signal: AbortSignal.timeout(2000) })
        .then(res => ({ key: 'tasks' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'tasks' as const, status: 'disconnected' as const })),
      
      fetch(`${BACKEND_URL}/v1/meta/latest`, { signal: AbortSignal.timeout(2000) })
        .then(res => ({ key: 'meta' as const, status: res.ok ? 'connected' as const : 'error' as const }))
        .catch(() => ({ key: 'meta' as const, status: 'disconnected' as const })),
      
      // Sandbox health
      fetch(`${BACKEND_URL}/api/sandbox/health`, { signal: AbortSignal.timeout(2000) })
        .then(res => res.json())
        .then(data => ({
          key: 'sandbox' as const,
          status: (data.status === 'healthy' && data.docker_available) ? 'connected' as const : 'error' as const
        }))
        .catch(() => ({ key: 'sandbox' as const, status: 'disconnected' as const })),
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

    // Update check history and apply debouncing
    setCheckHistory(prevHistory => {
      const newHistory = { ...prevHistory };
      const debouncedHealth = { ...newHealth };
      
      Object.keys(rawHealth).forEach((key) => {
        const typedKey = key as keyof HealthStatus;
        if (typedKey === 'lastCheck') return;
        
        const currentState = rawHealth[typedKey] as HealthState;
        
        // Initialize history for this key if needed
        if (!newHistory[key]) {
          newHistory[key] = [];
        }
        
        // Add current check result to history
        newHistory[key] = [...newHistory[key], currentState].slice(-REQUIRED_CONSISTENT_CHECKS);
        
        // Only change state if we have enough consistent checks
        if (newHistory[key].length >= REQUIRED_CONSISTENT_CHECKS) {
          const allSame = newHistory[key].every(state => state === currentState);
          if (allSame) {
            debouncedHealth[typedKey] = currentState;
          }
        }
      });
      
      setHealth(debouncedHealth);
      return newHistory;
    });
  };

  const updateTelemetryStatus = (connected: boolean) => {
    setHealth(prev => ({ ...prev, telemetry: connected ? 'connected' : 'disconnected' }));
  };

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up interval
    const interval = setInterval(checkHealth, CHECK_INTERVAL);

    // Listen for telemetry status updates from window events
    const handleTelemetryStatus = (event: CustomEvent) => {
      console.log('[HealthContext] Received telemetry-status event:', event.detail);
      updateTelemetryStatus(event.detail.connected);
    };

    window.addEventListener('telemetry-status', handleTelemetryStatus as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('telemetry-status', handleTelemetryStatus as EventListener);
    };
  }, []);

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
