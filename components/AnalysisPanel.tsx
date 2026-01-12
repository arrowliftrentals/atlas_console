'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { classifyNode, CognitiveRegion } from './Neural3D/NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './Neural3D/NeuralVisualEncodingV2';

interface Bottleneck {
  component: string;
  avg_time_ms: number;
  max_time_ms: number;
  p95_time_ms: number;
  sample_count: number;
}

interface CriticalPath {
  source: string;
  target: string;
  intent_type: string;
  avg_time_ms: number;
  failures: number;
  criticality_score: number;
}

interface HotPath {
  source: string;
  target: string;
  count: number;
}

interface DependencyFlow {
  timestamp: string;
  conversation_id: string;
  intent_type: string;
  source: string;
  target: string;
  duration_ms: number;
  success: boolean;
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
    const interval = setInterval(fetchAnalysisData, 10000);
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

  const getRegionColor = (componentId: string): { bg: string; border: string; text: string; region: CognitiveRegion } => {
    const metadata = classifyNode(componentId);
    const hexColor = REGION_COLORS[metadata.region];
    
    // Convert hex to Tailwind-compatible classes with opacity
    const colorMap: Record<CognitiveRegion, { bg: string; border: string; text: string }> = {
      core: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400' },
      memory: { bg: 'bg-pink-500/10', border: 'border-pink-500/40', text: 'text-pink-400' },
      perception: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', text: 'text-cyan-400' },
    };
    
    return { ...colorMap[metadata.region], region: metadata.region };
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
              bottlenecks.map((bottleneck, idx) => {
                const severity = bottleneck.avg_time_ms > 100 ? 'critical' : bottleneck.avg_time_ms > 50 ? 'high' : 'medium';
                const regionColors = getRegionColor(bottleneck.component);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${regionColors.bg} ${regionColors.border} cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => onHighlightComponent?.(bottleneck.component)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className={`font-mono text-sm font-medium ${regionColors.text}`}>
                          {bottleneck.component}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-semibold text-gray-400">
                          {regionColors.region}
                        </span>
                        <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                          {severity}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-gray-300">
                      <div>Avg Time: <span className="text-white">{bottleneck.avg_time_ms.toFixed(2)}ms</span></div>
                      <div>Max Time: <span className="text-white">{bottleneck.max_time_ms.toFixed(2)}ms</span></div>
                      <div>P95 Time: <span className="text-white">{bottleneck.p95_time_ms.toFixed(2)}ms</span></div>
                      <div>Samples: <span className="text-white">{bottleneck.sample_count}</span></div>
                    </div>
                  </div>
                );
              })
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
              criticalPaths.map((path, idx) => {
                const sourceColors = getRegionColor(path.source);
                const targetColors = getRegionColor(path.target);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-gray-700 bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-gray-400">Path {idx + 1}</span>
                      <span className="text-xs font-semibold text-red-400">
                        Criticality: {path.criticality_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs px-2 py-1 rounded font-mono ${sourceColors.bg} ${sourceColors.border} ${sourceColors.text} border cursor-pointer hover:opacity-80`}
                          onClick={() => onHighlightComponent?.(path.source)}
                        >
                          {path.source}
                        </span>
                        <span className="text-gray-600">→</span>
                        <span
                          className={`text-xs px-2 py-1 rounded font-mono ${targetColors.bg} ${targetColors.border} ${targetColors.text} border cursor-pointer hover:opacity-80`}
                          onClick={() => onHighlightComponent?.(path.target)}
                        >
                          {path.target}
                        </span>
                      </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Intent: <span className="text-white">{path.intent_type}</span></div>
                      <div>Avg Time: <span className="text-white">{path.avg_time_ms.toFixed(2)}ms</span></div>
                      <div>Failures: <span className="text-red-400">{path.failures}</span></div>
                    </div>
                  </div>
                </div>
                );
              })
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
              hotPaths.map((path, idx) => {
                const sourceColors = getRegionColor(path.source);
                const targetColors = getRegionColor(path.target);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-gray-700 bg-[#252526]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-gray-400">Path {idx + 1}</span>
                      <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {path.count} calls
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs px-2 py-1 rounded font-mono ${sourceColors.bg} ${sourceColors.border} ${sourceColors.text} border cursor-pointer hover:opacity-80`}
                        onClick={() => onHighlightComponent?.(path.source)}
                      >
                        {path.source}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span
                        className={`text-xs px-2 py-1 rounded font-mono ${targetColors.bg} ${targetColors.border} ${targetColors.text} border cursor-pointer hover:opacity-80`}
                        onClick={() => onHighlightComponent?.(path.target)}
                      >
                        {path.target}
                      </span>
                    </div>
                  </div>
                );
              })
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
                  .slice(0, 20)
                  .map((flow, idx) => {
                    const sourceColors = getRegionColor(flow.source);
                    const targetColors = getRegionColor(flow.target);
                    return (
                      <div
                        key={idx}
                        className="p-2 rounded border border-gray-700 bg-[#252526] hover:bg-[#2d2d2d] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className={`font-mono truncate ${sourceColors.text}`}>{flow.source}</span>
                            <span className="text-gray-600">→</span>
                            <span className={`font-mono truncate ${targetColors.text}`}>{flow.target}</span>
                          </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`font-semibold ${flow.success ? 'text-green-500' : 'text-red-500'}`}>
                            {flow.success ? '✓' : '✗'}
                          </span>
                          <span className="text-gray-400">{flow.duration_ms.toFixed(1)}ms</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>Intent: {flow.intent_type}</span>
                        <span className="text-gray-500">{new Date(flow.timestamp).toLocaleTimeString()}</span>
                      </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
