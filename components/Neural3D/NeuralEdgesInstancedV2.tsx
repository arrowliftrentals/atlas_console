// NeuralEdgesInstancedV2.tsx
// Helical ribbon paths wrapping around shell surfaces

'use client';

import { useRef, useMemo } from 'react';
import { Color, Vector3, CatmullRomCurve3, TubeGeometry, MeshBasicMaterial, Mesh, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { EdgeStateV2, NodeStateV2 } from './NeuralTelemetryTypesV2';
import { EDGE_COLORS_BY_EVENT } from './NeuralVisualEncodingV2';
import { Matrix4, Euler } from 'three';

const CORE_RADIUS = 20;
const MEMORY_RADIUS = 60;
const PERCEPTION_RADIUS = 100;

// Determine which shell a position belongs to
function getNodeShell(position: [number, number, number]): number {
  const [x, y, z] = position;
  const radius = Math.sqrt(x*x + y*y + z*z);
  const distToCore = Math.abs(radius - CORE_RADIUS);
  const distToMemory = Math.abs(radius - MEMORY_RADIUS);
  const distToPerception = Math.abs(radius - PERCEPTION_RADIUS);
  const minDist = Math.min(distToCore, distToMemory, distToPerception);
  if (minDist === distToCore) return CORE_RADIUS;
  if (minDist === distToMemory) return MEMORY_RADIUS;
  return PERCEPTION_RADIUS;
}

// Project point to sphere surface
function projectToSphere(point: Vector3, radius: number): Vector3 {
  const len = point.length();
  if (len === 0) return new Vector3(radius, 0, 0);
  return point.clone().multiplyScalar(radius / len);
}

// Create convex arched path between nodes (bulges outward from sphere)
function createHelicalRibbonPath(start: Vector3, end: Vector3, radius: number, segments: number = 20): Vector3[] {
  const points: Vector3[] = [];
  
  const startVec = start.clone();
  const endVec = end.clone();
  
  // Calculate midpoint and arch control point
  const midPoint = new Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const distance = startVec.distanceTo(endVec);
  
  // Arch height as function of pathway length:
  // Short paths (<20): low arch (10% of distance)
  // Medium paths (20-60): scaled arch (10% to 25% of distance)
  // Long paths (>60): high arch (25% of distance)
  let archHeightRatio;
  if (distance < 20) {
    archHeightRatio = 0.10;
  } else if (distance < 60) {
    // Linear interpolation from 10% to 25%
    archHeightRatio = 0.10 + ((distance - 20) / 40) * 0.15;
  } else {
    archHeightRatio = 0.25;
  }
  let archHeight = distance * archHeightRatio;
  
  // Control point bulges OUTWARD from sphere center (convex)
  const toOrigin = midPoint.clone().normalize();
  
  // Constrain arch height to not extend beyond shell surface
  // Calculate current distance from origin to midpoint
  const midpointRadius = midPoint.length();
  // Maximum allowed extension is the shell radius minus current midpoint distance
  const maxArchHeight = radius - midpointRadius;
  // Clamp arch height to stay within shell
  archHeight = Math.min(archHeight, maxArchHeight * 0.9); // 90% to stay safely inside
  
  const controlPoint = midPoint.clone().add(toOrigin.multiplyScalar(archHeight));
  
  // Quadratic Bezier curve
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new Vector3()
      .addScaledVector(startVec, (1 - t) * (1 - t))
      .addScaledVector(controlPoint, 2 * (1 - t) * t)
      .addScaledVector(endVec, t * t);
    points.push(point);
  }
  
  return points;
}

