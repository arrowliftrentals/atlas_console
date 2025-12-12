import * as THREE from 'three';

interface Node {
  id: string;
  position: [number, number, number];
  label?: string;
  subsystem?: string;
}

interface Edge {
  sourceId: string;
  targetId: string;
}

/**
 * Generate geodesic sphere distribution
 * Creates uniformly distributed points on a sphere using icosahedron subdivision
 */
function generateGeodesicSphere(nodeCount: number, radius: number): THREE.Vector3[] {
  // Start with icosahedron vertices (12 points)
  const t = (1.0 + Math.sqrt(5.0)) / 2.0;
  const vertices: THREE.Vector3[] = [
    new THREE.Vector3(-1, t, 0),
    new THREE.Vector3(1, t, 0),
    new THREE.Vector3(-1, -t, 0),
    new THREE.Vector3(1, -t, 0),
    new THREE.Vector3(0, -1, t),
    new THREE.Vector3(0, 1, t),
    new THREE.Vector3(0, -1, -t),
    new THREE.Vector3(0, 1, -t),
    new THREE.Vector3(t, 0, -1),
    new THREE.Vector3(t, 0, 1),
    new THREE.Vector3(-t, 0, -1),
    new THREE.Vector3(-t, 0, 1),
  ];

  // Normalize to sphere
  vertices.forEach(v => v.normalize().multiplyScalar(radius));

  // If we need more points, use Fibonacci sphere
  if (nodeCount > 12) {
    return generateFibonacciSphere(nodeCount, radius);
  }

  return vertices.slice(0, nodeCount);
}

/**
 * Generate points on sphere using Fibonacci spiral
 * This creates very uniform distribution for any number of points
 */
