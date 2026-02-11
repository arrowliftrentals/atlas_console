'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { RefreshCw, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import TabHeader from './TabHeader';
import { classifyNode, formatNodeLabel, CognitiveRegion } from './Neural3D/NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './Neural3D/NeuralVisualEncodingV2';

// Types
interface ComponentNode {
  id: string;
  label: string;
  type: string;
  status: 'live' | 'stubbed' | 'implemented' | 'in_progress' | 'not_started';
  percent_complete?: number;
  description?: string;
  dependencies: string[];
}

interface ComponentEdge {
  source: string;
  target: string;
  call_count?: number;
}

interface ArchitectureData {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
}

interface Node3D {
  id: string;
  label: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  region: CognitiveRegion;
  degree: number;
  normalizedDegree: number;
  status: string;
}

interface Edge3D {
  source: string;
  target: string;
  callCount: number;
}

// Simple layout: 3 well-separated clusters
const CLUSTER_RADIUS = 50;  // Radius of each cluster sphere

// Region centers - far apart in 3D space
const REGION_POSITIONS: Record<CognitiveRegion, THREE.Vector3> = {
  core: new THREE.Vector3(0, 150, 0),         // Top
  memory: new THREE.Vector3(-200, -100, 0),   // Bottom left
  perception: new THREE.Vector3(200, -100, 0), // Bottom right
};

// Fibonacci sphere distribution for even spacing
function fibonacciSphere(index: number, total: number, radius: number): THREE.Vector3 {
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const theta = 2 * Math.PI * index / goldenRatio;
  const phi = Math.acos(1 - 2 * (index + 0.5) / total);
  
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Main layout: group by region, distribute evenly in sphere
function computeRegionBasedLayout(
  nodes: Node3D[],
  edges: Edge3D[]
): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  if (nodes.length === 0) return positions;
  
  // Group nodes by cognitive region
  const regionNodes: Record<CognitiveRegion, Node3D[]> = {
    core: [],
    memory: [],
    perception: [],
  };
  
  nodes.forEach(node => {
    regionNodes[node.region].push(node);
  });
  
  console.log('[Arch3D Layout] Nodes by region:', {
    core: regionNodes.core.length,
    memory: regionNodes.memory.length,
    perception: regionNodes.perception.length,
  });
  
  // Position each region's nodes in a sphere around its center
  (Object.keys(regionNodes) as CognitiveRegion[]).forEach(region => {
    const center = REGION_POSITIONS[region];
    const nodesInRegion = regionNodes[region];
    const count = nodesInRegion.length;
    
    if (count === 0) return;
    
    // Sort by degree so high-degree nodes are near center
    nodesInRegion.sort((a, b) => b.degree - a.degree);
    
    nodesInRegion.forEach((node, i) => {
      if (count === 1) {
        // Single node at center
        positions.set(node.id, center.clone());
      } else {
        // Scale radius by position in sorted list (high degree = smaller radius)
        const t = i / (count - 1); // 0 to 1
        const nodeRadius = CLUSTER_RADIUS * (0.2 + t * 0.8); // 20% to 100% of radius
        
        const offset = fibonacciSphere(i, count, nodeRadius);
        positions.set(node.id, center.clone().add(offset));
      }
    });
  });
  
  return positions;
}

// Simple hook: compute positions once via useMemo
function useRegionLayout(
  nodes: Node3D[],
  edges: Edge3D[]
): Node3D[] {
  return useMemo(() => {
    if (nodes.length === 0) return [];
    
    const positions = computeRegionBasedLayout(nodes, edges);
    
    console.log('[Arch3D] Computed positions for', positions.size, 'nodes');
    
    return nodes.map(node => ({
      ...node,
      position: positions.get(node.id) || REGION_POSITIONS[node.region].clone(),
      velocity: new THREE.Vector3(),
    }));
  }, [nodes, edges]);
}

// Individual node component
function Node3DComponent({ 
  node, 
  isSelected,
  onClick 
}: { 
  node: Node3D; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = REGION_COLORS[node.region];
  
  // Scale based on degree (1.0 to 2.0)
  const scale = 1 + node.normalizedDegree;
  
  // Pulse effect for selected node
  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      meshRef.current.scale.setScalar(scale * pulse);
    }
  });

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        scale={scale}
      >
        <sphereGeometry args={[3, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      {/* Node label */}
      <Text
        position={[0, scale * 4 + 2, 0]}
        fontSize={3}
        color="#ffffff"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.2}
        outlineColor="#000000"
      >
        {node.label}
      </Text>
    </group>
  );
}

