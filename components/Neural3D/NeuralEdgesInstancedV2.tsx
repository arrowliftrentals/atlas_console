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

// Create helical ribbon path along shell surface
// Path spirals around the sphere surface between two points
function createHelicalRibbonPath(start: Vector3, end: Vector3, radius: number, segments: number = 40): Vector3[] {
  const points: Vector3[] = [];
  
  // Project endpoints to shell surface
  const p1 = projectToSphere(start, radius);
  const p2 = projectToSphere(end, radius);
  
  // Calculate great circle distance to determine helix intensity
  const angle = p1.angleTo(p2);
  
  // Number of helical wraps based on distance (more distance = more spirals)
  const helixTurns = Math.min(angle / Math.PI, 1.5); // 0 to 1.5 complete rotations
  
  // Create rotation axis perpendicular to the plane containing p1, p2, and origin
  const axis = new Vector3().crossVectors(p1, p2).normalize();
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Base position: spherical linear interpolation (slerp-like)
    const basePoint = new Vector3().lerpVectors(p1, p2, t);
    const geodesicPoint = projectToSphere(basePoint, radius);
    
    // Add helical rotation around the geodesic path
    const helixAngle = t * helixTurns * 2 * Math.PI;
    
    // Create local coordinate system at geodesic point
    const radialDir = geodesicPoint.clone().normalize(); // Points outward from sphere center
    const tangentDir = new Vector3().crossVectors(axis, radialDir).normalize(); // Tangent to helix
    
    // Helical displacement (stays on sphere surface by being perpendicular to radial)
    const helixRadius = radius * 0.03; // 3% of shell radius for ribbon width
    const offsetAmount = Math.sin(helixAngle) * helixRadius;
    
    // Apply offset in tangent direction
    const helixPoint = geodesicPoint.clone().add(tangentDir.multiplyScalar(offsetAmount));
    
    // Project back to sphere to maintain shell surface
    points.push(projectToSphere(helixPoint, radius));
  }
  
  return points;
}

// Create contiguous arc path between different shells
// Follows outer shell arc, then gracefully transitions to inner shell arc
function createCrossShellHelicalPath(start: Vector3, end: Vector3, startRadius: number, endRadius: number, segments: number = 50): Vector3[] {
  const points: Vector3[] = [];
  
  const outerRadius = Math.max(startRadius, endRadius);
  const innerRadius = Math.min(startRadius, endRadius);
  
  // Determine which endpoint is on which shell
  const startIsOuter = startRadius >= endRadius;
  
  // Project start point to outer shell, end point to inner shell
  const outerPoint = startIsOuter ? projectToSphere(start, outerRadius) : projectToSphere(end, outerRadius);
  const innerPoint = startIsOuter ? projectToSphere(end, innerRadius) : projectToSphere(start, innerRadius);
  
  // Also project inner endpoint to outer shell to create arc path
  const innerPointOnOuter = projectToSphere(innerPoint, outerRadius);
  
  // Rotation axis for helical rotation
  const axis = new Vector3().crossVectors(outerPoint, innerPointOnOuter).normalize();
  
  // Two-phase contiguous arc:
  // Phase 1: Follow outer shell arc from outer point toward inner point's projection
  // Phase 2: Spiral inward from outer shell to inner shell while continuing arc
  const transitionPoint = 0.5; // 50% along outer arc, 50% transitioning to inner
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    if (t <= transitionPoint) {
      // Phase 1: Arc along outer shell surface
      const shellT = t / transitionPoint;
      
      // Interpolate along outer shell arc
      const arcPoint = new Vector3().lerpVectors(outerPoint, innerPointOnOuter, shellT);
      const geodesicPoint = projectToSphere(arcPoint, outerRadius);
      
      // Add subtle helical rotation
      const helixAngle = shellT * 0.5 * 2 * Math.PI; // Half rotation on outer arc
      const radialDir = geodesicPoint.clone().normalize();
      const tangentDir = new Vector3().crossVectors(axis, radialDir).normalize();
      const helixRadius = outerRadius * 0.02;
      const offsetAmount = Math.sin(helixAngle) * helixRadius;
      
      const helixPoint = geodesicPoint.clone().add(tangentDir.multiplyScalar(offsetAmount));
      points.push(projectToSphere(helixPoint, outerRadius));
    } else {
      // Phase 2: Graceful transition from outer arc to inner shell
      const transT = (t - transitionPoint) / (1 - transitionPoint);
      
      // Smoothly interpolate radius from outer to inner
      const currentRadius = outerRadius - (outerRadius - innerRadius) * transT;
      
      // Continue arc path while transitioning between shells
      // Follow the arc on the current transitional radius
      const outerArcPoint = new Vector3().lerpVectors(outerPoint, innerPointOnOuter, t);
      const innerArcPoint = new Vector3().lerpVectors(outerPoint, innerPoint, t);
      
      // Blend between outer shell arc and direct path to inner point
      const blendedPoint = new Vector3().lerpVectors(outerArcPoint, innerArcPoint, transT);
      const geodesicPoint = projectToSphere(blendedPoint, currentRadius);
      
      // Continue helical rotation through transition
      const helixAngle = (0.5 + transT * 0.5) * 0.5 * 2 * Math.PI;
      const radialDir = geodesicPoint.clone().normalize();
      const tangentDir = new Vector3().crossVectors(axis, radialDir).normalize();
      const helixRadius = currentRadius * 0.02;
      const offsetAmount = Math.sin(helixAngle) * helixRadius;
      
      const helixPoint = geodesicPoint.clone().add(tangentDir.multiplyScalar(offsetAmount));
      points.push(projectToSphere(helixPoint, currentRadius));
    }
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
      
      // Create straight line path between nodes
      const startVec = new Vector3(x1, y1, z1);
      const endVec = new Vector3(x2, y2, z2);
      
      // Simple straight line - no curves
      const pathPoints: Vector3[] = [startVec, endVec];
      
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
      // Color based on event type
      const baseColor = new Color(
        edge.lastEventType
          ? EDGE_COLORS_BY_EVENT[edge.lastEventType]
          : '#555555'
      );
      
      // Activity pulse (brighten for recent events)
      const age = Date.now() - edge.lastEventTs;
      if (age < 500) {
        const boost = 1 + (500 - age) / 500;
        baseColor.multiplyScalar(boost);
      }
      
      // Highlight effect
      if (edge.isHighlighted) {
        baseColor.multiplyScalar(1.5);
      }
      
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
