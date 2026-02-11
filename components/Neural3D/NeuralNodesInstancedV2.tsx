// NeuralNodesInstancedV2.tsx
// Simple instanced mesh rendering for nodes

'use client';

import { useRef, useMemo, useEffect } from 'react';
import { InstancedMesh, Object3D, Color } from 'three';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NodeStateV2 } from './NeuralTelemetryTypesV2';
import { NODE_COLORS, REGION_COLORS } from './NeuralVisualEncodingV2';
import { classifyNode } from './NeuralCognitiveLayoutV2';

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, any>;
  timeScale: number;
}

const dummy = new Object3D();

export function NeuralNodesInstancedV2({ nodes, edges, timeScale }: Props) {
  const meshRef = useRef<InstancedMesh>(null!);
  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  
  // Use MeshBasicMaterial to avoid lighting effects that change colors
  const nodeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial();
  }, []);
  
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

  // Initialize colors on mount and when nodes change
  useEffect(() => {
    if (!meshRef.current) return;
    
    // Ensure instance color attribute exists
    if (!meshRef.current.instanceColor) {
      meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(nodeArray.length * 3),
        3
      );
    }
    
    nodeArray.forEach((node, i) => {
      const metadata = classifyNode(node.id, node.subsystem);
      const regionColor = REGION_COLORS[metadata.region];
      const color = new Color(regionColor);
      meshRef.current.setColorAt(i, color);
    });
    
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nodeArray]);
  
  // Track instance count for hiding unused
  const instanceCountRef = useRef(200);
  instanceCountRef.current = Math.max(nodeArray.length, 200);
  
  useFrame(() => {
    if (!meshRef.current) return;
    
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
    });
    
    // Hide unused instances (scale to 0)
    for (let i = nodeArray.length; i < instanceCountRef.current; i++) {
      dummy.position.set(0, 0, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
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
