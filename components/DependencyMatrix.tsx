'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DependencyFlow {
  timestamp: string;
  conversation_id: string;
  intent_type: string;
  source: string;
  target: string;
  duration_ms: number;
  success: boolean;
}

interface MatrixCell {
  source: string;
  target: string;
  intensity: number;
  health: number;
  callCount: number;
  latency: number;
}

interface ArchitectureEdge {
  source: string;
  target: string;
}

export default function DependencyMatrix() {
  const [flows, setFlows] = useState<DependencyFlow[]>([]);
  const [components, setComponents] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Map<string, MatrixCell>>(new Map());
  const [hoveredCell, setHoveredCell] = useState<MatrixCell | null>(null);
  const [staticEdges, setStaticEdges] = useState<ArchitectureEdge[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'active'>('all');
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [recentlyActive, setRecentlyActive] = useState<Set<string>>(new Set());
  const [showHistoryControls, setShowHistoryControls] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [historyHours, setHistoryHours] = useState(24);

  // Fetch static architecture on mount
  useEffect(() => {
    const controller = new AbortController();
    fetchArchitecture(controller.signal);
    return () => controller.abort();
  }, []);

  // Fetch historical telemetry on mount to populate active edges
  useEffect(() => {
    const controller = new AbortController();
    fetchHistoricalTelemetry(undefined, undefined, controller.signal);
    return () => controller.abort();
  }, []);

  // Fetch telemetry flows periodically
  useEffect(() => {
    const controller = new AbortController();
    fetchFlows(controller.signal);
    const interval = setInterval(() => fetchFlows(), 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []); // Run once on mount, then on interval

  const fetchArchitecture = async (signal?: AbortSignal) => {
    try {
      console.log('[DependencyMatrix] Fetching architecture...');
      const response = await fetch('http://localhost:8000/v1/architecture/graph', { signal });
      if (response.ok) {
        const data = await response.json();
        console.log('[DependencyMatrix] Received architecture:', data.nodes?.length, 'nodes,', data.edges?.length, 'edges');
        setStaticEdges(data.edges || []);
        
        // Extract ALL components from architecture nodes (not just those with edges)
        const allNodes = data.nodes || [];
        const allComponentIds = allNodes.map((node: any) => node.id).sort();
        console.log('[DependencyMatrix] Extracted', allComponentIds.length, 'components from all nodes');
        console.log('[DependencyMatrix] First 5 IDs:', allComponentIds.slice(0, 5));
        setComponents(allComponentIds);
        console.log('[DependencyMatrix] Components state updated to', allComponentIds.length, 'items');
        
        // Initialize matrix with static dependencies (no telemetry yet)
        const matrixMap = new Map<string, MatrixCell>();
        (data.edges || []).forEach((edge: ArchitectureEdge) => {
          const key = `${edge.source}-${edge.target}`;
          matrixMap.set(key, {
            source: edge.source,
            target: edge.target,
            intensity: 0.3, // Default low intensity for static deps
            health: 1.0, // Default healthy
            callCount: 0,
            latency: 0,
          });
        });
        console.log('[DependencyMatrix] Initialized matrix with', matrixMap.size, 'static edges');
        setMatrix(matrixMap);
      } else {
        console.error('[DependencyMatrix] Architecture fetch failed:', response.status, response.statusText);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return; // Ignore abort errors
      console.error('[DependencyMatrix] Failed to fetch architecture:', error);
    }
  };

  const fetchHistoricalTelemetry = async (limit?: number, hours?: number, signal?: AbortSignal) => {
    try {
      const traceLimit = limit || historyLimit;
      const timeHours = hours || historyHours;
      
      console.log(`[DependencyMatrix] Fetching historical telemetry (limit=${traceLimit}, hours=${timeHours})...`);
      
      // Fetch traces with configurable limit
      const response = await fetch(`http://localhost:8000/v1/telemetry/flows?limit=${traceLimit}`, { signal });
      if (response.ok) {
        const data = await response.json();
        const traces = data.traces || [];
        
        // Filter by time window
        const cutoffTime = Date.now() / 1000 - (timeHours * 3600);
        const recentTraces = traces.filter((trace: any) => 
          trace.start_time && trace.start_time >= cutoffTime
        );
        
        console.log(`[DependencyMatrix] Processing ${recentTraces.length} traces within ${timeHours}h window`);
        
        // Extract all unique edges from historical telemetry
        const historicalEdges = new Set<string>();
        recentTraces.forEach((trace: any) => {
          trace.spans?.forEach((span: any) => {
            const key = `${span.source}-${span.target}`;
            historicalEdges.add(key);
          });
        });
        
        console.log('[DependencyMatrix] Loaded', historicalEdges.size, 'active edges from history');
        setActiveEdges(historicalEdges);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return; // Ignore abort errors
      console.error('[DependencyMatrix] Failed to fetch historical telemetry:', error);
    }
  };

  const clearActiveEdges = () => {
    console.log('[DependencyMatrix] Clearing active edges');
    setActiveEdges(new Set());
    setRecentlyActive(new Set());
  };

  const fetchFlows = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('http://localhost:8000/v1/telemetry/flows', { signal });
      if (response.ok) {
        const data = await response.json();
        const traces = data.traces || [];
        
        // Extract all spans from traces and convert to flow format
        const flowData: DependencyFlow[] = [];
        traces.forEach((trace: any) => {
          trace.spans?.forEach((span: any) => {
            flowData.push({
              timestamp: span.start_time,
              conversation_id: trace.trace_id,
              intent_type: trace.intent_type || 'unknown',
              source: span.source,
              target: span.target,
              duration_ms: span.duration_ms,
              success: span.success,
            });
          });
        });
        
        setFlows(flowData);
        
        // If no telemetry data, don't update matrix (keep static architecture)
        if (flowData.length === 0) {
          return;
        }
        
        // Start with existing matrix to preserve static edges
        setMatrix(currentMatrix => {
          const matrixMap = new Map<string, MatrixCell>(currentMatrix);
        
        // If no static architecture loaded yet, extract components from telemetry
        if (components.length === 0 && staticEdges.length === 0) {
          const compSet = new Set<string>();
          flowData.forEach((f: DependencyFlow) => {
            compSet.add(f.source);
            compSet.add(f.target);
          });
          const comps = Array.from(compSet).sort();
          setComponents(comps);
        }
        
        // Overlay telemetry data on static dependencies
        const callCounts = new Map<string, number>();
        const latencies = new Map<string, number[]>();
        const successes = new Map<string, boolean[]>();
        
        flowData.forEach((f: DependencyFlow) => {
          const key = `${f.source}-${f.target}`;
          const current = callCounts.get(key) || 0;
          callCounts.set(key, current + 1);
          
          // Track latencies for averaging
          if (!latencies.has(key)) {
            latencies.set(key, []);
          }
          latencies.get(key)!.push(f.duration_ms);
          
          // Track success/failure for health
          if (!successes.has(key)) {
            successes.set(key, []);
          }
          successes.get(key)!.push(f.success);
        });
        
        const maxCalls = Math.max(...Array.from(callCounts.values()), 1);
        
        // Track which edges have recent activity
        const currentlyActive = new Set<string>(callCounts.keys());
        setRecentlyActive(currentlyActive);
        
        // Add new edges to active set (永久记录)
        setActiveEdges(prev => {
          const updated = new Set(prev);
          currentlyActive.forEach(edge => updated.add(edge));
          return updated;
        });
        
        // Update matrix cells with telemetry data
        callCounts.forEach((count, key) => {
          const [source, target] = key.split('-');
          
          // Calculate average latency
          const latencyArray = latencies.get(key);
          const avgLatency = latencyArray ? latencyArray.reduce((a, b) => a + b, 0) / latencyArray.length : 0;
          
          // Calculate health from success rate
          const successArray = successes.get(key);
          const successRate = successArray ? successArray.filter(s => s).length / successArray.length : 1.0;
          
          matrixMap.set(key, {
            source,
            target,
            intensity: count / maxCalls,
            health: successRate,
            callCount: count,
            latency: avgLatency || 0,
          });
        });
        
          return matrixMap;
        });
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return; // Ignore abort errors
      console.error('Failed to fetch flows:', error);
    }
  };

  const getCellColor = (cell: MatrixCell | undefined) => {
    if (!cell) return 'bg-[#02030a]';
    
    // Color based on health and intensity
    const opacity = Math.min(cell.intensity * 100, 90);
    
    if (cell.health >= 0.8) {
      return `bg-green-500 bg-opacity-${Math.floor(opacity / 10) * 10}`;
    } else if (cell.health >= 0.6) {
      return `bg-yellow-500 bg-opacity-${Math.floor(opacity / 10) * 10}`;
    } else {
      return `bg-red-500 bg-opacity-${Math.floor(opacity / 10) * 10}`;
    }
  };

  const getInlineStyle = (cell: MatrixCell | undefined, edgeKey: string) => {
    if (!cell) return {};
    
    // Determine opacity based on activity
    let opacity = Math.min(cell.intensity, 0.9);
    
    // In active view: dim edges that were seen before but not recently active
    if (viewMode === 'active' && activeEdges.has(edgeKey) && !recentlyActive.has(edgeKey)) {
      opacity = 0.2; // Dim but visible
    }
    
    if (cell.health >= 0.8) {
      return { backgroundColor: `rgba(34, 197, 94, ${opacity})` };
    } else if (cell.health >= 0.6) {
      return { backgroundColor: `rgba(245, 158, 11, ${opacity})` };
    } else {
      return { backgroundColor: `rgba(239, 68, 68, ${opacity})` };
    }
  };

  // Get all edges that exist in the matrix (have actual dependencies)
  const matrixEdgeKeys = matrix ? Array.from(matrix.keys()) : [];
  
  // Compute sources (rows) - components that have outgoing edges
  const sourcesInMatrix = new Set<string>();
  const targetsInMatrix = new Set<string>();
  matrixEdgeKeys.forEach(key => {
    if (!key || !key.includes('-')) return;
    const dashIndex = key.indexOf('-');
    const source = key.substring(0, dashIndex);
    const target = key.substring(dashIndex + 1);
    sourcesInMatrix.add(source);
    targetsInMatrix.add(target);
  });
  
  // Compute sources/targets for active edges
  const activeSources = new Set<string>();
  const activeTargets = new Set<string>();
  if (activeEdges && activeEdges.size > 0) {
    Array.from(activeEdges).forEach(edge => {
      if (!edge || !edge.includes('-')) return;
      const dashIndex = edge.indexOf('-');
      const source = edge.substring(0, dashIndex);
      const target = edge.substring(dashIndex + 1);
      activeSources.add(source);
      activeTargets.add(target);
    });
  }
  
  // Row components (sources) and column components (targets) based on view mode
  const rowComponents = viewMode === 'active' 
    ? components.filter(c => activeSources.has(c)).sort()
    : components.filter(c => sourcesInMatrix.has(c)).sort();
  
  const colComponents = viewMode === 'active'
    ? components.filter(c => activeTargets.has(c)).sort()
    : components.filter(c => targetsInMatrix.has(c)).sort();

  return (
    <div className="h-full flex flex-col bg-[#02030a] relative">
      {/* Header */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">Dependency Matrix</h3>
          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-[#02030a] rounded p-1">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-xs rounded ${
                  viewMode === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                All ({matrixEdgeKeys.length})
              </button>
              <button
                onClick={() => setViewMode('active')}
                className={`px-3 py-1 text-xs rounded ${
                  viewMode === 'active' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Active ({activeEdges.size})
              </button>
            </div>
            
            {/* History Controls */}
            <button
              onClick={() => setShowHistoryControls(!showHistoryControls)}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 rounded"
            >
              ⚙️ History
            </button>
            
            {/* Clear Button */}
            <button
              onClick={clearActiveEdges}
              className="px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded"
            >
              Clear Active
            </button>
          </div>
        </div>
        
        {/* History Controls Panel */}
        {showHistoryControls && (
          <div className="mt-2 p-2 bg-[#02030a] rounded border border-gray-700">
            <div className="flex gap-4 items-center text-xs">
              <div className="flex items-center gap-2">
                <label className="text-gray-400">Traces:</label>
                <input
                  type="number"
                  value={historyLimit}
                  onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 100)}
                  className="w-20 px-2 py-1 bg-[#252526] text-white rounded border border-gray-700"
                  min="10"
                  max="1000"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-gray-400">Hours:</label>
                <input
                  type="number"
                  value={historyHours}
                  onChange={(e) => setHistoryHours(parseInt(e.target.value) || 24)}
                  className="w-20 px-2 py-1 bg-[#252526] text-white rounded border border-gray-700"
                  min="1"
                  max="168"
                />
              </div>
              <button
                onClick={() => fetchHistoricalTelemetry(historyLimit, historyHours)}
                className="px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded"
              >
                Reload History
              </button>
            </div>
          </div>
        )}
        
        <p className="text-xs text-gray-400 mt-1">
          {viewMode === 'all' 
            ? 'Static architecture dependencies with real-time telemetry overlay'
            : 'Dependencies observed in telemetry (bright=active, dim=previously seen)'
          }
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Intensity = call frequency • Color = health (green=good, yellow=warning, red=poor)
        </p>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto p-4">
        {rowComponents.length === 0 || colComponents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {viewMode === 'active' ? 'No active dependencies observed' : 'No dependency data available'}
          </div>
        ) : (
          <div className="inline-block">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#252526] border border-gray-700 p-2" style={{ height: '120px' }}></th>
                  {colComponents.map(comp => (
                    <th
                      key={comp}
                      className="bg-[#252526] border border-gray-700 px-1 py-2 text-xs text-gray-300 align-bottom"
                      style={{ minWidth: '30px', maxWidth: '30px', height: '120px', verticalAlign: 'bottom' }}
                    >
                      <div
                        className="whitespace-nowrap font-mono text-center"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                      >
                        {comp}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowComponents.map(source => (
                  <tr key={source}>
                    <td className="sticky left-0 z-10 bg-[#252526] border border-gray-700 p-2 text-xs text-gray-300 font-mono whitespace-nowrap">
                      {source}
                    </td>
                    {colComponents.map(target => {
                      const key = `${source}-${target}`;
                      const cell = matrix.get(key);
                      
                      // Only show cells that have actual data
                      const hasData = matrix.has(key);
                      const isActive = activeEdges.has(key);
                      const shouldShow = viewMode === 'all' ? hasData : isActive;
                      
                      if (!shouldShow) {
                        return (
                          <td
                            key={key}
                            className="border border-gray-700"
                            style={{ width: '30px', height: '30px', backgroundColor: '#02030a' }}
                          />
                        );
                      }
                      
                      return (
                        <td
                          key={key}
                          className="border border-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                          style={{
                            width: '30px',
                            height: '30px',
                            ...getInlineStyle(cell, key),
                          }}
                          onMouseEnter={() => cell && setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredCell && (
        <div className="absolute bottom-20 left-4 bg-[#252526] border border-gray-700 rounded-lg p-3 shadow-xl z-50">
          <div className="space-y-1 text-xs">
            <div className="font-semibold text-white mb-2">
              {hoveredCell.source} → {hoveredCell.target}
            </div>
            <div className="text-gray-400">
              Calls: <span className="text-white">{hoveredCell.callCount}</span>
            </div>
            <div className="text-gray-400">
              Avg Latency: <span className="text-white">{hoveredCell.latency?.toFixed(1) || '0.0'}ms</span>
            </div>
            <div className="text-gray-400">
              Health: <span className={`font-semibold ${
                hoveredCell.health >= 0.8 ? 'text-green-500' :
                hoveredCell.health >= 0.6 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {(hoveredCell.health * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-2 bg-[#252526] border-t border-gray-700">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-400">Health:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-400">Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-gray-400">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-gray-400">Poor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
// Force reload Mon Jan 26 08:46:48 CST 2026
