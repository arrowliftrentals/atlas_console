
import React, { useEffect, useState, useCallback } from "react";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

// Types
interface DriftItem {
  type: string;
  file: string;
  line: number;
  documented: string;
  suggested: string | null;
  decision: "apply" | "reject" | "defer" | "modify";
  reasoning: string;
  confidence: number;
  userDecision?: "approve" | "reject" | "skip";
}

interface DriftStatistics {
  audit_log: {
    total_entries: number;
    applied: number;
    rolled_back: number;
    by_type: Record<string, number>;
  };
  current_drift: {
    total: number;
    high_confidence: number;
    by_type: Record<string, number>;
  };
  codebase: {
    files: number;
    classes: number;
    functions: number;
    endpoints: number;
  };
}

interface ReviewResult {
  status: string;
  total_reviewed: number;
  decisions: {
    apply: number;
    modify: number;
    reject: number;
    defer: number;
  };
  reviews: DriftItem[];
  errors: string[];
}

interface ApplyResult {
  status: string;
  changes_applied: number;
  files_modified: number;
  change_ids: string[];
  changes: Array<{
    change_id: string;
    file: string;
    line: number;
    original: string;
    new: string;
  }>;
  errors: string[];
}

const atlasApiBase = 
  typeof window !== 'undefined'
    ? (window as any).__ATLAS_API_BASE || ""
    : "";

