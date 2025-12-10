// NeuralTelemetryTypesV2.ts
// Type definitions for Atlas Neural 3D Visualization V2

export type TelemetryEventType =
  | 'data_transfer'
  | 'token_flow'
  | 'memory_read'
  | 'memory_write'
  | 'vector_retrieval'
  | 'plugin_invocation'
  | 'external_api_call'
  | 'agent_communication'
  | 'telemetry_metric';

export interface TelemetryEventV2 {
  source: string;
  target: string;
  type: TelemetryEventType;
  bytes?: number;
  timestamp: number;      // ms
  latency_ms?: number;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
  // Trace hierarchy (visual differentiation)
  is_parent_trace?: boolean;  // True for root traces, false for child traces
  spawn_count?: number;       // How many operations this decision spawned (1 = single, 3+ = multi-tool)
}

export type NodeSubsystem =
  | 'llm_core'
  | 'working_memory'
  | 'long_term_memory'
  | 'vector_db'
  | 'embedding_pipeline'
  | 'plugin_agent'
  | 'io_interface'
  | 'external_dependency'
  | 'internal_service'
  | 'background_process';

export type NodeStateType = 'active' | 'idle' | 'overloaded' | 'blocked' | 'error';

export interface NodeStateV2 {
  id: string;
  label: string;
  subsystem: NodeSubsystem;
  position: [number, number, number];
  throughput: number;        // bytes/sec or events/sec
  latencyMsAvg: number;
  queueDepth: number;
  utilization: number;       // 0..1
  lastEventTs: number;
  state: NodeStateType;
}

export interface EdgeStateV2 {
  id: string;
  sourceId: string;
  targetId: string;
  bandwidthUtilization: number; // 0..1
  lastEventType?: TelemetryEventType;
  lastEventTs: number;
  isHighlighted: boolean;
}

export interface ParticleInstanceV2 {
  id: number;           // index in instanced buffer
  sourceId: string;
  targetId: string;
  t: number;            // 0..1 along edge
  speed: number;
  color: number[];       // RGB
  size: number;
  trailLength: number;
}
