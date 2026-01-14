// NeuralArchitecture3DV2.tsx
// Main scene component for Atlas Neural 3D Visualization V2
// Complete reimplementation with instanced rendering and hierarchical layout

'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Vector3, Matrix4, Euler } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
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
import { NodeSelectorPanel } from './NodeSelectorPanel';
import { useHealth } from '@/contexts/HealthContext';

import { TelemetryEventV2, NodeStateV2 } from './NeuralTelemetryTypesV2';
import { convertV1ToV2, inferSubsystem } from './NeuralTelemetryUtilsV2';
import { optimizeShellRotations } from './NeuralShellOptimizer';
import { optimizeNodePositionsOnShell } from './NeuralNodePositionOptimizer';

// Camera animation component
function CameraController({
  focus,
  controlsRef,
  onComplete,
}: {
  focus: { position: Vector3; target: Vector3 } | null;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  onComplete: () => void;
}) {
  const { camera } = useThree();
  const animatingRef = useRef(false);
  const startPosRef = useRef<Vector3>(new Vector3());
  const startTargetRef = useRef<Vector3>(new Vector3());
  const progressRef = useRef(0);

  useEffect(() => {
    if (focus && !animatingRef.current) {
      console.log('[CameraController] Starting camera animation');
      animatingRef.current = true;
      startPosRef.current.copy(camera.position);
      if (controlsRef.current) {
        startTargetRef.current.copy(controlsRef.current.target);
      }
      progressRef.current = 0;
    }
  }, [focus, camera, controlsRef]);

  useFrame((state, delta) => {
    if (!focus || !animatingRef.current) return;

    // Smooth animation over 1 second
    progressRef.current += delta * 1.5;
    const t = Math.min(progressRef.current, 1);
    
    // Easing function (ease-in-out)
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Interpolate camera position
    camera.position.lerpVectors(startPosRef.current, focus.position, ease);
    
    // Interpolate OrbitControls target
    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startTargetRef.current, focus.target, ease);
      controlsRef.current.update();
    }

    // Complete animation
    if (t >= 1) {
      console.log('[CameraController] Animation complete');
      animatingRef.current = false;
      progressRef.current = 0;
      onComplete();
    }
  });

  return null;
}

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
  
  // Track node selector panel visibility
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  
  // Debug state for visible output
  const [debugInfo, setDebugInfo] = useState('');
  
  // Camera focus state
  const [cameraFocus, setCameraFocus] = useState<{ position: Vector3; target: Vector3 } | null>(null);
  const orbitControlsRef = useRef<OrbitControlsType | null>(null);
  
  // Track node count for auto-optimization
  const prevNodeCountRef = useRef(0);
  
  // Optimization handler
  const handleOptimizeRotations = () => {
    console.log('[V2] Optimizing shell rotations...');
    const optimized = optimizeShellRotations(nodes, edges, shellRotations);
    setShellRotations(optimized);
  };

  // Handle node selection from panel - focus camera on node
  const handleNodeSelect = useCallback((nodeId: string, position: [number, number, number]) => {
    console.log('[V2] Focusing camera on node:', nodeId, 'at position:', position);
    
    const targetPos = new Vector3(...position);
    const distance = 11.76; // Distance from node - 30% closer from 16.8 (16.8 * 0.7)
    
    // Calculate camera position offset from target
    const direction = targetPos.clone().normalize();
    const cameraPos = targetPos.clone().add(direction.multiplyScalar(distance));
    
    setCameraFocus({ position: cameraPos, target: targetPos });
  }, []);

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
            skipParticles: true,  // Don't spawn particles from initial architecture load
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
            skipParticles: true,  // Don't spawn particles from initial architecture load
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
    
    // Include ALL nodes (no filtering)
    const filteredLayout = new Map<string, NodeStateV2>();
    let coreCount = 0, memoryCount = 0, perceptionCount = 0;
    
    computedLayout.forEach((node, nodeId) => {
      // Always include every node
      filteredLayout.set(nodeId, node);
      
      // Count nodes by shell for debugging
      if (node.position) {
        const [x, y, z] = node.position;
        const dist = Math.sqrt(x * x + y * y + z * z);
        
        if (dist < 30) {
          coreCount++;
        } else if (dist < 70) {
          memoryCount++;
        } else {
          perceptionCount++;
        }
      }
    });
    
    console.log(`[V2 Layout] Showing ALL nodes: core=${coreCount}, memory=${memoryCount}, perception=${perceptionCount}, total=${filteredLayout.size}`);
    
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
    console.log(`[V2 Drag] Setting position for ${nodeId}:`, position);
    
    // Import dynamically to avoid SSR issues
    if (typeof window !== 'undefined') {
      import('@/lib/debugLogger').then(({ debugLogger }) => {
        debugLogger.log('DRAG', `Setting position for ${nodeId}`, position);
      });
    }
    
    setCustomNodePositions(prev => {
      const next = new Map(prev);
      next.set(nodeId, position);
      console.log(`[V2 Drag] Total custom positions now:`, next.size);
      
      if (typeof window !== 'undefined') {
        import('@/lib/debugLogger').then(({ debugLogger }) => {
          debugLogger.log('DRAG', `Total custom positions now: ${next.size}`, Array.from(next.keys()));
        });
      }
      
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
          // Store state on window for health checks
          if (typeof window !== 'undefined') {
            (window as any).__atlasWebSocketState = { connected: true, error: false };
          }
          // Dispatch telemetry status event
          window.dispatchEvent(new CustomEvent('telemetry-status', { detail: { connected: true } }));
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          
          try {
            const data = JSON.parse(event.data);
            console.log('[V2] Telemetry message received:', Object.keys(data));
            
            // DEBUG: Log events array details
            if (data.events) {
              console.log('[V2] Events array length:', data.events.length);
              if (data.events.length > 0) {
                console.log('[V2] First event:', JSON.stringify(data.events[0]));
              }
            } else {
              console.log('[V2] NO events array in message');
            }
            
            handleTelemetryUpdate(data);
          } catch (err) {
            console.warn('[V2] Failed to parse telemetry:', err);
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('[V2] WebSocket error:', error);
          setTelemetryConnected(false);
          // Store state on window for health checks
          if (typeof window !== 'undefined') {
            (window as any).__atlasWebSocketState = { connected: false, error: true };
          }
          // Dispatch telemetry status event
          window.dispatchEvent(new CustomEvent('telemetry-status', { detail: { connected: false } }));
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setTelemetryConnected(false);
          console.log('[V2] Telemetry disconnected, reconnecting...');
          // Store state on window for health checks
          if (typeof window !== 'undefined') {
            (window as any).__atlasWebSocketState = { connected: false, error: false };
          }
          // Dispatch telemetry status event
          window.dispatchEvent(new CustomEvent('telemetry-status', { detail: { connected: false } }));

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

  // Track which edges we've already spawned particles for with timestamps
  // Use Map instead of Set to store spawn timestamps for expiration
  const spawnedEdgesRef = useRef<Map<string, number>>(new Map());
  
  // Clear old spawned edges every 5 seconds to allow re-spawning on new queries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expirationTime = 3000; // 3 seconds - edges can re-spawn after this
      
      // Remove edges older than expiration time
      let removedCount = 0;
      spawnedEdgesRef.current.forEach((timestamp, edgeKey) => {
        if (now - timestamp > expirationTime) {
          spawnedEdgesRef.current.delete(edgeKey);
          removedCount++;
        }
      });
      
      if (removedCount > 0) {
        console.log('[V2] Cleared', removedCount, 'expired edges from spawn tracking');
      }
    }, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, []);

  // Process telemetry data with debouncing to prevent UI freezing
  const handleTelemetryUpdate = (data: any) => {
    console.log('[handleTelemetryUpdate] Called with data:', JSON.stringify(data).substring(0, 200));
    
    // Defer processing to next frame to prevent blocking render
    requestAnimationFrame(() => {
      const memoryEvents: TelemetryEventV2[] = [];
      
      // Handle TWO formats:
      // 1. Single event object: {type: 'memory_write', sourceId: 'X', targetId: 'Y'}
      // 2. Events array: {events: [{type: 'memory_write', ...}, ...]}
      
      let eventsToProcess: any[] = [];
      
      if (data.type === 'memory_write' && data.sourceId && data.targetId) {
        // Single event format from WebSocket
        console.log('[handleTelemetryUpdate] Single memory_write event:', data.sourceId, '→', data.targetId);
        eventsToProcess = [data];
      } else if (data.events && Array.isArray(data.events)) {
        // Events array format
        console.log('[handleTelemetryUpdate] Found events array with', data.events.length, 'items');
        eventsToProcess = data.events;
      } else {
        console.log('[handleTelemetryUpdate] Unrecognized format, keys:', Object.keys(data).join(', '));
        return;
      }
      
      // Process all events
      eventsToProcess.forEach((evt: any) => {
        console.log('[handleTelemetryUpdate] Processing event:', evt.type, evt.sourceId, evt.targetId);
        if (evt.type === 'memory_write' && evt.sourceId && evt.targetId) {
          console.log(`[MEMORY_WRITE] ${evt.sourceId} → ${evt.targetId} (${evt.layer || 'unknown'})`);
          
          memoryEvents.push({
            source: evt.sourceId,
            target: evt.targetId,
            type: 'data_transfer' as const,
            timestamp: Date.now(),
            bytes: 1024,
            priority: 'high' as const,
            is_parent_trace: true,
            spawn_count: 3, // Multiple particles for memory writes
            skipParticles: false, // Explicitly allow particles
          });
        }
      });
      
      if (memoryEvents.length > 0) {
        console.log('[V2] Processing', memoryEvents.length, 'memory_write events - calling ingestEvents');
        ingestEvents(memoryEvents);
      } else {
        console.log('[V2] No memory_write events to process');
      }
      
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
          
          // Only process edges we haven't recently spawned particles for
          if (spawnedEdgesRef.current.has(edgeKey)) continue;
          
          // Track spawn time for expiration
          spawnedEdgesRef.current.set(edgeKey, Date.now());
          
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
            skipParticles: false, // Explicitly allow particles
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

  // NOTE: Removed auto-clear interval for particle events
  // Particles are now cleared only after being spawned (one-time consumption)
  // This prevents continuous respawning from the same static edges

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

        {/* Camera focus controller */}
        <CameraController focus={cameraFocus} controlsRef={orbitControlsRef} onComplete={() => setCameraFocus(null)} />

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
          
          {/* Instanced rendering components */}
          <NeuralNodesInstancedV2 nodes={positionedNodes} edges={edges} timeScale={timeScale} />
          <NeuralEdgesInstancedV2 nodes={positionedNodes} edges={edges} timeScale={timeScale} />
          <NeuralLabelsV2 nodes={positionedNodes} edges={edges} />
          <NeuralParticlesInstancedV2 
            nodes={positionedNodes} 
            edges={edges} 
            spawnEvents={particleEvents}
            timeScale={timeScale}
            maxParticles={maxParticles}
            onActiveCountChange={setActiveParticleCount}
          />
        </Suspense>

        <OrbitControls
          ref={orbitControlsRef}
          target={[0, 0, 0]}
          enabled={!isDraggingNode && !selectedShellForRotation}
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.5}
          zoomSpeed={0.3}
          minDistance={20}
          maxDistance={800}
        />
      </Canvas>
      
      {/* HUD Overlay - Top bar with connection status and stats */}
      <NeuralHUDV2 telemetryConnected={true} stats={stats} />
      
      {/* Cognitive Legend - Bottom Left with detailed region info */}
      <NeuralCognitiveLegendV2 nodeStats={nodeStats} />
      
      {/* Node Selector Panel - expands upward from bottom-right */}
      {showNodeSelector && (
        <NodeSelectorPanel
          nodes={positionedNodes}
          onNodeSelect={handleNodeSelect}
          onClose={() => setShowNodeSelector(false)}
        />
      )}
      
      {/* Debug Info Display */}
      {debugInfo && (
        <div className="absolute top-4 right-4 bg-black/80 text-white p-4 rounded shadow-lg z-50 max-w-md text-xs font-mono">
          <pre className="whitespace-pre-wrap">{debugInfo}</pre>
        </div>
      )}
      
      {/* Test Particle Button - bottom-right, above node selector */}
      <button
        onClick={() => {
          const info: string[] = [];
          info.push(`[TEST] Injecting test particle event`);
          info.push(`Nodes: ${nodes.size}, Edges: ${edges.size}`);
          info.push(`ParticleEvents: ${particleEvents.length}`);
          
          // Get first NON-self-referential edge from store
          const validEdge = Array.from(edges.values()).find(e => e.sourceId !== e.targetId);
          if (!validEdge) {
            info.push('ERROR: No valid edges (all self-loops)');
            info.push('Edges: ' + Array.from(edges.values()).slice(0, 5).map(e => `${e.sourceId}->${e.targetId}`).join(', '));
            setDebugInfo(info.join('\n'));
            return;
          }
          
          info.push(`Using edge: ${validEdge.sourceId} -> ${validEdge.targetId}`);
          
          const testEvent = {
            source: validEdge.sourceId,
            target: validEdge.targetId,
            type: 'data_transfer' as const,
            timestamp: Date.now(),
            bytes: 1024,
            priority: 'high' as const,
            is_parent_trace: true,
            spawn_count: 3,
            skipParticles: false,
          };
          
          ingestEvents([testEvent]);
          
          // Check after ingestion
          setTimeout(() => {
            info.push(`After ingest: particleEvents = ${particleEvents.length}`);
            info.push('\nWaiting for particles to spawn...');
            info.push('Check if you see moving dots on edges');
            setDebugInfo(info.join('\n'));
            
            // Clear after 5 seconds
            setTimeout(() => setDebugInfo(''), 5000);
          }, 100);
        }}
        className="absolute bottom-20 right-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow-lg z-50 transition-colors"
        title="Inject Test Particle"
      >
        Test Particle
      </button>
      
      {/* Node Selector Toggle Button - bottom-right */}
      <button
        onClick={() => setShowNodeSelector(!showNodeSelector)}
        className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg z-50 transition-colors"
        title="Toggle Node Selector"
      >
        {showNodeSelector ? 'Hide Nodes' : 'Show Nodes'}
      </button>
    </div>
  );
}