const DriftReviewView: React.FC = () => {
  const { health } = useHealth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DriftStatistics | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [driftItems, setDriftItems] = useState<DriftItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "review">("list");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDecision, setFilterDecision] = useState<string>("all");

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${atlasApiBase}/v1/documentation/drift/statistics`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch drift stats:", e);
    }
  }, []);

  // Fetch review
  const fetchReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${atlasApiBase}/v1/documentation/drift/review?min_confidence=0.5`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch review: ${res.status}`);
      }
      const data: ReviewResult = await res.json();
      setReviewResult(data);
      setDriftItems(data.reviews.map(r => ({ ...r, userDecision: undefined })));
      setCurrentIndex(0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Apply approved changes
  const applyChanges = useCallback(async () => {
    // Get items user approved
    const approvedCount = driftItems.filter(d => d.userDecision === "approve").length;
    
    if (approvedCount === 0) {
      setError("No items approved. Review items and click Approve first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${atlasApiBase}/v1/documentation/drift/apply?min_confidence=0.5&max_changes=${approvedCount}`,
        { method: "POST" }
      );
      if (!res.ok) {
        throw new Error(`Failed to apply changes: ${res.status}`);
      }
      const data: ApplyResult = await res.json();
      setApplyResult(data);
      
      // Refresh stats and review
      await fetchStats();
      await fetchReview();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [driftItems, fetchStats, fetchReview]);

  // Initial load - auto-fetch review on mount
  useEffect(() => {
    fetchStats();
    fetchReview(); // Auto-load items needing review
  }, [fetchStats, fetchReview]);

  // Handle user decision on current item
  const handleDecision = (decision: "approve" | "reject" | "skip") => {
    const updated = [...driftItems];
    updated[currentIndex] = { ...updated[currentIndex], userDecision: decision };
    setDriftItems(updated);
    
    // Auto-advance to next item
    if (currentIndex < driftItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Filter items - by default only show items needing human review (defer)
  const filteredItems = driftItems.filter(item => {
    if (filterType !== "all" && item.type !== filterType) return false;
    // Default "all" means only items needing human review
    if (filterDecision === "all") return item.decision === "defer";
    if (filterDecision === "show-all") return true;
    if (filterDecision !== item.decision) return false;
    return true;
  });

  // Get counts
  const approvedCount = driftItems.filter(d => d.userDecision === "approve").length;
  const rejectedCount = driftItems.filter(d => d.userDecision === "reject").length;
  const skippedCount = driftItems.filter(d => d.userDecision === "skip").length;
  const pendingCount = driftItems.filter(d => !d.userDecision).length;

  // Drift type colors
  const typeColors: Record<string, string> = {
    file_path: "bg-blue-600",
    class_name: "bg-purple-600",
    function_name: "bg-green-600",
    api_endpoint: "bg-orange-600",
    import_path: "bg-cyan-600",
    broken_link: "bg-red-600",
  };

  // Decision colors
  const decisionColors: Record<string, string> = {
    apply: "text-green-400",
    reject: "text-red-400",
    defer: "text-yellow-400",
    modify: "text-blue-400",
  };

  return (
    <div className="h-full flex flex-col bg-[var(--atlas-bg-body)]">
      <TabHeader
        title="Drift Review"
        subtitle={stats ? `${stats.current_drift.total} drifts detected` : "Loading..."}
        statusConnected={health.backend === "connected"}
        statusLabel={health.backend === "connected" ? "Connected" : "Disconnected"}
      >
        <div className="flex gap-2">
          <button
            className="px-3 py-2 bg-[var(--atlas-bg-elevated)] hover:bg-[var(--atlas-bg-hover)] border border-[var(--atlas-border)] rounded text-xs text-[var(--atlas-text-secondary)] transition-colors"
            onClick={fetchReview}
            disabled={loading}
          >
            {loading ? "Loading..." : "Scan & Review"}
          </button>
          {approvedCount > 0 && (
            <button
              className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs text-white font-medium transition-colors"
              onClick={applyChanges}
              disabled={loading}
            >
              Apply {approvedCount} Changes
            </button>
          )}
        </div>
      </TabHeader>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Stats & Controls */}
        <div className="w-64 border-r border-[var(--atlas-border)] p-4 overflow-auto">
          {/* Statistics */}
          {stats && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-[var(--atlas-text-muted)] uppercase mb-2">
                  Current Drift
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--atlas-text-secondary)]">Total</span>
                    <span className="text-[var(--atlas-text-primary)] font-medium">{stats.current_drift.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--atlas-text-secondary)]">High Confidence</span>
                    <span className="text-orange-400 font-medium">{stats.current_drift.high_confidence}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--atlas-text-muted)] uppercase mb-2">
                  By Type
                </h3>
                <div className="space-y-1 text-xs">
                  {Object.entries(stats.current_drift.by_type).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className={`px-2 py-0.5 rounded text-white ${typeColors[type] || "bg-gray-600"}`}>
                        {type.replace("_", " ")}
                      </span>
                      <span className="text-[var(--atlas-text-secondary)]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--atlas-text-muted)] uppercase mb-2">
                  Audit Log
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--atlas-text-secondary)]">Applied</span>
                    <span className="text-green-400">{stats.audit_log.applied}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--atlas-text-secondary)]">Rolled Back</span>
                    <span className="text-red-400">{stats.audit_log.rolled_back}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[var(--atlas-text-muted)] uppercase mb-2">
                  Codebase
                </h3>
                <div className="space-y-1 text-xs text-[var(--atlas-text-secondary)]">
                  <div>{stats.codebase.files} files</div>
                  <div>{stats.codebase.classes} classes</div>
                  <div>{stats.codebase.functions} functions</div>
                </div>
              </div>
            </div>
          )}

          {/* Review Progress */}
          {driftItems.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[var(--atlas-border)]">
              <h3 className="text-xs font-semibold text-[var(--atlas-text-muted)] uppercase mb-2">
                Review Progress
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-400">✓ Approved</span>
                  <span>{approvedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">✗ Rejected</span>
                  <span>{rejectedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">→ Skipped</span>
                  <span>{skippedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--atlas-text-muted)]">○ Pending</span>
                  <span>{pendingCount}</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-2 h-2 bg-[var(--atlas-bg-elevated)] rounded overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${((approvedCount + rejectedCount + skippedCount) / driftItems.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Filters */}
          {driftItems.length > 0 && (
            <div className="mt-6 pt-4 border-t border-[var(--atlas-border)]">
              <h3 className="text-xs font-semibold text-[var(--atlas-text-muted)] uppercase mb-2">
                Filters
              </h3>
              <div className="space-y-2">
                <select
                  className="w-full px-2 py-1 text-xs bg-[var(--atlas-bg-elevated)] border border-[var(--atlas-border)] rounded text-[var(--atlas-text-secondary)]"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="file_path">File Path</option>
                  <option value="class_name">Class Name</option>
                  <option value="function_name">Function Name</option>
                  <option value="broken_link">Broken Link</option>
                </select>
                <select
                  className="w-full px-2 py-1 text-xs bg-[var(--atlas-bg-elevated)] border border-[var(--atlas-border)] rounded text-[var(--atlas-text-secondary)]"
                  value={filterDecision}
                  onChange={(e) => setFilterDecision(e.target.value)}
                >
                  <option value="all">Needs Human Review</option>
                  <option value="show-all">Show All (396 items)</option>
                  <option value="apply">Auto-Fix (100 items)</option>
                  <option value="reject">Auto-Reject (183 items)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-600 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {applyResult && applyResult.changes_applied > 0 && (
            <div className="mb-4 p-3 bg-green-900/20 border border-green-600 rounded text-green-400 text-sm">
              ✓ Applied {applyResult.changes_applied} changes to {applyResult.files_modified} files.
              Change IDs: {applyResult.change_ids.join(", ")}
            </div>
          )}

          {!reviewResult && !loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-pulse w-8 h-8 border-2 border-[var(--atlas-text-muted)] border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-[var(--atlas-text-secondary)]">Loading drift items...</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-[var(--atlas-accent-primary)] border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-[var(--atlas-text-secondary)]">Scanning documentation...</p>
              </div>
            </div>
          )}

          {/* Review Mode - One at a time */}
          {reviewResult && driftItems.length > 0 && viewMode === "review" && (
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-[var(--atlas-text-primary)]">
                  Item {currentIndex + 1} of {filteredItems.length}
                </h2>
                <button
                  className="text-xs text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)]"
                  onClick={() => setViewMode("list")}
                >
                  Switch to List View
                </button>
              </div>

              {filteredItems[currentIndex] && (
                <div className="bg-[var(--atlas-bg-elevated)] border border-[var(--atlas-border)] rounded-lg p-6">
                  {/* Type Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`px-2 py-1 rounded text-xs text-white font-medium ${typeColors[filteredItems[currentIndex].type] || "bg-gray-600"}`}>
                      {filteredItems[currentIndex].type.replace("_", " ")}
                    </span>
                    <span className={`text-xs font-medium ${decisionColors[filteredItems[currentIndex].decision]}`}>
                      AI recommends: {filteredItems[currentIndex].decision.toUpperCase()}
                    </span>
                    <span className="text-xs text-[var(--atlas-text-muted)]">
                      ({Math.round(filteredItems[currentIndex].confidence * 100)}% confidence)
                    </span>
                  </div>

                  {/* File Location */}
                  <div className="mb-4">
                    <div className="text-xs text-[var(--atlas-text-muted)] mb-1">Location</div>
                    <code className="text-sm text-[var(--atlas-text-primary)] bg-[var(--atlas-bg-body)] px-2 py-1 rounded">
                      {filteredItems[currentIndex].file}:{filteredItems[currentIndex].line}
                    </code>
                  </div>

                  {/* Current Value */}
                  <div className="mb-4">
                    <div className="text-xs text-[var(--atlas-text-muted)] mb-1">Documented (current)</div>
                    <div className="p-3 bg-red-900/20 border border-red-600/30 rounded font-mono text-sm text-red-300">
                      {filteredItems[currentIndex].documented}
                    </div>
                  </div>

                  {/* Suggested Value */}
                  {filteredItems[currentIndex].suggested && (
                    <div className="mb-4">
                      <div className="text-xs text-[var(--atlas-text-muted)] mb-1">Suggested (fix)</div>
                      <div className="p-3 bg-green-900/20 border border-green-600/30 rounded font-mono text-sm text-green-300">
                        {filteredItems[currentIndex].suggested}
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  <div className="mb-6">
                    <div className="text-xs text-[var(--atlas-text-muted)] mb-1">AI Reasoning</div>
                    <p className="text-sm text-[var(--atlas-text-secondary)]">
                      {filteredItems[currentIndex].reasoning}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      className={`flex-1 py-3 rounded font-medium transition-colors ${
                        filteredItems[currentIndex].userDecision === "approve"
                          ? "bg-green-600 text-white"
                          : "bg-green-600/20 text-green-400 hover:bg-green-600/40 border border-green-600"
                      }`}
                      onClick={() => handleDecision("approve")}
                    >
                      ✓ Approve Fix
                    </button>
                    <button
                      className={`flex-1 py-3 rounded font-medium transition-colors ${
                        filteredItems[currentIndex].userDecision === "reject"
                          ? "bg-red-600 text-white"
                          : "bg-red-600/20 text-red-400 hover:bg-red-600/40 border border-red-600"
                      }`}
                      onClick={() => handleDecision("reject")}
                    >
                      ✗ Reject
                    </button>
                    <button
                      className={`flex-1 py-3 rounded font-medium transition-colors ${
                        filteredItems[currentIndex].userDecision === "skip"
                          ? "bg-yellow-600 text-white"
                          : "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 border border-yellow-600"
                      }`}
                      onClick={() => handleDecision("skip")}
                    >
                      → Skip
                    </button>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-4 pt-4 border-t border-[var(--atlas-border)]">
                    <button
                      className="px-4 py-2 text-sm text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text-primary)] disabled:opacity-50"
                      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                      disabled={currentIndex === 0}
                    >
                      ← Previous
                    </button>
                    <button
                      className="px-4 py-2 text-sm text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text-primary)] disabled:opacity-50"
                      onClick={() => setCurrentIndex(Math.min(filteredItems.length - 1, currentIndex + 1))}
                      disabled={currentIndex >= filteredItems.length - 1}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List Mode */}
          {reviewResult && driftItems.length > 0 && viewMode === "list" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-[var(--atlas-text-primary)]">
                  {filteredItems.length} Items
                </h2>
                <button
                  className="text-xs text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)]"
                  onClick={() => setViewMode("review")}
                >
                  Switch to Review Mode
                </button>
              </div>

              <div className="border border-[var(--atlas-border)] rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--atlas-bg-elevated)]">
                    <tr className="border-b border-[var(--atlas-border)]">
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)] w-8">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)] w-24">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)]">File</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)]">Documented</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)]">Suggested</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)] w-20">AI</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--atlas-text-muted)] w-24">Your Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr 
                        key={idx} 
                        className={`border-b border-[var(--atlas-border)] hover:bg-[var(--atlas-bg-hover)] cursor-pointer ${
                          item.userDecision === "approve" ? "bg-green-900/10" :
                          item.userDecision === "reject" ? "bg-red-900/10" :
                          item.userDecision === "skip" ? "bg-yellow-900/10" : ""
                        }`}
                        onClick={() => { setCurrentIndex(idx); setViewMode("review"); }}
                      >
                        <td className="px-3 py-2 text-[var(--atlas-text-muted)]">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] text-white ${typeColors[item.type] || "bg-gray-600"}`}>
                            {item.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[var(--atlas-text-secondary)]">
                          {item.file.split("/").pop()}:{item.line}
                        </td>
                        <td className="px-3 py-2 text-red-300 font-mono truncate max-w-48" title={item.documented}>
                          {item.documented}
                        </td>
                        <td className="px-3 py-2 text-green-300 font-mono truncate max-w-48" title={item.suggested || ""}>
                          {item.suggested || "-"}
                        </td>
                        <td className={`px-3 py-2 font-medium ${decisionColors[item.decision]}`}>
                          {item.decision}
                        </td>
                        <td className="px-3 py-2">
                          {item.userDecision === "approve" && <span className="text-green-400">✓ Approved</span>}
                          {item.userDecision === "reject" && <span className="text-red-400">✗ Rejected</span>}
                          {item.userDecision === "skip" && <span className="text-yellow-400">→ Skipped</span>}
                          {!item.userDecision && <span className="text-[var(--atlas-text-muted)]">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DriftReviewView;
