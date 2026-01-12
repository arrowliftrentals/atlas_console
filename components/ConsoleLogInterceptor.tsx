'use client';

import { useEffect } from 'react';

// Intercept console logs and send relevant ones to server
export function ConsoleLogInterceptor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Helper to send log to server
    const sendToServer = async (level: string, args: any[]) => {
      try {
        // Convert args to string
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

        // Only send particle-related logs to avoid spam
        const relevantPrefixes = [
          '[PARTICLE',
          '[V2]',
          '[STORE]',
          '[TEST]',
          '[handleTelemetryUpdate]',
          '[TELEMETRY',
          '[MEMORY_WRITE]',
          '[EVENT',
          '[EDGE'
        ];

        const isRelevant = relevantPrefixes.some(prefix => message.includes(prefix));

        if (isRelevant) {
          await fetch('/api/console-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              level,
              message,
              timestamp: Date.now(),
            }),
          });
        }
      } catch (error) {
        // Silently fail to avoid infinite loops
      }
    };

    // Intercept console.log
    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      sendToServer('log', args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      sendToServer('warn', args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      sendToServer('error', args);
    };

    // Cleanup: restore original methods
    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return null; // This component doesn't render anything
}
