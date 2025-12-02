"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchActivityLogs, clearActivityLogs } from "@/lib/atlasConsoleClient";

interface ActivityLog {
  timestamp: string;
  level: string;
  message: string;
  session_id?: string;
  details?: Record<string, any>;
}

const LogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadLogs = async () => {
    try {
      const data = await fetchActivityLogs(200);
      setLogs(data);
    } catch (error) {
      console.error("Failed to load activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2000); // Poll every 2 seconds for real-time updates
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    setAutoScroll(isAtBottom);
  };

  const filteredLogs =
    levelFilter === "ALL"
      ? logs
      : logs.filter((log) => log.level === levelFilter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "DEBUG":
        return "text-[var(--atlas-log-debug)]";
      case "INFO":
        return "text-[var(--atlas-log-info)]";
      case "WARN":
        return "text-[var(--atlas-log-warn)]";
      case "ERROR":
        return "text-[var(--atlas-log-error)]";
      default:
        return "text-[var(--atlas-text-muted)]";
    }
  };

  const getLevelBadge = (level: string) => {
    const badgeClasses = {
      DEBUG: "atlas-badge-default",
      INFO: "atlas-badge-info",
      WARN: "atlas-badge-warning",
      ERROR: "atlas-badge-error",
    }[level] || "atlas-badge-default";

    return (
      <span className={`${badgeClasses} text-[10px] px-1.5 py-0.5 font-mono`}>
        {level}
      </span>
    );
  };

  const logCounts = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="atlas-panel h-full flex flex-col">
      {/* Header */}
      <div className="atlas-panel-header">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--atlas-text-primary)]">
            Logs
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  await clearActivityLogs();
                  setLogs([]);
                } catch (error) {
                  console.error("Failed to clear logs:", error);
                }
              }}
              className="text-xs text-[var(--atlas-text-muted)] hover:text-red-400 transition-colors"
              aria-label="Clear logs"
            >
              Clear
            </button>
            <button
              onClick={loadLogs}
              className="text-xs text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] transition-colors"
              aria-label="Refresh logs"
            >
              Refresh
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          {["ALL", "DEBUG", "INFO", "WARN", "ERROR"].map((level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                levelFilter === level
                  ? "bg-[var(--atlas-accent-primary)] text-white"
                  : "bg-[var(--atlas-bg-subtle)] text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-bg-hover)]"
              }`}
            >
              {level}
              {level !== "ALL" && logCounts[level] ? (
                <span className="ml-1 opacity-70">({logCounts[level]})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Logs List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="atlas-panel-body atlas-scrollbar"
      >
        {loading ? (
          <div className="text-center text-[var(--atlas-text-muted)] py-8">
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center text-[var(--atlas-text-muted)] py-8">
            No logs to display
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 py-1.5 px-2 hover:bg-[var(--atlas-bg-hover)] rounded transition-colors text-xs"
              >
                <span className="text-[var(--atlas-text-muted)] whitespace-nowrap font-mono text-[10px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {getLevelBadge(log.level)}
                <div className="flex-1">
                  <span className={getLevelColor(log.level)}>
                    {log.message}
                  </span>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-[10px] text-[var(--atlas-text-muted)] mt-1 font-mono whitespace-pre-wrap">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--atlas-border-subtle)] flex items-center justify-between text-xs">
        <span className="text-[var(--atlas-text-muted)]">
          {filteredLogs.length} of {logs.length} logs
        </span>
        <label className="flex items-center gap-2 text-[var(--atlas-text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="atlas-focus-ring"
          />
          Auto-scroll
        </label>
      </div>
    </div>
  );
};

export default LogsView;
