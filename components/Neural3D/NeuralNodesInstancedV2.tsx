// NeuralNodesInstancedV2.tsx
// Simple instanced mesh rendering for nodes

'use client';

import { useRef, useMemo } from 'react';
import { InstancedMesh, Object3D, Color } from 'three';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NodeStateV2 } from './NeuralTelemetryTypesV2';
import { REGION_COLORS } from './NeuralVisualEncodingV2';
import { classifyNode } from './NeuralCognitiveLayoutV2';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, any>;
  timeScale: number;
}

const dummy = new Object3D();

// Brightness of idle (no-particle-activity) nodes.  1.0 = full color.
const DIM_BRIGHTNESS = 0.22;
// Asymmetric ramp rates (units per second).
// Fast ramp-up so nodes light up quickly when data arrives.
// Slow ramp-down so the glow lingers and fades gracefully.
const ACTIVATION_RAMP_UP = 3.0;   // 0→1 in ~0.35s
const ACTIVATION_RAMP_DOWN = 0.35; // 1→0 in ~2.8s

export function NeuralNodesInstancedV2({ nodes, edges, timeScale }: Props) {
  const meshRef = useRef<InstancedMesh>(null!);
  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  
  // Per-node smooth activation level (0 = idle, 1 = fully active)
  const activationRef = useRef<Float32Array>(new Float32Array(0));
  
  // Read active-particle map from the store each frame
  const activeParticles = useNeuralTelemetryStoreV2((s) => s.activeParticles);
  
  // Use MeshBasicMaterial to avoid lighting effects that change colors
  const nodeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial();
  }, []);
  
  // Cache node classification to avoid calling classifyNode per node per frame
  const classificationCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof classifyNode>>();
    nodeArray.forEach(node => {
      cache.set(node.id, classifyNode(node.id, node.subsystem));
    });
    return cache;
  }, [nodeArray]);

  // Count connections per node
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((node) => counts.set(node.id, 0));
    
    edges.forEach((edge) => {
      counts.set(edge.sourceId, (counts.get(edge.sourceId) || 0) + 1);
      counts.set(edge.targetId, (counts.get(edge.targetId) || 0) + 1);
    });
    
    return counts;
  }, [nodes, edges]);

  
  // Track instance count for hiding unused
  const instanceCountRef = useRef(200);
  instanceCountRef.current = Math.max(nodeArray.length, 200);
  
  // Scratch Color used inside the render loop (avoid per-frame alloc)
  const _scratchColor = useMemo(() => new Color(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Ensure activation array is the right size
    if (activationRef.current.length < nodeArray.length) {
      const next = new Float32Array(nodeArray.length);
      next.set(activationRef.current); // preserve existing
      activationRef.current = next;
    }
    
    const act = activationRef.current;
    const dt = Math.min(delta, 0.1); // clamp to avoid huge jumps on tab-switch
    let colorsChanged = false;
    
    // Update actual nodes
    nodeArray.forEach((node, i) => {
      const [x, y, z] = node.position;
      
      // Validate position
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        dummy.position.set(0, 0, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }
      
      // Scale based on connection count with very large range
      const connectionCount = connectionCounts.get(node.id) || 0;
      const scale = 0.2 + (connectionCount * 0.35);

      // Set position and scale
      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // --- Smooth activation glow ---
      const hasActivity = activeParticles.has(node.id);
      const target = hasActivity ? 1.0 : 0.0;
      const prev = act[i] ?? 0;
      // Asymmetric lerp: fast up, slow down
      const speed = target > prev ? ACTIVATION_RAMP_UP : ACTIVATION_RAMP_DOWN;
      const step = speed * dt;
      const next = prev + Math.sign(target - prev) * Math.min(step, Math.abs(target - prev));
      act[i] = next;

      // Modulate instance color brightness
      const metadata = classificationCache.get(node.id)!;
      const regionColor = REGION_COLORS[metadata.region];
      _scratchColor.set(regionColor);
      const brightness = DIM_BRIGHTNESS + (1.0 - DIM_BRIGHTNESS) * next;
      _scratchColor.multiplyScalar(brightness);
      meshRef.current.setColorAt(i, _scratchColor);
      colorsChanged = true;
    });
    
    // Hide unused instances (scale to 0)
    for (let i = nodeArray.length; i < instanceCountRef.current; i++) {
      dummy.position.set(0, 0, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (colorsChanged && meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  // Create geometry once
  const nodeGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  
  // Allocate enough instances - use max of current count or minimum buffer
  // This prevents the mesh from having 0 instances on initial render
  const instanceCount = Math.max(nodeArray.length, 200);
  
  return (
    <instancedMesh
      key={`nodes-${instanceCount}`}  // Force remount when instance count changes significantly
      ref={meshRef}
      args={[nodeGeometry, nodeMaterial, instanceCount]}
      frustumCulled={false}
    />
  );
}
