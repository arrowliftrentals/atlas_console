"use client";

import React, { useState, useEffect } from "react";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";
import CodeAnalysisDashboard from "./CodeAnalysisDashboard";

interface SandboxResult {
  output: string;
  error: string;
  exit_code: number;
  execution_time: number;
  output_files?: Array<{ name: string; content: string }>;
  resource_usage?: {
    peak_memory_mb: number;
    cpu_time_seconds: number;
  };
}

interface HealthStatus {
  status: string;
  docker_available: boolean;
  image_status?: string;
  error?: string;
}

interface HistoryExecution {
  id: string;
  language: string;
  code: string;
  success: boolean;
  execution_time: number;
  timestamp: string;
}

interface Statistics {
  total_executions: number;
  success_rate: number;
  avg_execution_time: number;
  by_language: Record<string, number | { count: number }>;
}

interface Proposal {
  proposal_id: string;
  description: string;
  diff?: string;
  test_passed?: boolean;
  sandbox_path?: string;
  changes?: Array<{
    file_path: string;
    diff: string;
    rationale: string;
  }>;
}

const SandboxView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"executor" | "history" | "stats" | "proposals" | "analysis">("executor");
  
  // Executor state
  const [code, setCode] = useState<string>("print(2 + 2)");
  const [language, setLanguage] = useState<string>("python");
  const [networkMode, setNetworkMode] = useState<string>("none");
  const [timeout, setTimeout] = useState<number>(30);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Health state
  const [health, setHealth] = useState<HealthStatus | null>(null);
  
  // History state
  const [history, setHistory] = useState<HistoryExecution[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Statistics state
  const [stats, setStats] = useState<Statistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // Proposals state
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);

  // Load health on mount
  useEffect(() => {
    loadHealth();
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    } else if (activeTab === "stats") {
      loadStats();
    } else if (activeTab === "proposals") {
      loadProposals();
    }
  }, [activeTab]);

  const loadHealth = async () => {
    try {
      const res = await fetch("/api/sandbox/health");
      const data = await res.json();
      setHealth(data);
    } catch (e) {
      console.error("Failed to load health:", e);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/sandbox/history?limit=50");
      const data = await res.json();
      setHistory(data.executions || []);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/sandbox/statistics");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadProposals = async () => {
    setProposalsLoading(true);
    try {
      const res = await fetch("/api/sandbox/proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (e) {
      console.error("Failed to load proposals:", e);
    } finally {
      setProposalsLoading(false);
    }
  };

  const loadProposalDetails = async (proposalId: string) => {
    console.log("Loading proposal details for:", proposalId);
    try {
      // Call backend directly (Next.js dynamic routes not working with Turbopack)
      const atlasApiBase = process.env.NEXT_PUBLIC_ATLAS_API_BASE || "http://127.0.0.1:8000";
      const res = await fetch(`${atlasApiBase}/api/proposals/${proposalId}`);
      console.log("Response status:", res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to load proposal:", res.status, errorText);
        return;
      }
      
      const data = await res.json();
      console.log("Proposal data:", data);
      
      // Update the proposal in the list with full details
      setProposals(prev => prev.map(p => 
        p.proposal_id === proposalId 
          ? { ...p, changes: data.changes } 
          : p
      ));
      
      console.log("Proposal updated with changes:", data.changes?.length);
    } catch (e) {
      console.error("Failed to load proposal details:", e);
    }
  };

  const runCode = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          network_mode: networkMode !== "none" ? networkMode : undefined,
          timeout_seconds: timeout,
        }),
      });

      const data = await res.json();
      setResult(data);
      
      // Reload health after execution
      loadHealth();
    } catch (e: any) {
      console.error("SandboxView error:", e);
      setResult({
        output: "",
        error: "Failed to call sandbox API.",
        exit_code: -1,
        execution_time: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryItem = (item: HistoryExecution) => {
    setCode(item.code);
    setLanguage(item.language);
    setActiveTab("executor");
  };

  const applyProposal = async (proposalId: string) => {
    if (!confirm("Apply this proposal to the repository?")) return;
    
    try {
      const res = await fetch("/api/sandbox/apply-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId, run_tests: true }),
      });
      const data = await res.json();
      
      if (data.success) {
        alert("Changes applied successfully!");
        loadProposals();
      } else {
        alert(`Failed to apply: ${data.error || data.message}`);
      }
    } catch (e) {
      console.error("Failed to apply proposal:", e);
      alert("Failed to apply proposal");
    }
  };

  const rollbackProposal = async (proposalId: string) => {
    if (!confirm("Discard this proposal?")) return;
    
    try {
      const res = await fetch(`/api/sandbox/rollback-changes?proposal_id=${proposalId}`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (data.success) {
        loadProposals();
      }
    } catch (e) {
      console.error("Failed to rollback proposal:", e);
    }
  };

  const getHealthStatusColor = () => {
    if (!health) return "text-gray-400";
    if (health.status === "healthy") return "text-green-400";
    if (health.status === "unhealthy") return "text-red-400";
    return "text-yellow-400";
  };

  const { health: globalHealth } = useHealth();
  const sandboxHealthy = health?.status === "healthy" && health?.docker_available;

  return (
    <div className="h-full w-full flex flex-col text-sm text-gray-200 bg-[#1E1E1E]">
      <TabHeader
        title="Sandbox Executor"
        subtitle={health?.docker_available ? "Docker available" : "Docker unavailable"}
        statusConnected={sandboxHealthy}
        statusLabel={sandboxHealthy ? "Healthy" : "Unhealthy"}
      >
        <button
          onClick={loadHealth}
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
        >
          Refresh Health
        </button>
      </TabHeader>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700 bg-[#1a1a1a] px-4 flex gap-1">
        <button
          onClick={() => setActiveTab("executor")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "executor"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Executor
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "stats"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Statistics
        </button>
        <button
          onClick={() => setActiveTab("proposals")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "proposals"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Proposals
        </button>
        <button
          onClick={() => setActiveTab("analysis")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "analysis"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Code Analysis
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "executor" && (
          <div className="p-4 flex flex-col gap-3 h-full">
            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 items-center">
                <select
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="python">Python</option>
                  <option value="shell">Shell</option>
                  <option value="javascript">JavaScript</option>
                  <option value="go">Go</option>
                  <option value="rust">Rust</option>
                </select>
                
                <select
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                  value={networkMode}
                  onChange={(e) => setNetworkMode(e.target.value)}
                >
                  <option value="none">No Network</option>
                  <option value="restricted">Restricted</option>
                  <option value="full">Full Network</option>
                </select>
                
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  Timeout:
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={timeout}
                    onChange={(e) => setTimeout(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-16 text-xs"
                  />
                  <span>s</span>
                </label>
              </div>
              
              <button
                className="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1 rounded disabled:opacity-50 font-medium"
                onClick={runCode}
                disabled={loading}
              >
                {loading ? "Running..." : "Execute"}
              </button>
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col gap-2">
              <textarea
                className="flex-1 bg-[#1e1e1e] border border-gray-700 rounded px-3 py-2 text-xs font-mono resize-none"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={language === "python" ? "print('Hello from Atlas sandbox!')" : "echo 'Hello from Atlas sandbox!'"}
              />
              
              {/* Results */}
              {result && result.error && (
                <div className="border border-red-700 rounded bg-red-900/20 text-xs p-3">
                  <div className="font-semibold mb-2 text-red-400">Error:</div>
                  <pre className="text-red-300 whitespace-pre-wrap font-mono">{result.error}</pre>
                </div>
              )}
              
              {result && result.output && (
                <div className="border border-gray-700 rounded bg-[#1e1e1e] text-xs p-3">
                  <div className="font-semibold mb-2 text-green-400">Output:</div>
                  <pre className="whitespace-pre-wrap font-mono text-gray-200">{result.output}</pre>
                  
                  <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-gray-400">
                    <div className="flex gap-4">
                      <span>Exit code: {result.exit_code}</span>
                      <span>Time: {result?.execution_time?.toFixed(3) ?? "N/A"}s</span>
                      {result.resource_usage && (
                        <>
                          <span>Memory: {result.resource_usage.peak_memory_mb.toFixed(1)} MB</span>
                          <span>CPU: {result.resource_usage.cpu_time_seconds.toFixed(3)}s</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {result.output_files && result.output_files.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="font-semibold mb-2 text-blue-400">Output Files:</div>
                      <div className="space-y-2">
                        {result.output_files.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-800 rounded px-2 py-1">
                            <span className="font-mono">{file.name}</span>
                            <button
                              onClick={() => {
                                const blob = new Blob([file.content], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = file.name;
                                a.click();
                              }}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {!result && !loading && (
                <div className="text-xs text-gray-400 p-3 border border-gray-700 rounded bg-gray-800/30">
                  Execute code in Atlas's sandbox environment. Supports multiple languages with configurable network access and resource limits.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Execution History</h2>
              <button
                onClick={loadHistory}
                className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700 hover:border-gray-600"
              >
                Refresh
              </button>
            </div>
            
            {historyLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : history.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No execution history yet</div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-700 rounded p-3 bg-[#1e1e1e] hover:border-gray-600 cursor-pointer transition-colors"
                    onClick={() => loadHistoryItem(item)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded">{item.language}</span>
                        <span className={`text-xs ${item.success ? "text-green-400" : "text-red-400"}`}>
                          {item.success ? "✓ Success" : "✗ Failed"}
                        </span>
                        <span className="text-xs text-gray-400">{item?.execution_time?.toFixed(3) ?? "N/A"}s</span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <pre className="text-xs font-mono text-gray-300 line-clamp-2">{item.code}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Statistics</h2>
              <button
                onClick={loadStats}
                className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700 hover:border-gray-600"
              >
                Refresh
              </button>
            </div>
            
            {statsLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : !stats ? (
              <div className="text-center text-gray-400 py-8">No statistics available</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-gray-700 rounded p-4 bg-[#1e1e1e]">
                  <div className="text-2xl font-bold text-blue-400">{stats.total_executions}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Executions</div>
                </div>
                
                <div className="border border-gray-700 rounded p-4 bg-[#1e1e1e]">
                  <div className="text-2xl font-bold text-green-400">{(stats.success_rate * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-400 mt-1">Success Rate</div>
                </div>
                
                <div className="border border-gray-700 rounded p-4 bg-[#1e1e1e]">
                  <div className="text-2xl font-bold text-purple-400">{stats?.avg_execution_time?.toFixed(3) ?? "0.000"}s</div>
                  <div className="text-xs text-gray-400 mt-1">Avg Execution Time</div>
                </div>
                
                <div className="border border-gray-700 rounded p-4 bg-[#1e1e1e]">
                  <div className="text-xs text-gray-400 mb-2">By Language</div>
                  <div className="space-y-1">
                    {Object.entries(stats.by_language).map(([lang, data]) => (
                      <div key={lang} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">{lang}</span>
                        <span className="text-gray-400">{typeof data === 'object' ? data.count : data}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "proposals" && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Change Proposals</h2>
              <button
                onClick={loadProposals}
                className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700 hover:border-gray-600"
              >
                Refresh
              </button>
            </div>
            
            {proposalsLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : proposals.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No active proposals</div>
            ) : (
              <div className="space-y-3">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.proposal_id}
                    className="border border-gray-700 rounded bg-[#1e1e1e]"
                  >
                    <div className="p-3 border-b border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded">{proposal.proposal_id}</span>
                          {proposal.test_passed !== undefined && (
                            <span className={`text-xs ${proposal.test_passed ? "text-green-400" : "text-red-400"}`}>
                              Tests: {proposal.test_passed ? "✓ Passed" : "✗ Failed"}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => applyProposal(proposal.proposal_id)}
                            className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => rollbackProposal(proposal.proposal_id)}
                            className="text-xs bg-red-600 hover:bg-red-500 px-2 py-1 rounded"
                          >
                            Discard
                          </button>
                          <button
                            onClick={async () => {
                              console.log("View Diff clicked for:", proposal.proposal_id);
                              console.log("Current selectedProposal:", selectedProposal);
                              console.log("Proposal has changes:", !!proposal.changes);
                              
                              if (selectedProposal === proposal.proposal_id) {
                                console.log("Hiding diff");
                                setSelectedProposal(null);
                              } else {
                                console.log("Showing diff");
                                setSelectedProposal(proposal.proposal_id);
                                if (!proposal.changes) {
                                  console.log("Fetching proposal details...");
                                  await loadProposalDetails(proposal.proposal_id);
                                } else {
                                  console.log("Using cached changes");
                                }
                              }
                            }}
                            className="text-xs border border-gray-600 hover:border-gray-500 px-2 py-1 rounded"
                          >
                            {selectedProposal === proposal.proposal_id ? "Hide" : "View"} Diff
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-300">{proposal.description}</div>
                      {proposal.sandbox_path && (
                        <div className="text-xs text-gray-500 mt-1 font-mono">{proposal.sandbox_path}</div>
                      )}
                    </div>
                    
                    {selectedProposal === proposal.proposal_id && proposal.changes && (
                      <div className="p-3 space-y-3">
                        {proposal.changes.map((change, idx) => (
                          <div key={idx} className="border border-gray-700 rounded">
                            <div className="bg-gray-800 px-3 py-2 text-xs font-semibold">
                              {change.file_path}
                            </div>
                            <div className="p-3">
                              <div className="text-xs text-gray-400 mb-2">{change.rationale}</div>
                              <pre className="text-xs font-mono whitespace-pre-wrap bg-black/40 rounded p-2 overflow-x-auto max-h-96 overflow-y-auto">{change.diff}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "analysis" && (
          <CodeAnalysisDashboard />
        )}
      </div>
    </div>
  );
};

export default SandboxView;