function generateFibonacciSphere(nodeCount: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle in radians

  for (let i = 0; i < nodeCount; i++) {
    const y = 1 - (i / (nodeCount - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y); // radius at y

    const theta = phi * i; // Golden angle increment

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    points.push(new THREE.Vector3(x, y, z).normalize().multiplyScalar(radius));
  }

  return points;
}

/**
 * Optimizes node positions on a spherical shell to minimize total edge length.
 * Uses geodesic sphere initialization followed by light optimization.
 * 
 * Algorithm:
 * 1. Initialize with Fibonacci sphere (uniform distribution)
 * 2. Apply light forces to align with connections
 * 3. Maintain geodesic structure while optimizing
 */
export function optimizeNodePositionsOnShell(
  nodes: Node[],
  edges: Edge[],
  shellType: 'core' | 'memory' | 'perception',
  iterations: number = 1000
): Map<string, [number, number, number]> {
  
  // Classify nodes by shell based on distance from origin
  const classifyShell = (pos: [number, number, number]): 'core' | 'memory' | 'perception' => {
    const distance = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2);
    if (distance < 30) return 'core';
    if (distance < 70) return 'memory';
    return 'perception';
  };
  
  // Filter nodes for the specified shell
  const shellNodes = nodes.filter(n => classifyShell(n.position) === shellType);
  if (shellNodes.length === 0) {
    console.log(`[NodeOptimizer] No nodes found for shell: ${shellType}`);
    return new Map();
  }

  // Calculate the radius of this shell (average distance from origin)
  const radius = Math.sqrt(
    shellNodes[0].position[0] ** 2 +
    shellNodes[0].position[1] ** 2 +
    shellNodes[0].position[2] ** 2
  );

  console.log(`[NodeOptimizer] Optimizing ${shellNodes.length} nodes on ${shellType} shell (radius: ${radius.toFixed(1)})`);

  // Build adjacency map for quick edge lookup
  const adjacency = new Map<string, Set<string>>();
  edges.forEach(edge => {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
    adjacency.get(edge.sourceId)!.add(edge.targetId);
    adjacency.get(edge.targetId)!.add(edge.sourceId);
  });

  // Create working positions (mutable vectors)
  const positions = new Map<string, THREE.Vector3>();
  shellNodes.forEach(node => {
    positions.set(node.id, new THREE.Vector3(...node.position));
  });

  // Calculate initial total edge length
  let initialDistance = calculateTotalEdgeLength(shellNodes, edges, positions, nodes);
  console.log(`[NodeOptimizer] Initial total edge length: ${initialDistance.toFixed(1)}`);
  
  // Log initial positions
  console.log(`[NodeOptimizer] Initial positions sample:`, 
    Array.from(positions.entries()).slice(0, 3).map(([id, pos]) => 
      `${id}: [${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}]`
    ).join(', ')
  );

  // Uniform distribution on sphere surface using pure Fibonacci sphere algorithm
  console.log(`[NodeOptimizer] Distributing ${shellNodes.length} nodes uniformly on memory shell sphere surface`);
  
  // Use the full memory shell radius for all nodes
  const sphereRadius = radius; // radius = 60 for memory shell
  
  console.log(`[NodeOptimizer] Placing all nodes on sphere surface at radius=${sphereRadius}`);
  
  // Fibonacci sphere algorithm for uniform distribution
  const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle ≈ 2.39996 radians
  
  shellNodes.forEach((node, i) => {
    // Fibonacci sphere formula
    const y = 1 - (i / (shellNodes.length - 1)) * 2; // y goes from 1 to -1
    const radius_at_y = Math.sqrt(1 - y * y); // radius at this y level
    const theta = phi * i; // golden angle increment
    
    const x = Math.cos(theta) * radius_at_y;
    const z = Math.sin(theta) * radius_at_y;
    
    // Scale to sphere radius
    const pos = new THREE.Vector3(x * sphereRadius, y * sphereRadius, z * sphereRadius);
    positions.set(node.id, pos);
    
    if (i < 5) {
      const dist = pos.length();
      console.log(`[NodeOptimizer] Node ${i} (${node.id}): pos=[${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}], dist=${dist.toFixed(1)}`);
    }
  });
  
  console.log(`[NodeOptimizer] Starting free optimization to minimize crossings and path lengths...`);
  
  // Phase 1: Free optimization - nodes can move anywhere to minimize edge length
  const velocities = new Map<string, THREE.Vector3>();
  shellNodes.forEach(node => {
    velocities.set(node.id, new THREE.Vector3(0, 0, 0));
  });
  
  const attractionStrength = 0.05;
  const repulsionStrength = 2.0;
  const damping = 0.85;
  
  for (let iter = 0; iter < iterations; iter++) {
    shellNodes.forEach(node => {
      const pos = positions.get(node.id)!;
      const force = new THREE.Vector3(0, 0, 0);
      
      // Strong attraction to connected nodes
      const neighbors = adjacency.get(node.id);
      if (neighbors) {
        neighbors.forEach(neighborId => {
          const neighborPos = positions.get(neighborId);
          if (!neighborPos) return;
          
          const toNeighbor = new THREE.Vector3().subVectors(neighborPos, pos);
          const distance = toNeighbor.length();
          
          if (distance > 0.1) {
            const tangent = toNeighbor.clone().sub(pos.clone().multiplyScalar(toNeighbor.dot(pos) / pos.lengthSq()));
            if (tangent.length() > 0.01) {
              force.add(tangent.normalize().multiplyScalar(attractionStrength * distance));
            }
          }
        });
      }
      
      // Repulsion from all nodes
      shellNodes.forEach(otherNode => {
        if (otherNode.id === node.id) return;
        
        const otherPos = positions.get(otherNode.id)!;
        const toOther = new THREE.Vector3().subVectors(otherPos, pos);
        const distance = toOther.length();
        
        if (distance > 0.1 && distance < 30) {
          const tangent = toOther.clone().sub(pos.clone().multiplyScalar(toOther.dot(pos) / pos.lengthSq()));
          if (tangent.length() > 0.01) {
            force.add(tangent.normalize().multiplyScalar(-repulsionStrength / (distance * distance)));
          }
        }
      });
      
      const velocity = velocities.get(node.id)!;
      velocity.multiplyScalar(damping).add(force);
      pos.add(velocity);
      pos.normalize().multiplyScalar(sphereRadius);
    });
    
    if (iter % 200 === 0) {
      console.log(`[NodeOptimizer] Free optimization iteration ${iter}/${iterations}`);
    }
  }
  
  console.log(`[NodeOptimizer] Free optimization complete - now remapping to uniform Fibonacci spacing...`);
  
  // Phase 2: Remap optimized positions to uniform Fibonacci sphere
  // Sort nodes by their position on the optimized sphere (e.g., by polar angle)
  const nodePositions: Array<{ node: Node, pos: THREE.Vector3 }> = [];
  shellNodes.forEach(node => {
    nodePositions.push({ node, pos: positions.get(node.id)!.clone() });
  });
  
  // Sort by spherical coordinates (theta, phi) to maintain relative ordering
  nodePositions.sort((a, b) => {
    const aTheta = Math.atan2(a.pos.z, a.pos.x);
    const bTheta = Math.atan2(b.pos.z, b.pos.x);
    if (Math.abs(aTheta - bTheta) > 0.01) return aTheta - bTheta;
    return a.pos.y - b.pos.y;
  });
  
  // Redistribute nodes using Fibonacci sphere with the new ordering
  nodePositions.forEach((item, i) => {
    const y = 1 - (i / (nodePositions.length - 1)) * 2;
    const radius_at_y = Math.sqrt(1 - y * y);
    const theta = phi * i;
    
    const x = Math.cos(theta) * radius_at_y;
    const z = Math.sin(theta) * radius_at_y;
    
    const newPos = new THREE.Vector3(x * sphereRadius, y * sphereRadius, z * sphereRadius);
    positions.set(item.node.id, newPos);
  });
  
  console.log(`[NodeOptimizer] Remapped to uniform Fibonacci spacing with optimized ordering`);
  
  // Return optimized positions
  const finalPositions = new Map<string, [number, number, number]>();
  shellNodes.forEach(node => {
    const pos = positions.get(node.id)!;
    finalPositions.set(node.id, [pos.x, pos.y, pos.z]);
  });
  
  console.log(`[NodeOptimizer] Returning ${finalPositions.size} optimized positions`);
  return finalPositions;


}

