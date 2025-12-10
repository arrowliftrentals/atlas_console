// NeuralNodesInstancedV2.tsx
// Instanced mesh rendering for nodes with breathing animation and activity-based glow

'use client';

import { useRef, useMemo } from 'react';
import { InstancedMesh, Object3D, Color } from 'three';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NodeStateV2 } from './NeuralTelemetryTypesV2';
import { NODE_COLORS, STATE_COLORS, REGION_COLORS } from './NeuralVisualEncodingV2';
import { classifyNode } from './NeuralCognitiveLayoutV2';

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, any>;
  timeScale: number;
}

const dummy = new Object3D();

export function NeuralNodesInstancedV2({ nodes, edges, timeScale }: Props) {
  const meshRef = useRef<InstancedMesh>(null!);
  const glowRef = useRef<InstancedMesh>(null!);
  const nodeArray = useMemo(() => Array.from(nodes.values()), [nodes]);
  
  // Create custom shader material with per-instance colors
  const nodeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        emissiveIntensity: { value: 2.5 },
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

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    const t = clock.getElapsedTime() * timeScale;
    
    nodeArray.forEach((node, i) => {
      const [x, y, z] = node.position;
      
      // Validate position - hide node if invalid
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        console.warn('[NODE] Invalid position for', node.id, ':', [x, y, z]);
        dummy.position.set(10000, 10000, 10000);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }
      
      // Scale based on connection count (exponential) - 3x larger
      const connectionCount = connectionCounts.get(node.id) || 0;
      const baseScale = 0.9 * Math.pow(1.15, connectionCount); // Increased from 0.3 to 0.9
      
      // Breathing animation
      const breathing = 1 + 0.05 * Math.sin(t * 2 + i * 0.1);
      const scale = baseScale * breathing;

      // Node mesh
      dummy.position.set(x, y, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color based on cognitive region + subsystem
      const nodeMetadata = classifyNode(node.id, node.subsystem);
      const regionColor = new Color(REGION_COLORS[nodeMetadata.region]);
      const subsystemColor = new Color(NODE_COLORS[node.subsystem]);
      
      // Blend region and subsystem colors (70% region, 30% subsystem)
      const baseColor = regionColor.lerp(subsystemColor, 0.3);
      
      // Special handling for agent_router - use very dark gold to prevent white appearance
      const isAgentRouter = node.id.toLowerCase().includes('agent_router') || node.id.toLowerCase().includes('agentrouter');
      
      // Override for agent_router FIRST - skip all adjustments
      if (isAgentRouter) {
        baseColor.setHex(0xFFD700); // Pure gold
      } else {
        // Apply importance-based brightness
        baseColor.multiplyScalar(0.7 + nodeMetadata.importance * 0.5);
        
        // State modifications
        if (node.state === 'overloaded') {
          baseColor.offsetHSL(0.05, 0.2, 0.1);
        } else if (node.state === 'error') {
          baseColor.set(STATE_COLORS.error);
        } else if (node.state === 'blocked') {
          baseColor.set(STATE_COLORS.blocked);
        }
        
        // Activity pulse
        const age = Date.now() - node.lastEventTs;
        if (age < 500) {
          const boost = 1 + (500 - age) / 1000;
          baseColor.multiplyScalar(boost);
        }
      }
      
      // Set per-instance color using setColorAt
      meshRef.current.setColorAt(i, baseColor);

      // Glow layer (larger, semi-transparent)
      if (glowRef.current) {
        dummy.scale.set(scale * 1.4, scale * 1.4, scale * 1.4);
        dummy.updateMatrix();
        glowRef.current.setMatrixAt(i, dummy.matrix);
        
        // Glow intensity based on utilization
        const glowColor = baseColor.clone();
        const glowAlpha = node.utilization * 0.6;
        glowColor.multiplyScalar(glowAlpha);
        glowRef.current.setColorAt(i, glowColor);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    } else {
      console.warn('[NODES] instanceColor is null!');
    }
    
    // Force material update
    const material = meshRef.current.material as any;
    if (material) {
      material.needsUpdate = true;
    }
    
    // Force geometry to recompute bounding sphere to fix NaN errors
    if (meshRef.current.geometry.boundingSphere) {
      meshRef.current.geometry.boundingSphere = null;
    }
    meshRef.current.geometry.computeBoundingSphere();
    
    if (glowRef.current) {
      glowRef.current.instanceMatrix.needsUpdate = true;
      if (glowRef.current.instanceColor) {
        glowRef.current.instanceColor.needsUpdate = true;
      }
      
      // Force glow geometry to recompute bounding sphere
      if (glowRef.current.geometry.boundingSphere) {
        glowRef.current.geometry.boundingSphere = null;
      }
      glowRef.current.geometry.computeBoundingSphere();
    }
  });

  return (
    <group>
      {/* Main node spheres */}
      <instancedMesh
        ref={meshRef}
        args={[undefined as any, nodeMaterial, nodeArray.length]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 16, 16]} />
      </instancedMesh>

      {/* Glow layer */}
      <instancedMesh
        ref={glowRef}
        args={[undefined as any, undefined as any, nodeArray.length]}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}