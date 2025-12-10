// NeuralCognitiveShellsV2.tsx
// Visual guides showing the three cognitive regions as wireframe spheres

'use client';

import { useRef } from 'react';
import { Mesh } from 'three';

interface Props {
  visible?: boolean;
  opacity?: number;
}

// Core radius settings (matching layout)
const CORE_RADIUS = 20;
const MEMORY_RADIUS = 60;
const PERCEPTION_RADIUS = 100;

export function NeuralCognitiveShellsV2({ visible = true, opacity = 0.15 }: Props) {
  const coreMeshRef = useRef<Mesh>(null);
  const memoryMeshRef = useRef<Mesh>(null);
  const perceptionMeshRef = useRef<Mesh>(null);

  if (!visible) return null;

  return (
    <group>
      {/* Core shell - Gold */}
      <mesh ref={coreMeshRef}>
        <sphereGeometry args={[CORE_RADIUS, 32, 16]} />
        <meshBasicMaterial
          color="#FFD700"
          wireframe
          transparent
          opacity={opacity * 1.2} // Slightly more visible
        />
      </mesh>

      {/* Memory shell - Deep Pink */}
      <mesh ref={memoryMeshRef}>
        <sphereGeometry args={[MEMORY_RADIUS, 48, 24]} />
        <meshBasicMaterial
          color="#FF1493"
          wireframe
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Perception shell - Dark Turquoise */}
      <mesh ref={perceptionMeshRef}>
        <sphereGeometry args={[PERCEPTION_RADIUS, 64, 32]} />
        <meshBasicMaterial
          color="#00CED1"
          wireframe
          transparent
          opacity={opacity}
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
