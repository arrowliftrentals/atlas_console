'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Suspense, useState, useEffect, useRef } from 'react';
import NeuralGraph from './NeuralGraph';
import NeuralHUD from './NeuralHUD';

export type Node = {
  id: string;
  label?: string;
  group?: string;
  activity?: number; // 0-1, how "active" the node is
  position?: [number, number, number]; // Computed 3D position
};

export type Edge = {
  source: string;
  target: string;
  weight?: number; // 0-1, thickness/brightness
  bidirectional?: boolean;
};

export type Graph = {
  nodes: Node[];
  edges: Edge[];
};

/**
 * Generate demo graph data
 * Creates a brain-like structure with multiple clusters (lobes) and bridge connections
 */
function generateDemoGraph(): Graph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Create 5 clusters (brain lobes)
  const clusterCount = 5;
  const nodesPerCluster = 20;
  const groups = ['frontal', 'parietal', 'temporal', 'occipital', 'cerebellum'];
  
  // Generate nodes in clusters
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    for (let i = 0; i < nodesPerCluster; i++) {
      const nodeId = `node_${cluster}_${i}`;
      nodes.push({
        id: nodeId,
        label: `${groups[cluster]}_${i}`,
        group: groups[cluster],
        activity: Math.random()
      });
    }
  }
  
  // Intra-cluster connections (dense within each lobe)
  for (let cluster = 0; cluster < clusterCount; cluster++) {
    const clusterNodes = nodes.filter(n => n.group === groups[cluster]);
    for (let i = 0; i < clusterNodes.length; i++) {
      // Connect to 3-5 random nodes within same cluster
      const connectionCount = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < connectionCount; j++) {
        const targetIdx = Math.floor(Math.random() * clusterNodes.length);
        if (targetIdx !== i) {
          edges.push({
            source: clusterNodes[i].id,
            target: clusterNodes[targetIdx].id,
            weight: 0.5 + Math.random() * 0.5,
            bidirectional: Math.random() > 0.3 // 70% bidirectional
          });
        }
      }
    }
  }
  
  // Inter-cluster connections (sparse bridge connections between lobes)
  for (let i = 0; i < clusterCount; i++) {
    for (let j = i + 1; j < clusterCount; j++) {
      const cluster1 = nodes.filter(n => n.group === groups[i]);
      const cluster2 = nodes.filter(n => n.group === groups[j]);
      
      // Create 5-10 bridge connections between each pair of clusters
      const bridgeCount = 5 + Math.floor(Math.random() * 6);
      for (let k = 0; k < bridgeCount; k++) {
        const node1 = cluster1[Math.floor(Math.random() * cluster1.length)];
        const node2 = cluster2[Math.floor(Math.random() * cluster2.length)];
        edges.push({
          source: node1.id,
          target: node2.id,
          weight: 0.3 + Math.random() * 0.4,
          bidirectional: Math.random() > 0.5 // 50% bidirectional for bridges
        });
      }
    }
  }
  
  return { nodes, edges };
}

export type ActiveFlow = {
  source: string;
  target: string;
  timestamp: number;
};