function calculateTotalEdgeLength(
  shellNodes: Node[],
  edges: Edge[],
  positions: Map<string, THREE.Vector3>,
  allNodes: Node[]
): number {
  const shellNodeIds = new Set(shellNodes.map(n => n.id));
  let total = 0;

  edges.forEach(edge => {
    // Only count edges where at least one endpoint is on the shell we're optimizing
    const sourceOnShell = shellNodeIds.has(edge.sourceId);
    const targetOnShell = shellNodeIds.has(edge.targetId);
    
    if (!sourceOnShell && !targetOnShell) return;

    const sourcePos = positions.get(edge.sourceId) || 
                     new THREE.Vector3(...(allNodes.find(n => n.id === edge.sourceId)?.position || [0,0,0]));
    const targetPos = positions.get(edge.targetId) || 
                     new THREE.Vector3(...(allNodes.find(n => n.id === edge.targetId)?.position || [0,0,0]));

    total += sourcePos.distanceTo(targetPos);
  });

  return total;
}

/**
 * Alternative optimization using simulated annealing with node swapping
 */
export function optimizeNodePositionsAnnealing(
  nodes: Node[],
  edges: Edge[],
  shellType: 'core' | 'memory' | 'perception',
  iterations: number = 5000
): Map<string, [number, number, number]> {
  
  // Classify nodes by shell based on distance from origin
  const classifyShell = (pos: [number, number, number]): 'core' | 'memory' | 'perception' => {
    const distance = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2);
    if (distance < 30) return 'core';
    if (distance < 70) return 'memory';
    return 'perception';
  };
  
  const shellNodes = nodes.filter(n => classifyShell(n.position) === shellType);
  if (shellNodes.length < 2) {
    return new Map();
  }

  console.log(`[NodeOptimizer-SA] Optimizing ${shellNodes.length} nodes on ${shellType} shell using simulated annealing`);

  // Current positions
  const positions = new Map<string, THREE.Vector3>();
  shellNodes.forEach(node => {
    positions.set(node.id, new THREE.Vector3(...node.position));
  });

  let currentCost = calculateTotalEdgeLength(shellNodes, edges, positions, nodes);
  let bestCost = currentCost;
  const bestPositions = new Map(positions);

  console.log(`[NodeOptimizer-SA] Initial cost: ${currentCost.toFixed(1)}`);

  // Simulated annealing parameters
  let temperature = 100;
  const coolingRate = 0.9995;
  const minTemperature = 0.01;

  for (let iter = 0; iter < iterations && temperature > minTemperature; iter++) {
    // Pick two random nodes to swap positions
    const idx1 = Math.floor(Math.random() * shellNodes.length);
    const idx2 = Math.floor(Math.random() * shellNodes.length);
    
    if (idx1 === idx2) continue;

    const node1 = shellNodes[idx1];
    const node2 = shellNodes[idx2];

    // Swap positions
    const pos1 = positions.get(node1.id)!.clone();
    const pos2 = positions.get(node2.id)!.clone();
    
    positions.set(node1.id, pos2);
    positions.set(node2.id, pos1);

    // Calculate new cost
    const newCost = calculateTotalEdgeLength(shellNodes, edges, positions, nodes);
    const delta = newCost - currentCost;

    // Accept or reject based on Metropolis criterion
    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
      currentCost = newCost;
      
      if (newCost < bestCost) {
        bestCost = newCost;
        positions.forEach((pos, id) => {
          bestPositions.set(id, pos.clone());
        });
      }
    } else {
      // Reject: swap back
      positions.set(node1.id, pos1);
      positions.set(node2.id, pos2);
    }

    temperature *= coolingRate;

    if (iter % 500 === 0) {
      const improvement = ((currentCost - bestCost) / currentCost * 100).toFixed(1);
      console.log(`[NodeOptimizer-SA] Iteration ${iter}: Best cost = ${bestCost.toFixed(1)} (temp: ${temperature.toFixed(2)})`);
    }
  }

  const initialCost = calculateTotalEdgeLength(shellNodes, edges, 
    new Map(shellNodes.map(n => [n.id, new THREE.Vector3(...n.position)])), nodes);
  const improvement = ((initialCost - bestCost) / initialCost * 100).toFixed(1);
  console.log(`[NodeOptimizer-SA] Optimization complete! Best cost: ${bestCost.toFixed(1)} (${improvement}% improvement)`);

  // Convert best positions to tuples
  const result = new Map<string, [number, number, number]>();
  bestPositions.forEach((pos, id) => {
    result.set(id, [pos.x, pos.y, pos.z]);
  });

  return result;
}
