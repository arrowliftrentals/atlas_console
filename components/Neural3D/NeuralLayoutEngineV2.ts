// NeuralLayoutEngineV2.ts
// Atomic model layout matching V1 - memory core with orbital nodes

import { NodeStateV2, NodeSubsystem } from './NeuralTelemetryTypesV2';

// Map V2 subsystems to V1 types for layout compatibility
function subsystemToV1Type(subsystem: NodeSubsystem): string {
  switch (subsystem) {
    case 'llm_core': return 'llm';
    case 'working_memory':
    case 'long_term_memory': return 'memory';
    case 'vector_db':
    case 'embedding_pipeline': return 'store';
    case 'plugin_agent': return 'gateway';
    case 'io_interface': return 'router';
    case 'internal_service': return 'service';
    case 'external_dependency': return 'gateway';
    case 'background_process': return 'service';
    default: return 'service';
  }
}

/**
 * Organic force-directed layout: Largest (most connected) node at center
 * All other nodes orbit around it based on their connections
 */
export function computeNodePositionsV2(nodes: Map<string, NodeStateV2>): Map<string, NodeStateV2> {
  const result = new Map<string, NodeStateV2>();
  
  if (nodes.size === 0) return result;
  
  const nodeArray = Array.from(nodes.values());
  
  // Count connections for each node to find the most connected (largest) node
  const connectionCounts = new Map<string, number>();
  nodeArray.forEach(node => connectionCounts.set(node.id, 0));
  
  // This is simplified - in real implementation we'd count actual edges
  // For now, assume llm_gateway or most "central" named nodes are hubs
  nodeArray.forEach(node => {
    // Heuristic: count how many other nodes might connect to this one
    let connections = 0;
    if (node.id.includes('llm_gateway')) connections = 100; // Highest priority
    else if (node.id.includes('agent_router')) connections = 50;
    else if (node.id.includes('orchestrator')) connections = 50;
    else if (node.id.includes('tool_')) connections = 5;
    else connections = 10;
    
    connectionCounts.set(node.id, connections);
  });
  
  // Find the largest node (most connections)
  let largestNode = nodeArray[0];
  let maxConnections = 0;
  connectionCounts.forEach((count, nodeId) => {
    if (count > maxConnections) {
      maxConnections = count;
      largestNode = nodeArray.find(n => n.id === nodeId)!;
    }
  });
  
  console.log('[LAYOUT] Largest node (core):', largestNode.id, 'with', maxConnections, 'connections');
  
  // Initialize positions: largest node at center, others in sphere
  const positions = new Map<string, [number, number, number]>();
  
  // Place largest node at absolute center
  positions.set(largestNode.id, [0, 0, 0]);
  
  // Place all other nodes in sphere around it
  const otherNodes = nodeArray.filter(n => n.id !== largestNode.id);
  
  if (otherNodes.length === 0) {
    // Only one node - just return it at center
    result.set(largestNode.id, { ...largestNode, position: [0, 0, 0] });
    return result;
  }
  
  otherNodes.forEach((node, idx) => {
    const count = otherNodes.length;
    const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
    const r = 60; // Quadrupled from original 15
    
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    
    // Validate before setting
    positions.set(node.id, [
      isFinite(x) ? x : 0,
      isFinite(y) ? y : 0,
      isFinite(z) ? z : 0
    ]);
  });
  
  // Identify hub nodes (largest node is primary hub)
  const isHub = (node: NodeStateV2) => node.id === largestNode.id;
  
  // Force-directed iterations
  const iterations = 150;         // More iterations for better settling
  const springStrength = 0.5;     // Stronger pull for connected nodes
  const repulsionStrength = 40;   // Less repulsion to keep cluster tight
  const centerPull = 0.08;        // Stronger pull toward center
  const damping = 0.85;           // Higher damping for stability
  
  const velocities = new Map<string, [number, number, number]>();
  nodeArray.forEach(node => velocities.set(node.id, [0, 0, 0]));
  
  for (let iter = 0; iter < iterations; iter++) {
    // Apply forces
    nodeArray.forEach(nodeA => {
      const posA = positions.get(nodeA.id)!;
      const velA = velocities.get(nodeA.id)!;
      let [fx, fy, fz] = [0, 0, 0];
      
      nodeArray.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return;
        
        const posB = positions.get(nodeB.id)!;
        const dx = posB[0] - posA[0];
        const dy = posB[1] - posA[1];
        const dz = posB[2] - posA[2];
        const distSq = dx*dx + dy*dy + dz*dz;
        const dist = Math.sqrt(distSq) || 0.1; // Avoid division by zero, use 0.1 minimum
        
        // Check if nodes are connected (this is a simplified check - in real impl would use edge data)
        const connected = nodeA.id.includes('llm') && nodeB.id.includes('tool') ||
                         nodeA.id.includes('router') && nodeB.id.includes('llm') ||
                         nodeB.id.includes('llm') && nodeA.id.includes('tool') ||
                         nodeB.id.includes('router') && nodeA.id.includes('llm');
        
        if (connected) {
          // Spring attraction: pull connected nodes together
          // If nodeB is llm_gateway, use larger target distance to create space
          const isLLMGateway = nodeB.id.includes('llm_gateway');
          const targetDist = isLLMGateway ? 160 : 36; // Large orbit around llm_gateway, quadrupled spacing
          const force = springStrength * (dist - targetDist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
          fz += (dz / dist) * force;
        } else {
          // Coulomb repulsion: push unconnected nodes apart
          const force = repulsionStrength / (dist * dist);
          fx -= (dx / dist) * force;
          fy -= (dy / dist) * force;
          fz -= (dz / dist) * force;
        }
      });
      
      // Pull hub nodes toward center for nucleus formation
      if (isHub(nodeA)) {
        fx -= posA[0] * centerPull;
        fy -= posA[1] * centerPull;
        fz -= posA[2] * centerPull;
      }
      
      // Pull ALL nodes toward center to keep cluster compact
      const distFromCenter = Math.sqrt(posA[0]*posA[0] + posA[1]*posA[1] + posA[2]*posA[2]);
      if (distFromCenter > 120) { // If too far from center, pull back (quadrupled from 30)
        const pullStrength = 0.3 * (distFromCenter - 120) / distFromCenter;
        fx -= posA[0] * pullStrength;
        fy -= posA[1] * pullStrength;
        fz -= posA[2] * pullStrength;
      }
      
      // Safety check: ensure forces are valid numbers
      if (!isFinite(fx)) fx = 0;
      if (!isFinite(fy)) fy = 0;
      if (!isFinite(fz)) fz = 0;
      
      // Clamp forces to prevent extreme values
      const maxForce = 50;
      fx = Math.max(-maxForce, Math.min(maxForce, fx));
      fy = Math.max(-maxForce, Math.min(maxForce, fy));
      fz = Math.max(-maxForce, Math.min(maxForce, fz));
      
      // Update velocity and position
      velA[0] = (velA[0] + fx) * damping;
      velA[1] = (velA[1] + fy) * damping;
      velA[2] = (velA[2] + fz) * damping;
      
      // Safety check: ensure velocities are valid
      if (!isFinite(velA[0])) velA[0] = 0;
      if (!isFinite(velA[1])) velA[1] = 0;
      if (!isFinite(velA[2])) velA[2] = 0;
      
      // Clamp velocities to prevent runaway motion
      const maxVel = 20;
      velA[0] = Math.max(-maxVel, Math.min(maxVel, velA[0]));
      velA[1] = Math.max(-maxVel, Math.min(maxVel, velA[1]));
      velA[2] = Math.max(-maxVel, Math.min(maxVel, velA[2]));
      
      posA[0] += velA[0];
      posA[1] += velA[1];
      posA[2] += velA[2];
      
      // Safety check: ensure positions are valid
      if (!isFinite(posA[0])) posA[0] = 0;
      if (!isFinite(posA[1])) posA[1] = 0;
      if (!isFinite(posA[2])) posA[2] = 0;
      
      // Clamp positions to reasonable bounds to prevent extreme values
      const maxPos = 500;
      posA[0] = Math.max(-maxPos, Math.min(maxPos, posA[0]));
      posA[1] = Math.max(-maxPos, Math.min(maxPos, posA[1]));
      posA[2] = Math.max(-maxPos, Math.min(maxPos, posA[2]));
    });
  }
  
  // Apply final positions with validation
  nodeArray.forEach(node => {
    const pos = positions.get(node.id)!;
    // Final safety check
    const safePos: [number, number, number] = [
      isFinite(pos[0]) ? pos[0] : 0,
      isFinite(pos[1]) ? pos[1] : 0,
      isFinite(pos[2]) ? pos[2] : 0
    ];
    result.set(node.id, { ...node, position: safePos });
  });
  
  return result;
}