// Camera setup component to maintain aspect ratio
function CameraSetup() {
  const { camera, size } = useThree();
  
  useEffect(() => {
    camera.position.set(100, 80, 100);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  
  useEffect(() => {
    if ('aspect' in camera) {
      (camera as any).aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);
  
  return null;
}

export default function NeuralNetworkScene() {
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const [activitySpeed, setActivitySpeed] = useState(1.0);
  const [edgeDensity, setEdgeDensity] = useState(0.0);
  const [showLabels, setShowLabels] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeFlows, setActiveFlows] = useState<ActiveFlow[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Fetch real Atlas architecture
    fetch('http://localhost:8000/v1/architecture/graph')
      .then(res => res.json())
      .then(data => {
        console.log('📊 Loaded Atlas architecture:', data);
        
        // Transform to Graph format
        const graph: Graph = {
          nodes: data.nodes.map((n: any) => ({
            id: n.id,
            label: n.label,
            group: n.type, // router, service, memory, llm, gateway, store
            activity: (n.percent_complete || 50) / 100 // 0-1
          })),
          edges: data.edges.map((e: any) => ({
            source: e.source,
            target: e.target,
            weight: 0.5 + Math.random() * 0.5, // Random weight for now
            bidirectional: Math.random() > 0.5 // Random for now
          }))
        };
        
        setGraph(graph);
      })
      .catch(err => {
        console.error('Failed to load Atlas architecture:', err);
        // Fallback to demo
        const demoGraph = generateDemoGraph();
        setGraph(demoGraph);
      });
  }, []);

  // WebSocket telemetry for live activity updates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const ws = new WebSocket('ws://localhost:8000/v1/telemetry/stream');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Telemetry connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.active_traces) {
        const activeNodeIds = new Set<string>();
        const newFlows: ActiveFlow[] = [];
        
        data.active_traces.forEach((trace: any) => {
          if (trace.spans && trace.spans.length >= 2) {
            // Multi-span trace - create flows between consecutive spans
            for (let i = 0; i < trace.spans.length - 1; i++) {
              const sourceId = trace.spans[i].component_id;
              const targetId = trace.spans[i + 1].component_id;
              
              if (sourceId && targetId) {
                activeNodeIds.add(sourceId);
                activeNodeIds.add(targetId);
                newFlows.push({
                  source: sourceId,
                  target: targetId,
                  timestamp: Date.now()
                });
              }
            }
          } else if (trace.spans && trace.spans.length === 1) {
            // Single span - just mark as active
            const componentId = trace.spans[0].component_id;
            if (componentId) {
              activeNodeIds.add(componentId);
            }
          }
        });
        
        // Update active flows (keep flows active for 3 seconds)
        setActiveFlows(prev => {
          const now = Date.now();
          const filtered = prev.filter(flow => now - flow.timestamp < 3000);
          const updated = [...filtered, ...newFlows];
          if (updated.length > 0) {
            console.log(`🔥 Active flows (${updated.length}):`, updated.map(f => `${f.source}→${f.target}`).join(', '));
          }
          return updated;
        });
        
        // Update node activity
        setGraph(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => ({
            ...node,
            activity: activeNodeIds.has(node.id) ? 1.0 : Math.max(0.1, (node.activity || 0.5) * 0.95)
          }))
        }));
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Telemetry error:', error);
    };

    ws.onclose = () => {
      console.log('🔌 Telemetry disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Filter edges based on density slider (hide low-weight edges)
  const filteredGraph = {
    ...graph,
    edges: graph.edges.filter(e => (e.weight || 0.5) >= edgeDensity)
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* 3D Canvas */}
      <Canvas
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
      >
        {/* Deep space background gradient */}
        <color attach="background" args={['#05001a']} />
        <fog attach="fog" args={['#05001a', 100, 250]} />
        
        {/* Ambient lighting */}
        <ambientLight intensity={0.2} />
        <CameraSetup />
        
        <Suspense fallback={null}>
          <NeuralGraph
            graph={filteredGraph}
            activitySpeed={activitySpeed}
            showLabels={showLabels}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
            activeFlows={activeFlows}
            onNodeClick={setSelectedNode}
            onNodeHover={setHoveredNode}
          />
          
          {/* Post-processing effects */}
          <EffectComposer>
            <Bloom
              intensity={1.5}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              height={300}
            />
          </EffectComposer>
          
          {/* Camera controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            minDistance={80}
            maxDistance={300}
            target={[0, 0, 0]}
          />
        </Suspense>
      </Canvas>

      {/* HUD Overlay */}
      <NeuralHUD
        activitySpeed={activitySpeed}
        edgeDensity={edgeDensity}
        showLabels={showLabels}
        selectedNode={selectedNode}
        hoveredNode={hoveredNode}
        graph={graph}
        onActivitySpeedChange={setActivitySpeed}
        onEdgeDensityChange={setEdgeDensity}
        onShowLabelsChange={setShowLabels}
        onClearSelection={() => setSelectedNode(null)}
      />
    </div>
  );
}

/**
 * HOW TO USE WITH REAL DATA:
 * 
 * Replace the generateDemoGraph() call with your actual graph data:
 * 
 * useEffect(() => {
 *   fetch('/api/neural-graph')
 *     .then(res => res.json())
 *     .then(data => setGraph(data));
 * }, []);
 * 
 * Or pass graph as a prop:
 * 
 * export default function NeuralNetworkScene({ initialGraph }: { initialGraph: Graph }) {
 *   const [graph, setGraph] = useState<Graph>(initialGraph);
 *   ...
 * }
 */
