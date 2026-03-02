// Debug logger that writes to a file via API
// This allows the AI to review browser-side logs

// Set to true to enable verbose debug logging
const DEBUG_ENABLED = false;

// Safe stringify that handles circular references
function safeStringify(obj: any, maxDepth = 2): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    // Truncate large arrays/objects
    if (Array.isArray(value) && value.length > 10) {
      return `[Array(${value.length})]`;
    }
    if (value instanceof Map) return `[Map(${value.size})]`;
    if (value instanceof Set) return `[Set(${value.size})]`;
    return value;
  });
}

class DebugLogger {
  private logs: string[] = [];
  private maxLogs = 500;
  private flushInterval = 5000; // ms
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined' && DEBUG_ENABLED) {
      this.startFlushing();
    }
  }

  log(category: string, message: string, ...args: any[]) {
    if (!DEBUG_ENABLED) return;
    
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? safeStringify(args) : '';
    const logEntry = `[${timestamp}] [${category}] ${message} ${argsStr}`;
    
    // Store for file writing (skip console.log to prevent memory issues)
    this.logs.push(logEntry);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private startFlushing() {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush() {
    if (this.logs.length === 0) return;

    const logsToWrite = [...this.logs];
    this.logs = [];

    try {
      await fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToWrite }),
      });
    } catch (error) {
      console.error('Failed to write debug logs:', error);
    }
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.flush(); // Final flush
    }
  }
}

export const debugLogger = new DebugLogger();