/**
 * Compute clustered layout for LOD (far zoom)
 * Groups nodes by subsystem into single cluster nodes
 */
export function computeClusteredLayout(nodes: Map<string, NodeStateV2>): Map<string, NodeStateV2> {
  const clusters = new Map<string, NodeStateV2>();
  
  // Group by subsystem
  const bySubsystem = new Map<NodeSubsystem, NodeStateV2[]>();
  
  nodes.forEach((node) => {
    if (!bySubsystem.has(node.subsystem)) {
      bySubsystem.set(node.subsystem, []);
    }
    bySubsystem.get(node.subsystem)!.push(node);
  });
  
  // Create cluster node for each subsystem
  bySubsystem.forEach((nodeList, subsystem) => {
    if (nodeList.length === 0) return;
    
    // Aggregate metrics
    const totalThroughput = nodeList.reduce((sum, n) => sum + n.throughput, 0);
    const avgLatency = nodeList.reduce((sum, n) => sum + n.latencyMsAvg, 0) / nodeList.length;
    const maxUtilization = Math.max(...nodeList.map(n => n.utilization));
    const latestEvent = Math.max(...nodeList.map(n => n.lastEventTs));
    
    // Cluster position at center (can be enhanced with proper layout)
    clusters.set(`cluster_${subsystem}`, {
      id: `cluster_${subsystem}`,
      label: `${subsystem} (${nodeList.length} nodes)`,
      subsystem,
      position: [0, 0, 0],
      throughput: totalThroughput,
      latencyMsAvg: avgLatency,
      queueDepth: 0,
      utilization: maxUtilization,
      lastEventTs: latestEvent,
      state: maxUtilization > 0.7 ? 'overloaded' : maxUtilization > 0.1 ? 'active' : 'idle',
    });
  });
  
  return clusters;
}

/**
 * Interpolate between clustered and full layout based on zoom distance
 */
export function interpolateLayout(
  fullLayout: Map<string, NodeStateV2>,
  clusteredLayout: Map<string, NodeStateV2>,
  zoomFactor: number // 0 = far (clustered), 1 = near (full)
): Map<string, NodeStateV2> {
  if (zoomFactor >= 0.8) return fullLayout;
  if (zoomFactor <= 0.2) return clusteredLayout;
  
  // In transition zone, blend layouts
  // For simplicity, return full layout (can be enhanced with actual interpolation)
  return fullLayout;
}
