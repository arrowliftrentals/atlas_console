"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchActivityLogs, clearActivityLogs } from "@/lib/atlasConsoleClient";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

interface ActivityLog {
  timestamp: string;
  level: string;
  message: string;
  session_id?: string;
  details?: Record<string, any>;
}

const LogsView: React.FC = () => {
  const { health } = useHealth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
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
    const interval = setInterval(loadLogs, 30000); // Poll every 30 seconds (reduced from 5s)
    return () => clearInterval(interval);
  }, []);

  // Sort logs by timestamp descending (most recent first)
  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const filteredLogs =
    levelFilter === "ALL"
      ? sortedLogs
      : sortedLogs.filter((log) => log.level === levelFilter);

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
    <div className="h-full flex flex-col bg-[#02030a]">
      <TabHeader
        title="Activity Logs"
        subtitle={`${logs.length} log entries`}
        statusConnected={health.logs === 'connected'}
        statusLabel={health.logs === 'connected' ? 'Connected' : 'Disconnected'}
      >
        <button
          onClick={async () => {
            try {
              await clearActivityLogs();
              setLogs([]);
            } catch (error) {
              console.error("Failed to clear logs:", error);
            }
          }}
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
          aria-label="Clear logs"
        >
          Clear
        </button>
        <button
          onClick={loadLogs}
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
          aria-label="Refresh logs"
        >
          Refresh
        </button>
      </TabHeader>
      
      {/* Filters */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700">
        <div className="flex items-center gap-2">
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
        className="flex-1 overflow-auto px-4 py-3"
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
                key={`${log.timestamp}-${idx}`}
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
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--atlas-border-subtle)] flex items-center justify-between text-xs">
        <span className="text-[var(--atlas-text-muted)]">
          {filteredLogs.length} of {logs.length} logs • Most recent first
        </span>
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="text-[var(--atlas-text-secondary)] hover:text-white transition-colors"
        >
          ↑ Scroll to top
        </button>
      </div>
    </div>
  );
};

export default LogsView;
