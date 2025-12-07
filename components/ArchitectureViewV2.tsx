'use client';

import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import klay from 'cytoscape-klay';
import cola from 'cytoscape-cola';
import { X, BarChart3, Grid3x3, Clock } from 'lucide-react';
import AnalysisPanel from './AnalysisPanel';
import DependencyMatrix from './DependencyMatrix';
import Timeline from './Timeline';

// Register layouts
cytoscape.use(dagre);
cytoscape.use(klay);
cytoscape.use(cola);

interface ComponentNode {
  id: string;
  label: string;
  type: string;
  status: 'implemented' | 'in_progress' | 'not_started';
  percent_complete?: number;
  description?: string;
  dependencies: string[];
  dependency_metadata?: DependencyMetadata[];
  file_path?: string;
}

interface DependencyMetadata {
  target_id: string;
  operation_type: string;
  call_pattern: string;
  data_format: string;
  cardinality: string;
}

interface ComponentEdge {
  source: string;
  target: string;
  metadata?: DependencyMetadata | null;
}

interface ArchitectureData {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
  updated_at: string;
}

interface TelemetryData {
  type: string;
  timestamp: string;
  active_traces?: any[];
  metrics?: Record<string, any>;
}

interface FlowParticle {
  id: string;
  source: string;
  target: string;
  progress: number;
  color: string;
}

