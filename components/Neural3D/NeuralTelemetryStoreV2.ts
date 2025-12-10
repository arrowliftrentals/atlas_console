// NeuralTelemetryStoreV2.ts
// Zustand store for managing telemetry state in V2 visualization

import { create } from 'zustand';
import { TelemetryEventV2, NodeStateV2, EdgeStateV2 } from './NeuralTelemetryTypesV2';
import { computeNodeStateFromEvent, computeEdgeStateFromEvent, decayNodeActivity } from './NeuralTelemetryUtilsV2';

interface NeuralTelemetryStoreState {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, EdgeStateV2>;
  particleEvents: TelemetryEventV2[];
  lastUpdateTs: number;
  
  // Actions
  ingestEvents: (events: TelemetryEventV2[]) => void;
  clearParticleEvents: () => void;
  decayActivityPeriodically: () => void;
  resetState: () => void;
}

export const useNeuralTelemetryStoreV2 = create<NeuralTelemetryStoreState>((set, get) => ({
  nodes: new Map(),
  edges: new Map(),
  particleEvents: [],
  lastUpdateTs: performance.now(),

  ingestEvents: (events) => {
    const nodes = new Map(get().nodes);
    const edges = new Map(get().edges);
    const particleEvents = get().particleEvents.slice();

    console.log('[STORE] ingestEvents called with', events.length, 'events');
    console.log('[STORE] Before:', nodes.size, 'nodes,', edges.size, 'edges');

    for (const ev of events) {
      const nodeUpdates = computeNodeStateFromEvent(nodes, ev);
      const edgeUpdates = computeEdgeStateFromEvent(edges, ev);
      
      nodeUpdates.forEach((v, k) => {
        nodes.set(k, v);
        console.log('[STORE] Added/updated node:', k, 'subsystem:', v.subsystem);
      });
      edgeUpdates.forEach((v, k) => edges.set(k, v));

      // Queue for particle emission (LOD manager will sample)
      particleEvents.push(ev);
    }

    console.log('[STORE] After:', nodes.size, 'nodes,', edges.size, 'edges');
    console.log('[STORE] Node IDs:', Array.from(nodes.keys()).join(', '));

    set({
      nodes,
      edges,
      particleEvents,
      lastUpdateTs: performance.now(),
    });
  },

  clearParticleEvents: () => {
    console.log('[STORE] clearParticleEvents called');
    set({ particleEvents: [] });
  },

  decayActivityPeriodically: () => {
    const now = performance.now();
    const nodes = get().nodes;
    const updates = decayNodeActivity(nodes, now);
    
    if (updates.size > 0) {
      const newNodes = new Map(nodes);
      updates.forEach((v, k) => newNodes.set(k, v));
      set({ nodes: newNodes });
    }
  },

  resetState: () => set({
    nodes: new Map(),
    edges: new Map(),
    particleEvents: [],
    lastUpdateTs: performance.now(),
  }),
}));

// Auto-decay activity every 2 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    useNeuralTelemetryStoreV2.getState().decayActivityPeriodically();
  }, 2000);
}
