// NeuralArchitecture3DV2.tsx
// Main scene component for Atlas Neural 3D Visualization V2
// Complete reimplementation with instanced rendering and hierarchical layout

'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Vector3, Matrix4, Euler } from 'three';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';
import { computeCognitiveLayout, classifyNode, CORE_RADIUS, MEMORY_RADIUS } from './NeuralCognitiveLayoutV2';
import { NeuralNodesInstancedV2 } from './NeuralNodesInstancedV2';
import { NeuralEdgesInstancedV2 } from './NeuralEdgesInstancedV2';
import { NeuralParticlesInstancedV2 } from './NeuralParticlesInstancedV2';
import { NeuralLabelsV2 } from './NeuralLabelsV2';
import { NeuralHUDV2 } from './NeuralHUDV2';
import { NeuralCognitiveShellsV2 } from './NeuralCognitiveShellsV2';
import { NeuralCognitiveLegendV2 } from './NeuralCognitiveLegendV2';
import { NeuralShellControls } from './NeuralShellControls';
import { NeuralDraggableNodes } from './NeuralDraggableNodes';
import { NeuralShellDragRotation } from './NeuralShellDragRotation';
import { NeuralShellRotationHandles } from './NeuralShellRotationHandles';

import { TelemetryEventV2, NodeStateV2 } from './NeuralTelemetryTypesV2';
import { convertV1ToV2, inferSubsystem } from './NeuralTelemetryUtilsV2';
import { optimizeShellRotations } from './NeuralShellOptimizer';
import { optimizeNodePositionsOnShell } from './NeuralNodePositionOptimizer';

interface Props {
  timeScale?: number;
  maxParticles?: number;
}

