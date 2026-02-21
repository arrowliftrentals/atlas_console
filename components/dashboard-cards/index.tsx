"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { z } from "zod";

// =============================================================================
// INLINE TOOLTIP COMPONENT
// =============================================================================

interface InlineTooltipProps {
  children: React.ReactNode;
  tip: string;
}

/**
 * Lightweight inline tooltip for individual metrics/labels within cards.
 * Hover on the wrapped element to show a small explanation.
 */
export function InlineTooltip({ children, tip }: InlineTooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);

  const onEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Position tooltip below and centered on the element
    setCoords({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
    timerRef.current = window.setTimeout(() => setShow(true), 350);
  };

  const onLeave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <>
      <span
        className="cursor-help border-b border-dotted border-white/20 hover:border-white/40 transition-colors"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </span>
      {show && typeof document !== 'undefined' && (
        ReactDOM.createPortal(
          <div
            className="fixed z-[99999] max-w-xs px-2.5 py-1.5 rounded-md border border-white/20 bg-[#18181b]/95 backdrop-blur-sm shadow-xl text-[11px] text-white/80 leading-snug"
            style={{
              top: coords.y,
              left: coords.x,
              transform: 'translateX(-50%)',
            }}
          >
            {tip}
          </div>,
          document.body
        )
      )}
    </>
  );
}

// =============================================================================
// TYPES
// =============================================================================

export interface ClassifierStats {
  intent_predictions: number;
  domain_predictions: number;
  total_predictions: number;
  avg_inference_time_ms: number;
  cache_hit_rate: number;
  intent_classifier_loaded: boolean;
  domain_classifier_loaded: boolean;
}

export interface LearningStats {
  total_corrections: number;
  confirmations: number;
  actual_corrections: number;
  corrections_since_training: number;
  needs_retraining: boolean;
  retraining_threshold: number;
  corrections_by_intent: Record<string, number>;
}

// Canonical, normalized types exposed to components
export interface ExecutionTrace {
  trace_id: string;
  start_time: string;
  end_time: string | null;
  duration_ms: number;
  spans: {
    component_id: string;
    start_time: string;
    duration_ms: number;
    success: boolean;
  }[];
  status: "success" | "error";
}

export interface HotPath {
  path: string;
  call_count: number;
  avg_time_ms: number;
  total_time_ms: number;
}

// Canonical shapes returned by hooks after normalization
export type CanonicalHotPath = { label: string; calls: number; avgMs?: number };
export type CanonicalWorldSnapshot = { component: string; state: unknown; timestamp: string };

export interface DatabaseHealthResult {
  layer: string;
  status: "healthy" | "degraded" | "corrupted";
  size_mb: number;
  integrity_ok: boolean;
  row_counts: Record<string, number>;
}

export interface DatabaseHealthSummary {
  all_healthy: boolean;
  total_databases: number;
  healthy_count: number;
  corrupted_count: number;
  oversized_count: number;
  total_size_mb: number;
  corrupted: string[];
  oversized: string[];
  results: DatabaseHealthResult[];
}

export interface SafetyStats {
  total_executions: number;
  by_mode: Record<string, number>;
  by_status: Record<string, number>;
  total_rollbacks: number;
  total_blocked: number;
  sandbox_available: boolean;
}

export interface AttentionFocus {
  primary_target: string | null;
  secondary_targets: string[];
  attention_weights: Record<string, number>;
}

