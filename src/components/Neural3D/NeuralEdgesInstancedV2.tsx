// NeuralEdgesInstancedV2.tsx
// Helical ribbon paths wrapping around shell surfaces


import { useRef, useMemo } from 'react';
import { Color, Vector3, CatmullRomCurve3, TubeGeometry, MeshBasicMaterial, Mesh, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { EdgeStateV2, NodeStateV2 } from './NeuralTelemetryTypesV2';
import { EDGE_COLORS_BY_EVENT } from './NeuralVisualEncodingV2';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';

// Idle / active opacity range for edges
const EDGE_DIM_OPACITY = 0.1;
const EDGE_ACTIVE_OPACITY = 0.75;
// Asymmetric: fast brighten, slow dim
const EDGE_RAMP_UP = 3.0;    // ~0.3s to full brightness
const EDGE_RAMP_DOWN = 0.4;  // ~2.5s to fully dim

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
  
  // Smooth activation level per edge id
  const edgeActivationRef = useRef<Map<string, number>>(new Map());
  
  // Read active particles from store to know which edges have traffic
  const activeParticles = useNeuralTelemetryStoreV2((s) => s.activeParticles);
  
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
      
      // Use straight line path for verification
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

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const act = edgeActivationRef.current;
    
    // Build a set of edge ids that currently have particles in flight.
    // activeParticles is keyed by nodeId; we rebuild the set of *edges*
    // by pairing each particle's sourceId->targetId.
    const activeEdgeIds = new Set<string>();
    activeParticles.forEach((particles) => {
      for (const p of particles) {
        activeEdgeIds.add(`${p.sourceId}->${p.targetId}`);
      }
    });

    edgeMeshes.forEach(({ mesh, edge }) => {
      // Determine target activation (1 if edge has particles, else 0)
      const edgeId = edge.id;
      const target = activeEdgeIds.has(edgeId) ? 1.0 : 0.0;
      const prev = act.get(edgeId) ?? 0;
      const speed = target > prev ? EDGE_RAMP_UP : EDGE_RAMP_DOWN;
      const step = speed * dt;
      const next = prev + Math.sign(target - prev) * Math.min(step, Math.abs(target - prev));
      act.set(edgeId, next);

      // Color based on event type — mutate existing material color, no allocation
      const mat = mesh.material as MeshBasicMaterial;
      mat.color.set(
        edge.lastEventType
          ? EDGE_COLORS_BY_EVENT[edge.lastEventType]
          : '#555555'
      );
      mat.opacity = EDGE_DIM_OPACITY + (EDGE_ACTIVE_OPACITY - EDGE_DIM_OPACITY) * next;
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
