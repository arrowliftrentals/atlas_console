// NeuralCognitiveLayoutV2.ts
// Cognitively accurate 3D layout: Core → Memory → Perception
// Three concentric shells matching ATLAS cognitive architecture

import { NodeStateV2, NodeSubsystem } from './NeuralTelemetryTypesV2';

// Deterministic hash function for stable node positions
function hashNodeId(nodeId: string): number {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    const char = nodeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Get deterministic "random" value between -1 and 1 for a node
function getStableJitter(nodeId: string, seed: number = 0): number {
  const hash = hashNodeId(nodeId + seed);
  return (hash % 1000) / 500 - 1; // -1 to 1
}

/**
 * Cognitive region classification
 * Core: Central reasoning and control (innermost)
 * Memory: All memory systems (middle shell)
 * Perception: Tools, APIs, telemetry, console (outer shell)
 */
export type CognitiveRegion = 'core' | 'memory' | 'perception';

export interface CognitiveNodeMetadata {
  region: CognitiveRegion;
  memoryType?: 'episodic' | 'declarative' | 'procedural' | 'planning' | 'layered' | 'vector' | 'storage';
  perceptionType?: 'tools' | 'api' | 'telemetry' | 'console';
  importance: number; // 0-1, affects size and position
}

// Core radius settings - exported for use in other components
export const CORE_RADIUS = 20;        // Central reasoning sphere
export const MEMORY_RADIUS = 60;      // Memory shell
export const PERCEPTION_RADIUS = 100; // Outer perception shell

/**
 * Classify node into cognitive region based on ID/subsystem
 */
export function classifyNode(nodeId: string, subsystem: NodeSubsystem): CognitiveNodeMetadata {
  const id = nodeId.toLowerCase();
  
  // ========== CORE CONTROL & REASONING ==========
  
  // Core loop and phases
  if (id.includes('coreloop') || id.includes('loop_phases') || id === 'core_loop') {
    return { region: 'core', importance: 1.0 }; // Center of everything
  }
  
  // Agent profile and reasoning
  if (id.includes('agentprofile') || id.includes('agent_profile')) {
    return { region: 'core', importance: 0.9 };
  }
  if (id.includes('reasoningservice') || id.includes('reasoning_service')) {
    return { region: 'core', importance: 0.95 };
  }
  if (id.includes('reasoningtrace') || id.includes('reasoning_trace')) {
    return { region: 'core', importance: 0.85 };
  }
  
  // LLM routing and clients
  if (id.includes('agentrouter') || id.includes('agent_router') || id.includes('llm_router')) {
    return { region: 'core', importance: 0.9 };
  }
  if (id.includes('llm_gateway') || id.includes('llmgateway')) {
    return { region: 'core', importance: 0.9 };
  }
  if (id.includes('openaiclient') || id.includes('openai_client')) {
    return { region: 'core', importance: 0.7 };
  }
  if (id.includes('ollamaclient') || id.includes('ollama_client')) {
    return { region: 'core', importance: 0.7 };
  }
  if (id.includes('multiproviderclient') || id.includes('multi_provider')) {
    return { region: 'core', importance: 0.75 };
  }
  
  // ========== MEMORY SYSTEMS ==========
  
  // Episodic & session memory
  if (id.includes('sessionstore') || id.includes('session_store')) {
    return { region: 'memory', memoryType: 'episodic', importance: 0.8 };
  }
  if (id.includes('sessionservice') || id.includes('session_service')) {
    return { region: 'memory', memoryType: 'episodic', importance: 0.75 };
  }
  if (id.includes('db_session') || id.includes('session_message')) {
    return { region: 'memory', memoryType: 'episodic', importance: 0.6 };
  }
  if (id.includes('episodicstore') || id.includes('episodic_store')) {
    return { region: 'memory', memoryType: 'episodic', importance: 0.8 };
  }
  if (id.includes('episodicevent') || id.includes('episodic_event')) {
    return { region: 'memory', memoryType: 'episodic', importance: 0.6 };
  }
  
  // Declarative / semantic memory
  if (id.includes('declarativefact') || id.includes('declarative_fact')) {
    return { region: 'memory', memoryType: 'declarative', importance: 0.75 };
  }
  if (id.includes('knowledgechunk') || id.includes('knowledge_chunk')) {
    return { region: 'memory', memoryType: 'declarative', importance: 0.7 };
  }
  if (id.includes('ltdm') || id.includes('long_term_declarative')) {
    return { region: 'memory', memoryType: 'declarative', importance: 0.8 };
  }
  
  // Procedural / skills
  if (id.includes('proceduralstore') || id.includes('procedural_store')) {
    return { region: 'memory', memoryType: 'procedural', importance: 0.8 };
  }
  if (id.includes('proceduralskill') || id.includes('procedural_skill') || id.includes('skill_')) {
    return { region: 'memory', memoryType: 'procedural', importance: 0.75 };
  }
  if (id.includes('skillexecution') || id.includes('skill_execution')) {
    return { region: 'memory', memoryType: 'procedural', importance: 0.6 };
  }
  
  // Planning & roadmaps
  if (id.includes('roadmap') && !id.includes('event')) {
    return { region: 'memory', memoryType: 'planning', importance: 0.8 };
  }
  if (id.includes('roadmapitem') || id.includes('roadmap_item')) {
    return { region: 'memory', memoryType: 'planning', importance: 0.7 };
  }
  if (id.includes('roadmapevent') || id.includes('roadmap_event')) {
    return { region: 'memory', memoryType: 'planning', importance: 0.6 };
  }
  if (id.includes('taskstore') || id.includes('task_store')) {
    return { region: 'memory', memoryType: 'planning', importance: 0.75 };
  }
  
  // Layered memory abstractions
  if (id.includes('layeredmemory') || id.includes('layered_memory')) {
    return { region: 'memory', memoryType: 'layered', importance: 0.85 };
  }
  if (id.includes('memorylayers') || id.includes('memory_layers')) {
    return { region: 'memory', memoryType: 'layered', importance: 0.8 };
  }
  if (id.match(/l[7-9]|l10/i) && (id.includes('layer') || id.includes('world') || id.includes('goal') || id.includes('social') || id.includes('governance'))) {
    return { region: 'memory', memoryType: 'layered', importance: 0.75 };
  }
  
  // Vector stores & databases
  if (id.includes('vector') || id.includes('pinecone') || id.includes('chroma')) {
    return { region: 'memory', memoryType: 'vector', importance: 0.75 };
  }
  if (id.includes('database') || id.includes('db_') || id.includes('store')) {
    return { region: 'memory', memoryType: 'storage', importance: 0.7 };
  }
  
  // Generic memory
  if (id.includes('memory') || subsystem === 'working_memory' || subsystem === 'long_term_memory') {
    return { region: 'memory', memoryType: 'episodic', importance: 0.7 };
  }
  
  // ========== PERCEPTION & TOOLS ==========
  
  // File operations
  if (id.includes('fileops') || id.includes('file_ops') || 
      id.includes('list_files') || id.includes('read_file') || 
      id.includes('write_file') || id.includes('apply_patch')) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.6 };
  }
  
  // Execution tools
  if (id.includes('execute_python') || id.includes('execute_shell') || 
      id.includes('execution') || id.includes('shell_command')) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.65 };
  }
  
  // Workspace & git
  if (id.includes('workspace') || id.includes('git_status') || id.includes('git')) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.6 };
  }
  
  // Testing
  if (id.includes('test') && (id.includes('coverage') || id.includes('pytest') || id.includes('check'))) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.6 };
  }
  
  // Vector & standards
  if (id.includes('ingest_document') || id.includes('ingest_standard') || 
      id.includes('search_standards') || id.includes('vector')) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.65 };
  }
  
  // Academic/web
  if (id.includes('academic') || id.includes('paper') || id.includes('doi') || id.includes('web_search')) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.6 };
  }
  
  // Console operations
  if (id.includes('consolepatch') || id.includes('console_patch')) {
    return { region: 'perception', perceptionType: 'tools', importance: 0.6 };
  }
  
  // Routers & API layer
  if (id.includes('router') && !id.includes('agent')) {
    return { region: 'perception', perceptionType: 'api', importance: 0.7 };
  }
  if (id.includes('api') || id.includes('endpoint')) {
    return { region: 'perception', perceptionType: 'api', importance: 0.65 };
  }
  if (id.includes('files_router') || id.includes('sessions_router') || 
      id.includes('skills_router') || id.includes('tools_router')) {
    return { region: 'perception', perceptionType: 'api', importance: 0.65 };
  }
  
  // Telemetry & observability
  if (id.includes('telemetrytracer') || id.includes('telemetry_tracer')) {
    return { region: 'perception', perceptionType: 'telemetry', importance: 0.7 };
  }
  if (id.includes('telemetrymetrics') || id.includes('telemetry_metrics')) {
    return { region: 'perception', perceptionType: 'telemetry', importance: 0.7 };
  }
  if (id.includes('telemetryanalyzer') || id.includes('telemetry_analyzer')) {
    return { region: 'perception', perceptionType: 'telemetry', importance: 0.65 };
  }
  if (id.includes('observability') || id.includes('metrics')) {
    return { region: 'perception', perceptionType: 'telemetry', importance: 0.65 };
  }
  if (id.includes('telemetrymiddleware') || id.includes('telemetry_middleware')) {
    return { region: 'perception', perceptionType: 'telemetry', importance: 0.6 };
  }
  
  // Console & UI
  if (id.includes('consoleapp') || id.includes('console_app')) {
    return { region: 'perception', perceptionType: 'console', importance: 0.75 };
  }
  if (id.includes('telemetrycontext') || id.includes('telemetry_context')) {
    return { region: 'perception', perceptionType: 'console', importance: 0.7 };
  }
  if (id.includes('threescene') || id.includes('neural3d')) {
    return { region: 'perception', perceptionType: 'console', importance: 0.7 };
  }
  
  // Default: perception/tools for unknown nodes
  return { region: 'perception', perceptionType: 'tools', importance: 0.5 };
}

