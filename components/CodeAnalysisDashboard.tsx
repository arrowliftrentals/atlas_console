"use client";

import React, { useState, useEffect, useRef } from "react";

interface AnalysisIssue {
  id: string;
  file: string;
  line: number;
  column?: number;
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

  const [groupBy, setGroupBy] = useState<"file" | "severity" | "tool" | "code" | "priority">("code");
  const [sortBy, setSortBy] = useState<"priority" | "file" | "line">("priority");
  const [filterText, setFilterText] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<AnalysisIssue | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [fixJobId, setFixJobId] = useState<string | null>(null);
  const [fixProgress, setFixProgress] = useState<number>(0);
  const [fixMessage, setFixMessage] = useState<string>("");
  const [fixStatus, setFixStatus] = useState<string>("");
  const [fixLogs, setFixLogs] = useState<string[]>([]);
  // Analysis progress connections
  const analysisWsRef = useRef<WebSocket | null>(null);
  const analysisPollRef = useRef<any>(null);
  // Fix progress polling
  const fixPollRef = useRef<any>(null);
  const fixLogsEndRef = useRef<HTMLDivElement>(null);

  // Polling fallback for analysis progress (WS fallback)
  const startProgressPolling = (runId: string) => {
    if (analysisPollRef.current) return;
    analysisPollRef.current = setInterval(async () => {
      try {
        const progressRes = await fetch(`/api/analysis/progress/${runId}`);
        const progressData = await progressRes.json();
        setProgress(progressData);
        if (progressData.stage === "complete" || progressData.stage === "error") {
          clearInterval(analysisPollRef.current);
          analysisPollRef.current = null;
          setIsRunning(false);
          if (progressData.stage === "complete") {
            loadRuns();
            setSelectedRunId(runId);
          }
        }
      } catch (err) {
        console.error("Progress poll error:", err);
      }
    }, 500);
  };

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

