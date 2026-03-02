// NeuralParticlesInstancedV2.tsx
// Helical ribbon particle system following shell surface paths


import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { InstancedMesh, Object3D, Color, Matrix4, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { EdgeStateV2, NodeStateV2, TelemetryEventV2 } from './NeuralTelemetryTypesV2';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';
import { calculateEdgePath, getPathPosition } from './NeuralPathUtils';

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
  hidden: boolean; // true once matrix set to "hidden" state — skip in loop
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
        hidden: false,
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
      
      // Speed based on priority (slowed so streams linger on-screen longer)
      p.speed = ev.priority === 'high' ? 0.55 : ev.priority === 'low' ? 0.18 : 0.35;
      
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
        if (!p.hidden) {
          // Just became inactive — hide once then skip future frames
          dummy.position.set(10000, 10000, 10000);
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
          p.hidden = true;
        }
        return;
      }
      p.hidden = false; // active particle is visible

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

      // Dissolve tail:
      let effectiveSize = p.size;
      if (p.t > 0.8) {
        effectiveSize *= (1.0 - p.t) / 0.2; // 1→0 over t=0.8→1.0
      }
      // Fade-in at start (first 10%)
      if (p.t < 0.1) {
        effectiveSize *= p.t / 0.1;
      }

      dummy.position.set(x, y, z);
      dummy.scale.set(effectiveSize, effectiveSize, effectiveSize);
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
        frustumCulled={false}
        renderOrder={999}
      />
    </>
  );
}
