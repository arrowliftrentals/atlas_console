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

  // Create custom glow shader with radial gradient transparency
  const glowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vColor;
        
        void main() {
          vColor = instanceColor;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        
        void main() {
          // Fresnel effect - glow stronger at edges
          vec3 viewDir = normalize(cameraPosition);
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
          
          // Fade from opaque at node to transparent at edge
          float alpha = 1.0 - fresnel;
          
          gl_FragColor = vec4(vColor, alpha * 0.55);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
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
      const scale = 0.9 * Math.pow(1.15, connectionCount); // Increased from 0.3 to 0.9

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
      
      // Special handling for specific nodes to prevent white/washed out appearance
      const isAgentRouter = node.id.toLowerCase().includes('agent_router') || node.id.toLowerCase().includes('agentrouter');
      const isSandboxExecution = node.id.toLowerCase().includes('sandbox_execution');
      
      // Override for special nodes FIRST - skip all adjustments
      if (isAgentRouter) {
        baseColor.setHex(0xFFD700); // Pure gold
      } else if (isSandboxExecution) {
        baseColor.setHex(0x00CED1); // Cyan for sandbox execution
      } else {
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

      // Outer glow layer (gradient halo with breathing animation)
      if (glowRef.current) {
        const breathing = 1 + 0.05 * Math.sin(t * 2 + i * 0.1);
        const glowScale = scale * 1.6 * breathing;
        dummy.scale.set(glowScale, glowScale, glowScale);
        dummy.updateMatrix();
        glowRef.current.setMatrixAt(i, dummy.matrix);
        glowRef.current.setColorAt(i, baseColor);
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

      {/* Outer glow layer - gradient halo */}
      <instancedMesh
        ref={glowRef}
        args={[undefined as any, glowMaterial, nodeArray.length]}
        renderOrder={-1}
      >
        <sphereGeometry args={[1, 32, 32]} />
      </instancedMesh>
    </group>
  );
}