  // Auto-scroll fix logs to bottom
  useEffect(() => {
    fixLogsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [fixLogs]);

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
      // Build backend config format (mypy/pylint objects with exclude lists)
      const backendConfig = {
        mypy: {
          enabled: config.include_mypy,
          categories: [],
          exclude: config.exclude_codes
        },
        pylint: {
          enabled: config.include_pylint,
          categories: [],
          exclude: config.exclude_codes
        }
      };
      
      const res = await fetch("/api/analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: backendConfig,
          skip_tests: !config.include_tests
        }),
      });

      const data = await res.json();
      const runId = data.run_id;
      setCurrentRunId(runId);

      // Try WebSocket first
      try {
        const httpBase = process.env.NEXT_PUBLIC_ATLAS_API_BASE || "http://127.0.0.1:8000";
        const wsBase = httpBase.replace(/^http/, "ws");
        const wsUrl = `${wsBase}/api/analysis/ws/${runId}`;
        const ws = new WebSocket(wsUrl);
        analysisWsRef.current = ws;

        ws.onopen = () => {
          // Connected; no need to start polling
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            // Expected shape from backend: { stage, current, total, message }
            setProgress(msg);
            if (msg.stage === "complete" || msg.stage === "error") {
              ws.close();
              analysisWsRef.current = null;
              setIsRunning(false);
              if (msg.stage === "complete") {
                loadRuns();
                setSelectedRunId(runId);
              }
            }
          } catch (err) {
            console.error("WS parse error:", err);
          }
        };

        ws.onerror = () => {
          // Fallback to polling if WS errors out
          if (analysisPollRef.current) return;
          startProgressPolling(runId);
        };

        ws.onclose = () => {
          // If closed before completion and we are still running, ensure fallback polling
          if (isRunning && !analysisPollRef.current) {
            startProgressPolling(runId);
          }
        };
      } catch (wsErr) {
        console.warn("WebSocket unavailable, falling back to polling:", wsErr);
        startProgressPolling(runId);
      }
    } catch (e) {
      console.error("Failed to start analysis:", e);
      setIsRunning(false);
      setProgress({ stage: "error", current: 0, total: 100, message: "Failed to start analysis" });
    }
  };

  const stopAnalysis = async () => {
    if (!currentRunId) return;
    
    try {
      // Call backend to cancel the analysis
      await fetch(`/api/analysis/cancel/${currentRunId}`, {
        method: "POST"
      });
    } catch (err) {
      console.error("Failed to cancel analysis:", err);
    }
    
    // Clean up frontend state
    if (analysisPollRef.current) {
      clearInterval(analysisPollRef.current as any);
      analysisPollRef.current = null;
    }
    if (analysisWsRef.current) {
      try { analysisWsRef.current.close(); } catch {}
      analysisWsRef.current = null;
    }
    setIsRunning(false);
    setProgress(null);
    setCurrentRunId(null);
  };

  const deleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't select the run when clicking delete
    
    if (!confirm("Delete this analysis run? This cannot be undone.")) return;
    
    try {
      await fetch(`/api/analysis/delete/${runId}`, {
        method: "DELETE"
      });
      
      // Refresh runs list
      await loadRuns();
      
      // Clear selection if deleted run was selected
      if (selectedRunId === runId) {
        setSelectedRunId(null);
        setIssues([]);
      }
    } catch (err) {
      console.error("Failed to delete run:", err);
      alert("Failed to delete run");
    }
  };

  const toggleIssueSelection = (issueId: string) => {
    const newSelected = new Set(selectedIssueIds);
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId);
    } else {
      newSelected.add(issueId);
    }
    setSelectedIssueIds(newSelected);
  };

  const selectAllVisibleIssues = () => {
    const allIds = new Set(processedIssues.map(issue => issue.id));
    setSelectedIssueIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIssueIds(new Set());
  };

  const startFixGeneration = async (jobId: string) => {
    setFixJobId(jobId);
    setFixProgress(0);
    setFixStatus("running");
    setFixMessage("Starting fix generation...");
    setFixLogs([]);
    
    // Poll for status updates
    fixPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/fix/status/${jobId}`);
        if (!res.ok) {
          console.error(`Status poll failed: ${res.status}`);
          return;
        }
        
        const status = await res.json();
        setFixProgress(status.progress);
        setFixMessage(status.message);
        setFixStatus(status.status);
        
        // Add to log only if message changed
        setFixLogs(prev => {
          const lastLog = prev[prev.length - 1];
          const newLog = `[${status.progress}%] ${status.message}`;
          if (lastLog !== newLog) {
            return [...prev, newLog];
          }
          return prev;
        });
        
        if (status.status === "completed" || status.status === "failed") {
          clearInterval(fixPollRef.current);
          fixPollRef.current = null;
          
          if (status.status === "completed" && status.proposal_id) {
            setFixLogs(prev => [...prev, `✅ Proposal ${status.proposal_id.slice(0,8)} created!`]);
          } else if (status.status === "failed") {
            setFixLogs(prev => [...prev, `❌ Fix generation failed: ${status.message}`]);
          }
        }
      } catch (err) {
        console.error("Fix status poll error:", err);
        setFixLogs(prev => [...prev, `⚠️ Poll error: ${err}`]);
      }
    }, 500);
  };
  
  const closeFixProgress = () => {
    if (fixPollRef.current) {
      clearInterval(fixPollRef.current);
      fixPollRef.current = null;
    }
    setFixJobId(null);
    setFixProgress(0);
    setFixMessage("");
    setFixStatus("");
    setFixLogs([]);
  };

  const autoFixTopIssues = async () => {
    if (!selectedRunId) return;
    if (!confirm("Generate fixes for the top 10 highest priority issues?")) return;

    try {
      const res = await fetch("/api/fix/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRunId,
          max_issues: 10,
          min_priority: 50,
        }),
      });
      const data = await res.json();
      
      if (data.job_id) {
        startFixGeneration(data.job_id);
      }
    } catch (e) {
      alert(`Failed to start fix generation: ${e}`);
    }
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
    else if (groupBy === "code") key = `${issue.code} - ${issue.message.split(':')[0].substring(0, 50)}`;
    else if (groupBy === "priority") key = `Priority ${issue.priority_score}`;

    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {} as Record<string, AnalysisIssue[]>);
  
  // Sort groups by average priority (or by name if priorities are equal)
  const sortedGroups = Object.entries(groupedIssues).sort((a, b) => {
    const aAvgPriority = a[1].reduce((sum, issue) => sum + issue.priority_score, 0) / a[1].length;
    const bAvgPriority = b[1].reduce((sum, issue) => sum + issue.priority_score, 0) / b[1].length;
    if (Math.abs(bAvgPriority - aAvgPriority) < 0.01) {
      return a[0].localeCompare(b[0]); // Secondary sort by group name
    }
    return bAvgPriority - aAvgPriority;
  });
  
  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const selectedRun = runs.find((r) => r.run_id === selectedRunId);

  const progressPercentage = progress && progress.total > 0 
    ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100)) 
    : 0;

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold mb-2 text-gray-300">Analysis Tools</h3>
              <label className="flex items-center gap-2 text-xs mb-1 cursor-pointer" title="Type checker - finds type errors, missing annotations, and incorrect type usage">
                <input
                  type="checkbox"
                  checked={config.include_mypy}
                  onChange={(e) => setConfig({ ...config, include_mypy: e.target.checked })}
                  className="rounded cursor-pointer"
                />
                <span>mypy (type checking)</span>
              </label>
              <label className="flex items-center gap-2 text-xs mb-1 cursor-pointer" title="Code linter - finds style issues, code smells, potential bugs, and complexity problems">
                <input
                  type="checkbox"
                  checked={config.include_pylint}
                  onChange={(e) => setConfig({ ...config, include_pylint: e.target.checked })}
                  className="rounded cursor-pointer"
                />
                <span>pylint (linting)</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" title="Execute test suite - runs pytest/unittest and reports failures (slower, recommended after fixing static issues)">
                <input
                  type="checkbox"
                  checked={config.include_tests}
                  onChange={(e) => setConfig({ ...config, include_tests: e.target.checked })}
                  className="rounded cursor-pointer"
                />
                <span>Run tests</span>
              </label>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-2 text-gray-300" title="Filter which issues to report - useful for ignoring known/accepted violations">Filters (optional)</h3>
              <div className="text-xs text-gray-400 mb-2">
                Leave blank to show all issues
              </div>
              <textarea
                value={config.exclude_codes.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    exclude_codes: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                  })
                }
                placeholder="e.g. C0301, W0612, E1101"
                title="Enter error codes to exclude (e.g., C0301 for line-too-long, W0612 for unused-variable). Separate multiple codes with commas."
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-mono"
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">Exclude specific error codes like C0301, W0612 (comma-separated)</p>
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
                  className={`p-3 border-b border-gray-700 cursor-pointer transition-colors group relative ${
                    selectedRunId === run.run_id
                      ? "bg-blue-900/30 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-mono text-gray-300 mb-1">{run.run_id.slice(0, 8)}</div>
                      <div className="text-xs text-gray-400 mb-2">{new Date(run.timestamp).toLocaleString()}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400">{run.critical_count}C</span>
                        <span className="text-orange-400">{run.error_count}E</span>
                        <span className="text-yellow-400">{run.warning_count}W</span>
                        <span className="text-gray-400">{run.info_count}I</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteRun(run.run_id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600/20 rounded transition-opacity"
                      title="Delete run"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Issue Browser */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="border-b border-gray-700 p-3 bg-[#1a1a1a]">
            <div className="flex items-center justify-between mb-3">
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
                  <option value="code">Group by Type</option>
                  <option value="priority">Group by Priority Score</option>
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
            
            {/* Fix Generation Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllVisibleIssues}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
                >
                  Deselect All
                </button>
                {selectedIssueIds.size > 0 && (
                  <span className="text-xs text-gray-400">
                    {selectedIssueIds.size} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={autoFixTopIssues}
                  disabled={!selectedRunId}
                  className="text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
                >
                  Auto-Fix Top 10
                </button>
                <button
                  onClick={async () => {
                    if (!selectedRunId || selectedIssueIds.size === 0) return;
                    
                    try {
                      const res = await fetch("/api/fix/generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          run_id: selectedRunId,
                          issue_ids: Array.from(selectedIssueIds),
                          create_proposal: true,
                        }),
                      });
                      const data = await res.json();
                      
                      deselectAll();
                      
                      if (data.job_id) {
                        startFixGeneration(data.job_id);
                      }
                    } catch (e) {
                      alert(`Failed to start fix generation: ${e}`);
                    }
                  }}
                  disabled={selectedIssueIds.size === 0 || fixJobId !== null}
                  className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {fixJobId ? "Fix Running..." : `Generate Fixes (${selectedIssueIds.size})`}
                </button>
              </div>
            </div>
            
            {/* Fix Progress Panel */}
            {fixJobId && (
              <div className="mt-3 border border-blue-700 rounded bg-blue-900/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-blue-300">Fix Generation Progress</div>
                    <div className="text-xs text-gray-400">Job: {fixJobId.slice(0, 8)}</div>
                  </div>
                  {(fixStatus === "completed" || fixStatus === "failed") && (
                    <button
                      onClick={closeFixProgress}
                      className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      Close
                    </button>
                  )}
                </div>
                
                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{fixMessage}</span>
                    <span className="text-gray-400">{fixProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${fixProgress}%` }}
                    />
                  </div>
                </div>
                
                {/* Status Indicator */}
                <div className="flex items-center gap-2 text-xs mb-2">
                  {fixStatus === "running" && (
                    <div className="flex items-center gap-1 text-blue-400">
                      <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full" />
                      <span>Running</span>
                    </div>
                  )}
                  {fixStatus === "completed" && (
                    <div className="text-green-400">✅ Completed</div>
                  )}
                  {fixStatus === "failed" && (
                    <div className="text-red-400">❌ Failed</div>
                  )}
                </div>
                
                {/* Log Output */}
                <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto text-xs font-mono">
                  {fixLogs.map((log, idx) => (
                    <div key={idx} className="text-gray-300 mb-1 break-words whitespace-pre-wrap select-text">{log}</div>
                  ))}
                  {fixLogs.length === 0 && (
                    <div className="text-gray-500">Waiting for updates...</div>
                  )}
                  <div ref={fixLogsEndRef} />
                </div>
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
              <div className="space-y-2">
                {sortedGroups.map(([groupKey, groupIssues]) => {
                  const isExpanded = expandedGroups.has(groupKey);
                  const totalPriority = groupIssues.reduce((sum, issue) => sum + issue.priority_score, 0);
                  const avgPriority = Math.round(totalPriority / groupIssues.length);
                  
                  return (
                  <div key={groupKey} className="border border-gray-700 rounded bg-[#1a1a1a]">
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition-colors"
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                        <span className="text-sm font-medium text-gray-200">{groupKey}</span>
                        <span className="text-xs text-gray-500">({groupIssues.length} issues)</span>
                        <span className="text-xs text-purple-400">Avg Priority: {avgPriority}</span>
                      </div>
                    </div>
                    {isExpanded && (
                    <div className="border-t border-gray-700 p-3 space-y-2">
                      {groupIssues.map((issue, idx) => (
                        <div
                          key={`${issue.file}-${issue.line}-${idx}`}
                          className={`border rounded p-3 transition-colors ${
                            selectedIssue === issue
                              ? "border-blue-500 bg-blue-900/20"
                              : "border-gray-700 bg-[#1a1a1a] hover:border-gray-600"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedIssueIds.has(issue.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleIssueSelection(issue.id);
                              }}
                              className="mt-1 cursor-pointer"
                            />
                            <div 
                              className="flex-1 cursor-pointer"
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
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeAnalysisDashboard;