export default function ArchitectureViewV2() {
  console.log('🎨 ArchitectureViewV2 component rendering');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);
  const [telemetryConnected, setTelemetryConnected] = useState(false);
  const [flowParticles, setFlowParticles] = useState<FlowParticle[]>([]);
  const [layoutType, setLayoutType] = useState<'dagre' | 'klay' | 'cola'>('dagre');
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [replayTrace, setReplayTrace] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Fetch architecture data
  useEffect(() => {
    fetchArchitectureData();
  }, []);

  const fetchArchitectureData = async () => {
    try {
      const response = await fetch('http://localhost:8000/v1/architecture/graph');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch architecture:', error);
    }
  };

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !data) {
      console.log('Waiting for container or data...');
      return;
    }

    try {
      const elements: ElementDefinition[] = [];

      // Add nodes
      data.nodes.forEach(node => {
        elements.push({
          data: {
            id: node.id,
            label: node.label,
            type: node.type,
            status: node.status,
            percent: node.percent_complete || 0,
            description: node.description,
            file_path: node.file_path,
          },
        });
      });

      // Add edges from API
      data.edges.forEach(edge => {
        elements.push({
          data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            operation: edge.metadata?.operation_type || 'unknown',
            pattern: edge.metadata?.call_pattern || 'sync',
            format: edge.metadata?.data_format || 'json',
            cardinality: edge.metadata?.cardinality || '1:1',
          },
        });
      });

    // Cytoscape stylesheet
    const stylesheet: any[] = [
      // Nodes base style
      {
        selector: 'node',
        style: {
          'background-color': '#2D3748',
          'border-width': 2,
          'border-color': '#4A5568',
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#E2E8F0',
          'font-size': '12px',
          'font-weight': 'bold',
          'width': 120,
          'height': 60,
          'shape': 'roundrectangle',
          'text-wrap': 'wrap',
          'text-max-width': '110px',
        } as any,
      },
      // Node status colors
      {
        selector: 'node[status = "implemented"]',
        style: {
          'border-color': '#22C55E',
          'border-width': 3,
        } as any,
      },
      {
        selector: 'node[status = "in_progress"]',
        style: {
          'border-color': '#F59E0B',
          'border-width': 3,
        } as any,
      },
      {
        selector: 'node[status = "not_started"]',
        style: {
          'border-color': '#64748B',
          'border-width': 2,
        } as any,
      },
      // Node type shapes
      {
        selector: 'node[type = "router"]',
        style: {
          'background-color': '#06B6D4',
        } as any,
      },
      {
        selector: 'node[type = "memory"]',
        style: {
          'background-color': '#9333EA',
        } as any,
      },
      {
        selector: 'node[type = "llm"]',
        style: {
          'background-color': '#EC4899',
        } as any,
      },
      {
        selector: 'node[type = "database"]',
        style: {
          'background-color': '#14B8A6',
        } as any,
      },
      {
        selector: 'node[type = "tool"]',
        style: {
          'background-color': '#8B5CF6',
        } as any,
      },
      // Edges base style
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#4A5568',
          'target-arrow-color': '#4A5568',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2,
        } as any,
      },
      // Edge operation type colors
      {
        selector: 'edge[operation = "read"]',
        style: {
          'line-color': '#0EA5E9',
          'target-arrow-color': '#0EA5E9',
        } as any,
      },
      {
        selector: 'edge[operation = "write"]',
        style: {
          'line-color': '#F59E0B',
          'target-arrow-color': '#F59E0B',
        } as any,
      },
      {
        selector: 'edge[operation = "query"]',
        style: {
          'line-color': '#10B981',
          'target-arrow-color': '#10B981',
        } as any,
      },
      {
        selector: 'edge[operation = "execute"]',
        style: {
          'line-color': '#EC4899',
          'target-arrow-color': '#EC4899',
        } as any,
      },
      // Edge call pattern styles
      {
        selector: 'edge[pattern = "async"]',
        style: {
          'line-style': 'dashed',
        } as any,
      },
      {
        selector: 'edge[pattern = "streaming"]',
        style: {
          'line-style': 'dotted',
          'width': 3,
        } as any,
      },
      // Selected node highlight
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#3B82F6',
          'overlay-opacity': 0.2,
          'overlay-color': '#3B82F6',
        } as any,
      },
    ];

    // Initialize Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: stylesheet,
      layout: {
        name: layoutType,
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 200,
        animate: true,
        animationDuration: 500,
      } as any,
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    });

    // Node click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = data.nodes.find(n => n.id === node.id());
      if (nodeData) {
        setSelectedNode(nodeData);
      }
    });

    // Background click to deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

      cyRef.current = cy;

      setInitError(null);
      
      return () => {
        if (cy) {
          cy.destroy();
        }
      };
    } catch (err) {
      console.error('Failed to initialize Cytoscape:', err);
      setInitError(err instanceof Error ? err.message : 'Failed to initialize graph visualization');
    }
  }, [data, layoutType]);

  // WebSocket telemetry connection
  useEffect(() => {
    if (typeof window === 'undefined') {
      return; // Don't run on server
    }

    let isUnmounted = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (isUnmounted) return;

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        // Use localhost:8000 explicitly for backend since frontend runs on 3000
        const wsUrl = `${wsProtocol}://localhost:8000/v1/telemetry/stream`;
        
        console.log('🔌 Attempting WebSocket connection to', wsUrl);
        const ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('✅ Telemetry WebSocket connected');
          setTelemetryConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data: TelemetryData = JSON.parse(event.data);
            console.log('📊 Telemetry data received:', data.type, {
              traces: data.active_traces?.length || 0,
              metrics: Object.keys(data.metrics || {}).length,
            });
            handleTelemetryUpdate(data);
          } catch (err) {
            console.warn('⚠️ Failed to parse telemetry data:', err);
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('❌ WebSocket connection error:', error);
          setTelemetryConnected(false);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          console.log('Telemetry WebSocket closed');
          setTelemetryConnected(false);

          // Simple reconnect with backoff
          reconnectTimeout = setTimeout(() => {
            console.log('🔁 Reconnecting telemetry WebSocket...');
            connect();
          }, 3000);
        };
      } catch (err) {
        if (isUnmounted) return;
        console.warn('Failed to initialize WebSocket - telemetry disabled:', err);
        setTelemetryConnected(false);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout !== undefined) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleTelemetryUpdate = (data: TelemetryData) => {
    // Handle updates with active traces
    if ((data.type === 'update' || data.type === 'initial_state') && cyRef.current) {
      const traces = data.active_traces || [];
      
      console.log('🔄 Processing', traces.length, 'traces');
      
      // Animate flow for active traces
      traces.forEach((trace: any) => {
        console.log('  Trace:', trace.trace_id, 'spans:', trace.spans?.length);
        if (trace.spans && trace.spans.length > 1) {
          // Sort spans by start_time to get correct order
          const sorted = [...trace.spans].sort((a: any, b: any) => 
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
          const path = sorted.map((s: any) => s.component_id);
          
          console.log('  🎬 Animating flow:', path.join(' → '));
          
          // Animate flow along the path
          for (let i = 0; i < path.length - 1; i++) {
            animateFlow(path[i], path[i + 1]);
          }
        }
      });
      
      // Update node activity based on metrics
      if (data.metrics && cyRef.current) {
        Object.entries(data.metrics).forEach(([componentId, metrics]: [string, any]) => {
          const node = cyRef.current?.$id(componentId);
          if (node && node.length > 0 && metrics.request_count > 0) {
            // Pulse node on activity
            node.animate({
              style: { 'border-width': 4, 'border-color': '#3B82F6' },
              duration: 300,
            }).delay(300).animate({
              style: { 'border-width': 3 },
              duration: 300,
            });
          }
        });
      }
    }
  };

  const animateFlow = (source: string, target: string) => {
    if (!cyRef.current) {
      console.log('  ❌ cyRef not initialized');
      return;
    }
    
    const edgeId = `${source}-${target}`;
    const edge = cyRef.current.$id(edgeId);
    
    console.log('  🔍 Looking for edge:', edgeId, 'found:', edge.length > 0);
    
    if (edge.length > 0) {
      console.log('  ✨ Animating edge:', edgeId);
      // Pulse the edge with bright color
      edge.animate({
        style: {
          'width': 5,
          'line-color': '#3B82F6',
          'target-arrow-color': '#3B82F6',
        },
        duration: 400,
      }).delay(400).animate({
        style: {
          'width': 2,
        },
        duration: 400,
      });
    }
    
    // Pulse source and target nodes
    const sourceNode = cyRef.current.$id(source);
    const targetNode = cyRef.current.$id(target);
    
    if (sourceNode.length > 0) {
      sourceNode.animate({
        style: { 'background-color': '#3B82F6', 'border-width': 5 },
        duration: 200,
      }).delay(200).animate({
        style: { 'border-width': 3 },
        duration: 200,
      });
    }
    
    if (targetNode.length > 0) {
      setTimeout(() => {
        targetNode.animate({
          style: { 'background-color': '#10B981', 'border-width': 5 },
          duration: 200,
        }).delay(200).animate({
          style: { 'border-width': 3 },
          duration: 200,
        });
      }, 400);
    }
  };

  const changeLayout = (type: 'dagre' | 'klay' | 'cola') => {
    setLayoutType(type);
    if (cyRef.current) {
      cyRef.current.layout({
        name: type,
        rankDir: 'LR',
        nodeSep: 100,
        rankSep: 200,
        animate: true,
        animationDuration: 500,
      } as any).run();
    }
  };

  const highlightComponent = (componentId: string) => {
    if (!cyRef.current) return;
    
    const node = cyRef.current.$id(componentId);
    if (node.length > 0) {
      cyRef.current.animate({
        center: { eles: node },
        zoom: 1.5,
        duration: 500,
      });
      
      node.select();
      setTimeout(() => node.unselect(), 2000);
    }
  };

  const handleTraceReplay = (trace: any) => {
    setReplayTrace(trace);
    
    // Animate the trace path
    if (cyRef.current && trace.spans) {
      // Compute component path from spans
      const sorted = [...trace.spans].sort((a: any, b: any) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      const path = sorted.map((s: any) => s.component_id);
      
      // Highlight all nodes in path
      path.forEach((compId: string, index: number) => {
        setTimeout(() => {
          const node = cyRef.current!.$id(compId);
          if (node.length > 0) {
            node.animate({
              style: { 'border-width': 6, 'border-color': '#3B82F6' },
              duration: 300,
            });
            
            setTimeout(() => {
              node.animate({
                style: { 'border-width': 3 },
                duration: 300,
              });
            }, 300);
          }
        }, index * 200);
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Atlas Architecture - Live View</h2>
            <p className="text-sm text-gray-400">Interactive component graph with real-time telemetry</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${telemetryConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-400">
                {telemetryConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                  showAnalysis
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                Analysis
              </button>
              <button
                onClick={() => setShowMatrix(!showMatrix)}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                  showMatrix
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Grid3x3 className="w-3 h-3" />
                Matrix
              </button>
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                  showTimeline
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Clock className="w-3 h-3" />
                Timeline
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => changeLayout('dagre')}
                className={`px-3 py-1 text-xs rounded ${
                  layoutType === 'dagre'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Hierarchical
              </button>
              <button
                onClick={() => changeLayout('klay')}
                className={`px-3 py-1 text-xs rounded ${
                  layoutType === 'klay'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Layered
              </button>
              <button
                onClick={() => changeLayout('cola')}
                className={`px-3 py-1 text-xs rounded ${
                  layoutType === 'cola'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Force
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Matrix View (Full Screen) */}
        {showMatrix && (
          <div className="absolute inset-0 z-30 bg-[#1E1E1E]">
            <DependencyMatrix />
          </div>
        )}

        {/* Graph Container */}
        <div 
          ref={containerRef}
          className={`flex-1 bg-[#1E1E1E] ${showMatrix ? 'hidden' : ''} relative`}
          style={{ width: '100%', height: '100%' }}
        >
          {initError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
                <h3 className="text-red-400 font-semibold mb-2">Initialization Error</h3>
                <p className="text-gray-300 text-sm mb-4">{initError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                >
                  Reload Page
                </button>
              </div>
            </div>
          )}
          {!data && !initError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-400 text-sm">Loading architecture data...</div>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        {showAnalysis && !showMatrix && (
          <div className="w-80 flex-shrink-0">
            <AnalysisPanel onHighlightComponent={highlightComponent} />
          </div>
        )}

        {/* Node Details Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-96 bg-[#252526] border border-gray-700 rounded-lg shadow-xl">
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedNode.label}</h3>
                  <span className="text-xs text-gray-400">{selectedNode.type}</span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status */}
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedNode.status === 'implemented' ? 'bg-green-500' :
                    selectedNode.status === 'in_progress' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`} />
                  <span className="text-sm text-gray-200 capitalize">
                    {selectedNode.status.replace('_', ' ')}
                  </span>
                  {selectedNode.percent_complete !== undefined && (
                    <span className="text-xs text-gray-400">
                      ({selectedNode.percent_complete}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedNode.description && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Description</div>
                  <div className="text-sm text-gray-200">{selectedNode.description}</div>
                </div>
              )}

              {/* File Path */}
              {selectedNode.file_path && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">File Path</div>
                  <div className="text-xs text-blue-400 font-mono bg-[#1e1e1e] p-2 rounded">
                    {selectedNode.file_path}
                  </div>
                </div>
              )}

              {/* Dependencies */}
              {selectedNode.dependencies.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">Dependencies</div>
                  <div className="space-y-1">
                    {selectedNode.dependencies.map((depId, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-gray-200 bg-[#1e1e1e] px-3 py-1.5 rounded"
                      >
                        {depId}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {showTimeline && (
        <div className="relative z-50">
          <Timeline
            onTraceSelect={handleTraceReplay}
            onPlaybackSpeed={(speed) => console.log('Playback speed:', speed)}
          />
        </div>
      )}

      {/* Legend */}
      {!showTimeline && (
        <div className="px-4 py-2 bg-[#252526] border-t border-gray-700">
        <div className="flex items-center gap-6 text-xs flex-wrap">
          <div className="font-semibold text-gray-300">Connection Types:</div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#0EA5E9]" />
            <span className="text-gray-400">Read</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#F59E0B]" />
            <span className="text-gray-400">Write</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#10B981]" />
            <span className="text-gray-400">Query</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#EC4899]" />
            <span className="text-gray-400">Execute</span>
          </div>
          <div className="border-l border-gray-600 h-4" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-400" />
            <span className="text-gray-400">Async</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dotted border-gray-400" />
            <span className="text-gray-400">Streaming</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
