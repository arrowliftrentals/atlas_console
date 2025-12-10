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
  memoryType?: 'episodic' | 'declarative' | 'procedural' | 'planning' | 'layered';
  perceptionType?: 'tools' | 'api' | 'telemetry' | 'console';
  importance: number; // 0-1, affects size and position
}

// Core radius settings
const CORE_RADIUS = 20;        // Central reasoning sphere
const MEMORY_RADIUS = 60;      // Memory shell
const PERCEPTION_RADIUS = 100; // Outer perception shell

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
 * Core: small central sphere
 * Memory: middle shell with latitude bands by memory type
 * Perception: outer shell with longitude sectors by perception type
 */
export function computeCognitiveLayout(nodes: Map<string, NodeStateV2>): Map<string, NodeStateV2> {
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
  
  // ========== CORE LAYOUT (tight central cluster) ==========
  
  if (coreNodes.length > 0) {
    // Find CoreLoop or most important core node for center
    const centerNode = coreNodes.find(c => c.node.id.toLowerCase().includes('coreloop')) || 
                       coreNodes.reduce((max, c) => c.metadata.importance > max.metadata.importance ? c : max);
    
    // Place center node at origin
    result.set(centerNode.node.id, {
      ...centerNode.node,
      position: [0, 0, 0]
    });
    
    // Place other core nodes in small sphere around center
    const otherCore = coreNodes.filter(c => c.node.id !== centerNode.node.id);
    otherCore.forEach((c, idx) => {
      const count = otherCore.length;
      const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
      const r = CORE_RADIUS * (0.7 + 0.3 * c.metadata.importance); // Vary by importance
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      result.set(c.node.id, {
        ...c.node,
        position: [x, y, z]
      });
    });
  }
  
  // ========== MEMORY LAYOUT (shell with latitude bands) ==========
  
  if (memoryNodes.length > 0) {
    // Group by memory type
    const episodicNodes = memoryNodes.filter(c => c.metadata.memoryType === 'episodic');
    const declarativeNodes = memoryNodes.filter(c => c.metadata.memoryType === 'declarative');
    const proceduralNodes = memoryNodes.filter(c => c.metadata.memoryType === 'procedural');
    const planningNodes = memoryNodes.filter(c => c.metadata.memoryType === 'planning');
    const layeredNodes = memoryNodes.filter(c => c.metadata.memoryType === 'layered');
    const vectorNodes = memoryNodes.filter(c => c.metadata.memoryType === 'vector');
    const storageNodes = memoryNodes.filter(c => c.metadata.memoryType === 'storage');
    
    // Latitude bands:
    // North pole (90°): Planning
    // 45° N: Declarative
    // Equator (0°): Episodic
    // -45° S: Procedural
    // South pole (-90°): Layered
    
    const placeMemoryBand = (
      nodes: typeof episodicNodes,
      latStart: number, // degrees
      latEnd: number,
      thetaOffset: number = 0 // longitude offset in radians
    ) => {
      nodes.forEach((c, idx) => {
        const count = nodes.length;
        
        // Distribute evenly around longitude with optional offset
        const theta = thetaOffset + (idx / count) * 2 * Math.PI;
        
        // Distribute within latitude band with deterministic jitter
        const latMid = (latStart + latEnd) / 2;
        const latRange = (latEnd - latStart) / 2;
        const latJitter = getStableJitter(c.node.id, 1) * latRange * 0.4; // Stable jitter
        const lat = (latMid + latJitter) * Math.PI / 180;
        
        const r = MEMORY_RADIUS * (0.9 + 0.2 * c.metadata.importance);
        
        const x = r * Math.cos(lat) * Math.cos(theta);
        const y = r * Math.sin(lat);
        const z = r * Math.cos(lat) * Math.sin(theta);
        
        result.set(c.node.id, {
          ...c.node,
          position: [x, y, z]
        });
      });
    };
    
    placeMemoryBand(planningNodes, 30, 50);              // Mid-upper (roadmap_router, task_store)
    placeMemoryBand(vectorNodes, 30, 50, Math.PI / 3);   // Mid-upper, offset 60° (vector_store)
    placeMemoryBand(storageNodes, 30, 50, Math.PI * 2 / 3); // Mid-upper, offset 120° (database)
    placeMemoryBand(declarativeNodes, 50, 70);   // Upper hemisphere
    placeMemoryBand(episodicNodes, -20, 30);     // Equator region
    placeMemoryBand(proceduralNodes, -50, -20);  // Lower hemisphere
    placeMemoryBand(layeredNodes, -90, -50);     // South pole region
  }
  
  // ========== PERCEPTION LAYOUT (outer shell with longitude sectors) ==========
  
  if (perceptionNodes.length > 0) {
    // Group by perception type
    const toolsNodes = perceptionNodes.filter(c => c.metadata.perceptionType === 'tools');
    const apiNodes = perceptionNodes.filter(c => c.metadata.perceptionType === 'api');
    const telemetryNodes = perceptionNodes.filter(c => c.metadata.perceptionType === 'telemetry');
    const consoleNodes = perceptionNodes.filter(c => c.metadata.perceptionType === 'console');
    
    // Longitude sectors (quadrants):
    // Sector 1 (0°-90°): Tools
    // Sector 2 (90°-180°): API
    // Sector 3 (180°-270°): Telemetry
    // Sector 4 (270°-360°): Console
    
    const placePerceptionSector = (
      nodes: typeof toolsNodes,
      thetaStart: number, // degrees
      thetaEnd: number
    ) => {
      nodes.forEach((c, idx) => {
        const count = nodes.length;
        
        // Distribute within sector with deterministic offset
        const thetaMid = (thetaStart + thetaEnd) / 2;
        const thetaRange = (thetaEnd - thetaStart) / 2;
        const thetaOffset = ((idx / count) - 0.5) * thetaRange * 1.5;
        const thetaJitter = getStableJitter(c.node.id, 2) * thetaRange * 0.2; // Stable jitter
        const theta = (thetaMid + thetaOffset + thetaJitter) * Math.PI / 180;
        
        // Distribute in latitude (spherical)
        const phi = Math.acos(1 - 2 * (idx + 0.5) / count);
        
        const r = PERCEPTION_RADIUS * (0.9 + 0.2 * c.metadata.importance);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);
        
        result.set(c.node.id, {
          ...c.node,
          position: [x, y, z]
        });
      });
    };
    
    placePerceptionSector(toolsNodes, 0, 90);       // Front-right
    placePerceptionSector(apiNodes, 90, 180);       // Back-right
    placePerceptionSector(telemetryNodes, 180, 270); // Back-left
    placePerceptionSector(consoleNodes, 270, 360);   // Front-left
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
