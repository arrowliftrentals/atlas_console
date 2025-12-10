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
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';

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
  const activeParticles = useNeuralTelemetryStoreV2((s) => s.activeParticles);
  
  // Create custom shader material with per-instance colors and brightness
  const nodeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        emissiveIntensity: { value: 2.5 },
      },
      vertexShader: `
        varying vec3 vColor;
        varying float vBrightness;
        attribute float brightness;
        
        void main() {
          vColor = instanceColor;
          vBrightness = brightness;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float emissiveIntensity;
        varying vec3 vColor;
        varying float vBrightness;
        
        void main() {
          vec3 emissive = vColor * emissiveIntensity * vBrightness;
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
        varying float vAlpha;
        attribute float glowAlpha;
        
        void main() {
          vColor = instanceColor;
          vAlpha = glowAlpha;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        varying float vAlpha;
        
        void main() {
          // Fresnel effect - glow stronger at edges
          vec3 viewDir = normalize(cameraPosition);
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
          
          // Fresnel brightness variation with per-instance alpha
          float intensity = 0.5 + fresnel * 0.5;
          float alpha = vAlpha * (0.7 + fresnel * 0.3);
          
          gl_FragColor = vec4(vColor * intensity, alpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
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
    
    // Initialize brightness attribute if it doesn't exist
    if (meshRef.current.geometry && !meshRef.current.geometry.getAttribute('brightness')) {
      const brightnessArray = new Float32Array(nodeArray.length);
      for (let i = 0; i < nodeArray.length; i++) {
        brightnessArray[i] = 0.1; // Default dim state
      }
      meshRef.current.geometry.setAttribute('brightness', new THREE.InstancedBufferAttribute(brightnessArray, 1));
    }
    
    // Initialize glow alpha attribute if it doesn't exist
    if (glowRef.current && glowRef.current.geometry && !glowRef.current.geometry.getAttribute('glowAlpha')) {
      const glowAlphaArray = new Float32Array(nodeArray.length);
      for (let i = 0; i < nodeArray.length; i++) {
        glowAlphaArray[i] = 0.4; // 60% transparency (40% opacity) in off state
      }
      glowRef.current.geometry.setAttribute('glowAlpha', new THREE.InstancedBufferAttribute(glowAlphaArray, 1));
    }
    
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
        if (i === 0) console.log('[NODE COLOR] agent_router set to gold:', baseColor.getHexString());
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
      }
      
      // Calculate brightness based on active particles
      // Source nodes illuminate immediately, target nodes wait until particle is 50% through
      let targetBrightness = 0.1; // Off state by default
      
      const nodeParticles = activeParticles.get(node.id);
      if (nodeParticles && nodeParticles.length > 0) {
        // Node has active particles - determine if we should illuminate
        const now = Date.now();
        
        for (const particle of nodeParticles) {
          const age = now - particle.timestamp;
          
          // Only illuminate if particle data is recent (within last 100ms)
          if (age > 100) continue;
          
          const fadeOnDuration = 200;   // Fade on over 200ms
          const holdDuration = 300;     // Hold bright for 300ms
          const fadeOffDuration = 500;  // Fade off over 500ms
          
          // Calculate phase based on particle progress
          let phaseTime = 0;
          
          if (particle.sourceId === node.id) {
            // Source node: illuminate immediately when particle starts
            phaseTime = particle.progress * 1000; // Convert progress to approximate time
          } else if (particle.targetId === node.id && particle.progress >= 0.5) {
            // Target node: only illuminate after particle is 50% through
            phaseTime = (particle.progress - 0.5) * 2 * 1000; // Scale remaining 50% to full time
          } else {
            continue; // Target not ready yet
          }
          
          // Calculate brightness based on phase
          let phaseBrightness = 0.1;
          if (phaseTime < fadeOnDuration) {
            // Fade on: 0.1 -> 1.0
            phaseBrightness = 0.1 + (phaseTime / fadeOnDuration) * 0.9;
          } else if (phaseTime < fadeOnDuration + holdDuration) {
            // Hold at full brightness
            phaseBrightness = 1.0;
          } else if (phaseTime < fadeOnDuration + holdDuration + fadeOffDuration) {
            // Fade off: 1.0 -> 0.1
            const fadeOffTime = phaseTime - fadeOnDuration - holdDuration;
            phaseBrightness = 1.0 - (fadeOffTime / fadeOffDuration) * 0.9;
          }
          
          // Use maximum brightness from any active particle
          targetBrightness = Math.max(targetBrightness, phaseBrightness);
        }
      }
      
      // Smooth transition to target brightness using lerp
      let brightness = targetBrightness;
      if (meshRef.current && meshRef.current.geometry) {
        const brightnessAttr = meshRef.current.geometry.getAttribute('brightness') as THREE.InstancedBufferAttribute;
        if (brightnessAttr) {
          const currentBrightness = brightnessAttr.getX(i);
          // Lerp factor: higher = faster transition (0.1 = smooth, 0.3 = responsive)
          brightness = currentBrightness + (targetBrightness - currentBrightness) * 0.15;
          brightnessAttr.setX(i, brightness);
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
        
        // Dim glow color - even dimmer than node (5% min instead of 10%)
        const glowBrightness = 0.05 + (brightness - 0.1) * 0.95 / 0.9; // Maps 0.1->0.05, 1.0->1.0
        const dimmedGlowColor = baseColor.clone().multiplyScalar(glowBrightness);
        glowRef.current.setColorAt(i, dimmedGlowColor);
        
        // Update glow alpha: 60% transparent (0.4 opacity) at off state, fully opaque at on state
        const glowAlpha = 0.4 + (brightness - 0.1) * 0.6 / 0.9; // Maps 0.1->0.4, 1.0->1.0
        const glowAlphaAttr = glowRef.current.geometry?.getAttribute('glowAlpha') as THREE.InstancedBufferAttribute;
        if (glowAlphaAttr) {
          glowAlphaAttr.setX(i, glowAlpha);
        }
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    // Update brightness attribute
    const brightnessAttr = meshRef.current.geometry?.getAttribute('brightness') as THREE.InstancedBufferAttribute;
    if (brightnessAttr) {
      brightnessAttr.needsUpdate = true;
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
      
      // Update glow alpha attribute
      const glowAlphaAttr = glowRef.current.geometry?.getAttribute('glowAlpha') as THREE.InstancedBufferAttribute;
      if (glowAlphaAttr) {
        glowAlphaAttr.needsUpdate = true;
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