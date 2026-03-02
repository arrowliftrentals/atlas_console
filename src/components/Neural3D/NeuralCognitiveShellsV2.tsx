// NeuralCognitiveShellsV2.tsx
// Visual guides showing the three cognitive regions as wireframe spheres


import { useRef } from 'react';
import { Mesh } from 'three';
import { REGION_COLORS } from './NeuralVisualEncodingV2';

interface Props {
  visible?: boolean;
  opacity?: number;
  shellRotations?: {
    core: { x: number; y: number; z: number };
    memory: { x: number; y: number; z: number };
    perception: { x: number; y: number; z: number };
  };
}

// Core radius settings (matching layout)
const CORE_RADIUS = 20;
const MEMORY_RADIUS = 60;
const PERCEPTION_RADIUS = 100;

export function NeuralCognitiveShellsV2({ 
  visible = true, 
  opacity = 0.15,
  shellRotations = {
    core: { x: 0, y: 0, z: 0 },
    memory: { x: 0, y: 0, z: 0 },
    perception: { x: 0, y: 0, z: 0 },
  }
}: Props) {
  const coreMeshRef = useRef<Mesh>(null);
  const memoryMeshRef = useRef<Mesh>(null);
  const perceptionMeshRef = useRef<Mesh>(null);

  if (!visible) return null;

  return (
    <group>
      {/* Core shell - Dark Orange */}
      <mesh 
        ref={coreMeshRef}
        rotation={[
          (shellRotations.core.x * Math.PI) / 180,
          (shellRotations.core.y * Math.PI) / 180,
          (shellRotations.core.z * Math.PI) / 180,
        ]}
      >
        <sphereGeometry args={[CORE_RADIUS, 32, 16]} />
        <meshBasicMaterial
          color={REGION_COLORS.core}
          wireframe
          transparent
          opacity={opacity * 1.2} // Slightly more visible
        />
      </mesh>

      {/* Memory shell - Dark Pink */}
      <mesh 
        ref={memoryMeshRef}
        rotation={[
          (shellRotations.memory.x * Math.PI) / 180,
          (shellRotations.memory.y * Math.PI) / 180,
          (shellRotations.memory.z * Math.PI) / 180,
        ]}
      >
        <sphereGeometry args={[MEMORY_RADIUS, 48, 24]} />
        <meshBasicMaterial
          color={REGION_COLORS.memory}
          wireframe
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Perception shell - Dark Teal */}
      <mesh 
        ref={perceptionMeshRef}
        rotation={[
          (shellRotations.perception.x * Math.PI) / 180,
          (shellRotations.perception.y * Math.PI) / 180,
          (shellRotations.perception.z * Math.PI) / 180,
        ]}
      >
        <sphereGeometry args={[PERCEPTION_RADIUS, 64, 32]} />
        <meshBasicMaterial
          color={REGION_COLORS.perception}
          wireframe
          transparent
          opacity={opacity * 0.8}
        />
      </mesh>
    </group>
  );
}
