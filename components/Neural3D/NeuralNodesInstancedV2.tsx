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
  
  // Material with reduced metalness/roughness to show colors more vividly
  const nodeMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      metalness: 0.1,
      roughness: 0.3,
      // No emissive - will use instance colors directly with brighter intensity
    });
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
      // Brighten the color by 50% to make it more visible against dark background
      color.multiplyScalar(1.5);
      meshRef.current.setColorAt(i, color);
    });
    
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [nodeArray]);
  
  useFrame(() => {
    if (!meshRef.current) return;
    
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
      
      // Simple fixed scale
      const connectionCount = connectionCounts.get(node.id) || 0;
      const scale = 0.5 + (connectionCount * 0.1);

      // Set position and scale
      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Create geometry once
  const nodeGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[nodeGeometry, nodeMaterial, nodeArray.length]}
    />
  );
}