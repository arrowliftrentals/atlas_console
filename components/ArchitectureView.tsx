"use client";

import React, { useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/base.css";

interface ComponentNode {
  id: string;
  label: string;
  type: string;
  status: "not_started" | "in_progress" | "implemented";
  percent_complete?: number;
  description?: string;
  dependencies: string[];
  file_path?: string;
}

interface ArchitectureData {
  nodes: ComponentNode[];
  updated_at: string;
}

interface Stats {
  total_components: number;
  implemented: number;
  in_progress: number;
  not_started: number;
  overall_completion_percent: number;
}

const STATUS_COLORS = {
  not_started: "#6B7280", // gray
  in_progress: "#F59E0B", // amber
  implemented: "#22C55E", // green-500 to match implemented dot
};

const TYPE_ICONS = {
  router: "🌐",
  service: "⚙️",
  tool: "🔧",
  model: "📦",
  llm: "🤖",
  memory: "💾",
  database: "🗄️",
  api: "🔌",
};

const FUNCTIONAL_GROUPS = {
  infrastructure: {
    color: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.4)",
    ids: ['database', 'openai_client', 'auth', 'rate_limiter', 'multi_provider'],
  },
  core_memory: {
    color: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.4)",
    ids: ['rule_engine', 'skill_registry', 'task_store', 'memory_l1', 'memory_l2', 'memory_l3', 'memory_l4', 'memory_l5', 'memory_l6', 'memory_l7', 'memory_l8', 'memory_l9', 'memory_l10'],
  },
  tools_advanced: {
    color: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    ids: ['filesystem_tool', 'code_analysis_tool', 'task_management_tool', 'reasoning_engine', 'sandbox_execution', 'test_runner', 'vector_store', 'meta_engineer'],
  },
  api_future: {
    color: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    ids: ['health_router', 'agent_router', 'memory_router', 'skill_router', 'blueprint_router', 'roadmap_router', 'web_console', 'code_generation', 'documentation_gen', 'performance_monitor', 'security_scanner'],
  },
};

const getNodeGroup = (nodeId: string) => {
  for (const [groupName, group] of Object.entries(FUNCTIONAL_GROUPS)) {
    if (group.ids.includes(nodeId)) {
      return group;
    }
  }
  return null;
};

