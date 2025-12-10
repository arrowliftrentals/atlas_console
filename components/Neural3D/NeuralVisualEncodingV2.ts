// NeuralVisualEncodingV2.ts
// Color palettes and visual encoding mappings for V2

import { NodeSubsystem, TelemetryEventType } from './NeuralTelemetryTypesV2';
import { CognitiveRegion } from './NeuralCognitiveLayoutV2';

// Cognitive region colors (base tints for the three shells)
export const REGION_COLORS: Record<CognitiveRegion, string> = {
  core: '#FFD700',       // Gold - brightest, central control
  memory: '#FF1493',     // Deep pink - memory systems
  perception: '#00CED1', // Dark turquoise - perception/tools
};

// Node colors by subsystem (enhanced with cognitive regions)
export const NODE_COLORS: Record<NodeSubsystem, string> = {
  llm_core: '#FFD700',           // gold - core processor (CORE REGION)
  working_memory: '#FF69B4',     // hot pink (MEMORY REGION)
  long_term_memory: '#FF1493',   // deep pink (MEMORY REGION)
  vector_db: '#FF6B9D',          // pink-coral (MEMORY REGION - stores)
  embedding_pipeline: '#FF83A8', // light pink (MEMORY REGION - processing)
  plugin_agent: '#20B2AA',       // light sea green (PERCEPTION REGION)
  io_interface: '#00CED1',       // dark turquoise (PERCEPTION REGION)
  external_dependency: '#5F9EA0', // cadet blue (PERCEPTION REGION)
  internal_service: '#40E0D0',   // turquoise (PERCEPTION REGION)
  background_process: '#48D1CC', // medium turquoise (PERCEPTION REGION)
};

// Edge colors by event type (from spec)
export const EDGE_COLORS_BY_EVENT: Record<TelemetryEventType, string> = {
  data_transfer: '#3B82F6',        // blue
  token_flow: '#3B82F6',           // blue
  memory_read: '#10B981',          // green
  memory_write: '#10B981',         // green
  vector_retrieval: '#F59E0B',     // gold
  plugin_invocation: '#8B5CF6',    // purple
  external_api_call: '#8B5CF6',    // purple
  agent_communication: '#3B82F6',  // blue
  telemetry_metric: '#6B7280',     // gray
};

// Particle colors by event type (from spec)
export const PARTICLE_COLORS_BY_EVENT: Record<TelemetryEventType, string> = {
  data_transfer: '#3B82F6',        // blue - system messages
  token_flow: '#FFFFFF',           // white - high-priority
  memory_read: '#10B981',          // green
  memory_write: '#10B981',         // green
  vector_retrieval: '#F59E0B',     // gold - embedding/vector ops
  plugin_invocation: '#8B5CF6',    // purple
  external_api_call: '#8B5CF6',    // purple
  agent_communication: '#3B82F6',  // blue
  telemetry_metric: '#6B7280',     // gray
};

// State colors
export const STATE_COLORS: Record<string, string> = {
  active: '#10B981',      // green
  idle: '#6B7280',        // gray
  overloaded: '#F59E0B',  // orange
  blocked: '#EF4444',     // red
  error: '#DC2626',       // dark red
};
