"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useHealth } from "@/contexts/HealthContext";
import { useTelemetry } from "@/contexts/TelemetryContext";
import dynamic from "next/dynamic";
import DraggableCardContent from "./DraggableCardContent";
import DashboardGrid from "./DashboardGrid";
import { loadLayoutConfig, configToDefaultRows } from "@/lib/layoutConfig";
import {
  ClassifierStatsContent,
  LearningProgressContent,
  ExecutionTracesContent,
  HotPathsContent,
  DatabaseHealthContent,
  SafetyStatsContent,
  AttentionFocusContent,
  GoalsTrackerContent,
  SkillsCatalogContent,
  WorldStateContent,
  EpisodesTimelineContent,
  FactsKnowledgeContent,
  SubsystemStatusContent,
} from "./dashboard-cards";

// Lazy load full views
const NeuralOrganismView = dynamic(() => import("./NeuralOrganismView"), { ssr: false });
const ArchitectureViewV2 = dynamic(() => import("./ArchitectureViewV2"), { ssr: false });
const MetaView = dynamic(() => import("./MetaView"), { ssr: false });
const SandboxView = dynamic(() => import("./SandboxView"), { ssr: false });
const LogsView = dynamic(() => import("./LogsView"), { ssr: false });
const TasksView = dynamic(() => import("./TasksView"), { ssr: false });
const MemoryView = dynamic(() => import("./MemoryView"), { ssr: false });
const SecurityView = dynamic(() => import("./SecurityView"), { ssr: false });
const RecommendationsView = dynamic(() => import("./RecommendationsView"), { ssr: false });
const AnalysisPanel = dynamic(() => import("./AnalysisPanel"), { ssr: false });
const SystemsView = dynamic(() => import("./SystemsView"), { ssr: false });
const LearningView = dynamic(() => import("./LearningView"), { ssr: false });
const AttentionView = dynamic(() => import("./AttentionView"), { ssr: false });
const BenchmarkLiveView = dynamic(() => import("./BenchmarkLiveView"), { ssr: false });

// Real brain canvas for dashboard card
const BrainCanvas = dynamic(() => import("./BrainCanvas"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gradient-to-br from-orange-500/10 to-amber-500/5 rounded-lg flex items-center justify-center">
      <div className="text-cyan-400/60 text-xs animate-pulse">Loading brain...</div>
    </div>
  )
});

type ActiveView = null | "cognition" | "architecture" | "assessment" | "sandbox" | "logs" | "tasks" | "memory" | "security" | "recommendations" | "analysis" | "systems" | "learning" | "attention" | "benchmarks";

interface CardInfo {
  title: string;
  bullets: string[];
}

interface CardProps {
  title: string;
  subtitle?: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  info?: CardInfo;
}

interface ResizableCardProps extends CardProps {
  persistKey?: string;
}

// Card with resizable internal content width
function ResizableDashboardCard({ title, subtitle, onClick, children, accentColor = "#3b82f6", className = "", persistKey }: ResizableCardProps) {
  const [contentWidth, setContentWidth] = useState(100); // percentage of available width
  const [resizing, setResizing] = useState<{ startX: number; startWidth: number } | null>(null);
  const containerRef = useRef<HTMLButtonElement>(null);

  // Load persisted width
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`card-width-${persistKey}`);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 50 && parsed <= 100) {
          setContentWidth(parsed);
        }
      }
    }
  }, [persistKey]);

  // Save width
  useEffect(() => {
    if (persistKey && typeof window !== "undefined" && contentWidth !== 100) {
      localStorage.setItem(`card-width-${persistKey}`, String(contentWidth));
    }
  }, [contentWidth, persistKey]);

  // Handle resize drag
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - resizing.startX;
      const deltaPct = (deltaX / rect.width) * 100 * 2; // *2 because we resize from center
      
      let newWidth = resizing.startWidth + deltaPct;
      newWidth = Math.max(50, Math.min(100, newWidth));
      setContentWidth(newWidth);
    };

    const handleMouseUp = () => setResizing(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ startX: e.clientX, startWidth: contentWidth });
  };

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5 text-left transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-black/20 ${className}`}
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 20px 50px -15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      {/* Glow effect on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${accentColor}15 0%, transparent 60%)`,
        }}
      />
      
      {/* Accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      
      {/* Content with adjustable width */}
      <div 
        className="relative z-10 mx-auto transition-all"
        style={{ 
          width: `${contentWidth}%`,
          transition: resizing ? "none" : "width 0.15s ease-out",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white/90">{title}</h3>
            {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
          </div>
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
            style={{ background: `${accentColor}20` }}
          >
            <svg className="w-4 h-4" fill="none" stroke={accentColor} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        {children}

        {/* Right edge resize handle */}
        <div
          className="absolute -right-3 top-0 bottom-0 w-3 cursor-ew-resize z-50 flex items-center justify-center"
          onMouseDown={startResize}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-1 h-full bg-purple-500/30 hover:bg-purple-500/80 rounded-full transition-colors" />
        </div>
      </div>
    </button>
  );
}

// Generic info tooltip for card headers
function InfoTooltip({ title, bullets, anchor }: { title: string; bullets: string[]; anchor: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);

  const onEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCoords({ x: rect.left, y: rect.bottom + 8 });
    timerRef.current = window.setTimeout(() => setShow(true), 200);
  };
  const onLeave = () => { if (timerRef.current) window.clearTimeout(timerRef.current); setShow(false); };

  return (
    <>
      <span className="flex-1 min-w-0" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {anchor}
      </span>
      {show && typeof document !== 'undefined' && (
        ReactDOM.createPortal(
          <div className="fixed z-[99999] max-w-sm p-3 rounded-lg border border-white/20 bg-[#18181b]/95 backdrop-blur-sm shadow-2xl" style={{ top: coords.y, left: coords.x }}>
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2 font-medium">{title}</div>
            <ul className="list-disc pl-4 space-y-1 text-xs text-white/80">
              {bullets.map((b, i) => (<li key={i}>{b}</li>))}
            </ul>
          </div>,
          document.body
        )
      )}
    </>
  );
}

function DashboardCard({ title, subtitle, onClick, children, accentColor = "#3b82f6", className = "", info }: CardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-4 text-left transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-black/20 w-full h-full flex flex-col overflow-hidden ${className}`}
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 20px 50px -15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)`,
        minWidth: 0,
      }}
    >
      {/* Glow effect on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${accentColor}15 0%, transparent 60%)`,
        }}
      />
      
      {/* Accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      
      {/* Header */}
      <div className="relative z-10 mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {info ? (
            <InfoTooltip
              title={info.title}
              bullets={info.bullets}
              anchor={
                <h3 className="text-sm font-semibold text-white/90 truncate flex-1">{title}</h3>
              }
            />
          ) : (
            <h3 className="text-sm font-semibold text-white/90 truncate flex-1">{title}</h3>
          )}
        </div>
        {subtitle && <p className="text-xs text-white/50 mt-0.5 truncate">{subtitle}</p>}
      </div>
      
      {/* Content - overflow hidden, no scrollbars */}
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden w-full">
        {children}
      </div>
    </button>
  );
}

function StatusDot({ status }: { status: "online" | "offline" | "error" }) {
  const colors = {
    online: { bg: "#22c55e", glow: "rgba(34, 197, 94, 0.5)" },
    offline: { bg: "#6b7280", glow: "rgba(107, 114, 128, 0.3)" },
    error: { bg: "#ef4444", glow: "rgba(239, 68, 68, 0.5)" },
  };
  const c = colors[status];
  
  return (
    <div className="relative">
      <div 
        className="w-2.5 h-2.5 rounded-full"
        style={{ 
          backgroundColor: c.bg,
          boxShadow: `0 0 8px ${c.glow}, 0 0 16px ${c.glow}`,
        }}
      />
      {status === "online" && (
        <div 
          className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping"
          style={{ backgroundColor: c.bg, opacity: 0.4 }}
        />
      )}
    </div>
  );
}

// Tooltip wrapper for hero card items
interface HeroTooltipProps {
  children: React.ReactNode;
  title: string;
  details: { label: string; value: string | number }[];
}

function HeroTooltip({ children, title, details }: HeroTooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);
  
  const onEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCoords({ x: rect.left, y: rect.bottom + 8 });
    timerRef.current = window.setTimeout(() => setShow(true), 300);
  };
  
  const onLeave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setShow(false);
  };
  
  return (
    <>
      <div
        className="cursor-default hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </div>
      {show && details.length > 0 && typeof document !== 'undefined' && (
        ReactDOM.createPortal(
          <div
            className="fixed z-[99999] min-w-[200px] p-3 rounded-lg border border-white/20 bg-[#18181b]/95 backdrop-blur-sm shadow-2xl"
            style={{ top: coords.y, left: coords.x }}
          >
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2 font-medium">{title}</div>
            <div className="space-y-1.5">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-6">
                  <span className="text-white/60">{d.label}</span>
                  <span className="text-white/90 tabular-nums font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      )}
    </>
  );
}

// Mini sparkline chart for time-series data
interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  unit?: string;
}

function Sparkline({ data, color = "#3b82f6", width = 60, height = 20, unit = "" }: SparklineProps) {
  const latest = data.length > 0 ? data[data.length - 1] : 0;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  // Generate SVG path
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  });
  const pathD = points.length > 1 ? `M ${points.join(" L ")}` : "";
  
  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="flex-shrink-0">
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="text-xs font-medium tabular-nums text-white/90">
        {latest.toFixed(0)}{unit}
      </span>
    </div>
  );
}