/**
 * Compute cognitive layout positions
 * Nodes ordered along helical path to minimize straight-line connection distances
 */
export function computeCognitiveLayout(nodes: Map<string, NodeStateV2>, edges?: Map<string, any>): Map<string, NodeStateV2> {
  const result = new Map<string, NodeStateV2>();
  
  if (nodes.size === 0) return result;
  
  // Classify all nodes
  const nodeArray = Array.from(nodes.values());
  const classified = nodeArray.map(node => ({
    node,
    metadata: classifyNode(node.id, node.subsystem)
  }));
  
  // Separate by region
  const coreNodes = classified.filter(c => c.metadata.region === 'core');
  const memoryNodes = classified.filter(c => c.metadata.region === 'memory');
  const perceptionNodes = classified.filter(c => c.metadata.region === 'perception');
  
  // ========== OPTIMIZE NODE ORDERING TO MINIMIZE DISTANCES ==========
  
  const optimizeNodeOrder = (nodeList: typeof memoryNodes, shellRadius: number): typeof memoryNodes => {
    if (!edges || nodeList.length <= 1) return nodeList;
    
    // Build adjacency list with all connections (same-shell and cross-shell)
    const connections = new Map<string, Set<string>>();
    nodeList.forEach(n => connections.set(n.node.id, new Set()));
    
    // Add all edges involving nodes in this shell
    if (edges) {
      edges.forEach((edge: any) => {
        const srcInShell = nodeList.find(n => n.node.id === edge.sourceId);
        const dstInShell = nodeList.find(n => n.node.id === edge.targetId);
        
        // If source is in this shell, record the connection
        if (srcInShell) {
          connections.get(srcInShell.node.id)!.add(edge.targetId);
        }
        // If destination is in this shell, record the connection
        if (dstInShell) {
          connections.get(dstInShell.node.id)!.add(edge.sourceId);
        }
      });
    }
    
    // Greedy TSP-like algorithm: order nodes to minimize total path length
    // Start with the most connected node
    const ordered: typeof memoryNodes = [];
    const remaining = new Set(nodeList);
    
    // Find starting node (most connected)
    let maxConnections = 0;
    let startNode = nodeList[0];
    nodeList.forEach(n => {
      const connCount = connections.get(n.node.id)!.size;
      if (connCount > maxConnections) {
        maxConnections = connCount;
        startNode = n;
      }
    });
    
    ordered.push(startNode);
    remaining.delete(startNode);
    
    // Greedily add nodes that minimize total connection distance
    while (remaining.size > 0) {
      let bestNode = null;
      let bestScore = -Infinity;
      
      remaining.forEach(candidate => {
        let score = 0;
        const candidateConnections = connections.get(candidate.node.id)!;
        
        // Score based on:
        // 1. Connections to already-placed nodes (prefer neighbors of recently placed)
        // 2. High connectivity (prefer hubs)
        // 3. Proximity in the sequence
        
        ordered.forEach((placedNode, index) => {
          // Check if candidate connects to this placed node
          if (candidateConnections.has(placedNode.node.id)) {
            // Recent placements get higher weight (prefer sequential neighbors)
            const recencyWeight = index === ordered.length - 1 ? 10 : 
                                  index === ordered.length - 2 ? 5 : 1;
            score += recencyWeight;
          }
        });
        
        // Bonus for highly connected nodes (hubs should be central)
        score += candidateConnections.size * 0.1;
        
        if (score > bestScore) {
          bestScore = score;
          bestNode = candidate;
        }
      });
      
      // If no connected nodes found, pick the most connected remaining node
      if (bestScore <= 0) {
        let maxConn = 0;
        remaining.forEach(n => {
          const connCount = connections.get(n.node.id)!.size;
          if (connCount > maxConn) {
            maxConn = connCount;
            bestNode = n;
          }
        });
      }
      
      if (bestNode) {
        ordered.push(bestNode);
        remaining.delete(bestNode);
      } else {
        // Fallback: add any remaining node
        const next = remaining.values().next().value;
        if (next) {
          ordered.push(next);
          remaining.delete(next);
        }
      }
    }
    
    return ordered;
  };
  
  console.log('[COGNITIVE LAYOUT] Three-shell architecture initialized:', {
    total: nodeArray.length,
    core: coreNodes.length,
    memory: memoryNodes.length,
    perception: perceptionNodes.length
  });
  
  // Log region details for debugging
  if (coreNodes.length > 0) {
    console.log('[CORE REGION]', coreNodes.map(c => c.node.id).join(', '));
  }
  if (memoryNodes.length > 0) {
    console.log('[MEMORY REGION] Types:', {
      episodic: memoryNodes.filter(c => c.metadata.memoryType === 'episodic').length,
      declarative: memoryNodes.filter(c => c.metadata.memoryType === 'declarative').length,
      procedural: memoryNodes.filter(c => c.metadata.memoryType === 'procedural').length,
      planning: memoryNodes.filter(c => c.metadata.memoryType === 'planning').length,
      layered: memoryNodes.filter(c => c.metadata.memoryType === 'layered').length,
    });
  }
  if (perceptionNodes.length > 0) {
    console.log('[PERCEPTION REGION] Types:', {
      tools: perceptionNodes.filter(c => c.metadata.perceptionType === 'tools').length,
      api: perceptionNodes.filter(c => c.metadata.perceptionType === 'api').length,
      telemetry: perceptionNodes.filter(c => c.metadata.perceptionType === 'telemetry').length,
      console: perceptionNodes.filter(c => c.metadata.perceptionType === 'console').length,
    });
  }
  
  // ========== HELICAL LINE PLACEMENT ==========
  // All nodes on each shell follow a single helical path from 85°N,5°W to 85°S,5°E
  
  // Helper: Calculate position on helical line
  const getHelicalPosition = (index: number, total: number, radius: number): [number, number, number] => {
    const t = index / Math.max(total - 1, 1); // 0 to 1
    
    // Latitude: 85°N to 85°S (graceful continuous slope)
    const latStart = 85 * Math.PI / 180;  // 85°N
    const latEnd = -85 * Math.PI / 180;   // 85°S
    const lat = latStart + (latEnd - latStart) * t;
    
    // Longitude: spiral from 5°W to 5°E with one complete wrap
    const lonStart = -5 * Math.PI / 180; // 5°W
    const lonEnd = 5 * Math.PI / 180;    // 5°E
    const helixRotations = 1; // One complete wrap around the sphere
    const lon = lonStart + (lonEnd - lonStart) * t + (t * helixRotations * 2 * Math.PI);
    
    // Convert spherical to Cartesian
    const x = radius * Math.cos(lat) * Math.cos(lon);
    const y = radius * Math.sin(lat);
    const z = radius * Math.cos(lat) * Math.sin(lon);
    
    return [x, y, z];
  };
  
  // ========== CORE LAYOUT (optimized helical line) ==========
  
  if (coreNodes.length > 0) {
    const orderedCore = optimizeNodeOrder(coreNodes, CORE_RADIUS);
    orderedCore.forEach((c, idx) => {
      const pos = getHelicalPosition(idx, orderedCore.length, CORE_RADIUS);
      result.set(c.node.id, {
        ...c.node,
        position: pos
      });
    });
  }
  
  // ========== MEMORY LAYOUT (optimized helical line) ==========
  
  if (memoryNodes.length > 0) {
    const orderedMemory = optimizeNodeOrder(memoryNodes, MEMORY_RADIUS);
    orderedMemory.forEach((c, idx) => {
      const pos = getHelicalPosition(idx, orderedMemory.length, MEMORY_RADIUS);
      result.set(c.node.id, {
        ...c.node,
        position: pos
      });
    });
  }
  
  // ========== PERCEPTION LAYOUT (optimized helical line) ==========
  
  if (perceptionNodes.length > 0) {
    const orderedPerception = optimizeNodeOrder(perceptionNodes, PERCEPTION_RADIUS);
    orderedPerception.forEach((c, idx) => {
      const pos = getHelicalPosition(idx, orderedPerception.length, PERCEPTION_RADIUS);
      result.set(c.node.id, {
        ...c.node,
        position: pos
      });
    });
  }
  
  return result;
}

