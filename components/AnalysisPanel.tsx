'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, TrendingUp, Activity } from 'lucide-react';

interface Bottleneck {
  component_id: string;
  severity: string;
  latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
  throughput: number;
  reason: string;
}

interface CriticalPath {
  components: string[];
  total_latency_ms: number;
  bottleneck_component: string;
  bottleneck_latency_ms: number;
  health_score: number;
}

interface HotPath {
  components: string[];
  call_count: number;
}

interface DependencyFlow {
  source_id: string;
  target_id: string;
  call_count: number;
  avg_latency_ms: number;
  error_rate: number;
  health_score: number;
}

interface AnalysisPanelProps {
  onHighlightComponent?: (componentId: string) => void;
}

export default function AnalysisPanel({ onHighlightComponent }: AnalysisPanelProps) {
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [criticalPaths, setCriticalPaths] = useState<CriticalPath[]>([]);
  const [hotPaths, setHotPaths] = useState<HotPath[]>([]);
  const [flows, setFlows] = useState<DependencyFlow[]>([]);
  const [activeTab, setActiveTab] = useState<'bottlenecks' | 'paths' | 'flows' | 'hot'>('bottlenecks');

  useEffect(() => {
    fetchAnalysisData();
    const interval = setInterval(fetchAnalysisData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalysisData = async () => {
    try {
      const [bottlenecksRes, pathsRes, hotRes, flowsRes] = await Promise.all([
        fetch('http://localhost:8000/v1/telemetry/bottlenecks'),
        fetch('http://localhost:8000/v1/telemetry/critical-paths'),
        fetch('http://localhost:8000/v1/telemetry/hot-paths'),
        fetch('http://localhost:8000/v1/telemetry/flows'),
      ]);

      if (bottlenecksRes.ok) {
        const data = await bottlenecksRes.json();
        setBottlenecks(data.bottlenecks || []);
      }

      if (pathsRes.ok) {
        const data = await pathsRes.json();
        setCriticalPaths(data.paths || []);
      }

      if (hotRes.ok) {
        const data = await hotRes.json();
        setHotPaths(data.paths || []);
      }

      if (flowsRes.ok) {
        const data = await flowsRes.json();
        setFlows(data.flows || []);
      }
    } catch (error) {
      console.error('Failed to fetch analysis data:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 0.8) return 'text-green-500';
    if (score >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] border-l border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Performance Analysis
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-[#252526]">
        <button
          onClick={() => setActiveTab('bottlenecks')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'bottlenecks'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Bottlenecks ({bottlenecks.length})
        </button>
        <button
          onClick={() => setActiveTab('paths')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'paths'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Critical Paths ({criticalPaths.length})
        </button>
        <button
          onClick={() => setActiveTab('hot')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'hot'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Hot Paths ({hotPaths.length})
        </button>
        <button
          onClick={() => setActiveTab('flows')}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === 'flows'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Flows ({flows.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'bottlenecks' && (
          <>
            {bottlenecks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No bottlenecks detected
              </div>
            ) : (
              bottlenecks.map((bottleneck, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getSeverityColor(bottleneck.severity)} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => onHighlightComponent?.(bottleneck.component_id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-mono text-sm font-medium">
                        {bottleneck.component_id}
                      </span>
                    </div>
                    <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded">
                      {bottleneck.severity}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-300">
                    <div>Avg Latency: <span className="text-white">{bottleneck.latency_ms.toFixed(1)}ms</span></div>
                    <div>P95 Latency: <span className="text-white">{bottleneck.p95_latency_ms.toFixed(1)}ms</span></div>
                    <div>Error Rate: <span className="text-white">{(bottleneck.error_rate * 100).toFixed(1)}%</span></div>
                    <div>Throughput: <span className="text-white">{bottleneck.throughput} req</span></div>
                    <div className="pt-1 border-t border-gray-700 text-gray-400 italic">
                      {bottleneck.reason}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'paths' && (
          <>
            {criticalPaths.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No critical paths detected
              </div>
            ) : (
              criticalPaths.map((path, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-gray-700 bg-[#252526]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-gray-400">Path {idx + 1}</span>
                    <span className={`text-xs font-semibold ${getHealthColor(path.health_score)}`}>
                      Health: {(path.health_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {path.components.map((comp, i) => (
                        <React.Fragment key={i}>
                          <span
                            className={`text-xs px-2 py-1 rounded font-mono ${
                              comp === path.bottleneck_component
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                            onClick={() => onHighlightComponent?.(comp)}
                          >
                            {comp}
                          </span>
                          {i < path.components.length - 1 && (
                            <span className="text-gray-600">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Total Latency: <span className="text-white">{path.total_latency_ms.toFixed(1)}ms</span></div>
                      <div>Bottleneck: <span className="text-red-400">{path.bottleneck_component}</span> ({path.bottleneck_latency_ms.toFixed(1)}ms)</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'hot' && (
          <>
            {hotPaths.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No hot paths detected
              </div>
            ) : (
              hotPaths.map((path, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-gray-700 bg-[#252526]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-gray-400">Path {idx + 1}</span>
                    <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {path.call_count} calls
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {path.components.map((comp, i) => (
                      <React.Fragment key={i}>
                        <span
                          className="text-xs px-2 py-1 rounded font-mono bg-gray-700 text-gray-300 cursor-pointer hover:bg-gray-600"
                          onClick={() => onHighlightComponent?.(comp)}
                        >
                          {comp}
                        </span>
                        {i < path.components.length - 1 && (
                          <span className="text-gray-600">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'flows' && (
          <>
            {flows.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No flows detected
              </div>
            ) : (
              <div className="space-y-1">
                {flows
                  .sort((a, b) => b.call_count - a.call_count)
                  .slice(0, 20)
                  .map((flow, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded border border-gray-700 bg-[#252526] hover:bg-[#2d2d2d] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="font-mono text-gray-300 truncate">{flow.source_id}</span>
                          <span className="text-gray-600">→</span>
                          <span className="font-mono text-gray-300 truncate">{flow.target_id}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`font-semibold ${getHealthColor(flow.health_score)}`}>
                            {(flow.health_score * 100).toFixed(0)}%
                          </span>
                          <span className="text-gray-400">{flow.call_count}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{flow.avg_latency_ms.toFixed(1)}ms</span>
                        <span>{(flow.error_rate * 100).toFixed(1)}% err</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
