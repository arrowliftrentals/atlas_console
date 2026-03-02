
import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ThinkingStep } from "@/lib/atlasConsoleClient";

interface ThinkingProcessProps {
  steps: ThinkingStep[];
  isActive: boolean;
  defaultExpanded?: boolean;
}

/** Convert a step into readable natural language. */
function stepToText(step: ThinkingStep): string {
  switch (step.type) {
    case "tool_call": {
      const name = step.content || "tool";
      const args = step.metadata?.args as Record<string, unknown> | undefined;
      if (name.includes("read_file") || name.includes("read")) {
        const p = args?.filePath || args?.path || args?.file_path;
        return p ? `Reading ${String(p).split("/").pop()}…` : "Reading file…";
      }
      if (name.includes("search") || name.includes("grep")) {
        const q = args?.query || args?.pattern;
        return q ? `Searching for \"${String(q).slice(0, 60)}\"…` : "Searching…";
      }
      if (name.includes("replace") || name.includes("edit")) {
        const p = args?.filePath || args?.path || args?.file_path;
        return p ? `Editing ${String(p).split("/").pop()}…` : "Making changes…";
      }
      if (name.includes("run") || name.includes("terminal") || name.includes("command")) {
        const cmd = args?.command;
        return cmd ? `Running \`${String(cmd).slice(0, 50)}\`…` : "Running command…";
      }
      if (name.includes("create")) {
        const p = args?.filePath || args?.path || args?.file_path;
        return p ? `Creating ${String(p).split("/").pop()}…` : "Creating file…";
      }
      // Map internal tool names to human-readable descriptions
      const toolLabels: Record<string, string> = {
        get_health: "Checking system health",
        get_metrics: "Gathering performance metrics",
        get_recent_errors: "Reviewing recent errors",
        get_error_patterns: "Analyzing error patterns",
        get_component_latencies: "Measuring component latencies",
        get_flow_counts: "Checking execution flows",
        get_memory_stats: "Checking memory statistics",
        get_system_info: "Getting system information",
        analyze_performance: "Analyzing performance",
        get_recommendations: "Gathering recommendations",
        code_search: "Searching codebase",
        file_read: "Reading file",
        file_search: "Finding files",
        file_list: "Listing directory",
        memory_query: "Querying memory",
        get_tool_list: "Checking available tools",
        get_codebase_stats: "Gathering codebase statistics",
      };
      // Backend may send pre-formatted human-readable labels (e.g. "Querying memory layers")
      // that won't match raw tool name keys. Detect and use directly.
      if (toolLabels[name]) return `${toolLabels[name]}…`;
      if (name.includes(" ")) return `${name}…`;
      return `${name.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())}…`;
    }
    case "tool_result": {
      // Suppress successful results — the tool_call already shows the action.
      // Only surface failures so the user knows something went wrong.
      if (step.metadata?.success !== false) return "";
      const raw = step.content || "";
      if (!raw) return "Tool execution failed.";
      // Try to extract a clean error message from JSON-like content
      if (raw.startsWith("{") || raw.startsWith("'")) {
        const m = raw.match(/['"]error['"]:\s*['"]([^'"]+)/);
        return m?.[1]?.slice(0, 150) || "Tool execution failed.";
      }
      return raw.slice(0, 150);
    }
    default:
      return step.content;
  }
}

/** Compute elapsed seconds between first and last step timestamps. */
function elapsedSeconds(steps: ThinkingStep[]): number | null {
  if (steps.length < 2) return null;
  const first = new Date(steps[0].timestamp).getTime();
  const last = new Date(steps[steps.length - 1].timestamp).getTime();
  if (Number.isNaN(first) || Number.isNaN(last)) return null;
  return Math.round((last - first) / 1000);
}

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ steps, isActive, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasActiveRef = useRef(isActive);

  // Auto-collapse when thinking finishes (Warp-style)
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      setExpanded(false);
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Auto-scroll to bottom while active
  useEffect(() => {
    if (expanded && isActive && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps.length, expanded, isActive]);

  // Deduplicate consecutive steps with identical text
  const dedupedSteps = useMemo(() => {
    const result: ThinkingStep[] = [];
    let lastText = "";
    for (const step of steps) {
      const text = stepToText(step);
      if (text && text !== lastText) {
        result.push(step);
        lastText = text;
      }
    }
    return result;
  }, [steps]);

  if (steps.length === 0) return null;

  const elapsed = isActive ? null : elapsedSeconds(steps);
  const headerText = isActive
    ? "Thinking…"
    : elapsed !== null
      ? `Thought for ${elapsed} second${elapsed !== 1 ? "s" : ""}`
      : `Thought process (${dedupedSteps.length} steps)`;

  return (
    <div style={{ borderBottom: "1px solid var(--atlas-border-subtle)", background: "var(--atlas-bg-elevated)" }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-1.5 text-xs hover:bg-[var(--atlas-bg-hover)] transition-colors"
        style={{ color: "var(--atlas-text-muted)" }}
      >
        <span
          className="transition-transform duration-200 text-[10px]"
          style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        <span>{headerText}</span>
        {isActive && (
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse ml-1" style={{ background: "var(--atlas-accent-primary)" }} />
        )}
      </button>

      {/* Plain flowing text stream (Warp-style) */}
      {expanded && (
        <div ref={containerRef} className="px-4 pb-2 max-h-[300px] overflow-y-auto atlas-scrollbar">
          <p className="text-xs leading-relaxed" style={{ color: "var(--atlas-text-muted)" }}>
            {dedupedSteps.map((step, idx) => {
              const text = stepToText(step);
              if (!text) return null;
              const isError = step.type === "tool_result" && step.metadata?.success === false;
              return (
                <span key={idx} style={isError ? { color: "#f87171" } : undefined}>
                  {text}{idx < dedupedSteps.length - 1 ? " " : ""}
                </span>
              );
            })}
            {isActive && <span className="animate-pulse">▍</span>}
          </p>
        </div>
      )}
    </div>
  );
};

export default ThinkingProcess;