// Create lightly arched path between different shells (straight line with subtle arch)
function createCrossShellHelicalPath(start: Vector3, end: Vector3, startRadius: number, endRadius: number, segments: number = 20): Vector3[] {
  const points: Vector3[] = [];
  
  const startVec = start.clone();
  const endVec = end.clone();
  
  // Calculate midpoint and arch control point
  const midPoint = new Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
  const distance = startVec.distanceTo(endVec);
  
  // Light arch for cross-shell connections (half the arch height of same-shell)
  let archHeightRatio;
  if (distance < 20) {
    archHeightRatio = 0.05; // Half of same-shell
  } else if (distance < 60) {
    archHeightRatio = 0.05 + ((distance - 20) / 40) * 0.075; // Half of same-shell
  } else {
    archHeightRatio = 0.125; // Half of same-shell
  }
  const archHeight = distance * archHeightRatio;
  
  // Control point bulges OUTWARD from sphere center (convex)
  const toOrigin = midPoint.clone().normalize();
  const controlPoint = midPoint.clone().add(toOrigin.multiplyScalar(archHeight));
  
  // Quadratic Bezier curve
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new Vector3()
      .addScaledVector(startVec, (1 - t) * (1 - t))
      .addScaledVector(controlPoint, 2 * (1 - t) * t)
      .addScaledVector(endVec, t * t);
    points.push(point);
  }
  
  return points;
}

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, EdgeStateV2>;
  timeScale: number;
}

interface EdgeMeshData {
  mesh: Mesh;
  edge: EdgeStateV2;
}

export function NeuralEdgesInstancedV2({ nodes, edges, timeScale }: Props) {
  const groupRef = useRef<Group>(null!);
  
  // Create curved tube meshes for each edge
  const edgeMeshes = useMemo<EdgeMeshData[]>(() => {
    const meshes: EdgeMeshData[] = [];
    
    edges.forEach((edge) => {
      const src = nodes.get(edge.sourceId);
      const dst = nodes.get(edge.targetId);
      
      if (!src || !dst) return;
      
      const [x1, y1, z1] = src.position;
      const [x2, y2, z2] = dst.position;
      
      // Validate positions - skip edge if any NaN
      if (!isFinite(x1) || !isFinite(y1) || !isFinite(z1) ||
          !isFinite(x2) || !isFinite(y2) || !isFinite(z2)) {
        console.warn('[EDGE] Skipping edge with invalid positions:', edge.sourceId, '→', edge.targetId);
        return;
      }
      
      // Create curved arch path between nodes
      const startVec = new Vector3(x1, y1, z1);
      const endVec = new Vector3(x2, y2, z2);
      
      // Determine shell and use appropriate path algorithm
      const startRadius = Math.sqrt(x1*x1 + y1*y1 + z1*z1);
      const endRadius = Math.sqrt(x2*x2 + y2*y2 + z2*z2);
      
      let pathPoints: Vector3[];
      if (Math.abs(startRadius - endRadius) < 10) {
        // Same shell - use convex arch
        pathPoints = createHelicalRibbonPath(startVec, endVec, (startRadius + endRadius) / 2);
      } else {
        // Cross-shell - use cross-shell path
        pathPoints = createCrossShellHelicalPath(startVec, endVec, startRadius, endRadius);
      }
      
      // Create tube geometry along straight path
      let geometry: TubeGeometry;
      try {
        const curve = new CatmullRomCurve3(pathPoints);
        const thickness = 0.04; // Constant thickness
        geometry = new TubeGeometry(curve, 10, thickness, 6, false);
        
        // Validate geometry has valid bounding sphere
        geometry.computeBoundingSphere();
        if (!geometry.boundingSphere || !isFinite(geometry.boundingSphere.radius)) {
          console.warn('[EDGE] Invalid geometry for edge:', edge.sourceId, '→', edge.targetId);
          geometry.dispose();
          return;
        }
      } catch (error) {
        console.warn('[EDGE] Failed to create geometry for edge:', edge.sourceId, '→', edge.targetId, error);
        return;
      }
      
      const material = new MeshBasicMaterial({ 
        transparent: true, 
        opacity: 0.6 
      });
      
      const mesh = new Mesh(geometry, material);
      meshes.push({ mesh, edge });
    });
    
    return meshes;
  }, [edges, nodes]);

  useFrame(() => {
    if (!groupRef.current) return;

    edgeMeshes.forEach(({ mesh, edge }) => {
      // Color based on event type only - no effects
      const baseColor = new Color(
        edge.lastEventType
          ? EDGE_COLORS_BY_EVENT[edge.lastEventType]
          : '#555555'
      );
      
      (mesh.material as MeshBasicMaterial).color = baseColor;
    });
  });

  return (
    <group ref={groupRef}>
      {edgeMeshes.map(({ mesh }, i) => (
        <primitive key={i} object={mesh} />
      ))}
    </group>
  );
}
