// NeuralCognitiveShellsV2.tsx
// Visual guides showing the three cognitive regions as wireframe spheres

'use client';

import { useRef } from 'react';
import { Mesh } from 'three';

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
      {/* Core shell - Gold */}
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
          color="#FFD700"
          wireframe
          transparent
          opacity={opacity * 1.2} // Slightly more visible
        />
      </mesh>

      {/* Memory shell - Deep Pink */}
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
          color="#FF1493"
          wireframe
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Perception shell - Dark Turquoise */}
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
          color="#00CED1"
          wireframe
          transparent
          opacity={opacity * 0.4}
        />
      </mesh>

      {/* Memory latitude bands (horizontal rings) */}
      {/* Planning band (North) */}
      <mesh rotation={[0, 0, 0]} position={[0, MEMORY_RADIUS * 0.75, 0]}>
        <torusGeometry args={[MEMORY_RADIUS * 0.6, 0.2, 8, 32]} />
        <meshBasicMaterial color="#FF1493" transparent opacity={opacity * 0.5} />
      </mesh>

      {/* Declarative band */}
      <mesh rotation={[0, 0, 0]} position={[0, MEMORY_RADIUS * 0.4, 0]}>
        <torusGeometry args={[MEMORY_RADIUS * 0.9, 0.2, 8, 32]} />
        <meshBasicMaterial color="#FF1493" transparent opacity={opacity * 0.5} />
      </mesh>

      {/* Episodic band (Equator) */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[MEMORY_RADIUS, 0.2, 8, 32]} />
        <meshBasicMaterial color="#FF1493" transparent opacity={opacity * 0.5} />
      </mesh>

      {/* Procedural band */}
      <mesh rotation={[0, 0, 0]} position={[0, -MEMORY_RADIUS * 0.4, 0]}>
        <torusGeometry args={[MEMORY_RADIUS * 0.9, 0.2, 8, 32]} />
        <meshBasicMaterial color="#FF1493" transparent opacity={opacity * 0.5} />
      </mesh>

      {/* Layered band (South) */}
      <mesh rotation={[0, 0, 0]} position={[0, -MEMORY_RADIUS * 0.75, 0]}>
        <torusGeometry args={[MEMORY_RADIUS * 0.6, 0.2, 8, 32]} />
        <meshBasicMaterial color="#FF1493" transparent opacity={opacity * 0.5} />
      </mesh>

      {/* Perception longitude sectors (vertical planes) */}
      {/* Tools sector (0°) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <planeGeometry args={[PERCEPTION_RADIUS * 2, PERCEPTION_RADIUS * 2]} />
        <meshBasicMaterial
          color="#00CED1"
          transparent
          opacity={opacity * 0.3}
          side={2} // DoubleSide
          wireframe
        />
      </mesh>

      {/* API sector (90°) */}
      <mesh rotation={[0, Math.PI / 2, Math.PI / 2]} position={[0, 0, 0]}>
        <planeGeometry args={[PERCEPTION_RADIUS * 2, PERCEPTION_RADIUS * 2]} />
        <meshBasicMaterial
          color="#00CED1"
          transparent
          opacity={opacity * 0.3}
          side={2}
          wireframe
        />
      </mesh>
    </group>
  );
}
