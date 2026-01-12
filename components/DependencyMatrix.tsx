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

export default function DependencyMatrix() {
  const [flows, setFlows] = useState<DependencyFlow[]>([]);
  const [components, setComponents] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Map<string, MatrixCell>>(new Map());
  const [hoveredCell, setHoveredCell] = useState<MatrixCell | null>(null);

  useEffect(() => {
    fetchFlows();
    const interval = setInterval(fetchFlows, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchFlows = async () => {
    try {
      const response = await fetch('http://localhost:8000/v1/telemetry/flows');
      if (response.ok) {
        const data = await response.json();
        const flowData = data.flows || [];
        setFlows(flowData);
        
        // Extract unique components
        const compSet = new Set<string>();
        flowData.forEach((f: DependencyFlow) => {
          compSet.add(f.source);
          compSet.add(f.target);
        });
        const comps = Array.from(compSet).sort();
        setComponents(comps);
        
        // Build matrix - count occurrences of each source->target pair
        const matrixMap = new Map<string, MatrixCell>();
        const callCounts = new Map<string, number>();
        
        flowData.forEach((f: DependencyFlow) => {
          const key = `${f.source}-${f.target}`;
          const current = callCounts.get(key) || 0;
          callCounts.set(key, current + 1);
        });
        
        const maxCalls = Math.max(...Array.from(callCounts.values()), 1);
        
        callCounts.forEach((count, key) => {
          const [source, target] = key.split('-');
          // Find a recent flow for this pair to get timing data
          const recentFlow = flowData.find((f: DependencyFlow) => 
            f.source === source && f.target === target
          );
          
          matrixMap.set(key, {
            source,
            target,
            intensity: count / maxCalls,
            health: recentFlow?.success ? 1.0 : 0.5,
            callCount: count,
            latency: recentFlow?.duration_ms || 0,
          });
        });
        
        setMatrix(matrixMap);
      }
    } catch (error) {
      console.error('Failed to fetch flows:', error);
    }
  };

  const getCellColor = (cell: MatrixCell | undefined) => {
    if (!cell) return 'bg-[#1E1E1E]';
    
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

  const getInlineStyle = (cell: MatrixCell | undefined) => {
    if (!cell) return {};
    
    const opacity = Math.min(cell.intensity, 0.9);
    
    if (cell.health >= 0.8) {
      return { backgroundColor: `rgba(34, 197, 94, ${opacity})` };
    } else if (cell.health >= 0.6) {
      return { backgroundColor: `rgba(245, 158, 11, ${opacity})` };
    } else {
      return { backgroundColor: `rgba(239, 68, 68, ${opacity})` };
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] relative">
      {/* Header */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">Dependency Matrix</h3>
        <p className="text-xs text-gray-400 mt-1">
          Color intensity = call frequency, Color = health (green=good, yellow=warning, red=poor)
        </p>
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto p-4">
        {components.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No dependency data available
          </div>
        ) : (
          <div className="inline-block">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#252526] border border-gray-700 p-2" style={{ height: '120px' }}></th>
                  {components.map(comp => (
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
                {components.map(source => (
                  <tr key={source}>
                    <td className="sticky left-0 z-10 bg-[#252526] border border-gray-700 p-2 text-xs text-gray-300 font-mono whitespace-nowrap">
                      {source}
                    </td>
                    {components.map(target => {
                      const key = `${source}-${target}`;
                      const cell = matrix.get(key);
                      return (
                        <td
                          key={key}
                          className="border border-gray-700 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                          style={{
                            width: '30px',
                            height: '30px',
                            ...getInlineStyle(cell),
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
