// NeuralParticlesInstancedV2.tsx
// High-performance particle system using instanced rendering with fixed-size pool

'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { InstancedMesh, Object3D, Color, Matrix4 } from 'three';
import { useFrame } from '@react-three/fiber';
import { EdgeStateV2, NodeStateV2, TelemetryEventV2 } from './NeuralTelemetryTypesV2';
import { PARTICLE_COLORS_BY_EVENT, NODE_COLORS, REGION_COLORS } from './NeuralVisualEncodingV2';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';
import { classifyNode } from './NeuralCognitiveLayoutV2';

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, EdgeStateV2>;
  spawnEvents: TelemetryEventV2[];
  maxParticles?: number;
  timeScale: number;
  onActiveCountChange?: (count: number) => void;
}

interface ParticleRuntime {
  active: boolean;
  edgeId: string;
  t: number;            // 0..1 progress along edge
  speed: number;
  color: Color;
  size: number;
  // Multi-hop journey (visual only)
  path?: string[];
  currentHopIndex: number;
}

const dummy = new Object3D();
const identityMatrix = new Matrix4();

export function NeuralParticlesInstancedV2({
  nodes,
  edges,
  spawnEvents,
  maxParticles = 50000,
  timeScale,
  onActiveCountChange,
}: Props) {
  const meshRef = useRef<InstancedMesh>(null!);
  const glowRef = useRef<InstancedMesh>(null!);
  const updateParticleProgress = useNeuralTelemetryStoreV2((s) => s.updateParticleProgress);
  
  // Fixed-size particle pool (never reallocated)
  const particles = useMemo<ParticleRuntime[]>(
    () =>
      Array.from({ length: maxParticles }, () => ({
        active: false,
        edgeId: '',
        t: 0,
        speed: 0,
        color: new Color('#ffffff'),
        size: 1,
        currentHopIndex: 0,
      })),
    [maxParticles]
  );

  // Create custom shader material with per-instance colors
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        emissiveIntensity: { value: 2.0 },
      },
      vertexShader: `
        varying vec3 vColor;
        
        void main() {
          vColor = instanceColor;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float emissiveIntensity;
        varying vec3 vColor;
        
        void main() {
          vec3 emissive = vColor * emissiveIntensity;
          gl_FragColor = vec4(emissive, 1.0);
        }
      `,
    });
  }, []);
  const spawnIndexRef = useRef(0);
  const lastActiveCountRef = useRef(0);
  const activeCountRef = useRef(0); // Track count incrementally
  const processedEventsRef = useRef(new Set<string>());
  const frameCountRef = useRef(0);



  useFrame((_, delta) => {
    if (!meshRef.current || !glowRef.current) return;
    
    const dt = delta * timeScale;
    frameCountRef.current++;

    // Reconcile active count every 60 frames to fix any drift
    if (frameCountRef.current % 60 === 0) {
      let actualCount = 0;
      for (let i = 0; i < particles.length; i++) {
        if (particles[i].active) actualCount++;
      }
      if (actualCount !== activeCountRef.current) {
        console.log('[PARTICLE COUNT] Reconciling: was', activeCountRef.current, 'actually', actualCount);
        activeCountRef.current = actualCount;
      }
    }

    // Log spawn events being processed (more detail)
    if (spawnEvents.length > 0) {
      console.log('[PARTICLE FRAME] Processing', spawnEvents.length, 'spawn events, edges available:', edges.size);
      console.log('[PARTICLE FRAME] First spawn event:', spawnEvents[0]);
      console.log('[PARTICLE FRAME] Sample edges:', Array.from(edges.keys()).slice(0, 5));
    }

    // Spawn new particles from ALL events (one particle per hop)
    for (const ev of spawnEvents) {
      const edgeId = `${ev.source}->${ev.target}`;
      if (!edges.has(edgeId)) {
        console.log('[PARTICLE] Edge not found:', edgeId, 'Available edges:', Array.from(edges.keys()).slice(0, 5));
        continue;
      }
      
      // Create unique event ID to prevent duplicate spawns
      const eventId = `${ev.timestamp}_${edgeId}`;
      if (processedEventsRef.current.has(eventId)) continue;
      
      processedEventsRef.current.add(eventId);
      
      const p = particles[spawnIndexRef.current];
      if (!p.active) {
        activeCountRef.current++; // Increment when activating
      }
      p.active = true;
      p.edgeId = edgeId;
      p.t = 0;
      p.currentHopIndex = 0;
      p.path = undefined; // No multi-hop tracking
      
      console.log('[PARTICLE ACTIVATED] edgeId:', edgeId, 'particle index:', spawnIndexRef.current);
      
      // Speed based on priority
      p.speed = ev.priority === 'high' ? 1.5 : ev.priority === 'low' ? 0.3 : 0.8;
      
      // Inherit color from source node
      const sourceNode = nodes.get(ev.source);
      if (sourceNode) {
        // Compute source node's color using same logic as node renderer
        const nodeMetadata = classifyNode(sourceNode.id, sourceNode.subsystem);
        const regionColor = new Color(REGION_COLORS[nodeMetadata.region]);
        const subsystemColor = new Color(NODE_COLORS[sourceNode.subsystem]);
        
        // Blend region and subsystem colors (70% region, 30% subsystem)
        const nodeColor = regionColor.lerp(subsystemColor, 0.3);
        
        // Special handling for specific nodes
        const isAgentRouter = sourceNode.id.toLowerCase().includes('agent_router') || sourceNode.id.toLowerCase().includes('agentrouter');
        const isSandboxExecution = sourceNode.id.toLowerCase().includes('sandbox_execution');
        
        if (isAgentRouter) {
          nodeColor.setHex(0xFFD700); // Pure gold
        } else if (isSandboxExecution) {
          nodeColor.setHex(0x00CED1); // Cyan
        }
        
        p.color.copy(nodeColor);
      } else {
        // Fallback to event type color if source node not found
        p.color.set(PARTICLE_COLORS_BY_EVENT[ev.type] || '#ffffff');
      }
      
      // Size reflects "weight" of operation (how many spawns this decision triggered)
      // Single tool = smaller, multi-tool decision = larger
      const baseSize = 1.5; // Match smallest node size for visibility
      const spawnMultiplier = Math.sqrt(ev.spawn_count || 1); // sqrt for balanced scaling (1→1, 4→2, 9→3)
      p.size = baseSize * spawnMultiplier; // Large enough to see clearly
      
      console.log('[PARTICLE SPAWN]', {
        source: ev.source,
        target: ev.target,
        spawn_count: ev.spawn_count,
        size: p.size
      });

      spawnIndexRef.current = (spawnIndexRef.current + 1) % maxParticles;
    }
    
    // Clean up old processed event IDs (keep only last 1000)
    if (processedEventsRef.current.size > 1000) {
      const entries = Array.from(processedEventsRef.current);
      processedEventsRef.current = new Set(entries.slice(-500));
    }

    // Collect active particles for progress tracking
    const activeParticlesData: { sourceId: string; targetId: string; progress: number }[] = [];

    // Update all particles
    particles.forEach((p, i) => {
      if (!p.active) {
        // Hide inactive particles - move far away and scale to zero
        dummy.position.set(10000, 10000, 10000);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        glowRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }

      const edge = edges.get(p.edgeId);
      if (!edge) {
        p.active = false;
        activeCountRef.current--; // Decrement when deactivating
        return;
      }

      const src = nodes.get(edge.sourceId);
      const dst = nodes.get(edge.targetId);
      if (!src || !dst) {
        p.active = false;
        activeCountRef.current--; // Decrement when deactivating
        return;
      }

      // Advance particle along edge
      p.t += p.speed * dt;
      
      if (p.t >= 1.0) {
        // Particle reached end of edge, deactivate
        p.active = false;
        activeCountRef.current--; // Decrement when deactivating
        meshRef.current.setMatrixAt(i, identityMatrix);
        return;
      }

      // Quadratic bezier curve along edge
      const [x1, y1, z1] = src.position;
      const [x2, y2, z2] = dst.position;
      
      // Calculate control point perpendicular to edge
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const midZ = (z1 + z2) / 2;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const edgeLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Perpendicular offset (cross product with up vector)
      const curvature = edgeLen * 0.15; // 15% of edge length
      const perpX = -dz * curvature / (edgeLen || 1);
      const perpY = curvature;
      const perpZ = dx * curvature / (edgeLen || 1);
      
      const ctrlX = midX + perpX;
      const ctrlY = midY + perpY;
      const ctrlZ = midZ + perpZ;
      
      // Validate control point
      if (!isFinite(ctrlX) || !isFinite(ctrlY) || !isFinite(ctrlZ)) {
        console.warn('[PARTICLE] Invalid control point, deactivating particle');
        p.active = false;
        activeCountRef.current--; // Decrement when deactivating
        dummy.position.set(10000, 10000, 10000);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }
      
      // Quadratic bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
      const t = p.t;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      const factor = 2 * mt * t;
      
      const x = mt2 * x1 + factor * ctrlX + t2 * x2;
      const y = mt2 * y1 + factor * ctrlY + t2 * y2;
      const z = mt2 * z1 + factor * ctrlZ + t2 * z2;

      // Validate computed position
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        console.warn('[PARTICLE] Invalid position computed, deactivating particle');
        p.active = false;
        dummy.position.set(10000, 10000, 10000);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }

      dummy.position.set(x, y, z);
      dummy.scale.set(p.size, p.size, p.size);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, p.color);
      
      // Track particle progress for node illumination
      activeParticlesData.push({
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        progress: p.t,
      });
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    
    // Force geometry to recompute bounding sphere to prevent NaN errors
    if (meshRef.current.geometry.boundingSphere) {
      meshRef.current.geometry.boundingSphere = null;
    }
    meshRef.current.geometry.computeBoundingSphere();

    // Report active particle count (tracked incrementally for O(1) performance)
    if (onActiveCountChange) {
      const activeCount = Math.max(0, activeCountRef.current); // Ensure non-negative
      if (activeCount !== lastActiveCountRef.current) {
        lastActiveCountRef.current = activeCount;
        console.log('[PARTICLE COUNT] Active particles:', activeCount);
        onActiveCountChange(activeCount);
      }
    }
    
    // Update particle progress in store for node illumination timing
    if (activeParticlesData.length > 0) {
      updateParticleProgress(activeParticlesData);
    }
  });

  return (
    <>
      {/* Core bright white center */}
      <instancedMesh
        ref={meshRef}
        args={[undefined as any, particleMaterial, maxParticles]}
        renderOrder={999}
      >
        <sphereGeometry args={[0.8, 16, 16]} />
      </instancedMesh>
      
      {/* Outer colored glow shell */}
      <instancedMesh
        ref={glowRef}
        args={[undefined as any, undefined as any, maxParticles]}
        renderOrder={998}
      >
        <sphereGeometry args={[2.0, 16, 16]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.6}
          depthTest={true}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}
