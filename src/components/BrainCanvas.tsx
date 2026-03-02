
import { Canvas } from "@react-three/fiber";
import { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTelemetry, TelemetryFrame } from "@/contexts/TelemetryContext";
import { OrganismScene, BIO_COLORS } from "./NeuralOrganismView";

interface ComponentNode {
  id: string;
  label: string;
  type: string;
  status: string;
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

/**
 * Embeddable 3D brain visualization canvas.
 * This is the same OrganismScene used in NeuralOrganismView, 
 * without the surrounding UI (header, controls, stats HUD).
 */
export default function BrainCanvas() {
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { latestFrame, connectionStatus } = useTelemetry();
  
  // Track recently active nodes (with decay)
  const [recentlyActiveNodes, setRecentlyActiveNodes] = useState<Set<string>>(new Set());
  const activeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  // Fetch architecture data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/v1/architecture/graph", {
          cache: "no-cache",
        });
        if (res.ok) {
          const json = await res.json();
          // Transform API response to match expected schema
          const transformed: ArchitectureData = {
            nodes: json.nodes.map((n: { id: string; label?: string; type?: string; status?: string; dependencies?: string[] }) => ({
              id: n.id,
              label: n.label || n.id,
              type: n.type || "component",
              status: n.status || "active",
              dependencies: n.dependencies || [],
            })),
            edges: json.edges,
          };
          setData(transformed);
        }
      } catch (err) {
        console.error("BrainCanvas: Failed to fetch architecture data", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup WebGL context on unmount
  useEffect(() => {
    return () => {
      // Clear all active node timeouts
      activeTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      activeTimeoutsRef.current.clear();
      
      // Dispose WebGL context
      if (glRef.current) {
        console.log('[BrainCanvas] Disposing WebGL context');
        glRef.current.dispose();
        glRef.current.forceContextLoss();
        glRef.current = null;
      }
    };
  }, []);

  // Extract active node IDs from telemetry (same logic as NeuralOrganismView)
  useEffect(() => {
    if (!latestFrame) return;
    
    const newActive = new Set<string>();
    
    // Handle execution_flow events
    if (latestFrame.type === 'execution_flow' && latestFrame.source && latestFrame.target) {
      newActive.add(latestFrame.source);
      newActive.add(latestFrame.target);
    }
    
    // Handle batch events
    if (latestFrame.type === 'batch' && latestFrame.events) {
      latestFrame.events.forEach((event) => {
        if (event.source) newActive.add(event.source);
        if (event.target) newActive.add(event.target);
      });
    }
    
    // Add new nodes to active set with decay timeout
    if (newActive.size > 0) {
      setRecentlyActiveNodes(prev => {
        const updated = new Set(prev);
        newActive.forEach(nodeId => {
          updated.add(nodeId);
          
          // Clear existing timeout for this node
          const existingTimeout = activeTimeoutsRef.current.get(nodeId);
          if (existingTimeout) clearTimeout(existingTimeout);
          
          // Set new decay timeout (2s)
          const timeout = setTimeout(() => {
            setRecentlyActiveNodes(current => {
              const next = new Set(current);
              next.delete(nodeId);
              return next;
            });
            activeTimeoutsRef.current.delete(nodeId);
          }, 2000);
          activeTimeoutsRef.current.set(nodeId, timeout);
        });
        return updated;
      });
    }
  }, [latestFrame]);

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0a0a12]">
        <div className="text-cyan-400/60 text-xs animate-pulse">Loading brain...</div>
      </div>
    );
  }

  return (
    <Canvas
      key="brain-canvas"
      camera={{ position: [0, 80, 180], fov: 50 }}
      gl={{ 
        antialias: true, 
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true
      }}
      onPointerMissed={() => setSelectedNode(null)}
      onCreated={({ gl }) => {
        glRef.current = gl;
        console.log('[BrainCanvas] WebGL context created');
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          console.error('[BrainCanvas] WebGL context lost', e);
          e.preventDefault();
        });
        gl.domElement.addEventListener('webglcontextrestored', () => {
          console.log('[BrainCanvas] WebGL context restored');
        });
      }}
      style={{ background: BIO_COLORS.void }}
    >
      <color attach="background" args={[BIO_COLORS.void]} />
      <OrganismScene
        data={data}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        activeNodes={recentlyActiveNodes}
        useRealTelemetry={true}
        dragEnabled={false}
        nodePositionOverrides={new Map<string, THREE.Vector3>()}
        onNodeDrag={() => {}}
        autoRotateSpeed={1.0}
      />
    </Canvas>
  );
}
