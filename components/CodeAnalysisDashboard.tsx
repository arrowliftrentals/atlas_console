"use client";

import React, { useState, useEffect, useRef } from "react";

interface AnalysisIssue {
  id: string;
  file: string;
  line: number;
  code: string;
  message: string;
  severity: string;
  tool: string;
  priority_score: number;
  category: string;
  requires_fix: boolean;
  auto_fixable: boolean;
  fix_applied: boolean;
}

interface AnalysisRun {
  run_id: string;
  timestamp: string;
  status: string;
  total_issues: number;
  critical_count: number;
  error_count: number;
  warning_count: number;
  info_count: number;
  filters_applied: Record<string, any>;
}

interface AnalysisProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

interface AnalysisConfig {
  include_mypy: boolean;
  include_pylint: boolean;
  include_tests: boolean;
  min_priority: number;
  severity_filter: string[];
  exclude_codes: string[];
}

const CodeAnalysisDashboard: React.FC = () => {
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<AnalysisConfig>({
    include_mypy: true,
    include_pylint: true,
    include_tests: true,
    min_priority: 0.0,
    severity_filter: ["error", "warning", "info"],
    exclude_codes: [],
  });

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [issues, setIssues] = useState<AnalysisIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);

  const [groupBy, setGroupBy] = useState<"file" | "severity" | "tool">("severity");
  const [sortBy, setSortBy] = useState<"priority" | "file" | "line">("priority");
  const [filterText, setFilterText] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<AnalysisIssue | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Load runs on mount
  useEffect(() => {
    loadRuns();
  }, []);

  // Load issues when selected run changes
  useEffect(() => {
    if (selectedRunId) {
      loadIssues(selectedRunId);
    }
  }, [selectedRunId]);

  const loadRuns = async () => {
    try {
      const res = await fetch("/api/analysis/runs");
      const data = await res.json();
      setRuns(data.runs || []);
      
      // Auto-select most recent run
      if (data.runs && data.runs.length > 0 && !selectedRunId) {
        setSelectedRunId(data.runs[0].run_id);
      }
    } catch (e) {
      console.error("Failed to load runs:", e);
    }
  };

  const loadIssues = async (runId: string) => {
    setIssuesLoading(true);
    try {
      const res = await fetch(`/api/analysis/issues/${runId}`);
      const data = await res.json();
      setIssues(data.issues || []);
    } catch (e) {
      console.error("Failed to load issues:", e);
    } finally {
      setIssuesLoading(false);
    }
  };

  const startAnalysis = async () => {
    setIsRunning(true);
    setProgress({ stage: "Initializing", current: 0, total: 100, message: "Starting analysis..." });

    try {
      const res = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      const runId = data.run_id;
      setCurrentRunId(runId);

      // Poll for progress updates
      const pollInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`/api/analysis/progress/${runId}`);
          const progressData = await progressRes.json();
          
          setProgress(progressData);

          if (progressData.stage === "complete" || progressData.stage === "error") {
            clearInterval(pollInterval);
            setIsRunning(false);
            
            if (progressData.stage === "complete") {
              loadRuns();
              setSelectedRunId(runId);
            }
          }
        } catch (err) {
          console.error("Progress poll error:", err);
        }
      }, 500); // Poll every 500ms

      // Store interval ID for cleanup
      wsRef.current = pollInterval as any;
    } catch (e) {
      console.error("Failed to start analysis:", e);
      setIsRunning(false);
      setProgress({ stage: "error", current: 0, total: 100, message: "Failed to start analysis" });
    }
  };

  const stopAnalysis = () => {
    if (wsRef.current) {
      clearInterval(wsRef.current as any);
      wsRef.current = null;
    }
    setIsRunning(false);
    setProgress(null);
  };

  const markAsFixed = async (issue: AnalysisIssue) => {
    if (!selectedRunId) return;

    try {
      await fetch("/api/analysis/mark-fixed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRunId,
          file: issue.file,
          line: issue.line,
          code: issue.code,
        }),
      });

      // Reload issues
      loadIssues(selectedRunId);
    } catch (e) {
      console.error("Failed to mark as fixed:", e);
    }
  };

  // Filter and sort issues
  const processedIssues = issues
    .filter((issue) => {
      if (filterText) {
        const searchLower = filterText.toLowerCase();
        return (
          issue.file.toLowerCase().includes(searchLower) ||
          issue.message.toLowerCase().includes(searchLower) ||
          issue.code.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priority") return b.priority_score - a.priority_score;
      if (sortBy === "file") return a.file.localeCompare(b.file);
      if (sortBy === "line") return a.line - b.line;
      return 0;
    });

  // Group issues
  const groupedIssues = processedIssues.reduce((acc, issue) => {
    let key = "";
    if (groupBy === "file") key = issue.file;
    else if (groupBy === "severity") key = issue.severity;
    else if (groupBy === "tool") key = issue.tool;

    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, AnalysisIssue[]>);

  const selectedRun = runs.find((r) => r.run_id === selectedRunId);

  const progressPercentage = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="h-full w-full flex flex-col bg-[#1E1E1E] text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex items-center justify-between bg-[#1a1a1a]">
        <div>
          <h2 className="text-lg font-semibold">Code Analysis</h2>
          <p className="text-xs text-gray-400 mt-1">Static analysis and quality checks</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs transition-colors"
          >
            {showConfig ? "Hide" : "Show"} Config
          </button>
          <button
            onClick={isRunning ? stopAnalysis : startAnalysis}
            disabled={isRunning && !wsRef.current}
            className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
              isRunning
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {isRunning ? "Stop Analysis" : "Run Analysis"}
          </button>
          <button
            onClick={loadRuns}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="border-b border-gray-700 p-4 bg-[#1a1a1a]">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-xs font-semibold mb-2 text-gray-300">Analysis Tools</h3>
              <label className="flex items-center gap-2 text-xs mb-1">
                <input
                  type="checkbox"
                  checked={config.include_mypy}
                  onChange={(e) => setConfig({ ...config, include_mypy: e.target.checked })}
                  className="rounded"
                />
                <span>mypy (type checking)</span>
              </label>
              <label className="flex items-center gap-2 text-xs mb-1">
                <input
                  type="checkbox"
                  checked={config.include_pylint}
                  onChange={(e) => setConfig({ ...config, include_pylint: e.target.checked })}
                  className="rounded"
                />
                <span>pylint (linting)</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={config.include_tests}
                  onChange={(e) => setConfig({ ...config, include_tests: e.target.checked })}
                  className="rounded"
                />
                <span>Run tests</span>
              </label>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-2 text-gray-300">Severity Filter</h3>
              <div className="text-xs">
                <div className="flex gap-2">
                  {["error", "warning", "info"].map((sev) => (
                    <label key={sev} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={config.severity_filter.includes(sev)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfig({ ...config, severity_filter: [...config.severity_filter, sev] });
                          } else {
                            setConfig({ ...config, severity_filter: config.severity_filter.filter((s) => s !== sev) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="capitalize">{sev}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-2 text-gray-300">Exclude Codes</h3>
              <textarea
                value={config.exclude_codes.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    exclude_codes: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                  })
                }
                placeholder="import-not-found, missing-imports"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-mono"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">Comma-separated error codes to exclude</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isRunning && progress && (
        <div className="border-b border-gray-700 p-4 bg-[#1a1a1a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">{progress.stage}</span>
            <span className="text-xs text-gray-400">{progressPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{progress.message}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Run History */}
        <div className="w-64 border-r border-gray-700 flex flex-col bg-[#1a1a1a]">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-xs font-semibold text-gray-300">Analysis Runs</h3>
          </div>
          <div className="flex-1 overflow-auto">
            {runs.length === 0 ? (
              <div className="p-3 text-xs text-gray-400 text-center">No runs yet</div>
            ) : (
              runs.map((run) => (
                <div
                  key={run.run_id}
                  onClick={() => setSelectedRunId(run.run_id)}
                  className={`p-3 border-b border-gray-700 cursor-pointer transition-colors ${
                    selectedRunId === run.run_id
                      ? "bg-blue-900/30 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-800"
                  }`}
                >
                  <div className="text-xs font-mono text-gray-300 mb-1">{run.run_id.slice(0, 8)}</div>
                  <div className="text-xs text-gray-400 mb-2">{new Date(run.timestamp).toLocaleString()}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400">{run.critical_count}C</span>
                    <span className="text-orange-400">{run.error_count}E</span>
                    <span className="text-yellow-400">{run.warning_count}W</span>
                    <span className="text-gray-400">{run.info_count}I</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Issue Browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="border-b border-gray-700 p-3 bg-[#1a1a1a] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Filter issues..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-64"
              />
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
              >
                <option value="severity">Group by Severity</option>
                <option value="file">Group by File</option>
                <option value="tool">Group by Tool</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
              >
                <option value="priority">Sort by Priority</option>
                <option value="file">Sort by File</option>
                <option value="line">Sort by Line</option>
              </select>
            </div>
            {selectedRun && (
              <div className="text-xs text-gray-400">
                {processedIssues.length} / {selectedRun.total_issues} issues
              </div>
            )}
          </div>

          {/* Issue List */}
          <div className="flex-1 overflow-auto p-4">
            {issuesLoading ? (
              <div className="text-center text-gray-400 py-8">Loading issues...</div>
            ) : !selectedRunId ? (
              <div className="text-center text-gray-400 py-8">Select a run to view issues</div>
            ) : processedIssues.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No issues found</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedIssues).map(([groupKey, groupIssues]) => (
                  <div key={groupKey}>
                    <h3 className="text-sm font-semibold mb-2 text-gray-300 capitalize sticky top-0 bg-[#1E1E1E] py-2">
                      {groupKey} ({groupIssues.length})
                    </h3>
                    <div className="space-y-2">
                      {groupIssues.map((issue, idx) => (
                        <div
                          key={`${issue.file}-${issue.line}-${idx}`}
                          className={`border rounded p-3 cursor-pointer transition-colors ${
                            selectedIssue === issue
                              ? "border-blue-500 bg-blue-900/20"
                              : "border-gray-700 bg-[#1a1a1a] hover:border-gray-600"
                          }`}
                          onClick={() => setSelectedIssue(selectedIssue === issue ? null : issue)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                                    issue.severity === "error"
                                      ? "bg-red-900/50 text-red-300"
                                      : issue.severity === "warning"
                                      ? "bg-yellow-900/50 text-yellow-300"
                                      : "bg-blue-900/50 text-blue-300"
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                                  {issue.code}
                                </span>
                                <span className="text-xs text-gray-500">{issue.tool}</span>
                                <span className="text-xs text-purple-400">
                                  Priority: {issue.priority_score}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-gray-400 mb-1">
                                {issue.file}:{issue.line}
                                {issue.column && `:${issue.column}`}
                              </div>
                              <div className="text-sm text-gray-200">{issue.message}</div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsFixed(issue);
                              }}
                              className="ml-3 text-xs px-2 py-1 bg-green-800 hover:bg-green-700 rounded transition-colors"
                            >
                              Mark Fixed
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeAnalysisDashboard;
