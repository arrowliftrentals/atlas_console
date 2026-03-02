// NeuralShellRotationHandles.tsx
// Visual rotation handles on shell surfaces


import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CORE_RADIUS, MEMORY_RADIUS, PERCEPTION_RADIUS } from './NeuralCognitiveLayoutV2';

interface Props {
  selectedShell: 'core' | 'memory' | 'perception' | null;
  shellRotations: {
    core: { x: number; y: number; z: number };
    memory: { x: number; y: number; z: number };
    perception: { x: number; y: number; z: number };
  };
}

export function NeuralShellRotationHandles({ selectedShell, shellRotations }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // Get radius for selected shell
  const getRadius = () => {
    if (!selectedShell) return 0;
    if (selectedShell === 'core') return CORE_RADIUS;
    if (selectedShell === 'memory') return MEMORY_RADIUS;
    return PERCEPTION_RADIUS;
  };

  // Get color for selected shell
  const getColor = () => {
    if (selectedShell === 'core') return '#FF6B9D';
    if (selectedShell === 'memory') return '#4ECDC4';
    return '#FFD93D';
  };

  // Update handle positions based on shell rotation
  useFrame(() => {
    if (!groupRef.current || !selectedShell) return;

    const radius = getRadius();
    const rotation = shellRotations[selectedShell];

    // Apply rotation to the group
    groupRef.current.rotation.set(
      (rotation.x * Math.PI) / 180,
      (rotation.y * Math.PI) / 180,
      (rotation.z * Math.PI) / 180
    );
  });

  if (!selectedShell) return null;

  const radius = getRadius();
  const color = getColor();
  const handleSize = 2;

  // Position handles at the cardinal points on each axis
  const handles = [
    // X-axis (red tint)
    { pos: [radius, 0, 0], color: new THREE.Color(color).lerp(new THREE.Color('#ff0000'), 0.3) },
    { pos: [-radius, 0, 0], color: new THREE.Color(color).lerp(new THREE.Color('#ff0000'), 0.3) },
    // Y-axis (green tint)
    { pos: [0, radius, 0], color: new THREE.Color(color).lerp(new THREE.Color('#00ff00'), 0.3) },
    { pos: [0, -radius, 0], color: new THREE.Color(color).lerp(new THREE.Color('#00ff00'), 0.3) },
    // Z-axis (blue tint)
    { pos: [0, 0, radius], color: new THREE.Color(color).lerp(new THREE.Color('#0000ff'), 0.3) },
    { pos: [0, 0, -radius], color: new THREE.Color(color).lerp(new THREE.Color('#0000ff'), 0.3) },
  ];

  return (
    <group ref={groupRef}>
      {handles.map((handle, i) => (
        <mesh key={i} position={handle.pos as [number, number, number]}>
          <sphereGeometry args={[handleSize, 16, 16]} />
          <meshStandardMaterial
            color={handle.color}
            emissive={handle.color}
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      
      {/* Axis rings for better visualization */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.3, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[radius, 0.3, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <torusGeometry args={[radius, 0.3, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