// Edge component
function Edge3DComponent({ 
  sourcePos, 
  targetPos,
  callCount,
  isHighlighted
}: { 
  sourcePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  callCount: number;
  isHighlighted: boolean;
}) {
  // Line width and opacity based on call count
  const normalizedCount = Math.min(Math.log10(callCount + 1) / 3, 1);
  const opacity = 0.3 + normalizedCount * 0.5;
  const color = isHighlighted ? '#3B82F6' : `rgb(${74 + normalizedCount * 180}, ${85 + normalizedCount * 127}, ${104 + normalizedCount * 151})`;

  return (
    <Line
      points={[sourcePos, targetPos]}
      color={color}
      lineWidth={1 + normalizedCount * 2}
      opacity={opacity}
      transparent
    />
  );
}

// Main scene component
function Scene({ 
  data,
  selectedNode,
  setSelectedNode
}: {
  data: ArchitectureData | null;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
}) {
  // Process data into 3D nodes and edges
  const { nodes3D, edges3D } = useMemo(() => {
    if (!data) return { nodes3D: [], edges3D: [] };
    
    // Compute node degrees
    const degrees = new Map<string, number>();
    data.edges.forEach(edge => {
      degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
      degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
    });
    const maxDegree = Math.max(...Array.from(degrees.values()), 1);
    
    // Create 3D nodes
    const nodes3D: Node3D[] = data.nodes.map(node => {
      const metadata = classifyNode(node.id);
      const degree = degrees.get(node.id) || 0;
      return {
        id: node.id,
        label: formatNodeLabel(node.id, node.label),
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        region: metadata.region,
        degree,
        normalizedDegree: degree / maxDegree,
        status: node.status,
      };
    });
    
    // Create 3D edges
    const edges3D: Edge3D[] = data.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      callCount: edge.call_count || 0,
    }));
    
    return { nodes3D, edges3D };
  }, [data]);

  // Apply region-based layout
  const positionedNodes = useRegionLayout(nodes3D, edges3D);

  // Create node position map for edge rendering
  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    positionedNodes.forEach(node => map.set(node.id, node.position));
    return map;
  }, [positionedNodes]);

  // Handle background click to deselect
  const { camera } = useThree();
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 50, 50]} intensity={1} />
      <directionalLight position={[-50, -50, -50]} intensity={0.5} color="#3B82F6" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#FFD700" />

      {/* Edges */}
      {edges3D.map((edge, i) => {
        const sourcePos = nodePositions.get(edge.source);
        const targetPos = nodePositions.get(edge.target);
        if (!sourcePos || !targetPos) return null;
        
        const isHighlighted = selectedNode === edge.source || selectedNode === edge.target;
        
        return (
          <Edge3DComponent
            key={`edge-${i}`}
            sourcePos={sourcePos}
            targetPos={targetPos}
            callCount={edge.callCount}
            isHighlighted={isHighlighted}
          />
        );
      })}

      {/* Nodes */}
      {positionedNodes.map(node => (
        <Node3DComponent
          key={node.id}
          node={node}
          isSelected={selectedNode === node.id}
          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
        />
      ))}

      {/* Region Labels */}
      <Text
        position={[REGION_POSITIONS.core.x, REGION_POSITIONS.core.y + 80, REGION_POSITIONS.core.z]}
        fontSize={12}
        color={REGION_COLORS.core}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.5}
        outlineColor="#000000"
      >
        CORE
      </Text>
      <Text
        position={[REGION_POSITIONS.memory.x, REGION_POSITIONS.memory.y + 80, REGION_POSITIONS.memory.z]}
        fontSize={12}
        color={REGION_COLORS.memory}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.5}
        outlineColor="#000000"
      >
        MEMORY
      </Text>
      <Text
        position={[REGION_POSITIONS.perception.x, REGION_POSITIONS.perception.y + 80, REGION_POSITIONS.perception.z]}
        fontSize={12}
        color={REGION_COLORS.perception}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.5}
        outlineColor="#000000"
      >
        PERCEPTION
      </Text>

      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        minDistance={50}
        maxDistance={500}
      />
    </>
  );
}