/**
 * Get visual hints for cognitive mode
 * Returns which nodes/edges should be highlighted for different modes
 */
export interface CognitiveModeHighlights {
  activeNodes: Set<string>;
  activeEdgeTypes: Set<string>;
  particleMultiplier: number;
}

export function getCognitiveModeHighlights(mode: 'planning' | 'execution' | 'learning' | 'idle'): CognitiveModeHighlights {
  switch (mode) {
    case 'planning':
      return {
        activeNodes: new Set(['reasoningservice', 'roadmap', 'layeredmemory', 'l8_goals']),
        activeEdgeTypes: new Set(['planning', 'goal_setting']),
        particleMultiplier: 1.5
      };
    
    case 'execution':
      return {
        activeNodes: new Set(['agentrouter', 'fileops', 'execute_python', 'apply_patch']),
        activeEdgeTypes: new Set(['tool_call', 'file_operation']),
        particleMultiplier: 2.0
      };
    
    case 'learning':
      return {
        activeNodes: new Set(['episodicstore', 'declarativefact', 'proceduralskill', 'metacognitive']),
        activeEdgeTypes: new Set(['memory_write', 'skill_update']),
        particleMultiplier: 1.3
      };
    
    case 'idle':
    default:
      return {
        activeNodes: new Set(),
        activeEdgeTypes: new Set(),
        particleMultiplier: 0.5
      };
  }
}
