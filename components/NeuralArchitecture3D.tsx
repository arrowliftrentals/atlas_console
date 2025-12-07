'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Sphere, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Vector3 } from 'three';

interface Node {
  id: string;
  label: string;
  type: string;
  position?: [number, number, number];
}

interface Edge {
  id: string;
  source: string;
  target: string;
  metadata?: {
    operation_type?: string;
  };
}

interface TelemetryData {
  type: string;
  active_traces?: any[];
  metrics?: Record<string, any>;
}

interface Particle {
  id: string;
  sourceId: string;
  targetId: string;
  progress: number;
  speed: number;
  color: string;
}

// Neural node component with pulsing glow effect
function NeuralNode({ 
  node, 
  position, 
  isActive, 
  intensity,
  connectionCount 
}: { 
  node: Node; 
  position: [number, number, number]; 
  isActive: boolean;
  intensity: number;
  connectionCount: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [glowOpacity, setGlowOpacity] = useState(0);
  const [activeIntensity, setActiveIntensity] = useState(0.1);
  const wasActive = useRef(isActive);
  const fadeAnimationRef = useRef<number | null>(null);
  const deactivateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Cancel any existing animation
    if (fadeAnimationRef.current !== null) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }
    
    // Cancel any pending deactivation
    if (deactivateTimeoutRef.current !== null) {
      clearTimeout(deactivateTimeoutRef.current);
      deactivateTimeoutRef.current = null;
    }
    
    // Fade in/out transition when active state changes
    if (isActive && !wasActive.current) {
      // Fade in immediately
      const startTime = Date.now();
      const fadeIn = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / 500, 1); // 500ms fade in
        setGlowOpacity(progress);
        setActiveIntensity(0.1 + progress * 0.4); // Fade from 0.1 to 0.5
        if (progress < 1) {
          fadeAnimationRef.current = requestAnimationFrame(fadeIn);
        } else {
          fadeAnimationRef.current = null;
        }
      };
      fadeAnimationRef.current = requestAnimationFrame(fadeIn);
      wasActive.current = true;
    } else if (!isActive && wasActive.current) {
      // Delay fade out by 300ms to prevent rapid flashing
      deactivateTimeoutRef.current = setTimeout(() => {
        const startTime = Date.now();
        const currentOpacity = glowOpacity; // Start from current opacity
        const currentIntensity = activeIntensity;
        const fadeOut = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / 500, 1); // 500ms fade out
          setGlowOpacity(currentOpacity * (1 - progress));
          setActiveIntensity(currentIntensity - progress * (currentIntensity - 0.1)); // Fade to 0.1
          if (progress < 1) {
            fadeAnimationRef.current = requestAnimationFrame(fadeOut);
          } else {
            fadeAnimationRef.current = null;
          }
        };
        fadeAnimationRef.current = requestAnimationFrame(fadeOut);
        wasActive.current = false;
      }, 300); // 300ms delay before starting fade out
    }
    
    return () => {
      if (fadeAnimationRef.current !== null) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
      if (deactivateTimeoutRef.current !== null) {
        clearTimeout(deactivateTimeoutRef.current);
      }
    };
  }, [isActive]);
  
  useFrame(() => {
    // Update main node emissive intensity
    if (meshRef.current && meshRef.current.material instanceof THREE.MeshPhysicalMaterial) {
      meshRef.current.material.emissiveIntensity = activeIntensity;
    }
    
    if (glowRef.current && glowOpacity > 0) {
      // Apply fade to all glow layers
      const group = glowRef.current.parent;
      if (group) {
        group.children.forEach((child, index) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            const layerOpacities = [0.048, 0.072, 0.108, 0.15, 0.21];
            if (layerOpacities[index] !== undefined) {
              child.material.opacity = layerOpacities[index] * glowOpacity;
            }
          }
        });
      }
    }
  });

  const nodeColor = useMemo(() => {
    const colors: Record<string, string> = {
      router: '#3B82F6',    // blue
      service: '#10B981',   // green
      gateway: '#8B5CF6',   // purple
      store: '#F59E0B',     // orange
      memory: '#EC4899',    // pink
      llm: '#06B6D4',       // cyan
    };
    return colors[node.type] || '#6B7280';
  }, [node.type]);
  
  // Calculate node scale based on connections using exponential growth (min 0.5, max 2.5)
  const nodeScale = useMemo(() => {
    const minScale = 0.5;
    const maxScale = 2.5;
    
    // Exponential scaling: scale = minScale * (maxScale/minScale)^(connections/10)
    // This creates dramatic size differences
    const exponent = Math.min(connectionCount, 30) / 10; // Cap at 30 connections
    const scale = minScale * Math.pow(maxScale / minScale, exponent);
    
    return Math.max(minScale, Math.min(maxScale, scale));
  }, [connectionCount]);

  const getLighterColor = (hex: string, amount: number = 0.4) => {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Lighten by moving towards white
    const lighterR = Math.round(r + (255 - r) * amount);
    const lighterG = Math.round(g + (255 - g) * amount);
    const lighterB = Math.round(b + (255 - b) * amount);
    
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  return (
    <group position={position}>
      {/* Visual node elements - scaled by connection count */}
      <group scale={nodeScale}>
        {/* Main node - using icosahedron for distinct 3D geometric look */}
        <mesh ref={meshRef} castShadow receiveShadow>
          <icosahedronGeometry args={[0.8, 1]} />
          <meshPhysicalMaterial 
            color={nodeColor}
            emissive={nodeColor}
            emissiveIntensity={activeIntensity}
            metalness={0.95}
            roughness={0.05}
            clearcoat={1.0}
            clearcoatRoughness={0.0}
            reflectivity={1}
            envMapIntensity={2}
          />
        </mesh>
        
        {/* Inner core octahedron for depth */}
        <mesh scale={0.5} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshPhysicalMaterial 
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={activeIntensity * 4}
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={0.7}
        />
      </mesh>
      
      {/* White translucent outline */}
      {glowOpacity > 0 && (
        <mesh scale={1.3}>
          <icosahedronGeometry args={[0.8, 1]} />
          <meshBasicMaterial 
            color="#ffffff"
            transparent
            opacity={0.3 * glowOpacity}
            side={THREE.FrontSide}
            depthWrite={false}
          />
        </mesh>
      )}
      
      {/* Soft spherical glow effect with smooth radial fade */}
      {glowOpacity > 0 && (
        <>
          <mesh ref={glowRef} scale={1.4}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial 
              color={nodeColor}
              transparent
              opacity={0.048}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={1.225}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial 
              color={nodeColor}
              transparent
              opacity={0.072}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={1.05}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial 
              color={nodeColor}
              transparent
              opacity={0.108}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={0.91}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial 
              color={nodeColor}
              transparent
              opacity={0.15}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh scale={0.77}>
            <sphereGeometry args={[0.8, 32, 32]} />
            <meshBasicMaterial 
              color={nodeColor}
              transparent
              opacity={0.21}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
      
        {/* Wireframe overlay for geometric detail - rendered last to be on top */}
        <mesh scale={1.06}>
          <icosahedronGeometry args={[0.8, 3]} />
          <meshBasicMaterial 
            color={getLighterColor(nodeColor, 0.5)}
            wireframe
            transparent
            opacity={0.18}
            toneMapped={false}
            fog={false}
            depthWrite={false}
          />
        </mesh>
      </group>
      
      {/* Label - Billboard to always face camera - not scaled */}
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text
          position={[0, -1.5 * nodeScale, 0]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  );
}

// Animated particle flowing along curved path
function FlowParticle({
  sourcePos,
  targetPos,
  initialProgress,
  speed,
  color,
  onComplete
}: {
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  initialProgress: number;
  speed: number;
  color: string;
  onComplete?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(initialProgress);
  const completedRef = useRef(false);
  

  
  // Update position every frame and advance progress
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Advance progress using delta time
    progressRef.current += speed * delta * 60; // normalize to ~60fps
    
    // Check completion
    if (progressRef.current >= 1.0) {
      progressRef.current = 1.0;
      if (!completedRef.current && onComplete) {
        completedRef.current = true;
        onComplete();
      }
    }
    
    const start = new THREE.Vector3(...sourcePos);
    const end = new THREE.Vector3(...targetPos);
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    mid.multiplyScalar(0.6); // Pull toward center
    
    // Quadratic bezier interpolation
    const t = progressRef.current;
    const invT = 1 - t;
    
    const x = invT * invT * start.x + 2 * invT * t * mid.x + t * t * end.x;
    const y = invT * invT * start.y + 2 * invT * t * mid.y + t * t * end.y;
    const z = invT * invT * start.z + 2 * invT * t * mid.z + t * t * end.z;
    
    groupRef.current.position.set(x, y, z);
    
    if (Math.random() < 0.005) { // Log 0.5% of frames
      console.log(`📍 Position set: [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}], progress=${t.toFixed(3)}`);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Main particle - larger and brighter for visibility */}
      <mesh castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshPhysicalMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={5}
          metalness={0.95}
          roughness={0.05}
          clearcoat={1.0}
          clearcoatRoughness={0.0}
          reflectivity={1}
          toneMapped={false}
        />
      </mesh>
      
      {/* Soft aura glow - multiple layers */}
      {[1.8, 2.4, 3.2, 4.0, 5.0].map((scale, i) => (
        <mesh key={`aura-${i}`} scale={scale}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshBasicMaterial 
            color={color}
            transparent
            opacity={0.3 / Math.pow(i + 1, 1.5)}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// Neural connection with curved bezier paths and animated particles
function NeuralConnection({
  source,
  target,
  particles,
  isActive,
  isReverse = false
}: {
  source: [number, number, number];
  target: [number, number, number];
  particles: Particle[];
  isActive: boolean;
  isReverse?: boolean;
}) {
  const lineRef = useRef<any>(null);
  const [pathOpacity, setPathOpacity] = useState(0.08);
  const wasActive = useRef(isActive);
  const fadeAnimationRef = useRef<number | null>(null);
  
  // Create curved path through center for neural effect
  const curvedPath = useMemo(() => {
    const start = new THREE.Vector3(...source);
    const end = new THREE.Vector3(...target);
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    
    // Pull the midpoint toward center for curved effect
    mid.multiplyScalar(0.6);
    
    // Offset reverse paths perpendicular to the line for visual separation
    if (isReverse) {
      const direction = new THREE.Vector3().subVectors(end, start);
      const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
      mid.add(perpendicular.multiplyScalar(3.5)); // Offset by 3.5 units
    }
    
    // Create smooth bezier curve
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(50); // High resolution curve
  }, [source, target, isReverse]);
  
  useEffect(() => {
    // Cancel any existing animation
    if (fadeAnimationRef.current !== null) {
      cancelAnimationFrame(fadeAnimationRef.current);
      fadeAnimationRef.current = null;
    }
    
    // Animate opacity changes
    if (isActive && !wasActive.current) {
      // Fade in to active
      const startTime = Date.now();
      const startOpacity = pathOpacity;
      const fadeIn = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / 400, 1); // 400ms fade in
        setPathOpacity(startOpacity + (0.4 - startOpacity) * progress);
        if (progress < 1) {
          fadeAnimationRef.current = requestAnimationFrame(fadeIn);
        } else {
          fadeAnimationRef.current = null;
        }
      };
      fadeAnimationRef.current = requestAnimationFrame(fadeIn);
    } else if (!isActive && wasActive.current) {
      // Fade out to inactive
      const startTime = Date.now();
      const startOpacity = pathOpacity;
      const fadeOut = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / 600, 1); // 600ms fade out (slower)
        setPathOpacity(startOpacity - (startOpacity - 0.08) * progress);
        if (progress < 1) {
          fadeAnimationRef.current = requestAnimationFrame(fadeOut);
        } else {
          fadeAnimationRef.current = null;
        }
      };
      fadeAnimationRef.current = requestAnimationFrame(fadeOut);
    }
    
    wasActive.current = isActive;
    
    return () => {
      if (fadeAnimationRef.current !== null) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
    };
  }, [isActive]);

  return (
    <group>
      <Line
        ref={lineRef}
        points={curvedPath}
        color={isReverse ? "#F59E0B" : "#06B6D4"}
        lineWidth={1.5}
        transparent
        opacity={pathOpacity}
      />
      
      {particles.map((particle) => (
        <group key={particle.id}>
          <FlowParticle
            sourcePos={source}
            targetPos={target}
            initialProgress={particle.progress}
            speed={particle.speed}
            color={particle.color}
          />
        </group>
      ))}
    </group>
  );
}

// Main 3D scene
function Scene({
  nodes,
  edges,
  particles,
  activeNodes,
  nodePositionsRef,
  controlsRef
}: {
  nodes: Node[];
  edges: Edge[];
  particles: Particle[];
  activeNodes: Set<string>;
  nodePositionsRef: React.MutableRefObject<Map<string, [number, number, number]>>;
  controlsRef: React.MutableRefObject<any>;
}) {
  console.log('🎬 Scene rendering:', { nodes: nodes.length, edges: edges.length, particles: particles.length });

  // Calculate 3D layout - atomic model with memory core
  const nodePositions = useMemo(() => {
    const positions = new Map<string, [number, number, number]>();
    
    if (nodes.length === 0) return positions;
    
    // Separate memory layers from other components
    const memoryNodes = nodes.filter(n => n.type === 'memory');
    const otherNodes = nodes.filter(n => n.type !== 'memory');
    
    // Find L10 (memory_l10) - place at absolute center
    const l10Node = memoryNodes.find(n => 
      n.id === 'memory_l10' || 
      n.id.toLowerCase() === 'l10' || 
      n.label.toLowerCase().includes('l10')
    );
    const otherMemoryNodes = memoryNodes.filter(n => n.id !== 'memory_l10');
    
    console.log('🎯 L10 search:', { 
      found: !!l10Node, 
      l10Id: l10Node?.id,
      memoryCount: memoryNodes.length,
      otherMemoryCount: otherMemoryNodes.length
    });
    
    // Place L10 at the center
    if (l10Node) {
      positions.set(l10Node.id, [0, 0, 0]);
      console.log('✨ L10 (Memory Manager) placed at center [0,0,0]');
    }
    
    // Group other nodes by type
    const typeGroups: Record<string, Node[]> = {};
    otherNodes.forEach(node => {
      if (!typeGroups[node.type]) typeGroups[node.type] = [];
      typeGroups[node.type].push(node);
    });
    
    // Place other memory nodes in a tight sphere around L10
    const coreRadius = 12;
    otherMemoryNodes.forEach((node, idx) => {
      const count = otherMemoryNodes.length;
      
      // Use golden spiral for even distribution on sphere
      const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
      
      const x = coreRadius * Math.sin(phi) * Math.cos(theta);
      const y = coreRadius * Math.sin(phi) * Math.sin(theta);
      const z = coreRadius * Math.cos(phi);
      
      positions.set(node.id, [x, y, z]);
    });
    
    // Arrange nodes in data flow pattern: Request → Router → Service/LLM → Memory → Store
    const orbitRadius = 32;
    
    // Group nodes by type
    const routers = otherNodes.filter(n => n.type === 'router');
    const services = otherNodes.filter(n => n.type === 'service');
    const llms = otherNodes.filter(n => n.type === 'llm');
    const gateways = otherNodes.filter(n => n.type === 'gateway');
    const stores = otherNodes.filter(n => n.type === 'store');
    const others = otherNodes.filter(n => !['router', 'service', 'llm', 'gateway', 'store'].includes(n.type));
    
    // Front hemisphere (z > 0): Routers - user-facing entry points
    routers.forEach((node, idx) => {
      const count = routers.length;
      const angle = (idx / count) * Math.PI * 2;
      positions.set(node.id, [
        orbitRadius * Math.cos(angle) * 0.6,
        orbitRadius * Math.sin(angle) * 0.6,
        orbitRadius * 0.8  // Forward in z-axis
      ]);
    });
    
    // Side ring (x-axis dominant): Services - processing layer between routers and memory
    services.forEach((node, idx) => {
      const count = services.length;
      const angle = (idx / count) * Math.PI * 2;
      positions.set(node.id, [
        orbitRadius * 0.85 * Math.cos(angle),  // Wider ring on x-axis
        orbitRadius * 0.5 * Math.sin(angle),   // Compressed on y-axis
        orbitRadius * 0.2 * Math.cos(angle * 2) // Slight z variation
      ]);
    });
    
    // Top positions: LLMs - external AI resources above the system
    llms.forEach((node, idx) => {
      const count = llms.length;
      const angle = (idx / count) * Math.PI * 2;
      positions.set(node.id, [
        orbitRadius * 0.5 * Math.cos(angle),
        orbitRadius * 0.9,  // High on y-axis
        orbitRadius * 0.5 * Math.sin(angle)
      ]);
    });
    
    // Outer ring: Gateways - external system connections
    gateways.forEach((node, idx) => {
      const count = gateways.length;
      const angle = (idx / count) * Math.PI * 2 + Math.PI / 4; // Offset
      positions.set(node.id, [
        orbitRadius * Math.cos(angle),
        orbitRadius * 0.2 * Math.sin(angle * 3), // Undulating pattern
        orbitRadius * Math.sin(angle)
      ]);
    });
    
    // Back hemisphere (z < 0): Stores - data persistence behind memory core
    stores.forEach((node, idx) => {
      const count = stores.length;
      const angle = (idx / count) * Math.PI * 2;
      positions.set(node.id, [
        orbitRadius * Math.cos(angle) * 0.7,
        orbitRadius * Math.sin(angle) * 0.7,
        -orbitRadius * 0.7  // Back in z-axis
      ]);
    });
    
    // Others - distributed around
    others.forEach((node, idx) => {
      const count = others.length;
      const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
      positions.set(node.id, [
        orbitRadius * Math.sin(phi) * Math.cos(theta),
        orbitRadius * Math.sin(phi) * Math.sin(theta),
        orbitRadius * Math.cos(phi)
      ]);
    });
    
    console.log('⚛️ Atomic layout:', { memory: memoryNodes.length, outer: otherNodes.length });
    return positions;
  }, [nodes]);
  
  // Update ref whenever positions change
  useEffect(() => {
    nodePositionsRef.current = nodePositions;
  }, [nodePositions]);

  const edgeConnections = useMemo(() => {
    if (particles.length > 0) {
      console.log('🔍 Particle debug:', {
        totalParticles: particles.length,
        sampleParticle: particles[0],
        allParticlePaths: particles.map(p => `${p.sourceId}→${p.targetId}`),
        uniqueSources: [...new Set(particles.map(p => p.sourceId))],
        uniqueTargets: [...new Set(particles.map(p => p.targetId))]
      });
      console.log('🔍 Edge debug:', {
        totalEdges: edges.length,
        sampleEdge: edges[0],
        allEdgePaths: edges.slice(0, 20).map(e => `${e.source}→${e.target}`),
        uniqueSources: [...new Set(edges.map(e => e.source))].slice(0, 10),
        uniqueTargets: [...new Set(edges.map(e => e.target))].slice(0, 10)
      });
    }
    
    // Map particles to existing edges - create separate connections for each direction
    const connections: Array<{
      edge: Edge;
      source: [number, number, number];
      target: [number, number, number];
      particles: Particle[];
      isActive: boolean;
      isDynamic: boolean;
    }> = [];
    
    edges.forEach(edge => {
      // Forward direction: edge.source → edge.target
      const forwardParticles = particles.filter(p => 
        p.sourceId === edge.source && p.targetId === edge.target
      );
      if (forwardParticles.length > 0 || true) { // Always create path for static edges
        connections.push({
          edge: { ...edge, id: `${edge.id}-fwd` },
          source: nodePositions.get(edge.source) || [0, 0, 0],
          target: nodePositions.get(edge.target) || [0, 0, 0],
          particles: forwardParticles,
          isActive: forwardParticles.length > 0,
          isDynamic: false
        });
      }
      
      // Reverse direction: edge.target → edge.source
      const reverseParticles = particles.filter(p => 
        p.sourceId === edge.target && p.targetId === edge.source
      );
      // Always create reverse path (like forward) so bidirectional flows are visible
      if (reverseParticles.length > 0 || true) {
        connections.push({
          edge: { ...edge, id: `${edge.id}-rev` },
          source: nodePositions.get(edge.target) || [0, 0, 0],
          target: nodePositions.get(edge.source) || [0, 0, 0],
          particles: reverseParticles,
          isActive: reverseParticles.length > 0,
          isDynamic: false
        });
      }
    });
    
    // Find particles that don't match any existing edges (dynamic connections)
    const matchedParticleIds = new Set(
      connections.flatMap(c => c.particles.map(p => p.id))
    );
    
    const unmatchedParticles = particles.filter(p => !matchedParticleIds.has(p.id));
    
    if (unmatchedParticles.length > 0) {
      console.log('⚡ Creating dynamic edges for unmatched particles:', {
        unmatchedCount: unmatchedParticles.length,
        paths: unmatchedParticles.map(p => `${p.sourceId}→${p.targetId}`)
      });
      
      // Group unmatched particles by source→target pair
      const dynamicEdgeMap = new Map<string, Particle[]>();
      unmatchedParticles.forEach(p => {
        const key = `${p.sourceId}→${p.targetId}`;
        if (!dynamicEdgeMap.has(key)) {
          dynamicEdgeMap.set(key, []);
        }
        dynamicEdgeMap.get(key)!.push(p);
      });
      
      // Create dynamic connections for these particles
      dynamicEdgeMap.forEach((particles, key) => {
        const [sourceId, targetId] = key.split('→');
        const sourcePos = nodePositions.get(sourceId);
        const targetPos = nodePositions.get(targetId);
        
        if (sourcePos && targetPos) {
          connections.push({
            edge: {
              id: `dynamic-${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
              metadata: { operation_type: 'runtime_flow' }
            },
            source: sourcePos,
            target: targetPos,
            particles: particles,
            isActive: true,
            isDynamic: true
          });
        } else {
          console.warn(`  ⚠️ Could not find positions for: ${sourceId} → ${targetId}`, {
            sourcePos, targetPos,
            availableNodes: Array.from(nodePositions.keys()).slice(0, 10)
          });
        }
      });
    }
    
    const withParticles = connections.filter(c => c.particles.length > 0);
    if (withParticles.length > 0) {
      console.log('🔗 Active connections:', {
        total: connections.length,
        withParticles: withParticles.length,
        static: withParticles.filter(c => !c.isDynamic).length,
        dynamic: withParticles.filter(c => c.isDynamic).length,
        matchedPaths: withParticles.map(c => `${c.edge.source}→${c.edge.target} (${c.particles.length}p${c.isDynamic ? ' 🌟' : ''})`)
      });
    }
    
    return connections;
  }, [edges, nodePositions, particles]);

  return (
    <>
      {/* Enhanced lighting for dramatic 3D effect */}
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[50, 50, 50]} 
        intensity={2.5} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-50, -50, -50]} intensity={1.5} color="#3B82F6" />
      <spotLight 
        position={[0, 80, 0]} 
        intensity={3} 
        angle={0.6} 
        penumbra={0.5} 
        castShadow
        color="#60A5FA"
      />
      <pointLight position={[30, 30, 30]} intensity={1.5} />
      <pointLight position={[-30, -30, -30]} intensity={1.0} color="#3B82F6" />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#0a0a0a', 50, 150]} />
      
      {/* Neural nodes */}
      {nodes.map(node => {
        const position = nodePositions.get(node.id) || [0, 0, 0];
        const isActive = activeNodes.has(node.id);
        const intensity = isActive ? 1 : 0.2;
        
        // Count connections (both incoming and outgoing)
        const connectionCount = edges.filter(e => 
          e.source === node.id || e.target === node.id
        ).length;
        
        if (!nodePositions.has(node.id)) {
          console.warn(`⚠️ No position for node: ${node.id}`);
        }
        
        return (
          <NeuralNode
            key={node.id}
            node={node}
            position={position}
            isActive={isActive}
            intensity={intensity}
            connectionCount={connectionCount}
          />
        );
      })}
      
      {/* Neural connections - use stable key based on source→target */}
      {edgeConnections.length > 0 ? (
        edgeConnections.map(({ edge, source, target, particles, isActive, isDynamic }) => {
          const stableKey = isDynamic ? 
            `dynamic-${edge.source}-${edge.target}` : 
            edge.id;
          return (
            <group key={stableKey}>
              <NeuralConnection
                source={source as [number, number, number]}
                target={target as [number, number, number]}
                particles={particles}
                isActive={isActive}
                isReverse={edge.id.endsWith('-rev')}
              />
            </group>
          );
        })
      ) : null}
      
      {/* Camera controls - mouse drag to rotate, scroll to zoom, right-drag to pan */}
      <Controls controlsRef={controlsRef} />
    </>
  );
}

// Controls component - OrbitControls automatically binds to camera and canvas
function Controls({ controlsRef }: { controlsRef: React.MutableRefObject<any> }) {
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      minDistance={20}
      maxDistance={200}
    />
  );
}



export default function NeuralArchitecture3D() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [telemetryConnected, setTelemetryConnected] = useState(false);
  const nodePositionsRef = useRef<Map<string, [number, number, number]>>(new Map());
  const controlsRef = useRef<any>(null);
  
  // Telemetry tracking refs
  const discoveredPaths = useRef<Set<string>>(new Set());
  const particleIdCounter = useRef(0);

  // Fetch architecture data
  useEffect(() => {
    console.log('🔄 Fetching architecture from backend...');
    fetch('http://localhost:8000/v1/architecture/graph')
      .then(res => {
        console.log('📡 Response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('📊 Architecture loaded:', {
          nodes: data.nodes?.length,
          edges: data.edges?.length,
          sampleNodes: data.nodes?.slice(0, 3).map((n: Node) => n.id),
          sampleEdge: data.edges?.[0]
        });
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch(err => {
        console.error('❌ Failed to load architecture:', err);
        // Use minimal demo data if backend unavailable
        const demoNodes = [
          { id: 'node1', label: 'Router', type: 'router' },
          { id: 'node2', label: 'Service', type: 'service' },
          { id: 'node3', label: 'Memory', type: 'store' }
        ];
        const demoEdges = [
          { id: 'edge1', source: 'node1', target: 'node2' },
          { id: 'edge2', source: 'node2', target: 'node3' }
        ];
        setNodes(demoNodes);
        setEdges(demoEdges);
      });
  }, []);

  // WebSocket telemetry connection
  useEffect(() => {
    if (typeof window === 'undefined') {
      return; // Don't run on server
    }

    let isUnmounted = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (isUnmounted) return;

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://localhost:8000/v1/telemetry/stream`;
        
        console.log('🔌 Attempting WebSocket connection to', wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('✅ Telemetry WebSocket connected');
          setTelemetryConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data: TelemetryData = JSON.parse(event.data);
            console.log('📊 Telemetry data received:', data.type, {
              traces: data.active_traces?.length || 0,
              metrics: Object.keys(data.metrics || {}).length,
            });
            handleTelemetryUpdate(data);
          } catch (err) {
            console.warn('⚠️ Failed to parse telemetry data:', err);
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('❌ WebSocket connection error:', error);
          setTelemetryConnected(false);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          console.log('Telemetry WebSocket closed');
          setTelemetryConnected(false);

          // Simple reconnect with backoff
          reconnectTimeout = setTimeout(() => {
            console.log('🔁 Reconnecting telemetry WebSocket...');
            connect();
          }, 3000);
        };
      } catch (err) {
        if (isUnmounted) return;
        console.warn('Failed to initialize WebSocket - telemetry disabled:', err);
        setTelemetryConnected(false);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout !== undefined) {
        clearTimeout(reconnectTimeout);
      }
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, []);

  // Telemetry handler - processes live trace data
  const handleTelemetryUpdate = (data: TelemetryData) => {
    if ((data.type === 'update' || data.type === 'initial_state')) {
      const traces = data.active_traces || [];
      const newActiveNodes = new Set<string>();
      const newParticles: Particle[] = [];
      const discoveredNodeIds = new Set<string>();

      console.log('🔄 Telemetry update:', {
        type: data.type,
        traces: traces.length,
        totalSpans: traces.reduce((sum: number, t: any) => sum + (t.spans?.length || 0), 0)
      });

      traces.forEach((trace: any, traceIdx: number) => {
        if (trace.spans && trace.spans.length > 0) {
          const sorted = [...trace.spans].sort((a: any, b: any) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
          
          const path = sorted.map((s: any) => s.component_id);
          console.log(`  ✨ Trace #${traceIdx} [${trace.trace_id?.substring(0, 8)}] flow:`, path.join(' → '));
          
          // Create particles for EVERY sequential step in the trace
          for (let i = 0; i < path.length - 1; i++) {
            const sourceId = path[i];
            const targetId = path[i + 1];
            
            // Skip if source or target is undefined
            if (!sourceId || !targetId) {
              console.warn(`  ⚠️ Skipping undefined component: ${sourceId} → ${targetId}`);
              continue;
            }
            
            // Track discovered nodes and paths
            discoveredNodeIds.add(sourceId);
            discoveredNodeIds.add(targetId);
            const pathKey = `${sourceId}→${targetId}`;
            discoveredPaths.current.add(pathKey);
            
            // Only activate SOURCE nodes immediately - targets activate when particles arrive
            newActiveNodes.add(sourceId);
            
            console.log(`    🎯 Edge ${i}: ${sourceId} → ${targetId}`);
            
            // Create multiple particles for visible neural firing effect
            const particleCount = 12; // More particles for better visibility
            const colorOptions = ['#FF6B35', '#60A5FA', '#10B981', '#F59E0B', '#EC4899'];
            const flowColor = colorOptions[i % colorOptions.length]; // Color based on sequence
            
            // Calculate distance-based speed for consistent visual timing
            let particleSpeed = 0.015; // Default speed (increased)
            
            try {
              const sourcePos = nodePositionsRef.current?.get(sourceId);
              const targetPos = nodePositionsRef.current?.get(targetId);
              if (sourcePos && targetPos) {
                const dx = targetPos[0] - sourcePos[0];
                const dy = targetPos[1] - sourcePos[1];
                const dz = targetPos[2] - sourcePos[2];
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Target: ~0.5 seconds travel time
                // For delta-based animation: speed = 1 / travel_time_seconds
                // Speed of 2.0 = completes in 0.5 seconds
                particleSpeed = 2.0;
              }
            } catch (e) {
              // Use default speed if calculation fails
              console.warn('Speed calculation failed:', e);
            }
            
            for (let j = 0; j < particleCount; j++) {
              newParticles.push({
                id: `particle-${Date.now()}-${particleIdCounter.current++}`,
                sourceId,
                targetId,
                progress: 0, // All particles start at source
                speed: particleSpeed * (0.9 + Math.random() * 0.2), // Add slight variation (±10%)
                color: flowColor
              });
            }
          }
        } else if (trace.spans && trace.spans.length === 1) {
          // Single span - just mark as active
          const componentId = trace.spans[0].component_id;
          if (componentId) {
            discoveredNodeIds.add(componentId);
            newActiveNodes.add(componentId);
            console.log(`  🔵 Single span trace: ${componentId}`);
          }
        }
      });

      // Add any discovered nodes that don't exist in the graph
      setNodes(prevNodes => {
        const existingIds = new Set(prevNodes.map(n => n.id));
        const nodesToAdd: Node[] = [];
        
        discoveredNodeIds.forEach(nodeId => {
          if (!existingIds.has(nodeId)) {
            // Infer node type from naming convention
            let type = 'service'; // default
            if (nodeId.includes('router')) type = 'router';
            else if (nodeId.includes('gateway')) type = 'gateway';
            else if (nodeId.includes('store') || nodeId.includes('vector')) type = 'store';
            else if (nodeId.includes('memory') || nodeId.startsWith('L')) type = 'memory';
            
            nodesToAdd.push({
              id: nodeId,
              label: nodeId,
              type: type
            });
            console.log(`  ➕ Adding discovered node: ${nodeId} (${type})`);
          }
        });
        
        return nodesToAdd.length > 0 ? [...prevNodes, ...nodesToAdd] : prevNodes;
      });

      console.log('  📊 Created:', {
        activeNodes: newActiveNodes.size,
        nodesList: Array.from(newActiveNodes),
        newParticles: newParticles.length,
        particlePaths: newParticles.slice(0, 5).map(p => `${p.sourceId}→${p.targetId}`)
      });

      if (newParticles.length > 0) {
        console.log('  🎆 SETTING PARTICLES:', newParticles.length, 'new particles');
      } else {
        console.warn('  ⚠️ NO PARTICLES CREATED - check trace spans');
      }

      // Create persistent edges for all discovered paths
      setEdges(prevEdges => {
        const existingPaths = new Set(prevEdges.map(e => `${e.source}→${e.target}`));
        const newEdges: Edge[] = [];
        
        discoveredPaths.current.forEach((pathKey: string) => {
          if (!existingPaths.has(pathKey)) {
            const [source, target] = pathKey.split('→');
            newEdges.push({
              id: `edge-${source}-${target}`,
              source,
              target
            });
          }
        });
        
        return newEdges.length > 0 ? [...prevEdges, ...newEdges] : prevEdges;
      });
      
      // Only set source nodes as initially active - animation loop will handle targets
      setActiveNodes(newActiveNodes);
      setParticles(prev => {
        const updated = [...prev, ...newParticles];
        console.log('  🔥 setParticles called: prev=' + prev.length + ', new=' + newParticles.length + ', total=' + updated.length);
        return updated;
      });
    }
  };

  // Clean up completed particles periodically (less frequent than animation)
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => {
        const now = Date.now();
        // Remove particles older than 1 second (with speed ~2.0, they complete in ~0.5s)
        const filtered = prev.filter(p => {
          const timestampStr = p.id.split('-')[1];
          if (!timestampStr) return false;
          const timestamp = parseInt(timestampStr);
          const age = now - timestamp;
          return age < 1000;
        });
        return filtered;
      });
    }, 500); // Clean up every 0.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full bg-gray-950 relative">
        {/* 3D Canvas - Full screen */}
        <Canvas
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}
          camera={{ position: [80, 60, 80], fov: 60 }}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
          }}
          dpr={[1, 2]}
        >
          <Scene 
            nodes={nodes}
            edges={edges}
            particles={particles}
            activeNodes={activeNodes}
            nodePositionsRef={nodePositionsRef}
            controlsRef={controlsRef}
          />
        </Canvas>

        {/* Info bar overlay - positioned above Canvas but with pointer-events-none on container */}
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <div className="flex items-center justify-between gap-3 p-3">
            {/* Status indicator - re-enable pointer events for interactive elements */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700 backdrop-blur-sm pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${telemetryConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-300">
                  {telemetryConnected ? 'Live Neural Telemetry' : 'Connecting...'}
                </span>
              </div>
              <div className="text-sm text-gray-300 font-medium">
                {nodes.length} nodes • {edges.length} connections • {particles.length} signals
              </div>
            </div>

            <div className="text-sm text-gray-400 px-3 py-2 bg-gray-800/50 rounded-lg backdrop-blur-sm pointer-events-auto">
              <span className="text-blue-400">Drag</span> to rotate • <span className="text-blue-400">Scroll</span> to zoom • <span className="text-blue-400">Right-drag</span> to pan
            </div>
          </div>
        </div>
    </div>
  );
}