// Hoverable item with floating tooltip
interface HoverItemProps {
  label: string;
  color?: string;
  details?: { label: string; value: string | number }[];
  columnHeaders?: { left: string; right: string };
}

function HoverItem({ label, color = "text-white/80", details, columnHeaders }: HoverItemProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);
  
  const onEnter = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX + 16, y: e.clientY + 8 });
    timerRef.current = window.setTimeout(() => setShow(true), 250);
  };
  
  const onMove = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX + 16, y: e.clientY + 8 });
  };
  
  const onLeave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setShow(false);
  };
  
  return (
    <>
      <div
        className={`text-xs ${color} py-0.5 cursor-default hover:bg-white/5 -mx-1 px-1 rounded`}
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {label}
      </div>
      {show && details && details.length > 0 && typeof document !== 'undefined' && (
        ReactDOM.createPortal(
          <div
            className="fixed z-[99999] min-w-[220px] p-3 rounded-lg border border-white/20 bg-[#18181b] shadow-2xl"
            style={{ top: coords.y, left: coords.x }}
          >
            {columnHeaders && (
              <div className="flex items-center justify-between text-[10px] text-white/40 uppercase tracking-wider mb-2 pb-1 border-b border-white/10">
                <span>{columnHeaders.left}</span>
                <span>{columnHeaders.right}</span>
              </div>
            )}
            <div className="space-y-1">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-4">
                  <span className="text-white/70">{d.label}</span>
                  <span className="text-white/90 tabular-nums font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      )}
    </>
  );
}

function StatValue({ value, label, trend }: { value: string | number; label: string; trend?: "up" | "down" | "neutral" }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white/90 tabular-nums">{value}</div>
      <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

// Bar item with hover tooltip for Assessment card
interface HoverBarItemProps {
  label: string;
  score: number;
  details: { label: string; value: string | number }[];
}

function HoverBarItem({ label, score, details }: HoverBarItemProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<number | null>(null);
  
  const onEnter = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX + 16, y: e.clientY + 8 });
    timerRef.current = window.setTimeout(() => setShow(true), 250);
  };
  
  const onMove = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX + 16, y: e.clientY + 8 });
  };
  
  const onLeave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setShow(false);
  };
  
  const barColor = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-blue-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = score >= 85 ? 'text-green-400' : score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  
  return (
    <>
      <div
        className="flex items-center gap-2 cursor-default hover:bg-white/5 -mx-1 px-1 rounded py-0.5"
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <span className="text-[10px] text-white/50 w-16 truncate">{label}</span>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <span className={`text-[10px] tabular-nums w-8 text-right font-medium ${textColor}`}>{score}</span>
      </div>
      {show && details && details.length > 0 && typeof document !== 'undefined' && (
        ReactDOM.createPortal(
          <div
            className="fixed z-[99999] min-w-[200px] p-3 rounded-lg border border-white/20 bg-[#18181b] shadow-2xl"
            style={{ top: coords.y, left: coords.x }}
          >
            <div className="flex items-center justify-between text-[10px] text-white/40 uppercase tracking-wider mb-2 pb-1 border-b border-white/10">
              <span>Metric</span>
              <span>Value</span>
            </div>
            <div className="space-y-1">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-4">
                  <span className="text-white/70">{d.label}</span>
                  <span className="text-white/90 tabular-nums font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      )}
    </>
  );
}

// Architecture analysis types
interface ArchNode { id: string; label?: string; type?: string; status?: string; }
interface ArchEdge { source: string; target: string; call_count?: number; }
interface ArchAnalysis {
  nodeCount: number;
  edgeCount: number;
  liveCount: number;
  uninitCount: number;
  totalCalls: number;
  bottleneckCount: number;
  criticalPathCount: number;
  hotPathCount: number;
  failureCount: number;
  bottlenecks: { component: string; avg_time_ms: number; max_time_ms: number; sample_count: number }[];
  criticalPaths: { source: string; target: string; intent_type: string; avg_time_ms: number; failures: number; criticality_score: number }[];
  hotPaths: { source: string; target: string; count: number }[];
  failures: { source: string; target: string; intent_type: string; failures: number; avg_time_ms: number }[];
}

interface AssessmentScorecard {
  metaSystemScore: number | null;
  metaSystemPhase: string;
  overallScore: number | null;
  jarvisScore: number | null;
  maturityStage: string;
  dimensions: Record<string, number>;
  // Detailed stats for hover tooltips
  codebase: { modules: number; lines: number; classes: number; functions: number };
  tests: { files: number; count: number; passRate: number };
  reliability: { score: number; operations: number; successRate: number };
  jarvisDetails: { rawScore: number; foundationQuality: number; timeToJarvis: string };
}

// Memory layer vital information
interface MemoryLayerInfo {
  layer: string;
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'unknown';
  recordCount: number;
  storageMb: number;
}

interface MemoryVitals {
  layers: MemoryLayerInfo[];
  totalRecords: number;
  totalStorageMb: number;
  overallScore: number;
}

// Security scan findings
interface SecurityFinding {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location?: string;
  cwe_id?: string;
}

interface SecurityStatus {
  findings: SecurityFinding[];
  totalFindings: number;
  overallScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  complianceStatus: {
    compliant: number;
    partial: number;
    non_compliant: number;
  };
}

// Strategic recommendations from recommendations engine
interface StrategicOpportunity {
  id: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  impact_score: number;
  effort_score: number;
  roi_score: number;
}

interface RecommendationsSummary {
  overall_strategic_score: number;
  competitive_position: string;
  total_opportunities: number;
  opportunities_by_category: Record<string, number>;
  top_opportunities: StrategicOpportunity[];
}

export default function DashboardView() {
  const { health } = useHealth();
  const { connectionStatus, latestFrame } = useTelemetry();
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [stats, setStats] = useState({
    uptime: "—",
    latency: "—",
    modelStatus: "unknown" as "online" | "offline" | "unknown",
    modelName: "—",
    driftIssues: 0,
    lastDriftScan: "Never",
    nodeCount: 0,
    edgeCount: 0,
    liveCount: 0,
    uninitCount: 0,
    totalCalls: 0,
    executions: 0,
    successRate: 0,
    taskCount: 0,
    // New metrics
    totalRequests: 0,
    errorRate: 0,
    lastActivity: "—",
    avgResponseTime: 0,
    dbSizeMb: 0,
    activeGoals: 0,
    cpuPercent: 0,
    memoryMb: 0,
    diskMb: 0,
    openConnections: 0,
    pendingTasks: 0,
    timeoutRate: 0,
    memoryPercent: 0,
    totalRamGb: 0,
  });
  
  // Time-series history for sparklines (last 20 samples)
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [responseTimeHistory, setResponseTimeHistory] = useState<number[]>([]);
  const MAX_HISTORY = 20;
  
  // Pending tasks list for tooltip
  const [pendingTaskNames, setPendingTaskNames] = useState<string[]>([]);
  
  // Recent logs for dashboard card (grouped by message)
  const [recentLogs, setRecentLogs] = useState<{ level: string; message: string; count: number }[]>([]);
  
  // Layout save state
  const [layoutSaved, setLayoutSaved] = useState(false);
  
  const [archAnalysis, setArchAnalysis] = useState<ArchAnalysis>({
    nodeCount: 0,
    edgeCount: 0,
    liveCount: 0,
    uninitCount: 0,
    totalCalls: 0,
    bottleneckCount: 0,
    criticalPathCount: 0,
    hotPathCount: 0,
    failureCount: 0,
    bottlenecks: [],
    criticalPaths: [],
    hotPaths: [],
    failures: [],
  });
  const [assessmentScorecard, setAssessmentScorecard] = useState<AssessmentScorecard>({
    metaSystemScore: null,
    metaSystemPhase: "—",
    overallScore: null,
    jarvisScore: null,
    maturityStage: "—",
    dimensions: {},
    codebase: { modules: 0, lines: 0, classes: 0, functions: 0 },
    tests: { files: 0, count: 0, passRate: 0 },
    reliability: { score: 0, operations: 0, successRate: 0 },
    jarvisDetails: { rawScore: 0, foundationQuality: 0, timeToJarvis: "—" },
  });
  const [serverStartTime, setServerStartTime] = useState<number | null>(null);
  
  // Memory vitals (L1-L10)
  const [memoryVitals, setMemoryVitals] = useState<MemoryVitals>({
    layers: [],
    totalRecords: 0,
    totalStorageMb: 0,
    overallScore: 0,
  });
  
  // Security status from security scanner
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    findings: [],
    totalFindings: 0,
    overallScore: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    complianceStatus: { compliant: 0, partial: 0, non_compliant: 0 },
  });
  
  // Strategic recommendations
  const [recommendationsSummary, setRecommendationsSummary] = useState<RecommendationsSummary>({
    overall_strategic_score: 0,
    competitive_position: 'developing',
    total_opportunities: 0,
    opportunities_by_category: {},
    top_opportunities: [],
  });

  // Format uptime from milliseconds
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  // Fetch architecture data separately so it doesn't depend on other fetches
  useEffect(() => {
    const fetchArchitecture = async () => {
      try {
        const archRes = await fetch("http://localhost:8000/v1/architecture/graph");
        if (archRes.ok) {
          const archDataRes = await archRes.json();
          const nodes: ArchNode[] = archDataRes.nodes || [];
          const edges: ArchEdge[] = archDataRes.edges || [];
          
          let liveCount = 0;
          let uninitCount = 0;
          for (const n of nodes) {
            if (n.status === "live") liveCount++;
            else if (n.status === "not_initialized") uninitCount++;
          }
          
          const totalCalls = edges.reduce((sum, e) => sum + (e.call_count || 0), 0);
          
          setStats(prev => ({
            ...prev,
            nodeCount: nodes.length,
            edgeCount: edges.length,
            liveCount,
            uninitCount,
            totalCalls,
          }));
          
          // Fetch telemetry analysis data
          const [bottlenecksRes, criticalRes, hotRes] = await Promise.all([
            fetch('http://localhost:8000/v1/telemetry/bottlenecks'),
            fetch('http://localhost:8000/v1/telemetry/critical-paths'),
            fetch('http://localhost:8000/v1/telemetry/hot-paths'),
          ]);
          
          let bottlenecks: ArchAnalysis['bottlenecks'] = [];
          let criticalPaths: ArchAnalysis['criticalPaths'] = [];
          let hotPaths: ArchAnalysis['hotPaths'] = [];
          
          if (bottlenecksRes.ok) {
            const data = await bottlenecksRes.json();
            bottlenecks = data.bottlenecks || [];
          }
          if (criticalRes.ok) {
            const data = await criticalRes.json();
            criticalPaths = data.paths || [];
          }
          if (hotRes.ok) {
            const data = await hotRes.json();
            hotPaths = data.paths || [];
          }
          
          const failures = criticalPaths
            .filter(p => (p.failures || 0) > 0)
            .sort((a, b) => (b.failures || 0) - (a.failures || 0));
          
          console.log("[Dashboard] Setting archAnalysis:", { liveCount, uninitCount, totalCalls, nodes: nodes.length });
          setArchAnalysis({
            nodeCount: nodes.length,
            edgeCount: edges.length,
            liveCount,
            uninitCount,
            totalCalls,
            bottleneckCount: bottlenecks.length,
            criticalPathCount: criticalPaths.length,
            hotPathCount: hotPaths.length,
            failureCount: failures.length,
            bottlenecks,
            criticalPaths,
            hotPaths,
            failures,
          });
          
          if (bottlenecks.length > 0) {
            const avgTime = bottlenecks.reduce((sum: number, b: { avg_time_ms?: number }) => sum + (b.avg_time_ms || 0), 0) / bottlenecks.length;
            setStats(prev => ({ ...prev, avgResponseTime: Math.round(avgTime * 10) / 10 }));
          }
        }
      } catch (e) {
        console.error("Architecture fetch failed:", e);
      }
    };
    
    fetchArchitecture();
    const archInterval = setInterval(fetchArchitecture, 30000);
    return () => clearInterval(archInterval);
  }, []);

  // Fetch other stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Measure latency with health check
        const latencyStart = performance.now();
        const healthRes = await fetch("http://localhost:8000/health");
        const latencyMs = Math.round(performance.now() - latencyStart);
        
        if (healthRes.ok) {
          setStats(prev => ({
            ...prev,
            latency: `${latencyMs}ms`,
          }));
          setLatencyHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), latencyMs]);
        }

        // Fetch systems status for model info
        const systemsRes = await fetch("http://localhost:8000/api/systems");
        if (systemsRes.ok) {
          const systemsData = await systemsRes.json();
          const llmClient = systemsData.llm_client;
          setStats(prev => ({
            ...prev,
            modelStatus: llmClient?.initialized ? "online" : "offline",
            modelName: llmClient?.model || (llmClient?.initialized ? "Unknown" : "Offline"),
          }));
        }

        // Fetch drift analysis runs
        try {
          const driftRes = await fetch("http://localhost:8000/api/analysis/runs");
          if (driftRes.ok) {
            const driftData = await driftRes.json();
            const runs = driftData.runs || [];
            const latestRun = runs[0];
            
            let issueCount = 0;
            if (latestRun?.id) {
              const issuesRes = await fetch(`http://localhost:8000/api/analysis/issues/${latestRun.id}`);
              if (issuesRes.ok) {
                const issuesData = await issuesRes.json();
                issueCount = issuesData.issues?.length || 0;
              }
            }
            
            setStats(prev => ({
              ...prev,
              driftIssues: issueCount,
              lastDriftScan: latestRun ? new Date(latestRun.started_at).toLocaleDateString() : "Never",
            }));
          }
        } catch (e) {
          console.error("Drift fetch failed:", e);
        }

        // Fetch recent flows
        const flowsRes = await fetch("http://localhost:8000/v1/atlas/logs?limit=20");
        if (flowsRes.ok) {
          const flowsData = await flowsRes.json();
          const logs = flowsData.logs || flowsData || [];
          // Extract duration_ms from individual flow events (filter out zero values)
          const durations = logs
            .map((log: { details?: { duration_ms?: number } }) => log.details?.duration_ms || 0)
            .filter((d: number) => d > 0)
            .slice(0, MAX_HISTORY);
          if (durations.length > 0) {
            setResponseTimeHistory(durations);
          }
          // Store recent logs for dashboard card display (grouped by level+message)
          const logCounts = new Map<string, { level: string; message: string; count: number }>();
          for (const log of logs) {
            const key = `${log.level || 'INFO'}|${log.message || ''}`;
            const existing = logCounts.get(key);
            if (existing) {
              existing.count++;
            } else {
              logCounts.set(key, {
                level: log.level || 'INFO',
                message: log.message || '',
                count: 1,
              });
            }
          }
          // Convert to array and take top 5
          const groupedLogs = Array.from(logCounts.values()).slice(0, 5);
          setRecentLogs(groupedLogs);
        }

        // Fetch sandbox stats
        const sandboxRes = await fetch("/api/sandbox/statistics");
        if (sandboxRes.ok) {
          const sandboxData = await sandboxRes.json();
          setStats(prev => ({
            ...prev,
            executions: sandboxData.total_executions || 0,
            successRate: Math.round(sandboxData.success_rate || 0),
          }));
        }

        // Fetch metrics summary for request counts and error rate
        const metricsRes = await fetch("http://localhost:8000/api/metrics/summary");
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          const totalAttempts = metricsData.total_attempts || 0;
          const legacySuccessRate = metricsData.legacy?.success_rate || 0;
          const symbolicSuccessRate = metricsData.symbolic?.success_rate || 0;
          const avgSuccessRate = totalAttempts > 0 ? (legacySuccessRate + symbolicSuccessRate) / 2 : 100;
          setStats(prev => ({
            ...prev,
            totalRequests: totalAttempts,
            errorRate: Math.round((100 - avgSuccessRate) * 10) / 10,
          }));
        }

        // Fetch scheduler stats for last activity and pending tasks
        const schedulerRes = await fetch("http://localhost:8000/api/scheduler/stats");
        if (schedulerRes.ok) {
          const schedulerData = await schedulerRes.json();
          const tasks = schedulerData.tasks || [];
          // Find most recent last_run across all tasks
          let mostRecent = "";
          for (const task of tasks) {
            if (task.last_run && (!mostRecent || task.last_run > mostRecent)) {
              mostRecent = task.last_run;
            }
          }
          if (mostRecent) {
            const lastRunDate = new Date(mostRecent);
            const now = new Date();
            const diffMs = now.getTime() - lastRunDate.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            let lastActivityStr = "";
            if (diffMins < 1) lastActivityStr = "Just now";
            else if (diffMins < 60) lastActivityStr = `${diffMins}m ago`;
            else if (diffHours < 24) lastActivityStr = `${diffHours}h ago`;
            else lastActivityStr = lastRunDate.toLocaleDateString();
            setStats(prev => ({ ...prev, lastActivity: lastActivityStr }));
          }
          // Set task count from scheduler
          setStats(prev => ({ ...prev, taskCount: schedulerData.task_count || tasks.length }));
          // Store task names for pending tasks tooltip
          const taskNames = tasks.map((t: { name?: string }) => t.name || "unknown");
          setPendingTaskNames(taskNames);
        }

        // Fetch memory stats for active goals and L1-L10 vitals
        const memoryStatsRes = await fetch("http://localhost:8000/api/memory/stats");
        if (memoryStatsRes.ok) {
          const memoryStatsData = await memoryStatsRes.json();
          setStats(prev => ({
            ...prev,
            activeGoals: memoryStatsData.l8?.total_goals || 0,
          }));
          
          // Also populate memory vitals from the same data
          const layerNames: Record<string, string> = {
            l1: 'Working',
            l2: 'Short-term',
            l3: 'Episodic',
            l4: 'Declarative',
            l5: 'Procedural',
            l6: 'Attention',
            l7: 'World',
            l8: 'Goals',
            l9: 'Social',
            l10: 'Vector',
          };
          
          const layerInfos: MemoryLayerInfo[] = Object.entries(memoryStatsData)
            .filter(([key]) => key.startsWith('l'))
            .map(([key, stats]: [string, unknown]) => {
              const s = stats as Record<string, number | string | Record<string, number>>;
              let recordCount = 0;
              
              if (key === 'l1') recordCount = (s.active_conversations as number) || 0;
              else if (key === 'l2') recordCount = (s.recent_conversations as number) || 0;
              else if (key === 'l3') recordCount = (s.total_episodes as number) || 0;
              else if (key === 'l4') recordCount = (s.valid_facts as number) || 0;
              else if (key === 'l5') recordCount = (s.total_skills as number) || 0;
              else if (key === 'l6') recordCount = (s.db_focus_states as number) || (s.focus_states_tracked as number) || (s.total_states as number) || 0;
              else if (key === 'l7') recordCount = (s.total_snapshots as number) || 0;
              else if (key === 'l8') recordCount = (s.total_goals as number) || 0;
              else if (key === 'l9') recordCount = (s.total_users as number) || 0;
              else if (key === 'l10') recordCount = (s.total_messages as number) || (s.index_size as number) || 0;
              
              return {
                layer: key.toUpperCase(),
                name: layerNames[key] || key,
                status: recordCount > 0 ? 'healthy' as const : 'unknown' as const,
                recordCount,
                storageMb: 0,
              };
            });
          
          layerInfos.sort((a, b) => {
            const aNum = parseInt(a.layer.replace('L', ''), 10) || 0;
            const bNum = parseInt(b.layer.replace('L', ''), 10) || 0;
            return aNum - bNum;
          });
          
          const totalRecords = layerInfos.reduce((sum, l) => sum + l.recordCount, 0);
          const activeCount = layerInfos.filter(l => l.status === 'healthy').length;
          const healthScore = layerInfos.length > 0 ? Math.round((activeCount / layerInfos.length) * 100) : 0;
          
          setMemoryVitals({
            layers: layerInfos,
            totalRecords,
            totalStorageMb: 0,
            overallScore: healthScore,
          });
        }

        // Fetch system resources (CPU/Memory/Disk/Connections/Uptime)
        const resourcesRes = await fetch("http://localhost:8000/api/system/resources");
        if (resourcesRes.ok) {
          const resourcesData = await resourcesRes.json();
          setStats(prev => ({
            ...prev,
            cpuPercent: resourcesData.cpu_percent || 0,
            memoryMb: resourcesData.memory_mb || 0,
            memoryPercent: resourcesData.memory_percent || 0,
            totalRamGb: resourcesData.total_ram_gb || 0,
            diskMb: resourcesData.disk_mb || 0,
            openConnections: resourcesData.open_connections || 0,
            pendingTasks: resourcesData.pending_tasks || 0,
            timeoutRate: resourcesData.timeout_rate || 0,
          }));
          // Set server start time from backend
          if (resourcesData.server_start_time) {
            setServerStartTime(new Date(resourcesData.server_start_time).getTime());
          }
        }

        // Fetch latest dynamic assessment scorecard
        const latestAssessRes = await fetch("http://localhost:8000/v1/meta/dynamic/latest", {
          cache: 'no-cache',
        });
        if (latestAssessRes.ok) {
          const assessData = await latestAssessRes.json();
          
          // Map dynamic assessment dimensions to scorecard format
          const dimensionScores: Record<string, number> = {};
          if (assessData.dimensions) {
            for (const [dim, data] of Object.entries(assessData.dimensions)) {
              dimensionScores[dim] = (data as { score?: number }).score ?? 0;
            }
          }
          
          setAssessmentScorecard({
            metaSystemScore: assessData.combined_score ?? assessData.overall_score ?? null,
            metaSystemPhase: assessData.version || "—",
            overallScore: assessData.overall_score ?? null,
            jarvisScore: assessData.benchmark_overall_score ?? null,
            maturityStage: assessData.overall_score >= 80 ? "Advanced" : assessData.overall_score >= 50 ? "Developing" : "Foundation",
            dimensions: dimensionScores,
            codebase: {
              modules: 0,
              lines: 0,
              classes: 0,
              functions: 0,
            },
            tests: {
              files: 0,
              count: assessData.total_tests_run || 0,
              passRate: assessData.overall_success_rate != null ? Math.round(assessData.overall_success_rate * 100) : 100,
            },
            reliability: {
              score: assessData.overall_score || 0,
              operations: assessData.total_tests_run || 0,
              successRate: assessData.overall_success_rate != null ? Math.round(assessData.overall_success_rate * 100) : 0,
            },
            jarvisDetails: {
              rawScore: assessData.benchmark_overall_score || 0,
              foundationQuality: assessData.overall_score || 0,
              timeToJarvis: "—",
            },
          });
        }
        
        
        // Fetch security scan summary
        const securityRes = await fetch("http://localhost:8000/v1/security/summary");
        if (securityRes.ok) {
          const securityData = await securityRes.json();
          const findings = securityData.top_findings || [];
          const bySeverity = securityData.findings_by_severity || {};
          const compliance = securityData.compliance_summary || {};
          
          setSecurityStatus({
            findings: findings.map((f: { id: string; category: string; severity: string; title: string; description: string; location?: string; cwe_id?: string }) => ({
              id: f.id,
              category: f.category,
              severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
              title: f.title,
              description: f.description,
              location: f.location,
              cwe_id: f.cwe_id,
            })),
            totalFindings: securityData.total_findings || 0,
            overallScore: securityData.overall_score || 0,
            criticalCount: bySeverity.critical || 0,
            highCount: bySeverity.high || 0,
            mediumCount: bySeverity.medium || 0,
            lowCount: bySeverity.low || 0,
            complianceStatus: {
              compliant: compliance.compliant || 0,
              partial: compliance.partial || 0,
              non_compliant: compliance.non_compliant || 0,
            },
          });
        }
        
        // Fetch strategic recommendations
        const recommendationsRes = await fetch("http://localhost:8000/v1/recommendations/summary");
        if (recommendationsRes.ok) {
          const recData = await recommendationsRes.json();
          setRecommendationsSummary({
            overall_strategic_score: recData.overall_strategic_score || 0,
            competitive_position: recData.competitive_position || 'developing',
            total_opportunities: recData.total_opportunities || 0,
            opportunities_by_category: recData.opportunities_by_category || {},
            top_opportunities: (recData.top_opportunities || []).map((o: StrategicOpportunity) => ({
              id: o.id,
              category: o.category,
              priority: o.priority?.toLowerCase() as 'critical' | 'high' | 'medium' | 'low',
              title: o.title,
              description: o.description,
              rationale: o.rationale,
              impact_score: o.impact_score,
              effort_score: o.effort_score,
              roi_score: o.roi_score,
            })),
          });
        }
      } catch (e) {
        console.error("Failed to fetch dashboard stats:", e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update uptime every second
  const [uptime, setUptime] = useState("—");
  useEffect(() => {
    const updateUptime = () => {
      if (health.backend === "connected" && serverStartTime) {
        setUptime(formatUptime(Date.now() - serverStartTime));
      } else {
        setUptime("—");
      }
    };
    updateUptime();
    const interval = setInterval(updateUptime, 1000);
    return () => clearInterval(interval);
  }, [health.backend, serverStartTime]);

  // If a view is active, show it with back navigation
  if (activeView) {
    return (
      <div className="h-full flex flex-col">
        {/* Back bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => setActiveView(null)}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </button>
          <span className="text-white/30">/</span>
          <span className="text-sm text-white/90 capitalize">{activeView}</span>
        </div>
        
        {/* Active view */}
        <div className="flex-1 overflow-hidden">
          {activeView === "cognition" && <NeuralOrganismView />}
          {activeView === "architecture" && <ArchitectureViewV2 />}
          {activeView === "assessment" && <MetaView />}
          {activeView === "sandbox" && <SandboxView />}
          {activeView === "logs" && <LogsView />}
          {activeView === "tasks" && <TasksView />}
          {activeView === "memory" && <MemoryView />}
          {activeView === "security" && <SecurityView />}
          {activeView === "recommendations" && <RecommendationsView />}
          {activeView === "analysis" && <AnalysisPanel />}
          {activeView === "systems" && <SystemsView />}
          {activeView === "learning" && <LearningView />}
          {activeView === "attention" && <AttentionView />}
          {activeView === "benchmarks" && <BenchmarkLiveView />}
        </div>
      </div>
    );
  }

  const serverStatus = health.backend === "connected" ? "online" : health.backend === "error" ? "error" : "offline";
  const chatStatus = health.chat === "connected" ? "online" : health.chat === "error" ? "error" : "offline";
  const telemetryStatus = connectionStatus === "open" ? "online" : connectionStatus === "error" ? "error" : "offline";

  const saveLayout = () => {
    // Copy current layout to a backup key that won't be touched
    const currentLayout = localStorage.getItem('dashboard-grid-dashboard-layout');
    if (currentLayout) {
      localStorage.setItem('dashboard-grid-dashboard-layout-saved', currentLayout);
      setLayoutSaved(true);
      setTimeout(() => setLayoutSaved(false), 2000);
    }
  };
  const restoreLayout = () => {
    const savedLayout = localStorage.getItem('dashboard-grid-dashboard-layout-saved');
    if (savedLayout) {
      localStorage.setItem('dashboard-grid-dashboard-layout', savedLayout);
      window.location.reload();
    }
  };

  return (
    <div className="h-full overflow-auto p-6 bg-gradient-to-br from-[#0a0a0f] via-[#111118] to-[#0a0a0f]">
      {/* Layout controls */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={saveLayout}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
        >
          {layoutSaved ? '✓ Saved' : 'Save Layout'}
        </button>
        <button
          onClick={restoreLayout}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
        >
          Restore Layout
        </button>
      </div>
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-4">
        {/* Hero Card - System Health */}
        <div 
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-5"
          style={{
            boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 25px 60px -15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
        >
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 opacity-80" />
          
          <div className="grid grid-cols-4 gap-4">
            {/* Column 1 - Core Services */}
            <div className="space-y-3">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Services</div>
              <div className="space-y-2">
                <HeroTooltip
                  title="Backend API"
                  details={[
                    { label: "Status", value: serverStatus === "online" ? "Connected" : "Disconnected" },
                    { label: "Endpoint", value: "localhost:8000" },
                    { label: "Latency", value: stats.latency },
                  ]}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={serverStatus} />
                    <span className="text-xs text-white/80">Backend API</span>
                  </div>
                </HeroTooltip>
                <HeroTooltip
                  title="Chat Stream"
                  details={[
                    { label: "Status", value: chatStatus === "online" ? "Connected" : "Disconnected" },
                    { label: "Protocol", value: "Server-Sent Events" },
                  ]}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={chatStatus} />
                    <span className="text-xs text-white/80">Chat Stream</span>
                  </div>
                </HeroTooltip>
                <HeroTooltip
                  title="Telemetry"
                  details={[
                    { label: "Status", value: telemetryStatus === "online" ? "Connected" : "Disconnected" },
                    { label: "Protocol", value: "WebSocket" },
                    { label: "Nodes", value: stats.nodeCount },
                    { label: "Edges", value: stats.edgeCount },
                  ]}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={telemetryStatus} />
                    <span className="text-xs text-white/80">Telemetry</span>
                  </div>
                </HeroTooltip>
                <HeroTooltip
                  title="LLM Client"
                  details={[
                    { label: "Status", value: stats.modelStatus === "online" ? "Online" : "Offline" },
                    { label: "Model", value: stats.modelName },
                    { label: "Provider", value: "Anthropic" },
                  ]}
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={stats.modelStatus === "online" ? "online" : "offline"} />
                    <span className="text-xs text-white/80">LLM Client</span>
                  </div>
                </HeroTooltip>
              </div>
            </div>

            {/* Column 2 - Activity */}
            <div className="space-y-3 border-l border-white/10 pl-4">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Activity</div>
              <div className="grid grid-cols-2 gap-3">
                <HeroTooltip
                  title="Server Uptime"
                  details={[
                    { label: "Current", value: uptime },
                    { label: "Since", value: serverStartTime ? new Date(serverStartTime).toLocaleString() : "—" },
                  ]}
                >
                  <div>
                    <div className="text-xl font-bold text-white/90 tabular-nums">{uptime}</div>
                    <div className="text-[10px] text-white/40">Uptime</div>
                  </div>
                </HeroTooltip>
                <HeroTooltip
                  title="Active Goals"
                  details={[
                    { label: "Active", value: stats.activeGoals },
                    { label: "Storage", value: "L8 Goals Memory" },
                  ]}
                >
                  <div>
                    <div className="text-xl font-bold text-white/90 tabular-nums">{stats.activeGoals}</div>
                    <div className="text-[10px] text-white/40">Active Goals</div>
                  </div>
                </HeroTooltip>
                <HeroTooltip
                  title="Fix Attempts"
                  details={[
                    { label: "Total", value: stats.totalRequests },
                    { label: "Error Rate", value: `${stats.errorRate}%` },
                    { label: "Source", value: "Fix Generator Metrics" },
                  ]}
                >
                  <div>
                    <div className="text-xl font-bold text-white/90 tabular-nums">{stats.totalRequests}</div>
                    <div className="text-[10px] text-white/40">Requests</div>
                  </div>
                </HeroTooltip>
                <HeroTooltip
                  title="Last Activity"
                  details={[
                    { label: "When", value: stats.lastActivity },
                    { label: "Source", value: "Scheduler Tasks" },
                  ]}
                >
                  <div>
                    <div className="text-xl font-bold text-white/90 tabular-nums">{stats.lastActivity}</div>
                    <div className="text-[10px] text-white/40">Last Activity</div>
                  </div>
                </HeroTooltip>
              </div>
            </div>

            {/* Column 3 - Performance */}
            <div className="space-y-3 border-l border-white/10 pl-4">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Performance</div>
              <div className="space-y-2">
                {/* Latency with sparkline */}
                <HeroTooltip
                  title="API Latency"
                  details={[
                    { label: "Current", value: `${(latencyHistory[latencyHistory.length - 1] || 0).toFixed(2)}ms` },
                    { label: "Min", value: `${(Math.min(...(latencyHistory.length ? latencyHistory : [0]))).toFixed(2)}ms` },
                    { label: "Max", value: `${(Math.max(...(latencyHistory.length ? latencyHistory : [0]))).toFixed(2)}ms` },
                    { label: "Samples", value: latencyHistory.length },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Latency</span>
                    <Sparkline data={latencyHistory} color="#3b82f6" unit="ms" />
                  </div>
                </HeroTooltip>
                {/* Response Time with sparkline */}
                <HeroTooltip
                  title="Response Time"
                  details={[
                    { label: "Latest", value: `${(responseTimeHistory[responseTimeHistory.length - 1] || 0).toFixed(2)}ms` },
                    { label: "Min", value: `${(Math.min(...(responseTimeHistory.length ? responseTimeHistory : [0]))).toFixed(2)}ms` },
                    { label: "Max", value: `${(Math.max(...(responseTimeHistory.length ? responseTimeHistory : [0]))).toFixed(2)}ms` },
                    { label: "Avg", value: `${(responseTimeHistory.length ? (responseTimeHistory.reduce((a, b) => a + b, 0) / responseTimeHistory.length) : 0).toFixed(2)}ms` },
                    { label: "Samples", value: responseTimeHistory.length },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Response Time</span>
                    <Sparkline data={responseTimeHistory} color="#8b5cf6" unit="ms" />
                  </div>
                </HeroTooltip>
                {/* Scheduled Tasks */}
                <HeroTooltip
                  title="Scheduled Tasks"
                  details={[
                    ...pendingTaskNames.map((name, i) => ({ label: `Task ${i + 1}`, value: name })),
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Scheduled Tasks</span>
                    <span className="text-xs font-medium tabular-nums text-white/90">
                      {pendingTaskNames.length}
                    </span>
                  </div>
                </HeroTooltip>
                {/* Timeout Rate */}
                <HeroTooltip
                  title="Timeout Rate"
                  details={[
                    { label: "Rate", value: `${stats.timeoutRate}%` },
                    { label: "Status", value: stats.timeoutRate === 0 ? "Healthy" : stats.timeoutRate < 1 ? "Acceptable" : "High" },
                    { label: "Threshold", value: "60s default" },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Timeout Rate</span>
                    <span className={`text-xs font-medium tabular-nums ${stats.timeoutRate === 0 ? "text-green-400" : stats.timeoutRate < 1 ? "text-amber-400" : "text-red-400"}`}>
                      {stats.timeoutRate}%
                    </span>
                  </div>
                </HeroTooltip>
              </div>
            </div>

            {/* Column 4 - Resources */}
            <div className="space-y-3 border-l border-white/10 pl-4">
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Resources</div>
              <div className="space-y-2">
                {/* CPU */}
                <HeroTooltip
                  title="CPU Usage"
                  details={[
                    { label: "Process", value: `${stats.cpuPercent}%` },
                    { label: "Status", value: stats.cpuPercent < 50 ? "Normal" : stats.cpuPercent < 80 ? "Elevated" : "High" },
                    { label: "Scope", value: "ATLAS Process" },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">CPU</span>
                    <span className={`text-xs font-medium tabular-nums ${stats.cpuPercent < 50 ? "text-green-400" : stats.cpuPercent < 80 ? "text-amber-400" : "text-red-400"}`}>
                      {stats.cpuPercent}%
                    </span>
                  </div>
                </HeroTooltip>
                {/* Memory */}
                <HeroTooltip
                  title="Memory Usage"
                  details={[
                    { label: "RSS", value: `${stats.memoryMb.toFixed(2)} MB` },
                    { label: "Total RAM", value: `${stats.totalRamGb} GB` },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Memory</span>
                    <span className="text-xs font-medium text-white/90 tabular-nums">
                      {stats.memoryPercent.toFixed(2)}%
                    </span>
                  </div>
                </HeroTooltip>
                {/* Disk */}
                <HeroTooltip
                  title="Disk Usage"
                  details={[
                    { label: "Size", value: stats.diskMb > 1024 ? `${(stats.diskMb / 1024).toFixed(1)}GB` : `${stats.diskMb}MB` },
                    { label: "Location", value: "~/.atlas/memory/" },
                    { label: "Contents", value: "SQLite DBs (L2-L9)" },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Disk</span>
                    <span className="text-xs font-medium text-white/90 tabular-nums">
                      {stats.diskMb > 1024 ? `${(stats.diskMb / 1024).toFixed(1)}GB` : `${stats.diskMb}MB`}
                    </span>
                  </div>
                </HeroTooltip>
                {/* Connections */}
                <HeroTooltip
                  title="Open Connections"
                  details={[
                    { label: "Count", value: stats.openConnections },
                    { label: "Status", value: stats.openConnections < 50 ? "Normal" : stats.openConnections < 100 ? "Elevated" : "High" },
                    { label: "Type", value: "TCP/UDP sockets" },
                  ]}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/80">Connections</span>
                    <span className={`text-xs font-medium tabular-nums ${stats.openConnections < 50 ? "text-green-400" : stats.openConnections < 100 ? "text-amber-400" : "text-red-400"}`}>
                      {stats.openConnections}
                    </span>
                  </div>
                </HeroTooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Grid - drag cards between rows, resize width/height */}
        <DashboardGrid
          gap={16}
          persistKey="dashboard-layout"
          defaultRows={configToDefaultRows(loadLayoutConfig())}
          cards={[
            {
              id: "cognition",
              content: (
                  <DashboardCard
                    title="Cognition"
                    subtitle={<>{stats.nodeCount} nodes • {telemetryStatus === "online" ? <><span className="text-green-400">Live</span> Telemetry</> : <span className="text-red-400">Offline</span>}</>}
                    onClick={() => setActiveView("cognition")}
                    accentColor="#f97316"
                    className="h-full"
                    info={{
                      title: 'Cognition card',
                      bullets: [
                        'Live 3D rendering of core, memory, and perception regions',
                        'Use to spot overloaded regions and verify node status in real time',
                        'Click to open full Cognition view with interactive graph',
                      ],
                    }}
                  >
                    <div 
                      style={{ height: '360px' }}
                      className="-mx-2 -mb-2 rounded-lg overflow-hidden bg-[#0a0a12] cursor-pointer"
                      onClick={() => setActiveView("cognition")}
                    >
                      <BrainCanvas />
                    </div>
                  </DashboardCard>
              ),
            },
            {
              id: "architecture",
              content: (
                  <DashboardCard
                    title="Architecture"
                    subtitle={`${stats.nodeCount} nodes · ${stats.edgeCount} edges`}
                    onClick={() => setActiveView("architecture")}
                    accentColor="#8b5cf6"
                    className="h-full"
                    info={{
                      title: 'Architecture card',
                      bullets: [
                        'High-level counts from the architecture graph (nodes, edges)',
                        'Top bottlenecks summarize avg latency hot spots',
                        'Click to open full architecture analysis view',
                      ],
                    }}
                  >
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <div>
                          <div className="text-xl font-bold text-green-400 tabular-nums">{stats.liveCount}</div>
                          <div className="text-[10px] text-white/40">Live</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-amber-400 tabular-nums">{stats.uninitCount}</div>
                          <div className="text-[10px] text-white/40">Uninitialized</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-white/90 tabular-nums">{stats.totalCalls.toLocaleString()}</div>
                          <div className="text-[10px] text-white/40">Total Calls</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Top Bottlenecks</div>
                        <div className="space-y-0.5">
                          {archAnalysis.bottlenecks.slice(0, 4).map((b, i) => (
                            <div key={i} className="flex items-center justify-between text-xs gap-2">
                              <span className="text-white/70 truncate">{b?.component || 'unknown'}</span>
                              <span className="text-white/90 tabular-nums font-medium flex-shrink-0">{(b?.avg_time_ms ?? 0).toFixed(1)}ms</span>
                            </div>
                          ))}
                          {archAnalysis.bottlenecks.length === 0 && <div className="text-xs text-white/40">None</div>}
                        </div>
                      </div>
                    </div>
                  </DashboardCard>
              ),
            },
            {
              id: "assessment",
              content: (
                <DashboardCard
            title="Codebase Assessment"
            subtitle="System evaluation metrics"
            onClick={() => setActiveView("assessment")}
            accentColor="#06b6d4"
            info={{
              title: 'Assessment card',
              bullets: [
                'Aggregated scorecard from meta assessment pipeline',
                'Hover individual bars for metric details (files, tests, reliability)',
                'Click to open the full Assessment view',
              ],
            }}
          >
            {assessmentScorecard.overallScore !== null ? (
              <div className="space-y-2">
                {/* Top row - 4 key scores */}
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div>
                    <div className={`text-xl font-bold tabular-nums ${
                      (assessmentScorecard.metaSystemScore ?? 0) >= 85 ? 'text-green-400' :
                      (assessmentScorecard.metaSystemScore ?? 0) >= 70 ? 'text-blue-400' :
                      (assessmentScorecard.metaSystemScore ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {assessmentScorecard.metaSystemScore ?? '—'}
                    </div>
                    <div className="text-[8px] text-white/40 uppercase">Meta</div>
                  </div>
                  <div>
                    <div className={`text-xl font-bold tabular-nums ${
                      (assessmentScorecard.overallScore ?? 0) >= 85 ? 'text-green-400' :
                      (assessmentScorecard.overallScore ?? 0) >= 70 ? 'text-blue-400' :
                      (assessmentScorecard.overallScore ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {assessmentScorecard.overallScore?.toFixed(1) ?? '—'}
                    </div>
                    <div className="text-[8px] text-white/40 uppercase">Overall</div>
                  </div>
                  <div>
                    <div className={`text-xl font-bold tabular-nums ${
                      (assessmentScorecard.jarvisScore ?? 0) >= 85 ? 'text-green-400' :
                      (assessmentScorecard.jarvisScore ?? 0) >= 70 ? 'text-blue-400' :
                      (assessmentScorecard.jarvisScore ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {assessmentScorecard.jarvisScore?.toFixed(1) ?? '—'}
                    </div>
                    <div className="text-[8px] text-white/40 uppercase">Jarvis</div>
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${
                      assessmentScorecard.maturityStage === 'Jarvis-level' ? 'text-green-400' :
                      assessmentScorecard.maturityStage === 'Adult' ? 'text-blue-400' :
                      assessmentScorecard.maturityStage === 'Adolescent' ? 'text-yellow-400' : 'text-orange-400'
                    }`}>
                      {assessmentScorecard.maturityStage}
                    </div>
                    <div className="text-[8px] text-white/40 uppercase">Stage</div>
                  </div>
                </div>
                {/* Dimension bars */}
                <div className="space-y-1">
                <HoverBarItem
                  label="Codebase"
                  score={assessmentScorecard.dimensions.codebase_health ?? 0}
                  details={[
                    { label: "Modules", value: assessmentScorecard.codebase.modules.toLocaleString() },
                    { label: "Lines of Code", value: assessmentScorecard.codebase.lines.toLocaleString() },
                    { label: "Classes", value: assessmentScorecard.codebase.classes.toLocaleString() },
                    { label: "Functions", value: assessmentScorecard.codebase.functions.toLocaleString() },
                  ]}
                />
                {/* Test Coverage */}
                <HoverBarItem
                  label="Tests"
                  score={assessmentScorecard.dimensions.test_coverage ?? 0}
                  details={[
                    { label: "Test Files", value: assessmentScorecard.tests.files.toLocaleString() },
                    { label: "Total Tests", value: assessmentScorecard.tests.count.toLocaleString() },
                    { label: "Pass Rate", value: `${assessmentScorecard.tests.passRate}%` },
                  ]}
                />
                {/* Reliability */}
                <HoverBarItem
                  label="Reliability"
                  score={assessmentScorecard.dimensions.reliability ?? assessmentScorecard.reliability.score}
                  details={[
                    { label: "Total Operations", value: assessmentScorecard.reliability.operations.toLocaleString() },
                    { label: "Success Rate", value: `${assessmentScorecard.reliability.successRate}%` },
                  ]}
                />
                {/* Jarvis Readiness */}
                <HoverBarItem
                  label="Jarvis"
                  score={assessmentScorecard.jarvisScore ?? 0}
                  details={[
                    { label: "Raw Capability", value: `${assessmentScorecard.jarvisDetails.rawScore}%` },
                    { label: "Foundation Quality", value: `${assessmentScorecard.jarvisDetails.foundationQuality}%` },
                    { label: "Time to Jarvis", value: assessmentScorecard.jarvisDetails.timeToJarvis },
                  ]}
                />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">No assessment</div>
                    <div className="text-[10px] text-white/40">Click to generate</div>
                  </div>
                </div>
              </div>
            )}
                </DashboardCard>
              ),
            },
            {
              id: "sandbox",
              content: (
                <DashboardCard
                  title="Sandbox"
                  subtitle="Execution environment"
                  onClick={() => setActiveView("sandbox")}
                  accentColor="#22c55e"
                  info={{
                    title: 'Sandbox card',
                    bullets: [
                      'Shows recent execution count and pass rate from sandbox',
                      'Use to monitor CI-like safety runs and quick experiments',
                      'Click to open the full Sandbox console',
                    ],
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white/90">{stats.executions}</div>
                        <div className="text-[10px] text-white/40 uppercase">Executions</div>
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                      {stats.successRate}% pass
                    </div>
                  </div>
                </DashboardCard>
              ),
            },
            {
              id: "logs",
              content: (
                <DashboardCard
                  title="Logs"
                  subtitle="System event stream"
                  onClick={() => setActiveView("logs")}
                  accentColor="#f43f5e"
                  info={{
                    title: 'Logs card',
                    bullets: [
                      'Shows most recent log messages grouped by repetition',
                      'Use counts to spot noisy failure loops quickly',
                      'Click to open the full Logs view',
                    ],
                  }}
                >
                  <div className="space-y-1.5">
                    {recentLogs.length > 0 ? (
                      recentLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${
                            log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                            log.level === 'WARN' || log.level === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' :
                            log.level === 'DEBUG' ? 'bg-gray-500/20 text-gray-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {log.level.slice(0, 4)}
                          </span>
                          <span className="text-white/60 flex-1 break-all">
                            {log.message}
                          </span>
                          {log.count > 1 && (
                            <span className="flex-shrink-0 text-[9px] text-white/40 tabular-nums">
                              ×{log.count}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/10 flex items-center justify-center">
                          <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-sm text-white/50">No recent logs</div>
                      </div>
                    )}
                  </div>
                </DashboardCard>
              ),
            },
            {
              id: "tasks",
              content: (
                <DashboardCard
                  title="Tasks"
                  subtitle="Background operations"
                  onClick={() => setActiveView("tasks")}
                  accentColor="#eab308"
                  info={{
                    title: 'Tasks card',
                    bullets: [
                      'Displays number of active scheduled tasks',
                      'Useful for spotting build-up of background work',
                      'Click to open the full Task monitor',
                    ],
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-white/90">{stats.taskCount}</div>
                        <div className="text-[10px] text-white/40 uppercase">Active</div>
                      </div>
                    </div>
                  </div>
                </DashboardCard>
              ),
            },
            {
              id: "memory",
              content: (
                <DashboardCard
                  title="Memory Vitals"
                  subtitle={`${memoryVitals.totalRecords.toLocaleString()} records`}
                  onClick={() => setActiveView("memory")}
                  accentColor="#a855f7"
                  info={{
                    title: 'Memory Vitals card',
                    bullets: [
                      'Summarizes L1–L10 layer status, record counts, and storage usage',
                      'Use health colors to spot degraded or error layers quickly',
                      'Click to open Memory Architecture',
                    ],
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-lg font-bold text-white/90 tabular-nums">
                          {memoryVitals.totalStorageMb > 1024 
                            ? `${(memoryVitals.totalStorageMb / 1024).toFixed(1)}GB` 
                            : `${memoryVitals.totalStorageMb.toFixed(1)}MB`}
                        </div>
                        <div className="text-[10px] text-white/40">Total Storage</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold tabular-nums ${
                          memoryVitals.overallScore >= 85 ? 'text-green-400' :
                          memoryVitals.overallScore >= 70 ? 'text-blue-400' :
                          memoryVitals.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {memoryVitals.overallScore}%
                        </div>
                        <div className="text-[10px] text-white/40">Health Score</div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {memoryVitals.layers.length > 0 ? (
                        memoryVitals.layers.map((layer, i) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                layer.status === 'healthy' ? 'bg-green-500' :
                                layer.status === 'degraded' ? 'bg-yellow-500' :
                                layer.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                              }`} />
                              <span className="text-white/70">{layer.layer}</span>
                              <span className="text-white/40 text-[10px]">{layer.name}</span>
                            </div>
                            <span className="text-white/90 tabular-nums font-medium flex-shrink-0">
                              {layer.recordCount.toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-white/40">Loading memory layers...</div>
                      )}
                    </div>
                  </div>
                </DashboardCard>
              ),
            },
            {
              id: "security",
              content: (
                <DashboardCard
                  title="Security Scanner"
                  subtitle={`${securityStatus.totalFindings} findings · Score: ${securityStatus.overallScore}/100`}
                  onClick={() => setActiveView("security")}
                  accentColor="#ef4444"
                  info={{
                    title: 'Security Scanner card',
                    bullets: [
                      'Displays vulnerability findings by severity: Critical, High, Medium, Low',
                      'Security score (0-100) reflects overall code safety posture',
                      'CWE IDs link to Common Weakness Enumeration database for remediation guidance',
                      'Click to open the full Security detail view',
                    ],
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className={`text-xl font-bold tabular-nums ${
                          securityStatus.overallScore >= 80 ? 'text-green-400' :
                          securityStatus.overallScore >= 60 ? 'text-yellow-400' :
                          securityStatus.overallScore >= 40 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {securityStatus.overallScore}
                        </div>
                        <div className="text-[9px] text-white/40">Score</div>
                      </div>
                      <div className="flex gap-2">
                        {securityStatus.criticalCount > 0 && (
                          <div className="text-center">
                            <div className="text-sm font-bold text-red-400 tabular-nums">{securityStatus.criticalCount}</div>
                            <div className="text-[9px] text-white/40">Crit</div>
                          </div>
                        )}
                        {securityStatus.highCount > 0 && (
                          <div className="text-center">
                            <div className="text-sm font-bold text-orange-400 tabular-nums">{securityStatus.highCount}</div>
                            <div className="text-[9px] text-white/40">High</div>
                          </div>
                        )}
                        {securityStatus.mediumCount > 0 && (
                          <div className="text-center">
                            <div className="text-sm font-bold text-yellow-400 tabular-nums">{securityStatus.mediumCount}</div>
                            <div className="text-[9px] text-white/40">Med</div>
                          </div>
                        )}
                        {securityStatus.lowCount > 0 && (
                          <div className="text-center">
                            <div className="text-sm font-bold text-blue-400 tabular-nums">{securityStatus.lowCount}</div>
                            <div className="text-[9px] text-white/40">Low</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {securityStatus.findings.length > 0 ? (
                        securityStatus.findings.slice(0, 5).map((finding, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${
                              finding.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                              finding.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              finding.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {finding.severity.slice(0, 4)}
                            </span>
                            <span className="text-white/60 flex-1 truncate">{finding.title}</span>
                            {finding.cwe_id && (
                              <span className="text-[9px] text-purple-400 flex-shrink-0">{finding.cwe_id}</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div className="text-sm text-white/50">No vulnerabilities found</div>
                        </div>
                      )}
                    </div>
                  </div>
                </DashboardCard>
              ),
            },
            {
              id: "recommendations",
              content: (
                <DashboardCard
                  title="Strategic Opportunities"
                  subtitle={`${recommendationsSummary.total_opportunities} opportunities · ${recommendationsSummary.competitive_position}`}
                  onClick={() => setActiveView("recommendations")}
                  accentColor="#9333EA"
                  info={{
                    title: 'Opportunities card',
                    bullets: [
                      'Aggregated strategic recommendations by category',
                      'Use to prioritize high-ROI, high-impact items',
                      'Click to open the full Recommendations panel',
                    ],
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className={`text-xl font-bold tabular-nums ${
                          recommendationsSummary.overall_strategic_score >= 70 ? 'text-green-400' :
                          recommendationsSummary.overall_strategic_score >= 50 ? 'text-yellow-400' :
                          recommendationsSummary.overall_strategic_score >= 30 ? 'text-orange-400' : 'text-red-400'
                        }`}>
                          {recommendationsSummary.overall_strategic_score}
                        </div>
                        <div className="text-[9px] text-white/40">Score</div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(recommendationsSummary.opportunities_by_category).slice(0, 6).map(([cat, count]) => {
                          const catColor = cat === 'paradigm_shift' ? '#FFD700' :
                                           cat === 'competitive_moat' ? '#9333EA' :
                                           cat === 'frontier' ? '#06B6D4' :
                                           cat === 'market_disruption' ? '#F97316' :
                                           cat === 'technical_excellence' ? '#3B82F6' :
                                           cat === 'quick_win' ? '#22C55E' : '#9333EA';
                          const catName = cat === 'paradigm_shift' ? 'Shift' :
                                          cat === 'competitive_moat' ? 'Moat' :
                                          cat === 'frontier' ? 'Frontier' :
                                          cat === 'market_disruption' ? 'Disrupt' :
                                          cat === 'technical_excellence' ? 'Tech' :
                                          cat === 'quick_win' ? 'Quick' : cat.slice(0, 6);
                          return (
                            <div key={cat} className="text-center">
                              <div className="text-base font-bold tabular-nums" style={{ color: catColor }}>{count}</div>
                              <div className="text-[9px] text-white/40">{catName}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {recommendationsSummary.top_opportunities.length > 0 ? (
                        recommendationsSummary.top_opportunities.slice(0, 5).map((opp, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase ${
                              opp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                              opp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              opp.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {opp.priority.slice(0, 4)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-white/80 truncate">{opp.title}</div>
                              <div className="text-white/40 text-[10px] truncate">ROI: {opp.roi_score} · Impact: {opp.impact_score}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/10 flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <div className="text-sm text-white/50">Analyzing opportunities...</div>
                        </div>
                      )}
                    </div>
                  </div>
                </DashboardCard>
              ),
            },
            // === NEW CARDS - Performance & ML ===
            {
id: "classifier-stats",
              content: (
                <DashboardCard
                  title="ML Classifiers"
                  subtitle="Intent & domain classification"
                  onClick={() => setActiveView("learning")}
                  accentColor="#06b6d4"
                  info={{
                    title: 'ML Classifiers card',
                    bullets: [
                      'Shows inference volume, latency, and cache hit rate',
                      'Classifier loaded flags indicate readiness vs offline',
                    ],
                  }}
                >
                  <ClassifierStatsContent />
                </DashboardCard>
              ),
            },
            {
id: "learning-progress",
              content: (
                <DashboardCard
                  title="Learning Progress"
                  subtitle="Active learning & corrections"
                  onClick={() => setActiveView("learning")}
                  accentColor="#3b82f6"
                  info={{
                    title: 'Learning Progress card',
                    bullets: [
                      'Tracks confirmations vs corrections since last training',
                      'Progress bar shows distance to retraining threshold',
                    ],
                  }}
                >
                  <LearningProgressContent />
                </DashboardCard>
              ),
            },
            // === NEW CARDS - Telemetry & Traces ===
            {
id: "execution-traces",
              content: (
                <DashboardCard
                  title="Execution Traces"
                  subtitle="Recent request traces"
                  onClick={() => setActiveView("analysis")}
                  accentColor="#8b5cf6"
                  info={{
                    title: 'Execution Traces card',
                    bullets: [
                      'Shows last N traces, first few spans, and duration',
                      'Use to spot failing spans or unusually slow paths',
                    ],
                  }}
                >
                  <ExecutionTracesContent />
                </DashboardCard>
              ),
            },
            {
id: "hot-paths",
              content: (
                <DashboardCard
                  title="Hot Paths"
                  subtitle="Frequently executed paths"
                  onClick={() => setActiveView("analysis")}
                  accentColor="#f97316"
                  info={{
                    title: 'Hot Paths card',
                    bullets: [
                      'Top edges by call frequency in telemetry',
                      'Use to focus optimization and caching efforts',
                    ],
                  }}
                >
                  <HotPathsContent />
                </DashboardCard>
              ),
            },
            // === NEW CARDS - Infrastructure ===
            {
id: "subsystem-status",
              content: (
                <DashboardCard
                  title="Subsystems"
                  subtitle="Initialization status"
                  onClick={() => setActiveView("systems")}
                  accentColor="#6366f1"
                  info={{
                    title: 'Subsystems card',
                    bullets: [
                      'Shows total, online, and offline subsystem counts',
                      'Breakdown by category reveals which areas have initialization issues',
                    ],
                  }}
                >
                  <SubsystemStatusContent />
                </DashboardCard>
              ),
            },
            {
id: "database-health",
              content: (
                <DashboardCard
                  title="Database Health"
                  subtitle="SQLite integrity & status"
                  onClick={() => setActiveView("memory")}
                  accentColor="#22c55e"
                  info={{
                    title: 'Database Health card',
                    bullets: [
                      'Integrity, corruption, and size signals for memory DBs',
                      'Use to detect oversized or corrupted layers early',
                    ],
                  }}
                >
                  <DatabaseHealthContent />
                </DashboardCard>
              ),
            },
            {
id: "safety-stats",
              content: (
                <DashboardCard
                  title="Safety Monitor"
                  subtitle="Blocked ops & rollbacks"
                  onClick={() => setActiveView("sandbox")}
                  accentColor="#ef4444"
                  info={{
                    title: 'Safety Monitor card',
                    bullets: [
                      'Shows count of executions, blocked actions, and rollbacks',
                      'Mode breakdown reveals which subsystems trigger most safety stops',
                    ],
                  }}
                >
                  <SafetyStatsContent />
                </DashboardCard>
              ),
            },
            {
id: "benchmarks-live",
              content: (
                <DashboardCard
                  title="Benchmarks"
                  subtitle="Live benchmark runner"
                  onClick={() => setActiveView("benchmarks")}
                  accentColor="#f59e0b"
                  info={{
                    title: 'Benchmarks card',
                    bullets: [
                      'Run ATLAS benchmarks with real-time results streaming',
                      'Track progress, scores, and targets as tests execute',
                    ],
                  }}
                >
                  <div className="text-center py-4">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-xs text-white/60">Click to run benchmarks</div>
                  </div>
                </DashboardCard>
              ),
            },
            // === NEW CARDS - Memory Layers Deep Dive ===
            {
id: "attention-focus",
              content: (
                <DashboardCard
                  title="Attention Focus"
                  subtitle="L6 cognitive focus"
                  onClick={() => setActiveView("attention")}
                  accentColor="#06b6d4"
                  info={{
                    title: 'Attention Focus card',
                    bullets: [
                      'Primary and secondary focus targets from L6 attention store',
                      'Weights indicate relative priority across tasks/topics',
                    ],
                  }}
                >
                  <AttentionFocusContent />
                </DashboardCard>
              ),
            },
            {
id: "goals-tracker",
              content: (
                <DashboardCard
                  title="Goals Tracker"
                  subtitle="L8 active goals"
                  onClick={() => setActiveView("tasks")}
                  accentColor="#22c55e"
                  info={{
                    title: 'Goals card',
                    bullets: [
                      'Shows current goals, status, and % completion',
                      'Use to track planning progress and identify blocked work',
                    ],
                  }}
                >
                  <GoalsTrackerContent />
                </DashboardCard>
              ),
            },
            {
id: "skills-catalog",
              content: (
                <DashboardCard
                  title="Skills Catalog"
                  subtitle="L5 procedural skills"
                  onClick={() => setActiveView("learning")}
                  accentColor="#a855f7"
                  info={{
                    title: 'Skills card',
                    bullets: [
                      'Lists procedural skills with success rate and usage',
                      'Low success with high usage signals retraining opportunities',
                    ],
                  }}
                >
                  <SkillsCatalogContent />
                </DashboardCard>
              ),
            },
            {
id: "world-state",
              content: (
                <DashboardCard
                  title="World State"
                  subtitle="L7 environment state"
                  onClick={() => setActiveView("memory")}
                  accentColor="#eab308"
                  info={{
                    title: 'World State card',
                    bullets: [
                      'Snapshots of environment/state with timestamped updates',
                      'Use to verify external context ATLAS is referencing',
                    ],
                  }}
                >
                  <WorldStateContent />
                </DashboardCard>
              ),
            },
            // === NEW CARDS - Timeline & Events ===
            {
id: "episodes-timeline",
              content: (
                <DashboardCard
                  title="Episodes"
                  subtitle="L3 episodic events"
                  onClick={() => setActiveView("memory")}
                  accentColor="#8b5cf6"
                  info={{
                    title: 'Episodes card',
                    bullets: [
                      'Recent episodic events (L3) with timestamps and sessions',
                      'Use to audit recent interactions and sequences',
                    ],
                  }}
                >
                  <EpisodesTimelineContent />
                </DashboardCard>
              ),
            },
            {
id: "facts-knowledge",
              content: (
                <DashboardCard
                  title="Knowledge Base"
                  subtitle="L4 declarative facts"
                  onClick={() => setActiveView("memory")}
                  accentColor="#f43f5e"
                  info={{
                    title: 'Knowledge card',
                    bullets: [
                      'Top facts from L4 declarative memory with confidence',
                      'Use low-confidence items to schedule verification sweeps',
                    ],
                  }}
                >
                  <FactsKnowledgeContent />
                </DashboardCard>
              ),
            },
            // === NAVIGATION ===
            {
id: "quick-nav",
              content: (
                <DashboardCard
                  title="Quick Navigation"
                  subtitle="All console pages"
                  onClick={() => {}}
                  accentColor="#94a3b8"
                  info={{
                    title: 'Quick Navigation',
                    bullets: [
                      'Jump to any console page directly',
                    ],
                  }}
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { label: "Cognition", view: "cognition" as ActiveView, icon: "🧠" },
                      { label: "Architecture", view: "architecture" as ActiveView, icon: "🏗️" },
                      { label: "Assessment", view: "assessment" as ActiveView, icon: "📊" },
                      { label: "Memory", view: "memory" as ActiveView, icon: "💾" },
                      { label: "Learning", view: "learning" as ActiveView, icon: "📚" },
                      { label: "Analysis", view: "analysis" as ActiveView, icon: "🔍" },
                      { label: "Sandbox", view: "sandbox" as ActiveView, icon: "📦" },
                      { label: "Security", view: "security" as ActiveView, icon: "🔒" },
                      { label: "Systems", view: "systems" as ActiveView, icon: "⚙️" },
                      { label: "Logs", view: "logs" as ActiveView, icon: "📋" },
                      { label: "Tasks", view: "tasks" as ActiveView, icon: "✅" },
                      { label: "Attention", view: "attention" as ActiveView, icon: "🎯" },
                      { label: "Benchmarks", view: "benchmarks" as ActiveView, icon: "🏆" },
                      { label: "Recommendations", view: "recommendations" as ActiveView, icon: "💡" },
                    ]).map(({ label, view, icon }) => (
                      <div
                        key={view}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setActiveView(view); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setActiveView(view); } }}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                      >
                        <span className="text-[10px]">{icon}</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </DashboardCard>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
