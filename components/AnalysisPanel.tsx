'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { classifyNode, CognitiveRegion } from './Neural3D/NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './Neural3D/NeuralVisualEncodingV2';

/**
 * Normalize component ID - backend telemetry may use shortened names
 * that differ from actual node IDs in the architecture graph
 */
const normalizeComponentId = (id: string): string => {
  const idMap: Record<string, string> = {
    'memory': 'memorymanager',
    'memory_l3_episodic': 'episodicstore',
    'memory_l6_attention': 'attentionstore',
    'memory_l4_declarative': 'declarativestore',
    'memory_l5_procedural': 'proceduralstore',
    'session_memory': 'sessionstore',
    'l1_working': 'workingmemory',
    'l2_shortterm': 'shorttermstore',
    'l7_worldstate': 'worldstatestore',
    'l8_goals': 'goalsstore',
    'l9_social': 'socialstore',
    'l10_vector': 'vectorstore',
  };
  return idMap[id] || id;
};

/**
 * Get display name for component - converts node IDs to human-readable names
 */
const getDisplayName = (id: string): string => {
  const displayMap: Record<string, string> = {
    'episodicstore': 'Episodic Store (L3)',
    'attentionstore': 'Attention Store (L6)',
    'declarativestore': 'Declarative Store (L4)',
    'proceduralstore': 'Procedural Store (L5)',
    'memorymanager': 'Memory Manager',
    'sessionstore': 'Session Store (L3)',
    'workingmemory': 'Working Memory (L1)',
    'shorttermstore': 'Short-term Store (L2)',
    'worldstatestore': 'World State (L7)',
    'goalsstore': 'Goals Store (L8)',
    'socialstore': 'Social Memory (L9)',
    'vectorstore': 'Vector Store (L10)',
    'coreloop': 'Core Loop',
    'reasoningservice': 'Reasoning Service',
    'agentrouter': 'Agent Router',
    'llmclient': 'LLM Client',
    'openaiclient': 'OpenAI Client',
    'ollamaclient': 'Ollama Client',
    'fileops': 'File Operations',
    'execute_python': 'Python Executor',
    'execute_shell': 'Shell Executor',
    'apply_patch': 'Patch Applicator',
    'list_files': 'File Lister',
    'read_file': 'File Reader',
    'write_file': 'File Writer',
  };
  return displayMap[id] || id;
};

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
  const [selectedItem, setSelectedItem] = useState<{ type: string; index: number } | null>(null);

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
    const normalizedId = normalizeComponentId(componentId);
    const metadata = classifyNode(normalizedId);
    const hexColor = REGION_COLORS[metadata.region];
    
    // Use exact colors from REGION_COLORS with rgba for opacity control
    const colorStyles: Record<CognitiveRegion, { bg: string; border: string; text: string }> = {
      core: { 
        bg: 'bg-[#FFA500]/20', 
        border: 'border-[#FFA500]/70', 
        text: 'text-[#FFA500]' 
      },
      memory: { 
        bg: 'bg-[#FF1493]/20', 
        border: 'border-[#FF1493]/70', 
        text: 'text-[#FF1493]' 
      },
      perception: { 
        bg: 'bg-[#00CED1]/20', 
        border: 'border-[#00CED1]/70', 
        text: 'text-[#00CED1]' 
      },
    };
    
    return { ...colorStyles[metadata.region], region: metadata.region };
  };
  
  const getItemRecommendations = (type: string, index: number) => {
    const recommendations: { type: 'critical' | 'warning' | 'info'; message: string }[] = [];
    
    if (type === 'bottleneck') {
      const bottleneck = bottlenecks[index];
      if (!bottleneck) return [];
      
      const severity = bottleneck.avg_time_ms > 100 ? 'critical' : bottleneck.avg_time_ms > 50 ? 'high' : 'medium';
      
      if (severity === 'critical') {
        recommendations.push({
          type: 'critical',
          message: 'Critical slowdown detected. This component is blocking operations.'
        });
        recommendations.push({
          type: 'warning',
          message: 'Consider: Move to async/background processing, add caching layer, or optimize database queries.'
        });
      } else if (severity === 'high') {
        recommendations.push({
          type: 'warning',
          message: 'Moderate slowdown. Monitor for degradation over time.'
        });
        recommendations.push({
          type: 'info',
          message: 'Consider: Profile the component to find hotspots, add metrics, or implement lazy loading.'
        });
      } else {
        recommendations.push({
          type: 'info',
          message: 'Performance is acceptable but could be optimized further.'
        });
      }
      
      if (bottleneck.max_time_ms > bottleneck.avg_time_ms * 3) {
        recommendations.push({
          type: 'warning',
          message: `High variance detected (max ${bottleneck.max_time_ms.toFixed(0)}ms vs avg ${bottleneck.avg_time_ms.toFixed(0)}ms). Add timeouts and handle edge cases.`
        });
      }
    }
    
    if (type === 'path') {
      const path = criticalPaths[index];
      if (!path) return [];
      
      if (path.failures > 0) {
        recommendations.push({
          type: 'critical',
          message: `${path.failures} failure(s) detected on this path.`
        });
        recommendations.push({
          type: 'warning',
          message: 'Add: Retry logic with exponential backoff, circuit breaker pattern, or fallback handlers.'
        });
      }
      
      if (path.avg_time_ms > 100) {
        recommendations.push({
          type: 'warning',
          message: 'Slow path detected. This impacts user experience.'
        });
        recommendations.push({
          type: 'info',
          message: 'Consider: Parallel execution, request batching, or breaking into smaller async operations.'
        });
      }
      
      if (path.criticality_score > 8) {
        recommendations.push({
          type: 'critical',
          message: 'High criticality score indicates this path is essential and fragile.'
        });
        recommendations.push({
          type: 'info',
          message: 'Priority: Add monitoring, alerts, redundancy, and comprehensive error handling.'
        });
      }
    }
    
    if (type === 'hot') {
      const path = hotPaths[index];
      if (!path) return [];
      
      if (path.count > 1000) {
        recommendations.push({
          type: 'warning',
          message: 'Very high traffic path. Heavy load on these components.'
        });
        recommendations.push({
          type: 'info',
          message: 'Consider: Response caching, connection pooling, rate limiting, or CDN for static data.'
        });
      } else if (path.count > 100) {
        recommendations.push({
          type: 'info',
          message: 'Frequently used path. Good candidate for optimization.'
        });
        recommendations.push({
          type: 'info',
          message: 'Consider: Memoization, request deduplication, or pre-computation of common results.'
        });
      }
    }
    
    return recommendations;
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
                const normalizedId = normalizeComponentId(bottleneck.component);
                const regionColors = getRegionColor(bottleneck.component);
                const displayName = getDisplayName(normalizedId);
                return (
                  <div
                    key={idx}
                    className={`rounded-lg ${regionColors.bg} cursor-pointer transition-all flex overflow-hidden ${
                      selectedItem?.type === 'bottleneck' && selectedItem?.index === idx ? 'ring-2' : ''
                    }`}
                    style={{
                      ...(selectedItem?.type === 'bottleneck' && selectedItem?.index === idx ? {
                        '--tw-ring-color': regionColors.region === 'core' ? '#FF8C00' : regionColors.region === 'memory' ? '#FF1493' : '#00CED1'
                      } as any : {})
                    }}
                    onClick={() => {
                      if (selectedItem?.type === 'bottleneck' && selectedItem?.index === idx) {
                        setSelectedItem(null);
                      } else {
                        setSelectedItem({ type: 'bottleneck', index: idx });
                      }
                      onHighlightComponent?.(normalizedId);
                    }}
                  >
                    {/* Vertical severity strip */}
                    <div className={`flex items-center justify-center w-6 flex-shrink-0 ${
                      severity === 'critical' ? 'bg-[#8B0000]' :
                      severity === 'high' ? 'bg-[#FF8C00]' :
                      'bg-gray-600'
                    }`}>
                      <span 
                        className="text-[10px] font-bold text-white uppercase tracking-wider"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        {severity}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className={`text-sm font-medium ${regionColors.text}`}>
                            {displayName}
                          </span>
                        </div>
                      </div>
                    <div className="space-y-1 text-xs text-gray-300">
                      <div>Avg Time: <span className="text-white">{bottleneck.avg_time_ms.toFixed(2)}ms</span></div>
                      <div>Max Time: <span className="text-white">{bottleneck.max_time_ms.toFixed(2)}ms</span></div>
                      <div>P95 Time: <span className="text-white">{bottleneck.p95_time_ms.toFixed(2)}ms</span></div>
                      <div>Samples: <span className="text-white">{bottleneck.sample_count}</span></div>
                    </div>
                    
                    {/* Expanded Recommendations */}
                    {selectedItem?.type === 'bottleneck' && selectedItem?.index === idx && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recommendations</div>
                        {getItemRecommendations('bottleneck', idx).map((rec, recIdx) => (
                          <div
                            key={recIdx}
                            className={`flex items-start gap-2 p-2 rounded text-xs ${
                              rec.type === 'critical' ? 'bg-red-500/10 border border-red-500/30 text-red-300' :
                              rec.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' :
                              'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                            }`}
                          >
                            <span className="font-bold mt-0.5">
                              {rec.type === 'critical' ? '⚠️' : rec.type === 'warning' ? '⚡' : '💡'}
                            </span>
                            <span className="flex-1">{rec.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                const normalizedSource = normalizeComponentId(path.source);
                const normalizedTarget = normalizeComponentId(path.target);
                const sourceColors = getRegionColor(path.source);
                const targetColors = getRegionColor(path.target);
                const sourceDisplayName = getDisplayName(normalizedSource);
                const targetDisplayName = getDisplayName(normalizedTarget);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg bg-[#252526] cursor-pointer transition-all ${
                      selectedItem?.type === 'path' && selectedItem?.index === idx ? 'ring-2' : ''
                    }`}
                    style={{
                      ...(selectedItem?.type === 'path' && selectedItem?.index === idx ? {
                        '--tw-ring-color': sourceColors.region === 'core' ? '#FF8C00' : sourceColors.region === 'memory' ? '#FF1493' : '#00CED1'
                      } as any : {})
                    }}
                    onClick={() => {
                      if (selectedItem?.type === 'path' && selectedItem?.index === idx) {
                        setSelectedItem(null);
                      } else {
                        setSelectedItem({ type: 'path', index: idx });
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-gray-400">Path {idx + 1}</span>
                      <span className="text-xs font-semibold text-red-400">
                        Criticality: {path.criticality_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span
                          className={`text-xs px-2 py-1 rounded ${sourceColors.bg} ${sourceColors.text} cursor-pointer`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onHighlightComponent?.(normalizedSource);
                          }}
                        >
                          {sourceDisplayName}
                        </span>
                        <span className="text-gray-600">→</span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${targetColors.bg} ${targetColors.text} cursor-pointer`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onHighlightComponent?.(normalizedTarget);
                          }}
                        >
                          {targetDisplayName}
                        </span>
                      </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Intent: <span className="text-white">{path.intent_type}</span></div>
                      <div>Avg Time: <span className="text-white">{path.avg_time_ms.toFixed(2)}ms</span></div>
                      <div>Failures: <span className="text-red-400">{path.failures}</span></div>
                    </div>
                    
                    {/* Expanded Recommendations */}
                    {selectedItem?.type === 'path' && selectedItem?.index === idx && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recommendations</div>
                        {getItemRecommendations('path', idx).map((rec, recIdx) => (
                          <div
                            key={recIdx}
                            className={`flex items-start gap-2 p-2 rounded text-xs ${
                              rec.type === 'critical' ? 'bg-red-500/10 border border-red-500/30 text-red-300' :
                              rec.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' :
                              'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                            }`}
                          >
                            <span className="font-bold mt-0.5">
                              {rec.type === 'critical' ? '⚠️' : rec.type === 'warning' ? '⚡' : '💡'}
                            </span>
                            <span className="flex-1">{rec.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                const normalizedSource = normalizeComponentId(path.source);
                const normalizedTarget = normalizeComponentId(path.target);
                const sourceColors = getRegionColor(path.source);
                const targetColors = getRegionColor(path.target);
                const sourceDisplayName = getDisplayName(normalizedSource);
                const targetDisplayName = getDisplayName(normalizedTarget);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg bg-[#252526] cursor-pointer transition-all ${
                      selectedItem?.type === 'hot' && selectedItem?.index === idx ? 'ring-2' : ''
                    }`}
                    style={{
                      ...(selectedItem?.type === 'hot' && selectedItem?.index === idx ? {
                        '--tw-ring-color': sourceColors.region === 'core' ? '#FF8C00' : sourceColors.region === 'memory' ? '#FF1493' : '#00CED1'
                      } as any : {})
                    }}
                    onClick={() => {
                      if (selectedItem?.type === 'hot' && selectedItem?.index === idx) {
                        setSelectedItem(null);
                      } else {
                        setSelectedItem({ type: 'hot', index: idx });
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-gray-400">Path {idx + 1}</span>
                      <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {path.count} calls
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span
                        className={`text-xs px-2 py-1 rounded ${sourceColors.bg} ${sourceColors.text} cursor-pointer`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onHighlightComponent?.(normalizedSource);
                        }}
                      >
                        {sourceDisplayName}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${targetColors.bg} ${targetColors.text} cursor-pointer`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onHighlightComponent?.(normalizedTarget);
                        }}
                      >
                        {targetDisplayName}
                      </span>
                    </div>
                    
                    {/* Expanded Recommendations */}
                    {selectedItem?.type === 'hot' && selectedItem?.index === idx && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recommendations</div>
                        {getItemRecommendations('hot', idx).map((rec, recIdx) => (
                          <div
                            key={recIdx}
                            className={`flex items-start gap-2 p-2 rounded text-xs ${
                              rec.type === 'critical' ? 'bg-red-500/10 border border-red-500/30 text-red-300' :
                              rec.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' :
                              'bg-blue-500/10 border border-blue-500/30 text-blue-300'
                            }`}
                          >
                            <span className="font-bold mt-0.5">
                              {rec.type === 'critical' ? '⚠️' : rec.type === 'warning' ? '⚡' : '💡'}
                            </span>
                            <span className="flex-1">{rec.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                    const normalizedSource = normalizeComponentId(flow.source);
                    const normalizedTarget = normalizeComponentId(flow.target);
                    const sourceColors = getRegionColor(flow.source);
                    const targetColors = getRegionColor(flow.target);
                    const sourceDisplayName = getDisplayName(normalizedSource);
                    const targetDisplayName = getDisplayName(normalizedTarget);
                    return (
                      <div
                        key={idx}
                        className="p-2 rounded bg-[#252526]"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className={`truncate ${sourceColors.text}`}>{sourceDisplayName}</span>
                            <span className="text-gray-600">→</span>
                            <span className={`truncate ${targetColors.text}`}>{targetDisplayName}</span>
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
