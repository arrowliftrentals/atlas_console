// NeuralParticlesInstancedV2.tsx
// Helical ribbon particle system following shell surface paths

'use client';

import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { InstancedMesh, Object3D, Color, Matrix4, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { EdgeStateV2, NodeStateV2, TelemetryEventV2 } from './NeuralTelemetryTypesV2';
import { PARTICLE_COLORS_BY_EVENT, NODE_COLORS, REGION_COLORS } from './NeuralVisualEncodingV2';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';
import { classifyNode } from './NeuralCognitiveLayoutV2';
import { calculateEdgePath, getPathPosition } from './NeuralPathUtils';

const CORE_RADIUS = 20;
const MEMORY_RADIUS = 60;
const PERCEPTION_RADIUS = 100;

// Determine which shell a position belongs to
function getNodeShell(position: [number, number, number]): number {
  const [x, y, z] = position;
  const radius = Math.sqrt(x*x + y*y + z*z);
  const distToCore = Math.abs(radius - CORE_RADIUS);
  const distToMemory = Math.abs(radius - MEMORY_RADIUS);
  const distToPerception = Math.abs(radius - PERCEPTION_RADIUS);
  const minDist = Math.min(distToCore, distToMemory, distToPerception);
  if (minDist === distToCore) return CORE_RADIUS;
  if (minDist === distToMemory) return MEMORY_RADIUS;
  return PERCEPTION_RADIUS;
}

// Project point to sphere surface
function projectToSphere(x: number, y: number, z: number, radius: number): [number, number, number] {
  const len = Math.sqrt(x*x + y*y + z*z);
  if (len === 0) return [radius, 0, 0];
  const scale = radius / len;
  return [x * scale, y * scale, z * scale];
}

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
  // Bezier curve path for smooth animation
  curvePath?: Vector3[];
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
  const updateParticleProgress = useNeuralTelemetryStoreV2((s) => s.updateParticleProgress);
  const clearParticleEvents = useNeuralTelemetryStoreV2((s) => s.clearParticleEvents);
  
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

  // Single color material
  const particleMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x00FFFF, // Bright cyan
      toneMapped: false,
    });
  }, []);
  const spawnIndexRef = useRef(0);
  const lastActiveCountRef = useRef(0);
  const activeCountRef = useRef(0); // Track count incrementally
  const processedEventsRef = useRef(new Set<string>());
  const frameCountRef = useRef(0);



  useFrame((_, delta) => {
    if (!meshRef.current) return;
    
    const dt = delta * timeScale;
    frameCountRef.current++;

    // Reconcile active count every 60 frames to fix any drift
    if (frameCountRef.current % 60 === 0) {
      let actualCount = 0;
      for (let i = 0; i < particles.length; i++) {
        if (particles[i].active) actualCount++;
      }
      if (actualCount !== activeCountRef.current) {
        activeCountRef.current = actualCount;
      }
    }

    // Spawn new particles from ALL events (one particle per hop)
    for (const ev of spawnEvents) {
      const edgeId = `${ev.source}->${ev.target}`;
      
      // Check if nodes exist
      const srcNode = nodes.get(ev.source);
      const dstNode = nodes.get(ev.target);
      
      if (!srcNode || !dstNode) {
        console.warn('[PARTICLE] Missing nodes for edge:', edgeId, 
          'source exists:', !!srcNode, 'target exists:', !!dstNode,
          'Available nodes:', Array.from(nodes.keys()).slice(0, 10).join(', '));
        continue;
      }
      
      if (!edges.has(edgeId)) {
        console.warn('[PARTICLE] Edge not found:', edgeId, 
          'Available edges:', Array.from(edges.keys()).slice(0, 10).join(', '));
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
      
      // Use straight line path for now (no curve)
      p.curvePath = undefined;
      
      // Speed based on priority
      p.speed = ev.priority === 'high' ? 1.2 : ev.priority === 'low' ? 0.4 : 0.8;
      
      // Single color for all particles
      p.color.setHex(0x00FFFF);
      
      // Fixed size
      p.size = 0.8;

      spawnIndexRef.current = (spawnIndexRef.current + 1) % maxParticles;
    }
    
    // Clean up old processed event IDs (keep only last 1000)
    if (processedEventsRef.current.size > 1000) {
      const entries = Array.from(processedEventsRef.current);
      processedEventsRef.current = new Set(entries.slice(-500));
    }
    
    // Clear consumed spawn events after processing
    if (spawnEvents.length > 0) {
      clearParticleEvents();
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

      // Use curved path if available, otherwise straight line
      let x: number, y: number, z: number;
      
      if (p.curvePath && p.curvePath.length > 0) {
        // Animate along bezier curve
        const position = getPathPosition(p.curvePath, p.t);
        x = position.x;
        y = position.y;
        z = position.z;
      } else {
        // Fallback to straight line
        const [x1, y1, z1] = src.position;
        const [x2, y2, z2] = dst.position;
        const t = p.t;
        x = x1 + (x2 - x1) * t;
        y = y1 + (y2 - y1) * t;
        z = z1 + (z2 - z1) * t;
      }

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

      // Log first active particle every 30 frames
      if (frameCountRef.current % 30 === 0 && i === 0) {
        console.log(`[P0] t=${p.t.toFixed(3)} pos=[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`);
        console.log(`     src=[${src.position[0].toFixed(1)}, ${src.position[1].toFixed(1)}, ${src.position[2].toFixed(1)}]`);
        console.log(`     dst=[${dst.position[0].toFixed(1)}, ${dst.position[1].toFixed(1)}, ${dst.position[2].toFixed(1)}]`);
      }

      dummy.position.set(x, y, z);
      dummy.scale.set(p.size, p.size, p.size);
      dummy.updateMatrix();
      
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Track particle progress for node illumination
      activeParticlesData.push({
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        progress: p.t,
      });
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // Force geometry to recompute bounding sphere to prevent NaN errors
    if (meshRef.current.geometry.boundingSphere) {
      meshRef.current.geometry.boundingSphere = null;
    }
    meshRef.current.geometry.computeBoundingSphere();

    // Report active particle count (no logging)
    if (onActiveCountChange) {
      const activeCount = Math.max(0, activeCountRef.current);
      if (activeCount !== lastActiveCountRef.current) {
        lastActiveCountRef.current = activeCount;
        onActiveCountChange(activeCount);
      }
    }
    
    // Update particle progress in store for node illumination timing
    if (activeParticlesData.length > 0) {
      updateParticleProgress(activeParticlesData);
    }
  });

  // Simple large sphere for visibility testing
  const particleGeometry = useMemo(() => new THREE.SphereGeometry(2.0, 16, 16), []);
  return (
    <>
      {/* Single solid neon blue sphere */}
      <instancedMesh
        ref={meshRef}
        args={[particleGeometry, particleMaterial, maxParticles]}
        renderOrder={999}
      />
    </>
  );
}
