
import React, { useState, useEffect } from "react";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

interface MemoryLayer {
  layer: string;
  purpose: string;
  status: string;
  className: string;
  methodCount: number;
  hasRealData: boolean;
  dataVolume: string;
  module: string;
  apiMethods: string[];
}

interface MemoryStats {
  layers: Record<string, MemoryLayer>;
  scores?: {
    implementation_completeness?: number;
    data_flow_verification?: number;
    integration_maturity?: number;
    overall_memory_score?: number;
  };
  integration?: Record<string, unknown>;
}

const MemoryView: React.FC = () => {
  const { health } = useHealth();
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);
  const [detailedStats, setDetailedStats] = useState<Record<string, unknown> | null>(null);

  const fetchMemoryData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch memory stats (always available)
      const statsRes = await fetch("/api/memory/stats");
      if (!statsRes.ok) throw new Error("Failed to fetch memory stats");
      const statsData = await statsRes.json();
      setDetailedStats(statsData);
      
      // Layer metadata
      const layerMeta: Record<string, { purpose: string; className: string; module: string }> = {
        l1: { purpose: "Working Memory - Active conversation context", className: "L1WorkingMemory", module: "src.memory.l1_working" },
        l2: { purpose: "Short-term Memory - Recent interactions (24h)", className: "L2ShortTerm", module: "src.memory.l2_short_term" },
        l3: { purpose: "Episodic Memory - Event sequences and experiences", className: "L3Episodic", module: "src.memory.l3_episodic" },
        l4: { purpose: "Declarative Memory - Facts and knowledge", className: "L4Declarative", module: "src.memory.l4_declarative" },
        l5: { purpose: "Procedural Memory - Skills and procedures", className: "L5Procedural", module: "src.memory.l5_procedural" },
        l6: { purpose: "Attention Memory - Focus and context tracking", className: "L6Attention", module: "src.memory.l6_attention" },
        l7: { purpose: "World State Memory - Environment snapshots", className: "L7WorldState", module: "src.memory.l7_world_state" },
        l8: { purpose: "Goals Memory - Planning and goal hierarchies", className: "L8Goals", module: "src.memory.l8_goals" },
        l9: { purpose: "Social Memory - User profiles and interactions", className: "L9Social", module: "src.memory.l9_social" },
        l10: { purpose: "Vector Memory - Semantic retrieval (ChromaDB)", className: "L10Vector", module: "src.memory.l10_vector" },
      };
      
      // Build layers from stats data
      const layers: Record<string, MemoryLayer> = {};
      
      for (const [key, stats] of Object.entries(statsData)) {
        if (!key.startsWith('l')) continue;
        const s = stats as Record<string, unknown>;
        const meta = layerMeta[key] || { purpose: key, className: key, module: "" };
        
        // Extract record count based on layer
        let recordCount = 0;
        let dataVolume = "N/A";
        if (key === 'l1') { recordCount = (s.active_conversations as number) || 0; dataVolume = `${recordCount} conversations`; }
        else if (key === 'l2') { recordCount = (s.recent_conversations as number) || 0; dataVolume = `${recordCount} recent`; }
        else if (key === 'l3') { recordCount = (s.total_episodes as number) || 0; dataVolume = `${recordCount} episodes`; }
        else if (key === 'l4') { recordCount = (s.valid_facts as number) || 0; dataVolume = `${recordCount.toLocaleString()} facts`; }
        else if (key === 'l5') { recordCount = (s.total_skills as number) || 0; dataVolume = `${recordCount} skills`; }
        else if (key === 'l6') { recordCount = (s.db_focus_states as number) || (s.focus_states_tracked as number) || (s.total_states as number) || 0; dataVolume = `${recordCount} states`; }
        else if (key === 'l7') { recordCount = (s.total_snapshots as number) || 0; dataVolume = `${recordCount} snapshots`; }
        else if (key === 'l8') { recordCount = (s.total_goals as number) || 0; dataVolume = `${recordCount} goals`; }
        else if (key === 'l9') { recordCount = (s.total_users as number) || 0; dataVolume = `${recordCount} users`; }
        else if (key === 'l10') { recordCount = (s.total_messages as number) || (s.index_size as number) || 0; dataVolume = `${recordCount.toLocaleString()} vectors`; }
        
        // If the backend returns stats for a layer, it IS operational.
        // "active" = has data, "ready" = operational but empty (not "initialized")
        layers[key.toUpperCase()] = {
          layer: key.toUpperCase(),
          purpose: meta.purpose,
          status: recordCount > 0 ? "active" : "ready",
          className: meta.className,
          methodCount: Object.keys(s).length,
          hasRealData: recordCount > 0,
          dataVolume,
          module: meta.module,
          apiMethods: Object.keys(s),
        };
      }
      
      // Calculate scores from data
      const layerCount = Object.keys(layers).length;
      const activeCount = Object.values(layers).filter(l => l.hasRealData).length;
      const implementationScore = Math.round((layerCount / 10) * 100);
      const dataFlowScore = Math.round((activeCount / layerCount) * 100);
      
      setMemoryStats({
        layers,
        scores: {
          implementation_completeness: implementationScore,
          data_flow_verification: dataFlowScore,
          integration_maturity: Math.round((implementationScore + dataFlowScore) / 2),
          overall_memory_score: Math.round((implementationScore + dataFlowScore) / 2),
        },
      });
    } catch (e) {
      console.error("Memory fetch error:", e);
      setError(e instanceof Error ? e.message : "Failed to load memory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemoryData();
    const interval = setInterval(fetchMemoryData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string, hasData: boolean) => {
    if (status === "active" || status === "operational" || status === "healthy") {
      return hasData ? "text-green-400" : "text-blue-400";
    }
    if (status === "ready") return "text-blue-400"; // Operational but empty
    if (status === "degraded") return "text-yellow-400";
    if (status === "error") return "text-red-400";
    return "text-gray-400";
  };

  const getStatusBg = (status: string, hasData: boolean) => {
    if (status === "active" || status === "operational" || status === "healthy") {
      return hasData ? "bg-green-500/20" : "bg-blue-500/20";
    }
    if (status === "ready") return "bg-blue-500/20"; // Operational but empty
    if (status === "degraded") return "bg-yellow-500/20";
    if (status === "error") return "bg-red-500/20";
    return "bg-gray-500/20";
  };

  const sortedLayers = memoryStats
    ? Object.entries(memoryStats.layers).sort(([a], [b]) => {
        const aNum = parseInt(a.replace("L", ""), 10) || 0;
        const bNum = parseInt(b.replace("L", ""), 10) || 0;
        return aNum - bNum;
      })
    : [];

  const activeCount = sortedLayers.filter(
    ([, layer]) => layer.status === "active" && layer.hasRealData
  ).length;

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <TabHeader
        title="Memory Architecture"
        subtitle={`L1-L10 Memory Layers · ${activeCount}/${sortedLayers.length} active with data`}
        statusConnected={health.backend === "connected"}
        statusLabel={health.backend === "connected" ? "Connected" : "Disconnected"}
      >
        <button
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
          onClick={fetchMemoryData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </TabHeader>

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded border border-red-500/20">
            {error}
          </div>
        )}

        {loading && !memoryStats ? (
          <div className="text-center text-gray-400 py-8">Loading memory layers...</div>
        ) : (
          <div className="space-y-6">
            {/* Scores Overview */}
            {memoryStats?.scores && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Implementation", value: memoryStats.scores.implementation_completeness },
                  { label: "Data Flow", value: memoryStats.scores.data_flow_verification },
                  { label: "Integration", value: memoryStats.scores.integration_maturity },
                  { label: "Overall", value: memoryStats.scores.overall_memory_score },
                ].map((score) => (
                  <div
                    key={score.label}
                    className="p-4 bg-[#252526] rounded-lg border border-gray-700"
                  >
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                      {score.label}
                    </div>
                    <div
                      className={`text-2xl font-bold tabular-nums ${
                        (score.value ?? 0) >= 80
                          ? "text-green-400"
                          : (score.value ?? 0) >= 60
                          ? "text-blue-400"
                          : (score.value ?? 0) >= 40
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {score.value ?? "—"}%
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Memory Layers */}
            <div className="space-y-2">
              {sortedLayers.map(([key, layer]) => {
                const isExpanded = expandedLayer === key;
                const layerStats = detailedStats?.[key.toLowerCase()] as Record<string, unknown> | undefined;

                return (
                  <div
                    key={key}
                    className={`rounded-lg border transition-all ${
                      isExpanded
                        ? "border-purple-500/50 bg-purple-500/5"
                        : "border-gray-700 bg-[#252526] hover:border-gray-600"
                    }`}
                  >
                    {/* Layer Header */}
                    <button
                      className="w-full p-4 text-left flex items-center gap-4"
                      onClick={() => setExpandedLayer(isExpanded ? null : key)}
                    >
                      {/* Layer Badge */}
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${getStatusBg(
                          layer.status,
                          layer.hasRealData
                        )} ${getStatusColor(layer.status, layer.hasRealData)}`}
                      >
                        {key}
                      </div>

                      {/* Layer Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{layer.className}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${getStatusBg(
                              layer.status,
                              layer.hasRealData
                            )} ${getStatusColor(layer.status, layer.hasRealData)}`}
                          >
                            {layer.hasRealData ? "Active" : "Ready"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 truncate">{layer.purpose}</div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="text-white font-medium tabular-nums">
                            {layer.dataVolume}
                          </div>
                          <div className="text-[10px] text-gray-500">Data</div>
                        </div>
                        <div className="text-center">
                          <div className="text-white font-medium tabular-nums">
                            {layer.methodCount}
                          </div>
                          <div className="text-[10px] text-gray-500">Methods</div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${
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
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">
                        <div className="grid grid-cols-2 gap-6">
                          {/* API Methods */}
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                              API Methods ({layer.apiMethods.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {layer.apiMethods.map((method) => (
                                <span
                                  key={method}
                                  className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 font-mono"
                                >
                                  {method}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Module Info */}
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                              Module
                            </div>
                            <div className="text-sm text-purple-400 font-mono">{layer.module}</div>

                            {/* Layer-specific stats */}
                            {layerStats && (
                              <div className="mt-4">
                                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                                  Statistics
                                </div>
                                <div className="space-y-1">
                                  {Object.entries(layerStats)
                                    .sort(([, a], [, b]) => {
                                      // Sort non-zero numeric values first
                                      const aNum = typeof a === 'number' ? a : 0;
                                      const bNum = typeof b === 'number' ? b : 0;
                                      if (aNum !== 0 && bNum === 0) return -1;
                                      if (aNum === 0 && bNum !== 0) return 1;
                                      return 0;
                                    })
                                    .slice(0, 8).map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-xs">
                                      <span className="text-gray-400">{k.replace(/_/g, " ")}</span>
                                      <span className="text-white font-medium">
                                        {typeof v === "number"
                                          ? v.toLocaleString()
                                          : String(v)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryView;
