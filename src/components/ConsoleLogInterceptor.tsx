
import { useEffect } from 'react';

// Intercept console logs and send relevant ones to server
export function ConsoleLogInterceptor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Batch logs to reduce network calls
    let logBatch: Array<{ level: string; message: string; timestamp: number }> = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;

    // Helper to send batched logs to server
    const flushBatch = async () => {
      if (logBatch.length === 0) return;
      
      const logsToSend = [...logBatch];
      logBatch = [];
      
      try {
        // Send batch as single request
        await fetch('/api/console-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'batch',
            message: logsToSend.map(l => `[${l.level.toUpperCase()}] ${l.message}`).join('\n'),
            timestamp: Date.now(),
          }),
        });
      } catch (error) {
        // Silently fail to avoid infinite loops
      }
    };

    // Helper to add log to batch
    const addToBatch = (level: string, args: any[]) => {
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
          '[STORE]',
        ];

        const isRelevant = relevantPrefixes.some(prefix => message.includes(prefix));

        if (isRelevant) {
          logBatch.push({ level, message, timestamp: Date.now() });
          
          // Debounce: flush after 100ms of inactivity
          if (batchTimer) clearTimeout(batchTimer);
          batchTimer = setTimeout(flushBatch, 100);
          
          // Or flush immediately if batch is large
          if (logBatch.length >= 20) {
            if (batchTimer) clearTimeout(batchTimer);
            flushBatch();
          }
        }
      } catch (error) {
        // Silently fail
      }
    };

    // Intercept console.log
    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      addToBatch('log', args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      addToBatch('warn', args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      addToBatch('error', args);
    };

    // Cleanup: restore original methods and flush remaining logs
    return () => {
      if (batchTimer) clearTimeout(batchTimer);
      flushBatch();
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  return null; // This component doesn't render anything
}
