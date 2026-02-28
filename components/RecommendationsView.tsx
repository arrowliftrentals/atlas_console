"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";
import { engageOpportunityStream } from "@/lib/atlasConsoleClient";
import MarkdownRenderer from "./MarkdownRenderer";

interface StrategicOpportunity {
  id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  rationale: string;
  impact: string;  // Description text
  impact_score: number;  // 1-100
  effort: string;  // Description text  
  effort_score: number;  // 1-100 (lower = easier)
  roi_score: number;
  dependencies: string[];
}

interface CategoryInfo {
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface AnalysisResult {
  timestamp: string;
  overall_strategic_score: number;
  competitive_position: string;
  total_opportunities: number;
  opportunities_by_category: Record<string, number>;
  opportunities_by_priority: Record<string, number>;
  opportunities: StrategicOpportunity[];
  strategic_focus_areas: string[];
  next_steps: string[];
}

const CATEGORY_INFO: Record<string, CategoryInfo> = {
  paradigm_shift: {
    name: "Paradigm Shift",
    icon: "",
    color: "#FFD700",
    description: "Fundamental changes that redefine what AI can do - continuous learning, world models, compositional reasoning.",
  },
  competitive_moat: {
    name: "Competitive Moat",
    icon: "",
    color: "#9333EA",
    description: "Unique capabilities that create defensible advantages competitors can't easily replicate.",
  },
  frontier: {
    name: "Frontier",
    icon: "",
    color: "#06B6D4",
    description: "Cutting-edge AI capabilities at the edge of current research - metacognition, causal reasoning, theory of mind.",
  },
  market_disruption: {
    name: "Market Disruption",
    icon: "",
    color: "#F97316",
    description: "Business model innovations that change how AI is sold and used - new revenue models, platform plays.",
  },
  technical_excellence: {
    name: "Technical Excellence",
    icon: "",
    color: "#3B82F6",
    description: "Engineering improvements to reliability, performance, and developer experience.",
  },
  quick_win: {
    name: "Quick Wins",
    icon: "",
    color: "#22C55E",
    description: "High-impact improvements achievable in days to 2 weeks. Low risk, immediate value.",
  },
};

const POSITION_LABELS: Record<string, { label: string; color: string }> = {
  leading: { label: "Industry Leader", color: "#22C55E" },
  advancing: { label: "Advancing", color: "#3B82F6" },
  developing: { label: "Developing", color: "#F59E0B" },
  emerging: { label: "Emerging", color: "#EF4444" },
};

const RecommendationsView: React.FC = () => {
  const { health } = useHealth();
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"roi" | "impact" | "effort">("roi");

  // Engage ATLAS state — persists results per opportunity
  const [engageResults, setEngageResults] = useState<
    Record<string, { content: string; status: "loading" | "done" | "error" }>
  >({});
  const [engageErrors, setEngageErrors] = useState<Record<string, string>>({});
  const [engageExpanded, setEngageExpanded] = useState<Record<string, boolean>>({});
  const engageControllerRef = useRef<Record<string, AbortController>>({});

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      Object.values(engageControllerRef.current).forEach((c) => c.abort());
    };
  }, []);

  const handleEngage = useCallback((oppId: string) => {
    // Abort any existing stream for this opportunity
    engageControllerRef.current[oppId]?.abort();

    // Reset state
    setEngageResults((prev) => ({ ...prev, [oppId]: { content: "", status: "loading" } }));
    setEngageErrors((prev) => { const n = { ...prev }; delete n[oppId]; return n; });
    setEngageExpanded((prev) => ({ ...prev, [oppId]: true }));

    const controller = engageOpportunityStream(
      oppId,
      "full",
      // onChunk
      (chunk) => {
        setEngageResults((prev) => {
          const existing = prev[oppId] || { content: "", status: "loading" };
          return { ...prev, [oppId]: { ...existing, content: existing.content + chunk } };
        });
      },
      // onDone
      () => {
        setEngageResults((prev) => {
          const existing = prev[oppId];
          if (!existing) return prev;
          return { ...prev, [oppId]: { ...existing, status: "done" } };
        });
      },
      // onError
      (err) => {
        setEngageResults((prev) => {
          const existing = prev[oppId] || { content: "", status: "error" };
          return { ...prev, [oppId]: { ...existing, status: "error" } };
        });
        setEngageErrors((prev) => ({ ...prev, [oppId]: err }));
      },
    );

    engageControllerRef.current[oppId] = controller;
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from analyze endpoint which returns {status, result} or from summary as fallback
      const res = await fetch("http://localhost:8000/v1/recommendations/analyze?force_refresh=false");
      if (!res.ok) throw new Error("Failed to fetch strategic analysis");
      const responseData = await res.json();
      
      // Handle wrapped response: {status: "cached"|"completed", result: {...}}
      // Also handle unwrapped response from summary endpoint
      let analysisData: AnalysisResult;
      if (responseData.result) {
        analysisData = responseData.result;
      } else if (responseData.opportunities) {
        analysisData = responseData;
      } else {
        // Fallback to summary endpoint
        const summaryRes = await fetch("http://localhost:8000/v1/recommendations/summary");
        if (!summaryRes.ok) throw new Error("Failed to fetch recommendations summary");
        const summaryData = await summaryRes.json();
        analysisData = {
          timestamp: summaryData.analysis_time || new Date().toISOString(),
          overall_strategic_score: summaryData.overall_strategic_score || 0,
          competitive_position: summaryData.competitive_position || 'developing',
          total_opportunities: summaryData.total_opportunities || 0,
          opportunities_by_category: summaryData.opportunities_by_category || {},
          opportunities_by_priority: summaryData.opportunities_by_priority || {},
          opportunities: summaryData.top_opportunities || [],
          strategic_focus_areas: [],
          next_steps: [],
        };
      }
      
      setData(analysisData);
    } catch (e) {
      console.error("Recommendations fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const getCategoryInfo = (category: string): CategoryInfo => {
    return CATEGORY_INFO[category] || {
      name: category,
      icon: "📋",
      color: "#6B7280",
      description: "",
    };
  };

  const getPriorityStyles = (priority: string) => {
    const p = priority?.toLowerCase();
    if (p === "critical") return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" };
    if (p === "high") return { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" };
    if (p === "medium") return { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" };
    return { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  // Convert impact score to human-readable label
  const getImpactLabel = (score: number) => {
    if (score >= 90) return "Transformative";
    if (score >= 75) return "Major";
    if (score >= 60) return "Significant";
    if (score >= 40) return "Moderate";
    return "Minor";
  };

  // Convert effort score to human-readable time estimate
  const getEffortLabel = (score: number) => {
    if (score >= 80) return "6+ months";
    if (score >= 60) return "2-6 months";
    if (score >= 40) return "2-8 weeks";
    if (score >= 20) return "1-2 weeks";
    return "Days";
  };

  const filteredOpportunities = (data?.opportunities || [])
    .filter((opp) => {
      if (categoryFilter !== "all" && opp.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && opp.priority?.toLowerCase() !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "roi") return b.roi_score - a.roi_score;
      if (sortBy === "impact") return b.impact_score - a.impact_score;
      return a.effort_score - b.effort_score;
    });

  const positionInfo = POSITION_LABELS[data?.competitive_position || "developing"];

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <TabHeader
        title="Strategic Opportunities"
        subtitle={`${data?.total_opportunities || 0} opportunities identified`}
        statusConnected={health.backend === "connected"}
        statusLabel={health.backend === "connected" ? "Connected" : "Disconnected"}
      >
        <button
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
          onClick={fetchRecommendations}
          disabled={loading}
        >
        {loading ? "Analyzing..." : "Refresh Analysis"}
        </button>
      </TabHeader>

      <div className="flex-1 overflow-hidden flex flex-col">
        {error && (
          <div className="text-red-400 text-sm m-4 p-3 bg-red-500/10 rounded border border-red-500/20">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="text-center text-gray-400 py-8">
            <div>Analyzing strategic opportunities...</div>
          </div>
        ) : (
          <>
            {/* Strategic Summary Header */}
            <div className="px-4 py-4 bg-gradient-to-r from-[#252526] to-[#1E1E1E] border-b border-gray-700">
              <div className="flex items-center gap-6 mb-4">
                {/* Strategic Score */}
                <div className="text-center" title="How well ATLAS is positioned strategically. 100 = all opportunities implemented, 50 = baseline with room to grow.">
                  <div className={`text-4xl font-bold tabular-nums ${getScoreColor(data?.overall_strategic_score || 0)}`}>
                    {data?.overall_strategic_score || 0}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Readiness</div>
                  <div className="text-[9px] text-gray-500">out of 100</div>
                </div>

                {/* Position Badge */}
                <div className="flex-1">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: `${positionInfo.color}20` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: positionInfo.color }}
                    />
                    <span className="text-sm font-medium" style={{ color: positionInfo.color }}>
                      {positionInfo.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {data?.total_opportunities || 0} opportunities across{" "}
                    {Object.keys(data?.opportunities_by_category || {}).length} categories
                  </div>
                </div>

                {/* Category Distribution */}
                <div className="flex gap-4">
                  {Object.entries(data?.opportunities_by_category || {}).map(([cat, count]) => {
                    const info = getCategoryInfo(cat);
                    return (
                      <div
                        key={cat}
                        className="text-center cursor-pointer hover:bg-white/5 rounded px-2 py-1 transition-colors"
                        onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
                        title={info.description}
                      >
                        <div className="text-sm font-bold" style={{ color: info.color }}>
                          {count}
                        </div>
                        <div className="text-[10px] text-gray-500 whitespace-nowrap">{info.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strategic Focus Areas */}
              {data?.strategic_focus_areas && data.strategic_focus_areas.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Focus Areas:</span>
                  {data.strategic_focus_areas.map((area, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="px-4 py-3 bg-[#252526] border-b border-gray-700 flex items-center gap-4 flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase">Category:</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      categoryFilter === "all"
                        ? "bg-purple-500 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    All
                  </button>
                  {Object.keys(CATEGORY_INFO).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      title={CATEGORY_INFO[cat].description}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        categoryFilter === cat
                          ? "text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                      style={categoryFilter === cat ? { backgroundColor: CATEGORY_INFO[cat].color } : {}}
                    >
                      {CATEGORY_INFO[cat].name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase">Priority:</span>
                <div className="flex gap-1">
                  {["all", "critical", "high", "medium", "low"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={`text-xs px-2 py-1 rounded transition-colors capitalize ${
                        priorityFilter === p
                          ? p === "critical"
                            ? "bg-red-500 text-white"
                            : p === "high"
                            ? "bg-orange-500 text-white"
                            : p === "medium"
                            ? "bg-yellow-500 text-black"
                            : p === "low"
                            ? "bg-blue-500 text-white"
                            : "bg-purple-500 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] text-gray-500 uppercase">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "roi" | "impact" | "effort")}
                  className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 border-none outline-none"
                >
                  <option value="roi">ROI Score</option>
                  <option value="impact">Impact Score</option>
                  <option value="effort">Effort (Low First)</option>
                </select>
              </div>
            </div>

            {/* Opportunities List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredOpportunities.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  No opportunities match the current filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOpportunities.map((opp) => {
                    const isExpanded = expandedId === opp.id;
                    const catInfo = getCategoryInfo(opp.category);
                    const priorityStyles = getPriorityStyles(opp.priority);

                    return (
                      <div
                        key={opp.id}
                        className={`rounded-lg border transition-all ${
                          isExpanded
                            ? "border-purple-500/50 bg-purple-500/5"
                            : "border-gray-700 bg-[#252526] hover:border-gray-600"
                        }`}
                      >
                        <button
                          className="w-full p-4 text-left"
                          onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                        >
                          <div className="flex items-start gap-3">
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-white font-medium">{opp.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${priorityStyles.bg} ${priorityStyles.text}`}
                                >
                                  {opp.priority}
                                </span>
                                <span
                                  className="px-2 py-0.5 rounded text-[10px]"
                                  style={{
                                    backgroundColor: `${catInfo.color}20`,
                                    color: catInfo.color,
                                  }}
                                >
                                  {catInfo.name}
                                </span>
                              </div>
                              <div className="text-sm text-gray-400 line-clamp-2">{opp.description}</div>
                            </div>

                            {/* Scores */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-center" title={`ROI = Impact ÷ Effort × 100. Higher is better. This item: ${opp.impact_score} impact ÷ ${opp.effort_score} effort = ${opp.roi_score}`}>
                                <div className="text-lg font-bold text-green-400 tabular-nums">
                                  {opp.roi_score}%
                                </div>
                                <div className="text-[9px] text-gray-500">ROI</div>
                              </div>
                              <div className="text-center" title={`Business impact if implemented: ${getImpactLabel(opp.impact_score)} (${opp.impact_score}/100)`}>
                                <div className={`text-sm font-bold ${getScoreColor(opp.impact_score)}`}>
                                  {getImpactLabel(opp.impact_score)}
                                </div>
                                <div className="text-[9px] text-gray-500">Impact</div>
                              </div>
                              <div className="text-center" title={`Estimated implementation time: ${getEffortLabel(opp.effort_score)} (${opp.effort_score}/100 difficulty)`}>
                                <div className={`text-sm font-bold ${getScoreColor(100 - opp.effort_score)}`}>
                                  {getEffortLabel(opp.effort_score)}
                                </div>
                                <div className="text-[9px] text-gray-500">Effort</div>
                              </div>
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                  Rationale
                                </div>
                                <div className="text-sm text-gray-300">{opp.rationale}</div>

                                {opp.dependencies && opp.dependencies.length > 0 && (
                                  <div className="mt-4">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                      Dependencies
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {opp.dependencies.map((dep, i) => (
                                        <span
                                          key={i}
                                          className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300"
                                        >
                                          {dep}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div>
                                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                  Impact — {getImpactLabel(opp.impact_score)} ({opp.impact_score}/100)
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${getScoreBg(opp.impact_score)}`}
                                      style={{ width: `${opp.impact_score}%` }}
                                    />
                                  </div>
                                </div>
                                <div className="text-sm text-gray-300">{opp.impact}</div>

                                <div className="mt-4">
                                  <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                    Effort — {getEffortLabel(opp.effort_score)} ({opp.effort_score}/100)
                                  </div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${getScoreBg(100 - opp.effort_score)}`}
                                        style={{ width: `${opp.effort_score}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="text-sm text-gray-300">{opp.effort}</div>
                                </div>
                              </div>
                            </div>

                            {/* Engage ATLAS Button + Result */}
                            <div className="mt-6 border-t border-gray-700/50 pt-4">
                              {(() => {
                                const result = engageResults[opp.id];
                                const errMsg = engageErrors[opp.id];
                                const isEngaging = result?.status === "loading";
                                const isDone = result?.status === "done";
                                const isError = result?.status === "error";
                                const hasContent = !!result?.content;
                                const isResultExpanded = engageExpanded[opp.id] ?? false;

                                return (
                                  <>
                                    {/* Button row */}
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEngage(opp.id);
                                        }}
                                        disabled={isEngaging}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{
                                          background: isEngaging
                                            ? `${catInfo.color}15`
                                            : `linear-gradient(135deg, ${catInfo.color}30, ${catInfo.color}15)`,
                                          color: catInfo.color,
                                          border: `1px solid ${catInfo.color}40`,
                                        }}
                                      >
                                        {isEngaging ? (
                                          <>
                                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            ATLAS is analyzing...
                                          </>
                                        ) : isDone ? (
                                          <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Re-engage ATLAS
                                          </>
                                        ) : (
                                          <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Engage ATLAS
                                          </>
                                        )}
                                      </button>

                                      {hasContent && !isEngaging && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEngageExpanded((prev) => ({ ...prev, [opp.id]: !isResultExpanded }));
                                          }}
                                          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                                        >
                                          {isResultExpanded ? "Collapse plan" : "Show plan"}
                                        </button>
                                      )}

                                      {isEngaging && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            engageControllerRef.current[opp.id]?.abort();
                                            setEngageResults((prev) => {
                                              const existing = prev[opp.id];
                                              if (!existing) return prev;
                                              return { ...prev, [opp.id]: { ...existing, status: "done" } };
                                            });
                                          }}
                                          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                    </div>

                                    {/* Error message */}
                                    {isError && errMsg && (
                                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-red-400">{errMsg}</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEngage(opp.id);
                                            }}
                                            className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                          >
                                            Retry
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Streaming result panel */}
                                    {hasContent && isResultExpanded && (
                                      <div className="mt-4 p-4 bg-[#1A1A1E] rounded-lg border border-gray-700/50 max-h-[600px] overflow-auto">
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                                            Implementation Plan
                                            {isEngaging && (
                                              <span className="ml-2 inline-flex">
                                                <span className="animate-pulse">●</span>
                                                <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                                                <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                                              </span>
                                            )}
                                          </div>
                                          {isDone && (
                                            <span className="text-[10px] text-green-400">✓ Complete</span>
                                          )}
                                        </div>
                                        <MarkdownRenderer content={result.content} />
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Next Steps Footer */}
            {data?.next_steps && data.next_steps.length > 0 && (
              <div className="px-4 py-3 bg-[#252526] border-t border-gray-700">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                  Recommended Next Steps
                </div>
                <div className="flex gap-4 flex-wrap">
                  {data.next_steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RecommendationsView;
