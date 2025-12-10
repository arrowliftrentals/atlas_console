// NeuralTelemetryStoreV2.ts
// Zustand store for managing telemetry state in V2 visualization

import { create } from 'zustand';
import { TelemetryEventV2, NodeStateV2, EdgeStateV2 } from './NeuralTelemetryTypesV2';
import { computeNodeStateFromEvent, computeEdgeStateFromEvent, decayNodeActivity } from './NeuralTelemetryUtilsV2';

interface ParticleProgress {
  sourceId: string;
  targetId: string;
  progress: number; // 0 to 1
  timestamp: number;
}

interface NeuralTelemetryStoreState {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, EdgeStateV2>;
  particleEvents: TelemetryEventV2[];
  activeParticles: Map<string, ParticleProgress[]>; // nodeId -> particles affecting it
  lastUpdateTs: number;
  
  // Actions
  ingestEvents: (events: TelemetryEventV2[]) => void;
  updateParticleProgress: (particles: { sourceId: string; targetId: string; progress: number }[]) => void;
  clearParticleEvents: () => void;
  decayActivityPeriodically: () => void;
  resetState: () => void;
}

export const useNeuralTelemetryStoreV2 = create<NeuralTelemetryStoreState>((set, get) => ({
  nodes: new Map(),
  edges: new Map(),
  particleEvents: [],
  activeParticles: new Map(),
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

  updateParticleProgress: (particles) => {
    const activeParticles = new Map<string, ParticleProgress[]>();
    const now = Date.now();
    
    for (const p of particles) {
      // Track for source node (always active)
      if (!activeParticles.has(p.sourceId)) {
        activeParticles.set(p.sourceId, []);
      }
      activeParticles.get(p.sourceId)!.push({
        sourceId: p.sourceId,
        targetId: p.targetId,
        progress: p.progress,
        timestamp: now,
      });
      
      // Track for target node (only if progress >= 50%)
      if (p.progress >= 0.5) {
        if (!activeParticles.has(p.targetId)) {
          activeParticles.set(p.targetId, []);
        }
        activeParticles.get(p.targetId)!.push({
          sourceId: p.sourceId,
          targetId: p.targetId,
          progress: p.progress,
          timestamp: now,
        });
      }
    }
    
    set({ activeParticles });
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
    activeParticles: new Map(),
    lastUpdateTs: performance.now(),
  }),
}));

// Auto-decay activity every 2 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    useNeuralTelemetryStoreV2.getState().decayActivityPeriodically();
  }, 2000);
}
