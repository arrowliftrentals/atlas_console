// Debug logger that writes to a file via API
// This allows the AI to review browser-side logs

class DebugLogger {
  private logs: string[] = [];
  private maxLogs = 1000;
  private flushInterval = 2000; // ms
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startFlushing();
    }
  }

  log(category: string, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${category}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}`;
    
    // Also log to console
    console.log(`[DEBUG ${category}]`, message, ...args);
    
    // Store for file writing
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