export default function NeuralArchitecture3DV2({
  timeScale = 1,
  maxParticles = 50000,
}: Props) {
  const { nodes, edges, particleEvents, ingestEvents, clearParticleEvents } =
    useNeuralTelemetryStoreV2();
  
  const [telemetryConnected, setTelemetryConnected] = useState(false);
  const [stats, setStats] = useState({ fps: 0, nodeCount: 0, edgeCount: 0, particleCount: 0 });
  const [activeParticleCount, setActiveParticleCount] = useState(0);
  
  // Shell rotation states
  const [shellRotations, setShellRotations] = useState({
    core: { x: 0, y: 0, z: 0 },
    memory: { x: 0, y: 0, z: 0 },
    perception: { x: 0, y: 0, z: 0 },
  });
  
  // Track custom node positions (overrides computed layout)
  const [customNodePositions, setCustomNodePositions] = useState<Map<string, [number, number, number]>>(new Map());
  
  // Track drag state to disable OrbitControls during node dragging
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  
  // Track which shell is selected for rotation
  const [selectedShellForRotation, setSelectedShellForRotation] = useState<'core' | 'memory' | 'perception' | null>(null);
  
  // Track node count for auto-optimization
  const prevNodeCountRef = useRef(0);
  
  // Optimization handler
  const handleOptimizeRotations = () => {
    console.log('[V2] Optimizing shell rotations...');
    const optimized = optimizeShellRotations(nodes, edges, shellRotations);
    setShellRotations(optimized);
  };

  const handleOptimizeNodePositions = useCallback(() => {
    if (nodes.size === 0) {
      console.warn('[V2] No nodes loaded yet. Wait for architecture to load from http://localhost:8000/v1/architecture/graph');
      return;
    }

    console.log('[V2] ========================================');
    console.log('[V2] OPTIMIZING MEMORY SHELL NODE POSITIONS');
    console.log('[V2] Total nodes:', nodes.size, 'Total edges:', edges.size);
    
    // Get current computed layout to know which nodes are on memory shell
    const computedLayout = computeCognitiveLayout(nodes, edges);
    const nodesArray = Array.from(computedLayout.values());
    const edgesArray = Array.from(edges.values());
    
    // Log node distribution by shell
    const shellCounts = { core: 0, memory: 0, perception: 0 };
    const memoryNodeIds: string[] = [];
    
    nodesArray.forEach(node => {
      if (!node.position) return;
      const dist = Math.sqrt(node.position[0] ** 2 + node.position[1] ** 2 + node.position[2] ** 2);
      if (dist < 30) {
        shellCounts.core++;
      } else if (dist < 70) {
        shellCounts.memory++;
        memoryNodeIds.push(node.id);
      } else {
        shellCounts.perception++;
      }
    });
    
    console.log('[V2] Node distribution - Core:', shellCounts.core, 'Memory:', shellCounts.memory, 'Perception:', shellCounts.perception);
    console.log('[V2] Memory shell nodes:', memoryNodeIds.join(', '));
    
    if (shellCounts.memory === 0) {
      console.warn('[V2] No nodes found on memory shell (radius 30-70). Cannot optimize.');
      return;
    }
    
    // Optimize memory shell node positions
    console.log('[V2] Starting optimization algorithm...');
    const optimizedPositions = optimizeNodePositionsOnShell(
      nodesArray,
      edgesArray,
      'memory',
      1000 // iterations
    );

    console.log('[V2] Optimization complete! Returned', optimizedPositions.size, 'positions');

    if (optimizedPositions.size > 0) {
      // Clear existing memory shell positions and replace with optimized ones
      const updated = new Map<string, [number, number, number]>();
      
      // Keep non-memory shell custom positions
      customNodePositions.forEach((pos, nodeId) => {
        if (!memoryNodeIds.includes(nodeId)) {
          updated.set(nodeId, pos);
        }
      });
      
      // Add all optimized memory shell positions
      optimizedPositions.forEach((newPos, nodeId) => {
        updated.set(nodeId, newPos);
        console.log(`[V2] Node ${nodeId} optimized to [${newPos[0].toFixed(1)}, ${newPos[1].toFixed(1)}, ${newPos[2].toFixed(1)}]`);
      });
      
      console.log('[V2] Applying', updated.size, 'custom positions (including', optimizedPositions.size, 'optimized memory nodes)');
      
      // Force update by creating new Map instance
      setCustomNodePositions(new Map(updated));
      
      // Force re-render by triggering a state update
      console.log('[V2] Custom positions state updated. Layout should recalculate.');
      console.log('[V2] ========================================');
    }
  }, [nodes, edges, customNodePositions]);

  // Debug: Track when particleEvents actually updates
  useEffect(() => {
    if (particleEvents.length > 0) {
      console.log('[V2 EFFECT] particleEvents updated, length:', particleEvents.length);
      console.log('[V2 EFFECT] First event:', particleEvents[0]);
    }
  }, [particleEvents]);

  // Auto-optimize when new nodes are added to memory shell - DISABLED
  // Optimization only runs once on initial load
  useEffect(() => {
    prevNodeCountRef.current = nodes.size;
  }, [nodes]);

  // Load static architecture graph on mount and optimize positions
  useEffect(() => {
    fetch('http://localhost:8000/v1/architecture/graph')
      .then(res => res.json())
      .then(data => {
        console.log('[V2] Loaded architecture:', data.nodes?.length, 'nodes,', data.edges?.length, 'edges');
        
        // Create events that will populate both nodes and edges
        const initialEvents: TelemetryEventV2[] = [];
        
        // Add all nodes by creating self-referential events (ensures all nodes exist)
        (data.nodes || []).forEach((node: any) => {
          const nodeId = node.id || node.name;
          initialEvents.push({
            source: nodeId,
            target: nodeId,
            type: 'data_transfer' as const,
            timestamp: Date.now(),
            bytes: 0,
            priority: 'normal' as const,
          });
        });
        
        // Add all edges
        (data.edges || []).forEach((edge: any) => {
          initialEvents.push({
            source: edge.source,
            target: edge.target,
            type: 'data_transfer' as const,
            timestamp: Date.now(),
            bytes: 0,
            priority: 'normal' as const,
          });
        });

        console.log('[V2] Ingesting', initialEvents.length, 'initial events');
        ingestEvents(initialEvents);
        
        // Optimize positions immediately to avoid showing old constrained layout
        // Use setTimeout with minimal delay to ensure nodes are in store first
        setTimeout(() => {
          console.log('[V2] Auto-optimizing memory shell positions after initial load');
          handleOptimizeNodePositions();
        }, 100);
      })
      .catch(err => {
        console.warn('[V2] Failed to load architecture graph:', err);
      });
  }, [ingestEvents, handleOptimizeNodePositions]);

  // Compute stable positions using cognitive layout
  // Core → Memory → Perception (three concentric shells)
  // Nodes ordered to minimize straight-line connection distances
  // Apply custom positions from dragging and shell rotations
  const positionedNodes = useMemo(() => {
    console.log('[V2] Computing layout for', nodes.size, 'nodes');
    const nodeArray = Array.from(nodes.values());
    console.log('[V2] Node IDs:', nodeArray.map(n => n.id).join(', '));
    const hasDatabase = nodeArray.some(n => n.id === 'database');
    const hasVector = nodeArray.some(n => n.id === 'vector_store');
    console.log('[V2] Has database:', hasDatabase, 'Has vector_store:', hasVector);
    
    const computedLayout = computeCognitiveLayout(nodes, edges);
    
    // Include only core and memory shell nodes (hide perception/tools)
    const filteredLayout = new Map<string, NodeStateV2>();
    let coreCount = 0, memoryCount = 0, perceptionCount = 0;
    
    computedLayout.forEach((node, nodeId) => {
      // Always include nodes with custom positions (optimized memory nodes)
      if (customNodePositions.has(nodeId)) {
        filteredLayout.set(nodeId, node);
        memoryCount++;
        return;
      }
      
      // Include nodes based on shell
      if (node.position) {
        const [x, y, z] = node.position;
        const dist = Math.sqrt(x * x + y * y + z * z);
        
        if (dist < 25) {
          // Core shell nodes
          filteredLayout.set(nodeId, node);
          coreCount++;
        } else if (dist < 50) {
          // Memory shell nodes (if not already optimized)
          if (!customNodePositions.has(nodeId)) {
            filteredLayout.set(nodeId, node);
            memoryCount++;
          }
        }
        // Perception nodes (dist >= 50) are excluded
        else {
          perceptionCount++;
        }
      }
    });
    
    console.log(`[V2 Layout] Showing nodes: core=${coreCount}, memory=${memoryCount}, hidden perception=${perceptionCount}`);
    
    // Apply shell rotations and custom positions
    const finalLayout = new Map<string, NodeStateV2>();
    filteredLayout.forEach((node, nodeId) => {
      if (!node.position) {
        finalLayout.set(nodeId, node);
        return;
      }
      
      let position = node.position;
      
      // Override with optimized/custom position if exists
      if (customNodePositions.has(nodeId)) {
        position = customNodePositions.get(nodeId)!;
        const [cx, cy, cz] = position;
        const cdist = Math.sqrt(cx*cx + cy*cy + cz*cz);
        console.log(`[V2 Layout] Using custom position for ${nodeId}: [${cx.toFixed(1)}, ${cy.toFixed(1)}, ${cz.toFixed(1)}], dist=${cdist.toFixed(1)}`);
        
        // Custom positions are already in final world space - use directly without rotation
        finalLayout.set(nodeId, {
          ...node,
          position: position,
        });
        return; // Skip shell rotation for manually positioned nodes
      }
      
      // Apply shell rotation (only for non-custom positions)
      const [x, y, z] = position;
      const dist = Math.sqrt(x * x + y * y + z * z);
      
      // Determine which shell and get its rotation
      let rotation = { x: 0, y: 0, z: 0 };
      if (dist < CORE_RADIUS + 10) {
        rotation = shellRotations.core;
      } else if (dist < MEMORY_RADIUS + 10) {
        rotation = shellRotations.memory;
      } else {
        rotation = shellRotations.perception;
      }
      
      // Apply rotation using matrix transformation
      const vector = new Vector3(x, y, z);
      const matrix = new Matrix4();
      matrix.makeRotationFromEuler(
        new Euler(
          (rotation.x * Math.PI) / 180,
          (rotation.y * Math.PI) / 180,
          (rotation.z * Math.PI) / 180,
          'XYZ'
        )
      );
      vector.applyMatrix4(matrix);
      
      finalLayout.set(nodeId, {
        ...node,
        position: [vector.x, vector.y, vector.z],
      });
    });
    
    return finalLayout;
  }, [nodes, edges, customNodePositions, shellRotations]);
  
  // Handle node position changes from dragging
  // Store position in un-rotated coordinate system so shell rotations work correctly
  const handleNodePositionChange = (nodeId: string, position: [number, number, number]) => {
    // Store the dragged position directly (already in world space)
    // The dragging component handles sphere constraint internally
    setCustomNodePositions(prev => {
      const next = new Map(prev);
      next.set(nodeId, position);
      return next;
    });
  };

  // Compute node statistics for legend
  const nodeStats = useMemo(() => {
    const stats = {
      core: 0,
      memory: 0,
      perception: 0,
      memoryTypes: {
        episodic: 0,
        declarative: 0,
        procedural: 0,
        planning: 0,
        layered: 0,
        vector: 0,
        storage: 0,
      },
      perceptionTypes: {
        tools: 0,
        api: 0,
        telemetry: 0,
        console: 0,
      },
    };

    Array.from(nodes.values()).forEach(node => {
      const metadata = classifyNode(node.id, node.subsystem);
      
      if (metadata.region === 'core') {
        stats.core++;
      } else if (metadata.region === 'memory') {
        stats.memory++;
        if (metadata.memoryType) {
          stats.memoryTypes[metadata.memoryType]++;
        }
      } else if (metadata.region === 'perception') {
        stats.perception++;
        if (metadata.perceptionType) {
          stats.perceptionTypes[metadata.perceptionType]++;
        }
      }
    });

    return stats;
  }, [nodes]);

  // WebSocket telemetry connection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://localhost:8000/v1/telemetry/stream`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) return;
          setTelemetryConnected(true);
          console.log('[V2] Telemetry connected');
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          
          try {
            const data = JSON.parse(event.data);
            console.log('[V2] Telemetry message received:', Object.keys(data));
            handleTelemetryUpdate(data);
          } catch (err) {
            console.warn('[V2] Failed to parse telemetry:', err);
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('[V2] WebSocket error:', error);
          setTelemetryConnected(false);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setTelemetryConnected(false);
          console.log('[V2] Telemetry disconnected, reconnecting...');

          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        };
      } catch (err) {
        console.warn('[V2] Failed to initialize WebSocket:', err);
        setTelemetryConnected(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } else {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      isUnmounted = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  // Track which edges we've already spawned particles for (with cleanup)
  const spawnedEdgesRef = useRef<Set<string>>(new Set());
  
  // Clean up old spawned edges periodically to allow respawning
  useEffect(() => {
    const interval = setInterval(() => {
      // Clear the set every 5 seconds to allow particles to respawn
      spawnedEdgesRef.current.clear();
      console.log('[V2] Cleared spawned edges cache');
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Process telemetry data with debouncing to prevent UI freezing
  const handleTelemetryUpdate = (data: any) => {
    // Defer processing to next frame to prevent blocking render
    requestAnimationFrame(() => {
      if (data.type === 'update' || data.type === 'initial_state') {
        const traces = data.active_traces || data.traces || [];
      
      console.log('[TELEMETRY UPDATE]', {
        type: data.type,
        traceCount: traces.length,
        traceIds: traces.map((t: any) => t.trace_id || t.id)
      });

      // Collect all unique edges (source -> target pairs) we haven't seen yet
      const edgeMap = new Map<string, Set<string>>(); // source -> Set of targets
      const edgeTimestamps = new Map<string, number>(); // edge key -> first seen timestamp
      
      traces.forEach((trace: any) => {
        if (!trace.spans || trace.spans.length === 0) return;

        const validSpans = trace.spans.filter((s: any) => s && s.component_id);
        if (validSpans.length === 0) return;

        const sorted = [...validSpans].sort((a: any, b: any) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        for (let i = 0; i < sorted.length - 1; i++) {
          const source = sorted[i].component_id;
          const target = sorted[i + 1].component_id;
          const timestamp = new Date(sorted[i].start_time).getTime();
          const traceId = trace.trace_id || trace.id;
          
          // Create unique key: traceId + edge (so same edge in different traces = different particles)
          const edgeKey = `${traceId}:${source}->${target}`;
          
          // Only process edges we haven't spawned particles for yet
          if (spawnedEdgesRef.current.has(edgeKey)) continue;
          
          spawnedEdgesRef.current.add(edgeKey);
          
          // Track outgoing edges from each source
          if (!edgeMap.has(source)) {
            edgeMap.set(source, new Set());
          }
          edgeMap.get(source)!.add(target);
          
          // Track timestamp for this edge
          if (!edgeTimestamps.has(edgeKey)) {
            edgeTimestamps.set(edgeKey, timestamp);
          }
        }
      });
      
      // Create events: each unique edge becomes one event
      // Large particle: agent_router → llm_gateway (represents the LLM decision)
      // Small particles: everything else (tool executions and returns)
      const events: TelemetryEventV2[] = [];
      const llmGatewayOutgoingCount = edgeMap.get('llm_gateway')?.size || 1;
      
      edgeMap.forEach((targets, source) => {
        targets.forEach(target => {
          // Note: edgeTimestamps are keyed with traceId prefix, but we'll just use Date.now()
          const timestamp = Date.now();
          
          // Only make it large if it's the initial request TO llm_gateway (from router/orchestrator)
          // NOT from tools returning to llm_gateway
          const isLLMDecision = target === 'llm_gateway' && 
                               (source === 'agent_router' || source === 'orchestrator' || source === 'coordinator');
          
          const spawnCount = isLLMDecision
            ? llmGatewayOutgoingCount  // Large: sized by decision complexity
            : 1;                       // Small: tool execution or data return
          
          const event = {
            source,
            target,
            type: 'data_transfer' as const,
            timestamp: Date.now(), // Use now for animation
            bytes: 1024,
            priority: 'normal' as const,
            is_parent_trace: true,
            spawn_count: spawnCount,
          };
          
          console.log('[EVENT PUSHED]', event);
          events.push(event);
        });
      });

      console.log('[EDGE AGGREGATION]', {
        sources: edgeMap.size,
        details: Array.from(edgeMap.entries()).map(([source, targets]) => ({
          source,
          targetCount: targets.size,
          targets: Array.from(targets)
        }))
      });

      console.log('[EVENTS CREATED]', events.length, 'events:', events);

        if (events.length > 0) {
          console.log('[V2] Calling ingestEvents with', events.length, 'events');
          ingestEvents(events);
          // Note: particleEvents won't update until next render (Zustand state)
        }
      }
    });
  };

  // Update stats
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        fps: 60, // TODO: actual FPS measurement
        nodeCount: nodes.size,
        edgeCount: edges.size,
        particleCount: activeParticleCount,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [nodes.size, edges.size, activeParticleCount]);

  // Log particleEvents changes to debug store updates
  useEffect(() => {
    console.log('[V2 EFFECT] particleEvents updated, length:', particleEvents.length);
    if (particleEvents.length > 0) {
      console.log('[V2 EFFECT] First event:', particleEvents[0]);
    }
  }, [particleEvents]);

  // Clear consumed particle events periodically
  useEffect(() => {
    const interval = setInterval(() => {
      clearParticleEvents();
    }, 5000); // Clear every 5 seconds

    return () => clearInterval(interval);
  }, [clearParticleEvents]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#02030a' }}>
      <Canvas
        camera={{ position: [0, 0, 150], fov: 75, far: 5000 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#02030a']} />
        
        {/* Lighting */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 10]} intensity={2.0} castShadow />
        <directionalLight position={[-10, -10, -10]} intensity={1.5} color="#3B82F6" />
        <directionalLight position={[0, 10, -10]} intensity={1.5} color="#60A5FA" />
        <pointLight position={[0, 50, 0]} intensity={3.0} color="#FFFFFF" />
        <pointLight position={[50, 0, 50]} intensity={2.0} color="#FFD700" />
        <pointLight position={[-50, 0, -50]} intensity={2.0} color="#FF1493" />

        <Suspense fallback={null}>
          {/* Cognitive region shells (wireframe guides) */}
          <NeuralCognitiveShellsV2 
            visible={true} 
            opacity={0.12}
            shellRotations={shellRotations}
          />
          
          {/* Rotation handles for selected shell */}
          <NeuralShellRotationHandles
            selectedShell={selectedShellForRotation}
            shellRotations={shellRotations}
          />
          
          {/* Shell drag rotation handler */}
          <NeuralShellDragRotation
            selectedShell={selectedShellForRotation}
            shellRotations={shellRotations}
            onRotationChange={(shell, rotation) => {
              console.log('[Architecture] Updating shell rotation:', shell, rotation);
              // Update local state
              setShellRotations(prev => ({ ...prev, [shell]: rotation }));
            }}
          />
          
          {/* Draggable nodes with shell rotation support */}
          <NeuralDraggableNodes
            nodes={positionedNodes}
            edges={edges}
            timeScale={timeScale}
            onNodePositionChange={handleNodePositionChange}
            onDragStateChange={setIsDraggingNode}
            disabled={!!selectedShellForRotation}
          />
          
          {/* Instanced rendering components */}
          <NeuralEdgesInstancedV2 nodes={positionedNodes} edges={edges} timeScale={timeScale} />
          {/* Particles disabled */}
        </Suspense>

        <OrbitControls
          enabled={!isDraggingNode && !selectedShellForRotation}
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.5}
          zoomSpeed={1.5}
          minDistance={20}
          maxDistance={800}
        />
      </Canvas>
      
      {/* HUD Overlay - Top bar with connection status and stats */}
      <NeuralHUDV2 telemetryConnected={true} stats={stats} />
      
      {/* Cognitive Legend - Bottom Left with detailed region info */}
      <NeuralCognitiveLegendV2 nodeStats={nodeStats} />
    </div>
  );
}
