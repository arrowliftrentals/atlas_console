// NeuralEdgesInstancedV2.tsx
// Curved edge rendering with bezier paths

'use client';

import { useRef, useMemo } from 'react';
import { Color, Vector3, QuadraticBezierCurve3, TubeGeometry, MeshBasicMaterial, Mesh, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { EdgeStateV2, NodeStateV2 } from './NeuralTelemetryTypesV2';
import { EDGE_COLORS_BY_EVENT } from './NeuralVisualEncodingV2';

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
      
      // Calculate control point for bezier curve (same as particles)
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const midZ = (z1 + z2) / 2;
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const edgeLen = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
      
      // Perpendicular offset (matching particle curvature)
      const curvature = edgeLen * 0.15;
      const perpX = -dz * curvature / (edgeLen || 1);
      const perpY = curvature;
      const perpZ = dx * curvature / (edgeLen || 1);
      
      const ctrlX = midX + perpX;
      const ctrlY = midY + perpY;
      const ctrlZ = midZ + perpZ;
      
      // Validate control point
      if (!isFinite(ctrlX) || !isFinite(ctrlY) || !isFinite(ctrlZ)) {
        console.warn('[EDGE] Invalid control point for edge:', edge.sourceId, '→', edge.targetId);
        return;
      }
      
      // Create bezier curve with validated points
      let geometry: TubeGeometry;
      try {
        const curve = new QuadraticBezierCurve3(
          new Vector3(x1, y1, z1),
          new Vector3(ctrlX, ctrlY, ctrlZ),
          new Vector3(x2, y2, z2)
        );
        
        // Create tube geometry along curve
        const thickness = 0.04; // Constant thickness
        geometry = new TubeGeometry(curve, 20, thickness, 6, false);
        
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
