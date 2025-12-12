// NeuralShellOptimizer.ts
// Optimizes shell rotations to minimize connection pathway lengths

import { Vector3, Euler, Matrix4 } from 'three';

interface ShellRotation {
  x: number;
  y: number;
  z: number;
}

interface NodePosition {
  id: string;
  position: [number, number, number];
  shell: 'core' | 'memory' | 'perception';
}

interface Edge {
  source: string;
  target: string;
}

// Calculate distance between two points
function distance(p1: [number, number, number], p2: [number, number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Apply rotation to a position
function rotatePosition(
  pos: [number, number, number],
  rotation: ShellRotation
): [number, number, number] {
  const vector = new Vector3(pos[0], pos[1], pos[2]);
  const matrix = new Matrix4();
  matrix.makeRotationFromEuler(
    new Euler(
      (rotation.x * Math.PI) / 180,
      (rotation.y * Math.PI) / 180,
      (rotation.z * Math.PI) / 180,
      'XYZ'
    )
  );
  vector.applyMatrix4(matrix);
  return [vector.x, vector.y, vector.z];
}

// Calculate total path length for all edges with given rotations
function calculateTotalPathLength(
  nodes: Map<string, NodePosition>,
  edges: Edge[],
  rotations: {
    core: ShellRotation;
    memory: ShellRotation;
    perception: ShellRotation;
  }
): number {
  let totalDistance = 0;
  
  for (const edge of edges) {
    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);
    
    if (!sourceNode || !targetNode) continue;
    
    // Apply rotation to source position
    const sourcePos = rotatePosition(
      sourceNode.position,
      rotations[sourceNode.shell]
    );
    
    // Apply rotation to target position
    const targetPos = rotatePosition(
      targetNode.position,
      rotations[targetNode.shell]
    );
    
    totalDistance += distance(sourcePos, targetPos);
  }
  
  return totalDistance;
}

// Try random rotations and keep the best one (simple optimization)
export function optimizeShellRotations(
  nodes: Map<string, any>,
  edges: Map<string, any>,
  currentRotations: {
    core: ShellRotation;
    memory: ShellRotation;
    perception: ShellRotation;
  },
  iterations: number = 500
): {
  core: ShellRotation;
  memory: ShellRotation;
  perception: ShellRotation;
} {
  console.log('[Optimizer] Starting optimization with', nodes.size, 'nodes and', edges.size, 'edges');
  
  // Convert nodes to position map with shell classification
  const nodePositions = new Map<string, NodePosition>();
  nodes.forEach((node, nodeId) => {
    if (node.position) {
      const [x, y, z] = node.position;
      const dist = Math.sqrt(x * x + y * y + z * z);
      
      let shell: 'core' | 'memory' | 'perception';
      if (dist < 30) {
        shell = 'core';
      } else if (dist < 70) {
        shell = 'memory';
      } else {
        shell = 'perception';
      }
      
      nodePositions.set(nodeId, {
        id: nodeId,
        position: node.position,
        shell,
      });
    }
  });
  
  // Convert edges to array
  const edgeArray: Edge[] = [];
  edges.forEach((edge) => {
    edgeArray.push({
      source: edge.sourceId,
      target: edge.targetId,
    });
  });
  
  console.log('[Optimizer] Classified', nodePositions.size, 'nodes into shells');
  
  // Start with current rotations
  let bestRotations = { ...currentRotations };
  let bestDistance = calculateTotalPathLength(nodePositions, edgeArray, bestRotations);
  
  console.log('[Optimizer] Initial total path length:', bestDistance.toFixed(2));
  
  // Try random perturbations (simulated annealing approach)
  let temperature = 45; // Starting rotation range in degrees
  const coolingRate = 0.995;
  
  for (let i = 0; i < iterations; i++) {
    // Pick a random shell to rotate
    const shells: ('core' | 'memory' | 'perception')[] = ['core', 'memory', 'perception'];
    const shellToRotate = shells[Math.floor(Math.random() * shells.length)];
    
    // Generate random rotation within temperature range
    const testRotations = JSON.parse(JSON.stringify(bestRotations));
    const axis = ['x', 'y', 'z'][Math.floor(Math.random() * 3)] as 'x' | 'y' | 'z';
    
    testRotations[shellToRotate][axis] += (Math.random() - 0.5) * 2 * temperature;
    
    // Clamp to valid range
    testRotations[shellToRotate][axis] = Math.max(-180, Math.min(180, testRotations[shellToRotate][axis]));
    
    // Calculate new distance
    const testDistance = calculateTotalPathLength(nodePositions, edgeArray, testRotations);
    
    // Accept if better, or with probability if worse (simulated annealing)
    const delta = testDistance - bestDistance;
    if (delta < 0 || Math.random() < Math.exp(-delta / (temperature * 10))) {
      bestRotations = testRotations;
      bestDistance = testDistance;
      
      if (i % 50 === 0) {
        console.log(`[Optimizer] Iteration ${i}: distance = ${bestDistance.toFixed(2)}, temp = ${temperature.toFixed(1)}`);
      }
    }
    
    // Cool down
    temperature *= coolingRate;
  }
  
  console.log('[Optimizer] Final total path length:', bestDistance.toFixed(2));
  console.log('[Optimizer] Optimized rotations:', bestRotations);
  
  return bestRotations;
}

// Quick optimization with fewer iterations
export function quickOptimize(
  nodes: Map<string, any>,
  edges: Map<string, any>,
  currentRotations: {
    core: ShellRotation;
    memory: ShellRotation;
    perception: ShellRotation;
  }
): {
  core: ShellRotation;
  memory: ShellRotation;
  perception: ShellRotation;
} {
  return optimizeShellRotations(nodes, edges, currentRotations, 200);
}
