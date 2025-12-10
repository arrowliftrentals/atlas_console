"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useTelemetry } from '@/contexts/TelemetryContext';

export const NeuralArchitecture3DScene: React.FC = () => {
  const { latestFrame, connectionStatus } = useTelemetry();
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [particles, setParticles] = useState<any[]>([]);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  
  const nodePositionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  const discoveredPaths = useRef<Set<string>>(new Set());
  const particleIdCounter = useRef(0);

  // Load initial architecture
  useEffect(() => {
    fetch('http://localhost:8000/v1/architecture/graph')
      .then(res => res.json())
      .then(data => {
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          console.log('[Scene] Loaded architecture:', data.nodes.length, 'nodes,', data.edges.length, 'edges');
        }
      })
      .catch(err => {
        console.warn('[Scene] Architecture load failed:', err);
        // Use demo data
        setNodes([
          { id: 'node1', label: 'Router', type: 'router' },
          { id: 'node2', label: 'Service', type: 'service' },
          { id: 'node3', label: 'Memory', type: 'store' }
        ]);
        setEdges([
          { id: 'edge1', source: 'node1', target: 'node2' },
          { id: 'edge2', source: 'node2', target: 'node3' }
        ]);
      });
  }, []);

  // Process telemetry to create particles
  useEffect(() => {
    if (!latestFrame || (latestFrame.type !== 'update' && latestFrame.type !== 'initial_state')) {
      return;
    }

    const traces = latestFrame.active_traces || [];
    const newActiveNodes = new Set<string>();
    const newParticles: any[] = [];
    const discoveredNodeIds = new Set<string>();

    console.log('[Scene] Telemetry update:', {
      type: latestFrame.type,
      traces: traces.length,
      totalSpans: traces.reduce((sum: number, t: any) => sum + (t.spans?.length || 0), 0)
    });

    traces.forEach((trace: any, traceIdx: number) => {
      if (trace.spans && trace.spans.length > 0) {
        const sorted = [...trace.spans].sort((a: any, b: any) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );
        
        const path = sorted.map((s: any) => s.component_id);
        console.log(`[Scene] Trace #${traceIdx} flow:`, path.join(' → '));
        
        for (let i = 0; i < path.length - 1; i++) {
          const sourceId = path[i];
          const targetId = path[i + 1];
          
          if (!sourceId || !targetId) continue;
          
          discoveredNodeIds.add(sourceId);
          discoveredNodeIds.add(targetId);
          const pathKey = `${sourceId}→${targetId}`;
          discoveredPaths.current.add(pathKey);
          
          newActiveNodes.add(sourceId);
          
          const particleCount = 12;
          const colorOptions = ['#FF6B35', '#60A5FA', '#10B981', '#F59E0B', '#EC4899'];
          const flowColor = colorOptions[i % colorOptions.length];
          
          for (let j = 0; j < particleCount; j++) {
            newParticles.push({
              id: `particle-${Date.now()}-${particleIdCounter.current++}`,
              sourceId,
              targetId,
              progress: 0,
              speed: 2.0 * (0.9 + Math.random() * 0.2),
              color: flowColor
            });
          }
        }
      }
    });

    // Add discovered nodes
    setNodes(prevNodes => {
      const existingIds = new Set(prevNodes.map(n => n.id));
      const nodesToAdd: any[] = [];
      
      discoveredNodeIds.forEach(nodeId => {
        if (!existingIds.has(nodeId)) {
          let type = 'service';
          if (nodeId.includes('router')) type = 'router';
          else if (nodeId.includes('gateway')) type = 'gateway';
          else if (nodeId.includes('store') || nodeId.includes('vector')) type = 'store';
          else if (nodeId.includes('memory') || nodeId.startsWith('L')) type = 'memory';
          
          nodesToAdd.push({
            id: nodeId,
            label: nodeId,
            type: type
          });
          console.log(`[Scene] ➕ Adding node: ${nodeId} (${type})`);
        }
      });
      
      return nodesToAdd.length > 0 ? [...prevNodes, ...nodesToAdd] : prevNodes;
    });

    // Add discovered edges
    setEdges(prevEdges => {
      const existingPaths = new Set(prevEdges.map(e => `${e.source}→${e.target}`));
      const newEdges: any[] = [];
      
      discoveredPaths.current.forEach((pathKey: string) => {
        if (!existingPaths.has(pathKey)) {
          const [source, target] = pathKey.split('→');
          newEdges.push({
            id: `edge-${source}-${target}`,
            source,
            target
          });
        }
      });
      
      return newEdges.length > 0 ? [...prevEdges, ...newEdges] : prevEdges;
    });
    
    setActiveNodes(newActiveNodes);
    setParticles(prev => [...prev, ...newParticles]);
    
    console.log('[Scene] Created:', {
      activeNodes: newActiveNodes.size,
      newParticles: newParticles.length
    });
  }, [latestFrame]);

  // Clean up old particles
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => {
        const now = Date.now();
        return prev.filter((p: any) => {
          const timestampStr = p.id.split('-')[1];
          if (!timestampStr) return false;
          const timestamp = parseInt(timestampStr);
          return (now - timestamp) < 1000;
        });
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Render nodes */}
      {/* Render edges */}
      {/* Render particles */}
      {/* For now, return a placeholder - the original Scene component will be integrated */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <group>
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#60A5FA" />
        </mesh>
      </group>
    </>
  );
};
