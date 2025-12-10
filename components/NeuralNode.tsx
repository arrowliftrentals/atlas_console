'use client';

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, Html } from '@react-three/drei';
import { Node } from './NeuralNetworkScene';

interface NeuralNodeProps {
  node: Node;
  position: [number, number, number];
  activitySpeed: number;
  showLabel: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}

/**
 * Color palette by Atlas component type
 */
const GROUP_COLORS: Record<string, string> = {
  router: '#3B82F6',       // Blue
  service: '#10B981',      // Green
  gateway: '#8B5CF6',      // Purple
  store: '#F59E0B',        // Orange
  memory: '#EC4899',       // Pink
  llm: '#06B6D4',          // Cyan
  default: '#6B7280'       // Gray
};

export default function NeuralNode({
  node,
  position,
  activitySpeed,
  showLabel,
  isSelected,
  isHovered,
  isDimmed,
  onClick,
  onHover
}: NeuralNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  
  const baseColor = GROUP_COLORS[node.group || 'default'];
  const activity = node.activity || 0.5;
  
  // Base scale influenced by activity
  const baseScale = 0.8 + (activity * 0.4); // 0.8 - 1.2
  
  // Animated pulsing effect
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    
    const time = clock.getElapsedTime() * activitySpeed;
    
    // Breathing pulse (0.9 - 1.1) - use uniform scaling
    const pulse = 1.0 + Math.sin(time * 2 + parseFloat(node.id.slice(-2))) * 0.1 * activity;
    const scale = baseScale * pulse;
    meshRef.current.scale.set(scale, scale, scale);
    
    // Emit intensity pulse
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 1.0 + Math.sin(time * 3) * 0.5 * activity;
    
    // Glow pulse - also use uniform scaling
    if (glowRef.current) {
      const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
      glowMaterial.opacity = (0.3 + Math.sin(time * 2) * 0.2) * activity;
      const glowScale = scale * 1.5 * hoverScale;
      glowRef.current.scale.set(glowScale, glowScale, glowScale);
    }
  });
  
  // Hover scale boost
  const hoverScale = (isHovered || isSelected) ? 1.3 : 1.0;
  const dimOpacity = isDimmed ? 0.3 : 1.0;
  
  return (
    <group position={position}>
      {/* Main glowing sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          onHover(false);
        }}
        scale={hoverScale}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={1.0}
          metalness={0.95}
          roughness={0.05}
          clearcoat={1.0}
          clearcoatRoughness={0.0}
          reflectivity={1}
          transparent
          opacity={dimOpacity}
        />
      </mesh>
      
      {/* Outer glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={baseColor}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={hoverScale * 1.8}>
          <ringGeometry args={[0.9, 1.1, 32]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      
      {/* Label */}
      {showLabel && (
        <Text
          position={[0, -1.5, 0]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {node.label || node.id}
        </Text>
      )}
      
      {/* Hover tooltip */}
      {(isHovered || isSelected) && (
        <Html
          position={[0, 2, 0]}
          center
          distanceFactor={15}
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div className="bg-black/90 text-white px-3 py-2 rounded-lg border border-cyan-500/50 backdrop-blur-sm text-xs whitespace-nowrap">
            <div className="font-semibold text-cyan-400">{node.label || node.id}</div>
            <div className="text-gray-400 mt-0.5">Group: {node.group || 'default'}</div>
            <div className="text-gray-400">Activity: {(activity * 100).toFixed(0)}%</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * VISUAL CUSTOMIZATION:
 * 
 * Colors: Modify GROUP_COLORS to change node colors per group
 * Size: Adjust baseScale calculation (currently 0.8-1.2 based on activity)
 * Pulse: Change pulse frequency in useFrame (currently time * 2)
 * Glow: Adjust glowRef opacity range (currently 0.3 ± 0.2)
 * Material: Tweak metalness/roughness for different looks
 */
