// NeuralTelemetryUtilsV2.ts
// Utility functions to update node/edge state from telemetry events

import { TelemetryEventV2, NodeStateV2, EdgeStateV2, NodeSubsystem } from './NeuralTelemetryTypesV2';
import { formatNodeLabel } from './NeuralCognitiveLayoutV2';

// Infer subsystem from node ID (improved from V1)
export function inferSubsystem(nodeId: string): NodeSubsystem {
  const id = nodeId.toLowerCase();
  
  // LLM core - includes routing/gateway nodes that are part of the LLM decision flow
  if (id.includes('llm') || id.includes('gpt') || id.includes('claude') || id.includes('openai') ||
      id.includes('agent_router') || id.includes('llm_gateway') || id.includes('llm_router')) {
    return 'llm_core';
  }
  
  // Memory layers
  if (id.includes('memory')) {
    if (id.includes('working') || id.includes('short')) return 'working_memory';
    if (id.includes('long') || id.includes('persistent')) return 'long_term_memory';
    return 'working_memory';
  }
  
  if (id.startsWith('l') && /l\d+/.test(id)) return 'working_memory';
  
  // Vector & embedding
  if (id.includes('vector') || id.includes('pinecone') || id.includes('chroma')) {
    return 'vector_db';
  }
  if (id.includes('embed')) return 'embedding_pipeline';
  
  // Plugins
  if (id.includes('plugin') || id.includes('agent')) return 'plugin_agent';
  
  // Storage
  if (id.includes('database') || id.includes('store') || id.includes('db')) {
    return 'vector_db';
  }
  
  // IO & interfaces (but exclude agent_router, llm_gateway which are core)
  if ((id.includes('router') || id.includes('gateway') || id.includes('api')) &&
      !id.includes('agent_router') && !id.includes('llm_gateway') && !id.includes('llm_router')) {
    return 'io_interface';
  }
  
  // External
  if (id.includes('external') || id.includes('http') || id.includes('client')) {
    return 'external_dependency';
  }
  
  // Background
  if (id.includes('background') || id.includes('worker') || id.includes('queue')) {
    return 'background_process';
  }
  
  // Default to internal service
  return 'internal_service';
}

// Update node states from a batch of events
// Only updates EXISTING nodes - does not create new ones from telemetry
export function computeNodeStateFromEvent(
  nodes: Map<string, NodeStateV2>,
  event: TelemetryEventV2
): Map<string, NodeStateV2> {
  const updates = new Map<string, NodeStateV2>();
  
  // Update source node (only if it exists in architecture)
  if (event.source) {
    const existing = nodes.get(event.source);
    
    if (existing) {
      updates.set(event.source, {
        ...existing,
        throughput: existing.throughput * 0.9 + (event.bytes || 100) * 0.1,
        latencyMsAvg: event.latency_ms || existing.latencyMsAvg,
        utilization: Math.min(1, existing.utilization * 0.95 + 0.05),
        lastEventTs: event.timestamp,
        state: 'active',
      });
    }
    // Don't create new nodes from telemetry - only update existing architecture nodes
  }
  
  // Update target node (only if it exists in architecture)
  if (event.target) {
    const existing = nodes.get(event.target);
    
    if (existing) {
      updates.set(event.target, {
        ...existing,
        throughput: existing.throughput * 0.9 + (event.bytes || 100) * 0.1,
        latencyMsAvg: event.latency_ms || existing.latencyMsAvg,
        utilization: Math.min(1, existing.utilization * 0.95 + 0.05),
        lastEventTs: event.timestamp,
        state: 'active',
      });
    }
    // Don't create new nodes from telemetry - only update existing architecture nodes
  }
  
  return updates;
}

// Update edge states from a batch of events
export function computeEdgeStateFromEvent(
  edges: Map<string, EdgeStateV2>,
  event: TelemetryEventV2
): Map<string, EdgeStateV2> {
  const updates = new Map<string, EdgeStateV2>();
  const edgeId = `${event.source}->${event.target}`;
  
  const existing = edges.get(edgeId);
  
  updates.set(edgeId, {
    id: edgeId,
    sourceId: event.source,
    targetId: event.target,
    bandwidthUtilization: Math.min(1, (existing?.bandwidthUtilization || 0) * 0.9 + 0.1),
    lastEventType: event.type,
    lastEventTs: event.timestamp,
    isHighlighted: existing?.isHighlighted || false,
  });
  
  return updates;
}

// Decay node activity over time (call periodically)
// Using a gentler factor (0.985 vs 0.95) and a longer grace period (3s vs 1s)
// so that activity fades smoothly rather than blinking off.
export function decayNodeActivity(nodes: Map<string, NodeStateV2>, now: number): Map<string, NodeStateV2> {
  // `now` MUST be Date.now() (epoch ms) — same time base as node.lastEventTs.
  const updates = new Map<string, NodeStateV2>();
  
  nodes.forEach((node) => {
    const age = now - node.lastEventTs;
    if (age > 5000) { // 5 seconds grace before decay starts
      updates.set(node.id, {
        ...node,
        utilization: node.utilization * 0.993, // very gentle decay
        state: node.utilization < 0.03 ? 'idle' : node.state,
      });
    }
  });
  
  return updates;
}

// Convert legacy V1 telemetry format to V2
export function convertV1ToV2(v1Event: any): TelemetryEventV2 | null {
  // Handle active_traces format from WebSocket
  if (!v1Event.spans || v1Event.spans.length === 0) return null;
  
  const sorted = [...v1Event.spans].sort((a: any, b: any) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  
  // Convert spans to events
  const events: TelemetryEventV2[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const source = sorted[i].component_id;
    const target = sorted[i + 1].component_id;
    
    if (!source || !target) continue;
    
    events.push({
      source,
      target,
      type: 'data_transfer', // Default type
      timestamp: Date.now(),
      bytes: 1024, // Default
      priority: 'normal',
    });
  }
  
  return events[0] || null;
}