// Main component
export default function Architecture3DView() {
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch architecture data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/v1/architecture/graph');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      console.log('[Architecture3D] Loaded:', result.nodes?.length, 'nodes,', result.edges?.length, 'edges');
      setData(result);
    } catch (err) {
      console.error('[Architecture3D] Failed to fetch:', err);
      setError('Failed to load architecture data. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute stats
  const stats = useMemo(() => {
    if (!data) return { nodes: 0, edges: 0, core: 0, memory: 0, perception: 0 };
    
    let core = 0, memory = 0, perception = 0;
    data.nodes.forEach(node => {
      const region = classifyNode(node.id).region;
      if (region === 'core') core++;
      else if (region === 'memory') memory++;
      else perception++;
    });
    
    return {
      nodes: data.nodes.length,
      edges: data.edges.length,
      core,
      memory,
      perception,
    };
  }, [data]);

  // Get selected node details
  const selectedNodeData = useMemo(() => {
    if (!selectedNode || !data) return null;
    return data.nodes.find(n => n.id === selectedNode);
  }, [selectedNode, data]);

  return (
    <div className="h-full flex flex-col bg-[#02030a]">
      {/* Header */}
      <TabHeader
        title="3D Architecture"
        subtitle="Hub-Centric"
        statusConnected={!isLoading && !error}
        statusLabel={isLoading ? 'Loading...' : error ? 'Error' : 'Ready'}
      >
        <button
          onClick={fetchData}
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center gap-2"
          title="Reload data"
        >
          <RefreshCw className="w-3 h-3" />
          Reload
        </button>
      </TabHeader>

      {/* Main content */}
      <div className="flex-1 relative">
        {/* 3D Canvas */}
        <Canvas
          camera={{ position: [0, 0, 200], fov: 60 }}
          gl={{ antialias: true, alpha: false }}
          style={{ background: '#02030a' }}
        >
          <color attach="background" args={['#02030a']} />
          <Scene
            data={data}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
          />
        </Canvas>

        {/* Loading/Error overlay */}
        {(isLoading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="bg-[#252526] border border-gray-700 rounded-lg p-6 max-w-md text-center">
              {isLoading ? (
                <>
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
                  <p className="text-gray-300">Loading architecture data...</p>
                </>
              ) : (
                <>
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stats HUD */}
        <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-3 rounded-lg">
          <div className="font-bold mb-2">Statistics</div>
          <div>Nodes: {stats.nodes}</div>
          <div>Edges: {stats.edges}</div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: REGION_COLORS.core }} />
              Core: {stats.core}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: REGION_COLORS.memory }} />
              Memory: {stats.memory}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: REGION_COLORS.perception }} />
              Perception: {stats.perception}
            </div>
          </div>
        </div>

        {/* Selected node details */}
        {selectedNodeData && (
          <div className="absolute top-4 right-4 w-80 bg-[#252526] border border-gray-700 rounded-lg shadow-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">{selectedNodeData.label}</h3>
                <p className="text-gray-400 text-xs">{selectedNodeData.type}</p>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Status:</span>
                <span className={`capitalize ${
                  selectedNodeData.status === 'live' || selectedNodeData.status === 'implemented'
                    ? 'text-green-400'
                    : selectedNodeData.status === 'stubbed' || selectedNodeData.status === 'in_progress'
                    ? 'text-yellow-400'
                    : 'text-gray-400'
                }`}>
                  {selectedNodeData.status.replace('_', ' ')}
                </span>
              </div>
              
              {selectedNodeData.description && (
                <div>
                  <span className="text-gray-400">Description:</span>
                  <p className="text-gray-200 mt-1">{selectedNodeData.description}</p>
                </div>
              )}
              
              {selectedNodeData.dependencies.length > 0 && (
                <div>
                  <span className="text-gray-400">Dependencies ({selectedNodeData.dependencies.length}):</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedNodeData.dependencies.slice(0, 5).map(dep => (
                      <span key={dep} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                        {dep}
                      </span>
                    ))}
                    {selectedNodeData.dependencies.length > 5 && (
                      <span className="text-xs text-gray-500">
                        +{selectedNodeData.dependencies.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs p-3 rounded-lg">
          <div className="font-bold mb-2">Controls</div>
          <div className="space-y-1 text-gray-300">
            <div>🖱️ Left drag: Rotate</div>
            <div>🖱️ Right drag: Pan</div>
            <div>🖱️ Scroll: Zoom</div>
            <div>Click node: Select</div>
          </div>
        </div>
      </div>
    </div>
  );
}