export default function ArchitectureView() {
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [graphRes, statsRes] = await Promise.all([
        fetch("http://localhost:8000/v1/architecture/graph"),
        fetch("http://localhost:8000/v1/architecture/stats"),
      ]);

      if (!graphRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch architecture data");
      }

      const graphData: ArchitectureData = await graphRes.json();
      const statsData: Stats = await statsRes.json();

      setData(graphData);
      setStats(statsData);

      // Calculate hierarchical positions (left to right flow)
      const positions = calculateHierarchicalLayout(graphData.nodes);

      // Convert to ReactFlow nodes
      const flowNodes: Node[] = graphData.nodes.map((node) => {
        const statusColor = STATUS_COLORS[node.status];
        const icon = TYPE_ICONS[node.type as keyof typeof TYPE_ICONS] || "📄";
        const functionalGroup = getNodeGroup(node.id);

        return {
          id: node.id,
          type: "default",
          position: positions[node.id] || { x: 0, y: 0 },
          data: {
            label: (
              <div className="text-xs">
                <div className="font-semibold flex items-center gap-1">
                  <span>{icon}</span>
                  <span>{node.label}</span>
                </div>
                {node.status === "in_progress" && (
                  <div className="text-[10px] text-gray-400 mt-1">
                    {node.percent_complete}% complete
                  </div>
                )}
              </div>
            ),
          },
          style: {
            background: functionalGroup?.color || "rgba(75, 85, 99, 0.2)",
            color: "white",
            border: `3px solid ${functionalGroup?.borderColor || statusColor}`,
            borderRadius: "8px",
            padding: "10px",
            minWidth: "150px",
            boxShadow: `0 0 0 2px ${statusColor}`,
          },
        };
      });

      // Create orthogonal (right-angle) edges with vertical offset routing to prevent overlaps
      const flowEdges: Edge[] = [];
      const addedEdges = new Set<string>();
      const usedRoutes = new Map<string, number>(); // Track vertical routing lanes
      
      graphData.nodes.forEach((node) => {
        node.dependencies.forEach((depId) => {
          const edgeKey = `${depId}-${node.id}`;
          if (addedEdges.has(edgeKey)) return;
          addedEdges.add(edgeKey);
          
          const sourceNode = graphData.nodes.find(n => n.id === depId);
          const sourcePos = positions[depId];
          const targetPos = positions[node.id];
          
          // Log missing positions for debugging
          if (!sourcePos) {
            console.warn(`Missing source position for ${depId}`);
          }
          if (!targetPos) {
            console.warn(`Missing target position for ${node.id}`);
          }
          
          if (!sourcePos || !targetPos || !sourceNode) return;
          
          // Define edge styles based on data flow type
          const EDGE_STYLES = {
            memory: { color: '#9333EA', width: 3, dash: '0', animated: false },
            data: { color: '#0EA5E9', width: 2.5, dash: '0', animated: false },
            control: { color: '#F59E0B', width: 2, dash: '5,5', animated: false },
            api: { color: '#10B981', width: 2, dash: '0', animated: true },
            llm: { color: '#EC4899', width: 2.5, dash: '0', animated: true },
            tool: { color: '#8B5CF6', width: 2, dash: '8,4', animated: false },
            router: { color: '#06B6D4', width: 2, dash: '0', animated: false },
            security: { color: '#EF4444', width: 2, dash: '3,3', animated: false },
            storage: { color: '#14B8A6', width: 2.5, dash: '0', animated: false },
            service: { color: '#64748B', width: 2, dash: '0', animated: false },
          };
          
          // Determine edge type based on source and target
          let edgeStyle = EDGE_STYLES.data;
          
          if (depId.startsWith('memory_') || node.id.startsWith('memory_')) {
            edgeStyle = EDGE_STYLES.memory;
          } else if (depId.includes('openai') || depId.includes('llm') || depId.includes('provider')) {
            edgeStyle = EDGE_STYLES.llm;
          } else if (depId.includes('auth') || depId.includes('rate')) {
            edgeStyle = EDGE_STYLES.security;
          } else if (depId.includes('database') || depId.includes('vector') || depId.includes('store')) {
            edgeStyle = EDGE_STYLES.storage;
          } else if (depId.includes('tool')) {
            edgeStyle = EDGE_STYLES.tool;
          } else if (depId.includes('router')) {
            edgeStyle = EDGE_STYLES.router;
          } else if (depId.includes('engine') || depId.includes('registry') || depId.includes('runner')) {
            edgeStyle = EDGE_STYLES.control;
          } else if (depId.includes('console') || node.id.includes('router')) {
            edgeStyle = EDGE_STYLES.api;
          } else {
            edgeStyle = EDGE_STYLES.service;
          }
          
          // Override animation for in-progress connections
          let edgeColor = edgeStyle.color;
          let isAnimated = edgeStyle.animated;
          
          if (node.status === "in_progress") {
            isAnimated = true;
          }
          
          // Determine connection type and routing strategy
          const isMemoryToMemory = depId.startsWith('memory_') && node.id.startsWith('memory_');
          const sameColumn = Math.abs(sourcePos.x - targetPos.x) < 10;
          const isLeftToCenter = sourcePos.x < 700 && targetPos.x >= 750;
          const isCenterToRight = sourcePos.x >= 750 && targetPos.x > 900;
          const isCenterToLeft = sourcePos.x >= 750 && targetPos.x < 700;
          const isRightToCenter = sourcePos.x > 900 && targetPos.x >= 750 && targetPos.x <= 850;
          
          // Create unique routing lanes based on direction and Y positions
          const routeKey = `${Math.floor(sourcePos.x/100)}-${Math.floor(targetPos.x/100)}-${Math.floor(sourcePos.y/150)}`;
          const routeCount = usedRoutes.get(routeKey) || 0;
          usedRoutes.set(routeKey, routeCount + 1);
          
          // Stagger based on route count to prevent overlaps
          const horizontalOffset = routeCount * 25;
          const verticalOffset = routeCount * 20;
          
          let edgeType = "straight";
          
          // PRIORITY: Memory-to-memory connections - ALWAYS use straight vertical lines
          if (isMemoryToMemory) {
            console.log(`Creating memory edge: ${depId} -> ${node.id}`);
            edgeType = "straight";
            // Force edge color to purple for memory connections
            if (sourceNode.status === "implemented" && node.status === "implemented") {
              edgeColor = "#6B21A8";
            }
          }
          // Left to Center: route around with offset
          else if (isLeftToCenter) {
            edgeType = "smoothstep";
          }
          // Center to Right: route around with offset
          else if (isCenterToRight) {
            edgeType = "smoothstep";
          }
          // Center to Left: route around below
          else if (isCenterToLeft) {
            edgeType = "smoothstep";
          }
          // Right to Center: route around
          else if (isRightToCenter) {
            edgeType = "smoothstep";
          }
          // Same column: straight
          else if (sameColumn) {
            edgeType = "straight";
          }
          // Default: step pattern
          else {
            edgeType = "smoothstep";
          }
          
          // Create edge with data flow label
          const edgeLabel = isMemoryToMemory ? '' : (node.description?.split(',')[0] || '');
          
          const newEdge = {
            id: edgeKey,
            source: depId,
            target: node.id,
            type: edgeType,
            label: edgeLabel.length > 30 ? '' : edgeLabel,
            labelStyle: { 
              fill: edgeColor, 
              fontSize: '10px', 
              fontWeight: 600,
              background: 'white',
              padding: '2px 6px',
            },
            labelBgStyle: { 
              fill: 'white', 
              fillOpacity: 0.95,
            },
            animated: isAnimated,
            style: { 
              stroke: edgeColor,
              strokeWidth: edgeStyle.width,
              strokeDasharray: edgeStyle.dash,
              opacity: 0.8,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edgeColor,
              width: 20,
              height: 20,
            },
          };
          
          if (isMemoryToMemory) {
            console.log(`Added memory edge to flowEdges:`, newEdge);
          }
          
          flowEdges.push(newEdge);
        });
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err: any) {
      console.error("Error fetching architecture data:", err);
      setError(err.message || "Failed to load architecture data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh disabled to preserve manual layout adjustments
    // Uncomment below to re-enable auto-refresh:
    // const interval = setInterval(fetchData, 30000);
    // return () => clearInterval(interval);
  }, []);

  const calculateHierarchicalLayout = (components: ComponentNode[]) => {
    const positions: Record<string, { x: number; y: number }> = {};
    
    // Build dependency graph
    const graph = new Map<string, string[]>();
    const reverseGraph = new Map<string, string[]>();
    components.forEach(node => {
      graph.set(node.id, node.dependencies);
      node.dependencies.forEach(depId => {
        if (!reverseGraph.has(depId)) reverseGraph.set(depId, []);
        reverseGraph.get(depId)!.push(node.id);
      });
    });
    
    // Calculate depth (layer) for each node using topological ordering
    const depths = new Map<string, number>();
    const visited = new Set<string>();
    
    const calculateDepth = (nodeId: string): number => {
      if (depths.has(nodeId)) return depths.get(nodeId)!;
      if (visited.has(nodeId)) return 0; // Circular dependency
      
      visited.add(nodeId);
      const deps = graph.get(nodeId) || [];
      if (deps.length === 0) {
        depths.set(nodeId, 0);
        return 0;
      }
      
      const maxDepth = Math.max(...deps.map(d => calculateDepth(d)));
      depths.set(nodeId, maxDepth + 1);
      return maxDepth + 1;
    };
    
    components.forEach(node => calculateDepth(node.id));
    
    // Group nodes by depth (layer)
    const layers = new Map<number, ComponentNode[]>();
    components.forEach(node => {
      const depth = depths.get(node.id) || 0;
      if (!layers.has(depth)) layers.set(depth, []);
      layers.get(depth)!.push(node);
    });
    
    // Sort layers by depth
    const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
    
    // Position nodes layer by layer with crossing reduction
    const LAYER_WIDTH = 400;
    const NODE_HEIGHT = 120;
    const START_X = 100;
    const START_Y = 100;
    
    sortedLayers.forEach((depth, layerIndex) => {
      const nodesInLayer = layers.get(depth)!;
      
      // Sort nodes within layer to minimize crossings using barycenter heuristic
      if (layerIndex > 0) {
        nodesInLayer.sort((a, b) => {
          // Calculate barycenter (average Y position of dependencies)
          const getBarycenter = (node: ComponentNode) => {
            const deps = node.dependencies
              .map(depId => positions[depId]?.y)
              .filter(y => y !== undefined);
            return deps.length > 0 ? deps.reduce((sum, y) => sum + y, 0) / deps.length : 0;
          };
          return getBarycenter(a) - getBarycenter(b);
        });
      } else {
        // First layer: group by functional type
        nodesInLayer.sort((a, b) => {
          const typeOrder = ['database', 'llm', 'api', 'service', 'memory', 'tool', 'router'];
          return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
        });
      }
      
      // Calculate vertical spacing to spread nodes evenly
      const totalHeight = nodesInLayer.length * NODE_HEIGHT;
      const startYForLayer = START_Y + (totalHeight / 2) - (NODE_HEIGHT * nodesInLayer.length / 2);
      
      nodesInLayer.forEach((node, idx) => {
        positions[node.id] = {
          x: START_X + layerIndex * LAYER_WIDTH,
          y: startYForLayer + idx * NODE_HEIGHT,
        };
      });
    });
    
    return positions;
  };

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    const componentData = data?.nodes.find(n => n.id === node.id);
    if (componentData) {
      setSelectedNode(componentData);
    }
  };

  const getDependencyNames = (depIds: string[]): string[] => {
    if (!data) return [];
    return depIds.map(id => {
      const dep = data.nodes.find(n => n.id === id);
      return dep?.label || id;
    });
  };

  const getDependents = (nodeId: string): string[] => {
    if (!data) return [];
    return data.nodes
      .filter(n => n.dependencies.includes(nodeId))
      .map(n => n.label);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-300">
        <div className="text-center">
          <div className="text-2xl mb-2">⚙️</div>
          <div>Loading architecture...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-red-400">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div>Error: {error}</div>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
      {/* Header with Stats */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-200">
            ATLAS Architecture
          </h2>
          {stats && (
            <div className="text-xs text-gray-400">
              Last updated: {new Date(data?.updated_at || "").toLocaleTimeString()}
            </div>
          )}
        </div>
        
        {stats && (
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-300">
                Implemented: {stats.implemented}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-gray-300">
                In Progress: {stats.in_progress}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-gray-300">
                Not Started: {stats.not_started}
              </span>
            </div>
            <div className="font-semibold text-blue-400">
              {stats.overall_completion_percent.toFixed(1)}% Complete
            </div>
          </div>
        )}
      </div>

      {/* ReactFlow Diagram */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView={false}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          attributionPosition="bottom-left"
        >
          <Background color="#666" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const nodeData = data?.nodes.find(n => n.id === node.id);
              if (!nodeData) return "#4B5563";
              const group = getNodeGroup(nodeData.id);
              return group?.borderColor || STATUS_COLORS[nodeData.status];
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
        </ReactFlow>

        {/* Detail Modal */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-96 bg-[#252526] border border-gray-600 rounded-lg shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d30] border-b border-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {TYPE_ICONS[selectedNode.type as keyof typeof TYPE_ICONS] || "📄"}
                </span>
                <h3 className="font-semibold text-gray-200">{selectedNode.label}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {/* Status */}
              <div>
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[selectedNode.status] }}
                  ></div>
                  <span className="text-sm text-gray-200 capitalize">
                    {selectedNode.status.replace('_', ' ')}
                  </span>
                  {selectedNode.status === "in_progress" && (
                    <span className="text-xs text-gray-400">
                      ({selectedNode.percent_complete}% complete)
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {selectedNode.percent_complete !== undefined && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">Progress</div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${selectedNode.percent_complete}%`,
                        backgroundColor: STATUS_COLORS[selectedNode.status]
                      }}
                    ></div>
                  </div>
                  <div className="text-right text-xs text-gray-400 mt-1">
                    {selectedNode.percent_complete}%
                  </div>
                </div>
              )}

              {/* Type */}
              <div>
                <div className="text-xs text-gray-400 mb-1">Type</div>
                <div className="text-sm text-gray-200 capitalize">
                  {selectedNode.type}
                </div>
              </div>

              {/* Description */}
              {selectedNode.description && (
                <div>
                  <div className="text-xs text-gray-400 mb-1">Description</div>
                  <div className="text-sm text-gray-200">
                    {selectedNode.description}
                  </div>
                </div>
              )}

              {/* File Path */}
              {selectedNode.file_path && (
                <div>
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
                    {getDependencyNames(selectedNode.dependencies).map((dep, idx) => (
                      <div 
                        key={idx}
                        className="text-sm text-gray-200 bg-[#1e1e1e] px-3 py-1.5 rounded flex items-center gap-2"
                      >
                        <span className="text-gray-500">→</span>
                        {dep}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dependents (what depends on this) */}
              {getDependents(selectedNode.id).length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">Used By</div>
                  <div className="space-y-1">
                    {getDependents(selectedNode.id).map((dep, idx) => (
                      <div 
                        key={idx}
                        className="text-sm text-gray-200 bg-[#1e1e1e] px-3 py-1.5 rounded flex items-center gap-2"
                      >
                        <span className="text-gray-500">←</span>
                        {dep}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 bg-[#252526] border-t border-gray-700">
        <div className="space-y-2">
          {/* Connection Types Row */}
          <div className="flex items-center gap-6 text-xs flex-wrap">
            <div className="font-semibold text-gray-300">Connection Types:</div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#9333EA" strokeWidth="3" />
                <polygon points="24,6 20,4 20,8" fill="#9333EA" />
              </svg>
              <span className="text-gray-400">Memory</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#EC4899" strokeWidth="2.5" />
                <polygon points="24,6 20,4 20,8" fill="#EC4899" />
              </svg>
              <span className="text-gray-400">LLM</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#14B8A6" strokeWidth="2.5" />
                <polygon points="24,6 20,4 20,8" fill="#14B8A6" />
              </svg>
              <span className="text-gray-400">Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#0EA5E9" strokeWidth="2.5" />
                <polygon points="24,6 20,4 20,8" fill="#0EA5E9" />
              </svg>
              <span className="text-gray-400">Data</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#F59E0B" strokeWidth="2" strokeDasharray="5,5" />
                <polygon points="24,6 20,4 20,8" fill="#F59E0B" />
              </svg>
              <span className="text-gray-400">Control</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#10B981" strokeWidth="2" />
                <polygon points="24,6 20,4 20,8" fill="#10B981" />
              </svg>
              <span className="text-gray-400">API</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#8B5CF6" strokeWidth="2" strokeDasharray="8,4" />
                <polygon points="24,6 20,4 20,8" fill="#8B5CF6" />
              </svg>
              <span className="text-gray-400">Tool</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#06B6D4" strokeWidth="2" />
                <polygon points="24,6 20,4 20,8" fill="#06B6D4" />
              </svg>
              <span className="text-gray-400">Router</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="28" height="12">
                <line x1="0" y1="6" x2="24" y2="6" stroke="#EF4444" strokeWidth="2" strokeDasharray="3,3" />
                <polygon points="24,6 20,4 20,8" fill="#EF4444" />
              </svg>
              <span className="text-gray-400">Security</span>
            </div>
          </div>
          
          {/* Component Types Row */}
          <div className="flex items-center gap-6 text-xs flex-wrap">
            <div className="font-semibold text-gray-300">Component Types:</div>
            <span className="text-gray-400">🌐 Router</span>
            <span className="text-gray-400">⚙️ Service</span>
            <span className="text-gray-400">🔧 Tool</span>
            <span className="text-gray-400">🤖 LLM</span>
            <span className="text-gray-400">💾 Memory</span>
            <span className="text-gray-400">🗄️ Database</span>
            <span className="text-gray-400">🔌 API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