export interface Goal {
  id: string;
  description: string;
  status: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

export type CanonicalGoal = {
  id: string;
  description: string;
  status: 'completed' | 'in_progress' | 'blocked' | 'pending' | 'unknown';
  progress: number; // 0..100
};

export interface Skill {
  id: string;
  name: string;
  category: string;
  success_rate: number;
  execution_count: number;
}

// Canonical types exposed by hooks (UI-safe)
export type CanonicalSkill = {
  id: string;
  name: string;
  category: string;
  successRate: number; // 0..100
  executionCount: number;
};

export interface WorldSnapshot {
  component: string;
  state: Record<string, unknown>;
  timestamp: string;
}

export interface Episode {
  id: string;
  event_type: string;
  session_id: string;
  context: Record<string, unknown>;
  timestamp: string;
}

export interface Fact {
  id: string;
  content: string;
  category: string;
  confidence: number;
  source: string;
  created_at: string;
}

export type CanonicalFact = {
  id: string;
  content: string;
  category: string;
  confidencePct: number; // 0..100
};

// =============================================================================
// DATA HOOKS
// =============================================================================

export function useClassifierStats(): { data: ClassifierStats | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<ClassifierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/v1/classify/stats");
        if (res.ok) {
          setData(await res.json());
        } else if (res.status === 503) {
          setData({
            intent_predictions: 0,
            domain_predictions: 0,
            total_predictions: 0,
            avg_inference_time_ms: 0,
            cache_hit_rate: 0,
            intent_classifier_loaded: false,
            domain_classifier_loaded: false,
          });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useLearningStats(): { data: LearningStats | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/v1/learning/corrections/stats");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useExecutionTraces(limit = 20): { data: ExecutionTrace[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<ExecutionTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/telemetry/traces/recent?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          setData(json.traces || []);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

// Runtime schemas
const HotPathASchema = z.object({
  path: z.string(),
  call_count: z.number().optional(),
  avg_time_ms: z.number().optional(),
});
const HotPathBSchema = z.object({
  source: z.string(),
  target: z.string(),
  count: z.number(),
});
const HotPathsResponse = z.object({
  paths: z.array(z.union([HotPathASchema, HotPathBSchema])).default([]),
});

const SafetyStatsSchema = z.object({
  total_executions: z.number().default(0),
  by_mode: z.record(z.string(), z.number()).default({}),
  by_status: z.record(z.string(), z.number()).default({}),
  total_rollbacks: z.number().default(0),
  total_blocked: z.number().default(0),
  sandbox_available: z.boolean().default(false),
});

// API returns { primary_goal, active_contexts, attention_weights }
// Frontend expects { primary_target, secondary_targets, attention_weights }
const AttentionFocusRawSchema = z.object({
  primary_goal: z.string().nullable().optional(),
  primary_target: z.string().nullable().optional(),
  active_contexts: z.array(z.string()).optional(),
  secondary_targets: z.array(z.string()).optional(),
  attention_weights: z.record(z.string(), z.number()).default({}),
});
const normalizeAttentionFocus = (raw: z.infer<typeof AttentionFocusRawSchema>): AttentionFocus => ({
  primary_target: raw.primary_target ?? raw.primary_goal ?? null,
  secondary_targets: raw.secondary_targets ?? raw.active_contexts ?? [],
  attention_weights: raw.attention_weights,
});

const WorldSnapshotASchema = z.object({
  component: z.string(),
  state: z.unknown(),
  timestamp: z.string(),
});
const WorldSnapshotBSchema = z.object({
  state_type: z.string(),
  state_data: z.unknown(),
  timestamp: z.string(),
});
const WorldStateResponse = z.object({
  snapshots: z.array(z.union([WorldSnapshotASchema, WorldSnapshotBSchema])).default([]),
});

// Helpers for coercion
const toNumber = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : (typeof v === 'number' ? v : NaN);
  return Number.isFinite(n) ? n : fallback;
};
const toPercent01To100 = (v: unknown): number => {
  const n = toNumber(v, 0);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return Math.max(0, Math.min(100, Math.round(n * 100)));
  // If already a percentage (<=100), clamp
  return Math.max(0, Math.min(100, Math.round(n)));
};

// Additional schemas - updated to match actual API response fields
// Skills API returns: { id, name, description, steps, preconditions, success_criteria, status, version, created_at }
const SkillItemSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(), // API uses 'status' instead of explicit category
  success_rate: z.union([z.number(), z.string()]).optional(),
  execution_count: z.union([z.number(), z.string()]).optional(),
});
const SkillsResponse = z.object({ skills: z.array(SkillItemSchema).default([]) });

// Goals API returns: { id, description, parent_goal_id, priority, status, created_at, updated_at, deadline }
const GoalItemSchema = z.object({
  id: z.string(),
  description: z.string().default(''),
  status: z.string().default('unknown'),
  priority: z.string().optional(), // Use priority to derive progress if progress missing
  progress: z.union([z.number(), z.string()]).nullable().optional(),
});
const GoalsResponse = z.object({ goals: z.array(GoalItemSchema).default([]) });

// Facts API returns: { id, statement, source, confidence, verified_at, invalidated_at, metadata, created_at }
const FactItemSchema = z.object({
  id: z.string(),
  content: z.string().optional(), // May not exist
  statement: z.string().optional(), // API uses 'statement' instead of 'content'
  category: z.string().optional(),
  source: z.string().optional(), // Can use source as category fallback
  confidence: z.union([z.number(), z.string()]).optional(),
});
const FactsResponse = z.object({ facts: z.array(FactItemSchema).default([]) });

export function useHotPaths(limit = 10): { data: CanonicalHotPath[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<CanonicalHotPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/telemetry/hot-paths?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          const parsed = HotPathsResponse.safeParse(json);
          if (parsed.success) {
            const normalized = parsed.data.paths.map((p): CanonicalHotPath => {
              if ("path" in p) {
                return { label: p.path, calls: p.call_count ?? 0, avgMs: p.avg_time_ms };
              }
              return { label: `${p.source} → ${p.target}`, calls: p.count };
            });
            setData(normalized);
          } else {
            console.warn("hot-paths schema mismatch", parsed.error);
            setData([]);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useDatabaseHealth(): { data: DatabaseHealthSummary | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<DatabaseHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/database/health");
        if (res.ok) {
          const json = await res.json();
          // Normalize API response to match DatabaseHealthSummary interface
          // API returns { last_check: {...}, databases_monitored, ... }
          // Frontend expects { all_healthy, total_databases, ... }
          const lastCheck = json.last_check || {};
          const normalized: DatabaseHealthSummary = {
            all_healthy: lastCheck.all_healthy ?? true,
            total_databases: json.databases_monitored ?? 0,
            healthy_count: lastCheck.healthy ?? 0,
            corrupted_count: (lastCheck.corrupted || []).length,
            oversized_count: (lastCheck.oversized || []).length,
            total_size_mb: lastCheck.total_size_mb ?? 0,
            corrupted: lastCheck.corrupted || [],
            oversized: lastCheck.oversized || [],
            results: [], // Not returned by current API
          };
          setData(normalized);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useSafetyStats(): { data: SafetyStats | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<SafetyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/v1/safety/stats");
        if (res.ok) {
          const json = await res.json();
          const parsed = SafetyStatsSchema.safeParse(json);
          if (parsed.success) {
            setData(parsed.data);
          } else {
            console.warn("safety-stats schema mismatch", parsed.error);
            setData(null);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useAttentionFocus(): { data: AttentionFocus | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<AttentionFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/v1/memory/l6/focus");
        if (res.ok) {
          const json = await res.json();
          const parsed = AttentionFocusRawSchema.safeParse(json);
          if (parsed.success) {
            setData(normalizeAttentionFocus(parsed.data));
          } else {
            console.warn("attention-focus schema mismatch", parsed.error);
            setData({ primary_target: null, secondary_targets: [], attention_weights: {} });
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function useGoals(limit = 10): { data: CanonicalGoal[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<CanonicalGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/memory/l8/goals?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          const parsed = GoalsResponse.safeParse(json);
          if (parsed.success) {
            const normalized: CanonicalGoal[] = parsed.data.goals.map(g => {
              const statusLower = g.status.toLowerCase();
              const normalizedStatus: CanonicalGoal['status'] = (() => {
                if (statusLower === 'completed') return 'completed';
                if (statusLower === 'in_progress' || statusLower === 'in-progress' || statusLower === 'active') return 'in_progress';
                if (statusLower === 'blocked') return 'blocked';
                if (statusLower === 'pending' || statusLower === 'todo') return 'pending';
                return 'unknown';
              })();
              // Derive progress from status if not provided
              const derivedProgress = g.progress != null 
                ? toPercent01To100(g.progress)
                : (normalizedStatus === 'completed' ? 100 : normalizedStatus === 'in_progress' ? 50 : 0);
              return {
                id: g.id,
                description: g.description,
                status: normalizedStatus,
                progress: Math.max(0, Math.min(100, derivedProgress)),
              };
            });
            setData(normalized);
          } else {
            console.warn('goals schema mismatch', parsed.error);
            setData([]);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useSkills(limit = 20): { data: CanonicalSkill[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<CanonicalSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/memory/l5/skills?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          const parsed = SkillsResponse.safeParse(json);
          if (parsed.success) {
            const normalized: CanonicalSkill[] = parsed.data.skills.map(s => ({
              id: s.id,
              name: s.name,
              category: s.category || s.status || 'general', // Use status as fallback
              successRate: toPercent01To100(s.success_rate),
              executionCount: Math.max(0, Math.floor(toNumber(s.execution_count, 0))),
            }));
            setData(normalized);
          } else {
            console.warn('skills schema mismatch', parsed.error);
            setData([]);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useWorldState(limit = 10): { data: CanonicalWorldSnapshot[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<CanonicalWorldSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/memory/l7/snapshots?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          const parsed = WorldStateResponse.safeParse(json);
          if (parsed.success) {
            const normalized = parsed.data.snapshots.map((s): CanonicalWorldSnapshot => {
              if ("component" in s) {
                return { component: s.component, state: s.state, timestamp: s.timestamp };
              }
              return { component: s.state_type, state: s.state_data, timestamp: s.timestamp };
            });
            setData(normalized);
          } else {
            console.warn("world-state schema mismatch", parsed.error);
            setData([]);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useEpisodes(limit = 10): { data: Episode[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/memory/l3/episodes?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          setData(json.episodes || []);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

export function useFacts(limit = 20): { data: CanonicalFact[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<CanonicalFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/v1/memory/l4/facts?limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          const parsed = FactsResponse.safeParse(json);
          if (parsed.success) {
            const normalized: CanonicalFact[] = parsed.data.facts.map(f => ({
              id: f.id,
              content: f.content || f.statement || '', // Use statement as fallback
              category: f.category || f.source || 'general', // Use source as fallback
              confidencePct: toPercent01To100(f.confidence),
            }));
            setData(normalized);
          } else {
            console.warn('facts schema mismatch', parsed.error);
            setData([]);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
}

// =============================================================================
// CARD CONTENT COMPONENTS
// =============================================================================

interface CardContentProps {
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}

function CardContent({ loading, error, children }: CardContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white/40 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400/60 text-sm">Error: {error}</div>
      </div>
    );
  }
  return <>{children}</>;
}

// --- ML Classifier Stats Card ---
export function ClassifierStatsContent() {
  const { data, loading, error } = useClassifierStats();

  return (
    <CardContent loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-2.5">
              <div className={`text-lg font-bold tabular-nums ${data.intent_classifier_loaded ? 'text-green-400' : 'text-red-400'}`}>
                {data.intent_classifier_loaded ? 'Active' : 'Offline'}
              </div>
              <div className="text-[10px] text-white/40">
                <InlineTooltip tip="Classifies user requests into intents (e.g., query, command, clarification)">
                  Intent Classifier
                </InlineTooltip>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <div className={`text-lg font-bold tabular-nums ${data.domain_classifier_loaded ? 'text-green-400' : 'text-red-400'}`}>
                {data.domain_classifier_loaded ? 'Active' : 'Offline'}
              </div>
              <div className="text-[10px] text-white/40">
                <InlineTooltip tip="Routes requests to specialized domain handlers (code, docs, system, etc.)">
                  Domain Classifier
                </InlineTooltip>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-base font-bold text-cyan-400 tabular-nums">{data.total_predictions.toLocaleString()}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Total ML inference calls since startup">
                  Predictions
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-base font-bold text-amber-400 tabular-nums">{data.avg_inference_time_ms.toFixed(1)}ms</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Mean time per classification. Target: <50ms">
                  Avg Latency
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-base font-bold text-purple-400 tabular-nums">{(data.cache_hit_rate * 100).toFixed(0)}%</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Percentage of requests served from cache. Higher = faster responses">
                  Cache Hits
                </InlineTooltip>
              </div>
            </div>
          </div>
        </div>
      )}
    </CardContent>
  );
}

// --- Learning Progress Card ---
export function LearningProgressContent() {
  const { data, loading, error } = useLearningStats();

  return (
    <CardContent loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold text-cyan-400 tabular-nums">{data.total_corrections}</div>
              <div className="text-[10px] text-white/40">
                <InlineTooltip tip="Cumulative user corrections that improve model accuracy">
                  Total Corrections
                </InlineTooltip>
              </div>
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${data.needs_retraining ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
              <InlineTooltip tip={data.needs_retraining ? 'Enough new corrections to warrant model update' : 'Model is up to date with recent feedback'}>
                {data.needs_retraining ? 'Retraining Needed' : 'Model Current'}
              </InlineTooltip>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${Math.min((data.corrections_since_training / data.retraining_threshold) * 100, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-white/50">
            <InlineTooltip tip="Progress toward automatic retraining trigger">
              {data.corrections_since_training} / {data.retraining_threshold} corrections until retraining
            </InlineTooltip>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/60">
                <InlineTooltip tip="User agreed with model prediction">
                  Confirmations
                </InlineTooltip>
              </span>
              <span className="text-green-400 tabular-nums">{data.confirmations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">
                <InlineTooltip tip="User corrected model prediction">
                  Corrections
                </InlineTooltip>
              </span>
              <span className="text-amber-400 tabular-nums">{data.actual_corrections}</span>
            </div>
          </div>
        </div>
      )}
    </CardContent>
  );
}

// --- Execution Traces Card ---
export function ExecutionTracesContent() {
  const { data, loading, error } = useExecutionTraces(10);

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-1.5">
        {data.length > 0 ? (
          data.slice(0, 6).map((trace, idx) => (
            <div key={`${trace.trace_id}-${idx}`} className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${trace.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                <InlineTooltip tip={trace.status === 'success' ? 'Trace completed successfully' : 'Trace ended with error'}>
                  <span className="sr-only">{trace.status}</span>
                </InlineTooltip>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-white/70 truncate">
                  {trace.spans.slice(0, 3).map((s, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-white/30">→</span>}
                      <InlineTooltip tip={`Component: ${s.component_id} (${s.duration_ms.toFixed(0)}ms, ${s.success ? 'success' : 'failed'})`}>
                        <span className="truncate">{s.component_id.split('.').pop()}</span>
                      </InlineTooltip>
                    </React.Fragment>
                  ))}
                  {trace.spans.length > 3 && (
                    <InlineTooltip tip={`${trace.spans.length - 3} more spans in this trace`}>
                      <span className="text-white/40">+{trace.spans.length - 3}</span>
                    </InlineTooltip>
                  )}
                </div>
              </div>
              <span className="text-white/50 tabular-nums flex-shrink-0">
                <InlineTooltip tip="Total execution time for this trace">
                  {trace.duration_ms.toFixed(0)}ms
                </InlineTooltip>
              </span>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No recent traces</div>
        )}
      </div>
    </CardContent>
  );
}

// --- Hot Paths Card ---
export function HotPathsContent() {
  const { data, loading, error } = useHotPaths(8);

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-1.5">
        {data.length > 0 ? (
          data.slice(0, 6).map((item, i) => {
            const anyItem = item as any;
            const label = typeof anyItem.label === 'string'
              ? anyItem.label
              : typeof anyItem.path === 'string'
                ? anyItem.path
                : [anyItem.source, anyItem.target].filter(Boolean).join(' → ');
            const calls = (anyItem.calls ?? anyItem.call_count ?? anyItem.count ?? 0) as number;
            const avgVal = (anyItem.avgMs ?? anyItem.avg_time_ms) as number | undefined;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="text-white/40 w-4 tabular-nums">
                  <InlineTooltip tip={`Rank ${i + 1} by call frequency`}>
                    {i + 1}
                  </InlineTooltip>
                </div>
                <div className="flex-1 text-white/70 truncate">
                  <InlineTooltip tip={`Execution path: ${label || 'Unknown'}`}>
                    {label || 'Unknown'}
                  </InlineTooltip>
                </div>
                <span className="text-cyan-400 tabular-nums flex-shrink-0">
                  <InlineTooltip tip="Total invocations of this path">
                    {calls}
                  </InlineTooltip>
                </span>
                {typeof avgVal === 'number' && (
                  <span className="text-amber-400 tabular-nums flex-shrink-0">
                    <InlineTooltip tip="Average execution time for this path">
                      {avgVal.toFixed(1)}ms
                    </InlineTooltip>
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No hot paths detected</div>
        )}
      </div>
    </CardContent>
  );
}

// --- Database Health Card ---
export function DatabaseHealthContent() {
  const { data, loading, error } = useDatabaseHealth();

  // Use normalized data from useDatabaseHealth hook
  const allHealthy = data?.all_healthy ?? true;
  const totalSizeMb = data?.total_size_mb ?? 0;
  const healthyCount = data?.healthy_count ?? 0;
  const corrupted = data?.corrupted ?? [];
  const oversized = data?.oversized ?? [];
  const dbsMonitored = data?.total_databases ?? 0;

  return (
    <CardContent loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${allHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className={`text-sm font-medium ${allHealthy ? 'text-green-400' : 'text-amber-400'}`}>
                <InlineTooltip tip={allHealthy ? 'All databases passed integrity checks' : 'One or more databases have issues'}>
                  {allHealthy ? 'All Healthy' : `${corrupted.length + oversized.length} Issues`}
                </InlineTooltip>
              </span>
            </div>
            <span className="text-white/50 text-xs">
              <InlineTooltip tip="Database health status">
                {dbsMonitored} DBs
              </InlineTooltip>
            </span>
          </div>
          
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">{dbsMonitored}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Number of SQLite databases being monitored">
                  Monitored
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400 tabular-nums">{healthyCount}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Databases that passed integrity checks">
                  Healthy
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-white/90 tabular-nums">{totalSizeMb.toFixed(1)}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Combined size of all memory databases">
                  MB Total
                </InlineTooltip>
              </div>
            </div>
          </div>
          
          {/* Issues section - prominent display when unhealthy */}
          {(corrupted.length > 0 || oversized.length > 0) ? (
            <div className="space-y-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="text-xs font-bold text-red-500 uppercase tracking-wide flex items-center gap-1">
                <span className="animate-pulse">⚠</span> Database Issues Detected
              </div>
              {corrupted.length > 0 && (
                <div className="space-y-1">
                  {corrupted.map((db: string) => (
                    <div key={db} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-bold text-red-400">{db}</span>
                      <span className="text-red-300 text-xs">- CORRUPTED (integrity check failed)</span>
                    </div>
                  ))}
                </div>
              )}
              {oversized.length > 0 && (
                <div className="space-y-1">
                  {oversized.map((db: string) => (
                    <div key={db} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-bold text-amber-400">{db}</span>
                      <span className="text-amber-300 text-xs">- OVERSIZED (exceeds size limit)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </CardContent>
  );
}

// --- Safety Stats Card ---
export function SafetyStatsContent() {
  const { data, loading, error } = useSafetyStats();

  return (
    <CardContent loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">{data.total_executions}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Total operations executed through the safety layer">
                  Executions
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400 tabular-nums">{data.total_blocked}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Operations blocked due to policy violations or safety concerns">
                  Blocked
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-400 tabular-nums">{data.total_rollbacks}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Operations reverted after detecting unintended side effects">
                  Rollbacks
                </InlineTooltip>
              </div>
            </div>
          </div>
          {data.by_mode && Object.keys(data.by_mode).length > 0 && (
          <div className="space-y-1">
            {Object.entries(data.by_mode).map(([mode, count]) => (
              <div key={mode} className="flex items-center justify-between text-xs">
                <span className="text-white/60 capitalize">
                  <InlineTooltip tip={`Executions in ${mode.replace('_', ' ')} mode`}>
                    {mode.replace('_', ' ')}
                  </InlineTooltip>
                </span>
                <span className="text-white/90 tabular-nums">{count}</span>
              </div>
            ))}
          </div>
          )}
          <div className={`text-[10px] px-2 py-1 rounded text-center ${data.sandbox_available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            <InlineTooltip tip={data.sandbox_available ? 'Isolated execution environment ready for risky operations' : 'Sandbox unavailable—risky operations will be blocked'}>
              Sandbox: {data.sandbox_available ? 'Available' : 'Unavailable'}
            </InlineTooltip>
          </div>
        </div>
      )}
    </CardContent>
  );
}

// --- Attention Focus Card ---
export function AttentionFocusContent() {
  const { data, loading, error } = useAttentionFocus();

  return (
    <CardContent loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-white/40 uppercase mb-1">
              <InlineTooltip tip="The component or context currently receiving most processing resources">
                Primary Focus
              </InlineTooltip>
            </div>
            <div className="text-sm text-cyan-400 font-medium">
              {data.primary_target || 'None'}
            </div>
          </div>
          {data.secondary_targets && data.secondary_targets.length > 0 && (
            <div>
              <div className="text-[10px] text-white/40 uppercase mb-1">
                <InlineTooltip tip="Additional contexts being monitored in the background">
                  Secondary
                </InlineTooltip>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.secondary_targets.slice(0, 5).map((target, i) => (
                  <span key={i} className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-white/70">
                    {target}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data.attention_weights && Object.keys(data.attention_weights).length > 0 && (
            <div>
              <div className="text-[10px] text-white/40 uppercase mb-1">
                <InlineTooltip tip="Relative allocation of attention across active components (0-100%)">
                  Weights
                </InlineTooltip>
              </div>
              <div className="space-y-1">
                {Object.entries(data.attention_weights).slice(0, 4).map(([key, weight]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/60 w-20 truncate">{key}</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${(weight as number) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-white/50 tabular-nums w-8">{((weight as number) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CardContent>
  );
}

// --- Goals Tracker Card ---
export function GoalsTrackerContent() {
  const { data, loading, error } = useGoals(6);

  const statusTips: Record<string, string> = {
    completed: 'Goal successfully achieved',
    in_progress: 'Actively working toward this goal',
    blocked: 'Progress halted due to dependency or issue',
    pending: 'Queued for future execution',
    unknown: 'Status not determined',
  };

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-2">
        {data.length > 0 ? (
          data.map((goal) => (
            <div key={goal.id} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-white/80 flex-1 line-clamp-1">{goal.description}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  goal.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  goal.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                  goal.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                  goal.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  <InlineTooltip tip={statusTips[goal.status] || statusTips.unknown}>
                    {goal.status.replace('_',' ')}
                  </InlineTooltip>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/50 tabular-nums">
                  <InlineTooltip tip="Percentage of goal completion based on tracked milestones">
                    {goal.progress}%
                  </InlineTooltip>
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No active goals</div>
        )}
      </div>
    </CardContent>
  );
}

// --- Skills Catalog Card ---
export function SkillsCatalogContent() {
  const { data, loading, error } = useSkills(8);

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-1.5">
        {data.length > 0 ? (
          data.slice(0, 6).map((skill) => (
            <div key={skill.id} className="flex items-center gap-2 text-xs">
              <span className="text-white/70 flex-1 truncate">{skill.name}</span>
              <span className="text-purple-400 text-[10px]">
                <InlineTooltip tip={`Skill category: ${skill.category}`}>
                  {skill.category}
                </InlineTooltip>
              </span>
              <span className={`tabular-nums ${skill.successRate >= 90 ? 'text-green-400' : skill.successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                <InlineTooltip tip="Percentage of successful executions. Green ≥90%, Amber ≥70%, Red <70%">
                  {skill.successRate.toFixed(0)}%
                </InlineTooltip>
              </span>
              <span className="text-white/40 tabular-nums">
                <InlineTooltip tip="Total times this skill has been invoked">
                  ×{skill.executionCount}
                </InlineTooltip>
              </span>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No skills recorded</div>
        )}
      </div>
    </CardContent>
  );
}

// --- World State Card ---
export function WorldStateContent() {
  const { data, loading, error } = useWorldState(6);

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-2">
        {data.length > 0 ? (
          data.slice(0, 5).map((snapshot, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 font-medium">
                  <InlineTooltip tip={`State snapshot from component: ${snapshot.component}`}>
                    {snapshot.component}
                  </InlineTooltip>
                </span>
                <span className="text-white/40 text-[10px]">
                  <InlineTooltip tip="Time this state snapshot was captured">
                    {new Date(snapshot.timestamp).toLocaleTimeString()}
                  </InlineTooltip>
                </span>
              </div>
              <div className="text-white/50 truncate text-[10px]">
                <InlineTooltip tip="JSON preview of the component's internal state">
                  {(() => {
                    try {
                      return JSON.stringify(snapshot.state ?? {}).slice(0, 60);
                    } catch {
                      return '[unserializable]';
                    }
                  })()}...
                </InlineTooltip>
              </div>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No state snapshots</div>
        )}
      </div>
    </CardContent>
  );
}

// --- Episodes Timeline Card ---
export function EpisodesTimelineContent() {
  const { data, loading, error } = useEpisodes(10);

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-1.5">
        {data.length > 0 ? (
          data.slice(0, 6).map((episode) => (
            <div key={episode.id} className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/80 truncate">
                    <InlineTooltip tip={`Event type: ${episode.event_type}`}>
                      {episode.event_type}
                    </InlineTooltip>
                  </span>
                  <span className="text-white/40 text-[10px] flex-shrink-0">
                    <InlineTooltip tip="When this episode was recorded">
                      {new Date(episode.timestamp).toLocaleTimeString()}
                    </InlineTooltip>
                  </span>
                </div>
                <div className="text-white/40 text-[10px] truncate">
                  <InlineTooltip tip={`Full session ID: ${episode.session_id}`}>
                    {episode.session_id.slice(0, 8)}...
                  </InlineTooltip>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No episodes recorded</div>
        )}
      </div>
    </CardContent>
  );
}

// --- Subsystem Status Card ---
export interface SubsystemSummary {
  total: number;
  initialized: number;
  uninitialized: number;
  categories: Record<string, { total: number; initialized: number }>;
}

export function useSubsystemStatus(): { data: SubsystemSummary | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<SubsystemSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/systems");
        if (res.ok) {
          const json = await res.json();
          const entries = Object.values(json) as { initialized: boolean; category: string }[];
          const categories: Record<string, { total: number; initialized: number }> = {};
          for (const s of entries) {
            if (!categories[s.category]) categories[s.category] = { total: 0, initialized: 0 };
            categories[s.category].total++;
            if (s.initialized) categories[s.category].initialized++;
          }
          setData({
            total: entries.length,
            initialized: entries.filter(s => s.initialized).length,
            uninitialized: entries.filter(s => !s.initialized).length,
            categories,
          });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

export function SubsystemStatusContent() {
  const { data, loading, error } = useSubsystemStatus();

  return (
    <CardContent loading={loading} error={error}>
      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-cyan-400 tabular-nums">{data.total}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Total registered subsystems">
                  Total
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400 tabular-nums">{data.initialized}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Subsystems that initialized successfully">
                  Online
                </InlineTooltip>
              </div>
            </div>
            <div>
              <div className={`text-lg font-bold tabular-nums ${data.uninitialized > 0 ? 'text-amber-400' : 'text-white/30'}`}>{data.uninitialized}</div>
              <div className="text-[9px] text-white/40">
                <InlineTooltip tip="Subsystems that failed to initialize or are disabled">
                  Offline
                </InlineTooltip>
              </div>
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${data.total > 0 ? (data.initialized / data.total * 100) : 0}%` }}
            />
          </div>
          <div className="space-y-1">
            {Object.entries(data.categories)
              .sort(([,a], [,b]) => b.total - a.total)
              .slice(0, 5)
              .map(([cat, counts]) => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="text-white/60">
                    <InlineTooltip tip={`${counts.initialized}/${counts.total} subsystems online in ${cat}`}>
                      {cat}
                    </InlineTooltip>
                  </span>
                  <span className={`tabular-nums ${counts.initialized === counts.total ? 'text-green-400' : 'text-amber-400'}`}>
                    {counts.initialized}/{counts.total}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </CardContent>
  );
}

// --- Facts/Knowledge Card ---
export function FactsKnowledgeContent() {
  const { data, loading, error } = useFacts(10);

  return (
    <CardContent loading={loading} error={error}>
      <div className="space-y-1.5">
        {data.length > 0 ? (
          data.slice(0, 5).map((fact) => (
            <div key={fact.id} className="text-xs space-y-0.5">
              <div className="text-white/80 line-clamp-2">{fact.content}</div>
              <div className="flex items-center gap-2">
                <span className="text-purple-400">
                  <InlineTooltip tip={`Knowledge category: ${fact.category}`}>
                    {fact.category}
                  </InlineTooltip>
                </span>
                <span className={`tabular-nums ${fact.confidencePct >= 90 ? 'text-green-400' : fact.confidencePct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                  <InlineTooltip tip="Confidence in the accuracy of this fact. Green ≥90%, Amber ≥70%, Red <70%">
                    {fact.confidencePct.toFixed(0)}%
                  </InlineTooltip>
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm text-center py-4">No facts stored</div>
        )}
      </div>
    </CardContent>
  );
}
