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

// How long (ms) a node/edge stays "active" after its last particle finishes.
// This is the afterglow window that the lerp fades through.
const AFTERGLOW_MS = 4000;

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

    for (const ev of events) {
      const nodeUpdates = computeNodeStateFromEvent(nodes, ev);
      const edgeUpdates = computeEdgeStateFromEvent(edges, ev);
      
      nodeUpdates.forEach((v, k) => nodes.set(k, v));
      edgeUpdates.forEach((v, k) => edges.set(k, v));

      // Queue for particle emission (cap at 1000 to prevent memory issues)
      // Skip events marked for architecture loading only
      const shouldAddParticle = !ev.skipParticles && particleEvents.length < 1000;
      
      if (shouldAddParticle) {
        particleEvents.push(ev);
      }
    }

    set({
      nodes,
      edges,
      particleEvents,
      lastUpdateTs: performance.now(),
    });
  },

  updateParticleProgress: (particles) => {
    // MERGE into existing map (don't rebuild from scratch) so that
    // entries persist with their timestamps even after particles finish.
    // Stale entries are pruned in decayActivityPeriodically().
    const activeParticles = new Map(get().activeParticles);
    const now = Date.now();
    
    for (const p of particles) {
      // Track for source node (always active)
      const srcEntry: ParticleProgress = {
        sourceId: p.sourceId,
        targetId: p.targetId,
        progress: p.progress,
        timestamp: now,
      };
      activeParticles.set(p.sourceId, [srcEntry]);
      
      // Track for target node (only if progress >= 50%)
      if (p.progress >= 0.5) {
        const tgtEntry: ParticleProgress = {
          sourceId: p.sourceId,
          targetId: p.targetId,
          progress: p.progress,
          timestamp: now,
        };
        activeParticles.set(p.targetId, [tgtEntry]);
      }
    }
    
    set({ activeParticles });
  },

  clearParticleEvents: () => {
    const currentEvents = get().particleEvents.length;
    if (currentEvents === 0) return;
    
    // Just clear events - keep all edges (they represent the architecture)
    set({ particleEvents: [] });
  },

  decayActivityPeriodically: () => {
    const now = Date.now();
    const nodes = get().nodes;
    const updates = decayNodeActivity(nodes, now);
    
    if (updates.size > 0) {
      const newNodes = new Map(nodes);
      updates.forEach((v, k) => newNodes.set(k, v));
      set({ nodes: newNodes });
    }
    
    // Prune stale activeParticles entries (afterglow expired)
    const activeParticles = get().activeParticles;
    if (activeParticles.size > 0) {
      let pruned = false;
      const next = new Map(activeParticles);
      next.forEach((entries, nodeId) => {
        // Keep only entries younger than AFTERGLOW_MS
        const fresh = entries.filter(e => now - e.timestamp < AFTERGLOW_MS);
        if (fresh.length === 0) {
          next.delete(nodeId);
          pruned = true;
        } else if (fresh.length !== entries.length) {
          next.set(nodeId, fresh);
          pruned = true;
        }
      });
      if (pruned) {
        set({ activeParticles: next });
      }
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

// Auto-decay activity every 500ms (was 2s) with gentler per-tick factor
if (typeof window !== 'undefined') {
  setInterval(() => {
    useNeuralTelemetryStoreV2.getState().decayActivityPeriodically();
  }, 500);
}
