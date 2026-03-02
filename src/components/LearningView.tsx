
import React, { useState, useEffect, useCallback } from 'react';
import PatternsList from './PatternsList';
import PatternDetail from './PatternDetail';
import TabHeader from './TabHeader';
import { useHealth } from '@/contexts/HealthContext';
import {
    fetchLearningPatterns,
    FixPattern,
    LearningStats,
} from '@/lib/atlasLearningClient';

// --- Types ---
interface IntentCorrection {
    query: string;
    predicted_intent: string;
    correct_intent: string;
    confidence: number;
    timestamp: string;
    session_id: string | null;
    is_confirmation: boolean;
}

interface LowSuccessPattern {
    error_code: string;
    tool: string;
    success_rate: number;
    attempts: number;
    failure_reasons: string[];
}

interface ComprehensiveStats {
    pattern_learning: {
        total_commands: number;
        successful_commands: number;
        overall_success_rate: number;
        unique_patterns: number;
        workflow_patterns: number;
    };
    feedback: {
        total_feedback: number;
        by_type: Record<string, number>;
        unique_corrections: number;
    };
    fix_learning: {
        total_patterns: number;
        total_attempts: number;
        total_successes: number;
        overall_success_rate: number;
        high_success_patterns: LowSuccessPattern[];
        low_success_patterns: LowSuccessPattern[];
    };
    proposal_learning: {
        total_proposals: number;
        overall_success_rate: number;
        by_type: Record<string, unknown>;
    };
    feature_requests: {
        total_requests: number;
        high_urgency: number;
        detected_this_session: number;
    };
    improvement_suggestions: number;
}

type LearningTab = 'overview' | 'corrections' | 'patterns';

// --- Stat card helper ---
function StatCard({ label, value, color = 'text-blue-400', sub }: {
    label: string; value: string | number; color?: string; sub?: string;
}) {
    return (
        <div className="bg-gray-800 rounded-lg p-3">
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
            {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
        </div>
    );
}

// --- Success rate bar ---
function RateBar({ rate, label }: { rate: number; label: string }) {
    const pct = Math.max(0, Math.min(100, rate * 100));
    const color = pct >= 70 ? 'from-green-500 to-emerald-500'
        : pct >= 40 ? 'from-amber-500 to-yellow-500'
        : 'from-red-500 to-orange-500';
    return (
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{label}</span>
                <span className="text-white/70 tabular-nums">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all`}
                     style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

// --- Overview tab ---
function OverviewTab({ cs, patterns }: { cs: ComprehensiveStats | null; patterns: FixPattern[] }) {
    if (!cs) return <div className="p-8 text-gray-500 text-center">Loading comprehensive stats...</div>;

    const fl = cs.fix_learning;
    const pl = cs.pattern_learning;
    const pr = cs.proposal_learning;
    const fr = cs.feature_requests;

    // Group fix patterns by tool
    const byTool: Record<string, FixPattern[]> = {};
    for (const p of patterns) {
        (byTool[p.tool] ??= []).push(p);
    }

    return (
        <div className="overflow-auto h-full p-4 space-y-5">
            {/* Top-level summary */}
            <div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">Learning Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Fix Patterns" value={fl.total_patterns} color="text-cyan-400" sub={`${fl.total_attempts} attempts`} />
                    <StatCard label="Fix Success Rate" value={`${(fl.overall_success_rate * 100).toFixed(1)}%`}
                              color={fl.overall_success_rate >= 0.5 ? 'text-green-400' : 'text-amber-400'}
                              sub={`${fl.total_successes} / ${fl.total_attempts}`} />
                    <StatCard label="Command Patterns" value={pl.unique_patterns} color="text-purple-400" sub={`${pl.total_commands} commands`} />
                    <StatCard label="Proposals" value={pr.total_proposals} color="text-blue-400"
                              sub={pr.total_proposals > 0 ? `${(pr.overall_success_rate * 100).toFixed(0)}% success` : 'None yet'} />
                </div>
            </div>

            {/* Fix patterns by tool */}
            <div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">Fix Patterns by Tool</h3>
                <div className="space-y-3">
                    {Object.entries(byTool).map(([tool, toolPatterns]) => {
                        const totalAttempts = toolPatterns.reduce((s, p) => s + p.attempts, 0);
                        const totalSuccesses = toolPatterns.reduce((s, p) => s + p.successes, 0);
                        const rate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0;
                        return (
                            <div key={tool} className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-white/80 font-mono">{tool}</span>
                                    <span className="text-xs text-gray-400">
                                        {toolPatterns.length} pattern{toolPatterns.length !== 1 ? 's' : ''} &middot; {totalAttempts} attempts
                                    </span>
                                </div>
                                <RateBar rate={rate} label="Success rate" />
                                <div className="mt-2 space-y-1">
                                    {toolPatterns.sort((a, b) => b.attempts - a.attempts).map(p => {
                                        const pRate = p.attempts > 0 ? p.successes / p.attempts : 0;
                                        return (
                                            <div key={`${p.tool}:${p.error_code}`}
                                                 className="flex items-center justify-between text-xs py-1 border-t border-gray-700">
                                                <span className="font-mono text-white/70">{p.error_code}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-500">{p.attempts} tries</span>
                                                    <span className={pRate >= 0.5 ? 'text-green-400' : pRate > 0 ? 'text-amber-400' : 'text-red-400'}>
                                                        {(pRate * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(byTool).length === 0 && (
                        <div className="text-gray-500 text-sm text-center py-4">No fix patterns recorded yet</div>
                    )}
                </div>
            </div>

            {/* Problematic patterns with failure reasons */}
            {fl.low_success_patterns.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-2">Problematic Patterns (Low Success)</h3>
                    <div className="space-y-2">
                        {fl.low_success_patterns.map((p, i) => (
                            <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-mono text-sm text-white/80">{p.tool}:{p.error_code}</span>
                                    <span className="text-xs text-red-400">{(p.success_rate * 100).toFixed(1)}% success ({p.attempts} attempts)</span>
                                </div>
                                {p.failure_reasons.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-[10px] text-gray-400 mb-1">Recent failure reasons:</div>
                                        {p.failure_reasons.map((reason, ri) => (
                                            <div key={ri} className="text-xs text-red-300/70 pl-2 border-l border-red-500/30 mb-1 break-all">
                                                {reason}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* High success patterns */}
            {fl.high_success_patterns.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-green-400 mb-2">Mastered Patterns (High Success)</h3>
                    <div className="space-y-2">
                        {fl.high_success_patterns.map((p, i) => (
                            <div key={i} className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 flex items-center justify-between">
                                <span className="font-mono text-sm text-white/80">{p.tool}:{p.error_code}</span>
                                <span className="text-xs text-green-400">{(p.success_rate * 100).toFixed(1)}% success ({p.attempts} attempts)</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Other subsystems */}
            <div>
                <h3 className="text-sm font-semibold text-white/90 mb-2">Other Learning Subsystems</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Feedback Processing</div>
                        <div className="text-lg font-bold text-blue-400 tabular-nums">{cs.feedback.total_feedback}</div>
                        <div className="text-[10px] text-gray-500">
                            {cs.feedback.by_type.correction ?? 0} corrections &middot; {cs.feedback.by_type.positive ?? 0} positive &middot; {cs.feedback.by_type.negative ?? 0} negative
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Feature Requests Detected</div>
                        <div className="text-lg font-bold text-purple-400 tabular-nums">{fr.total_requests}</div>
                        <div className="text-[10px] text-gray-500">
                            {fr.high_urgency} high urgency &middot; {fr.detected_this_session} this session
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Workflow Patterns</div>
                        <div className="text-lg font-bold text-amber-400 tabular-nums">{pl.workflow_patterns}</div>
                        <div className="text-[10px] text-gray-500">
                            {pl.overall_success_rate > 0 ? `${(pl.overall_success_rate * 100).toFixed(0)}% command success rate` : 'No commands recorded yet'}
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Improvement Suggestions</div>
                        <div className="text-lg font-bold text-cyan-400 tabular-nums">{cs.improvement_suggestions}</div>
                        <div className="text-[10px] text-gray-500">
                            Auto-generated from learning data
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Corrections list component ---
function CorrectionsList({ corrections }: { corrections: IntentCorrection[] }) {
    if (corrections.length === 0) {
        return (
            <div className="p-8 text-gray-500 text-center">
                No intent corrections recorded yet.
                <div className="text-xs text-gray-600 mt-2">
                    Corrections are recorded when a user fixes an incorrect intent prediction.
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-auto h-full">
            <div className="space-y-2 p-4">
                {corrections.map((c, idx) => {
                    const isCorrection = !c.is_confirmation;
                    const date = (() => {
                        try {
                            const d = new Date(c.timestamp);
                            return isNaN(d.getTime()) ? c.timestamp : d.toLocaleString();
                        } catch {
                            return c.timestamp;
                        }
                    })();

                    return (
                        <div
                            key={`${c.timestamp}-${idx}`}
                            className={`rounded-lg border p-4 ${
                                isCorrection
                                    ? 'border-amber-500/30 bg-amber-500/5'
                                    : 'border-green-500/30 bg-green-500/5'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white/90 font-medium mb-2">
                                        &ldquo;{c.query}&rdquo;
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-mono">
                                            {c.predicted_intent}
                                        </span>
                                        <span className="text-white/40">&rarr;</span>
                                        <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-mono">
                                            {c.correct_intent}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className={`text-xs font-medium px-2 py-0.5 rounded ${
                                        isCorrection
                                            ? 'bg-amber-500/20 text-amber-400'
                                            : 'bg-green-500/20 text-green-400'
                                    }`}>
                                        {isCorrection ? 'Correction' : 'Confirmation'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        Confidence: {(c.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-500 mt-2">
                                {date}{c.session_id ? ` • Session: ${c.session_id}` : ''}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function LearningView() {
    const { health } = useHealth();
    const [activeTab, setActiveTab] = useState<LearningTab>('overview');
    const [patterns, setPatterns] = useState<FixPattern[]>([]);
    const [stats, setStats] = useState<LearningStats | null>(null);
    const [compStats, setCompStats] = useState<ComprehensiveStats | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    const [corrections, setCorrections] = useState<IntentCorrection[]>([]);
    const [correctionsTotal, setCorrectionsTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleSelect = useCallback((patternId: string) => {
        setSelectedPattern(patternId);
    }, []);

    // Load fix patterns
    const loadPatterns = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            setError(null);
            const data = await fetchLearningPatterns();
            setPatterns(data.patterns);
            setStats(data.stats);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load learning patterns');
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    // Load corrections
    const loadCorrections = async () => {
        try {
            const res = await fetch('/api/atlasLearning/corrections?limit=50');
            if (res.ok) {
                const data = await res.json();
                setCorrections(data.corrections ?? []);
                setCorrectionsTotal(data.total ?? 0);
            }
        } catch { /* non-blocking */ }
    };

    // Load comprehensive stats
    const loadCompStats = async () => {
        try {
            const res = await fetch('/api/atlasLearning/stats');
            if (res.ok) setCompStats(await res.json());
        } catch { /* non-blocking */ }
    };

    useEffect(() => {
        loadPatterns(true);
        loadCorrections();
        loadCompStats();
        const interval = setInterval(() => {
            loadPatterns(false);
            loadCorrections();
            loadCompStats();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div className="flex items-center justify-center h-full text-gray-400">Loading learning data...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-full text-red-400">Error: {error}</div>;
    }

    const selected = selectedPattern
        ? patterns.find(p => `${p.tool}:${p.error_code}` === selectedPattern) || null
        : null;

    const totalLearned = (compStats?.fix_learning.total_patterns ?? 0)
        + (compStats?.pattern_learning.unique_patterns ?? 0)
        + correctionsTotal;

    return (
        <div className="flex h-full flex-col">
            <TabHeader
                title="Learning System"
                subtitle={`${totalLearned} items learned across ${compStats ? 5 : 0} subsystems`}
                statusConnected={health.learning === 'connected'}
                statusLabel={health.learning === 'connected' ? 'Active' : 'Inactive'}
            />

            {/* Tab switcher */}
            <div className="flex border-b border-gray-700 bg-gray-900">
                {([
                    ['overview', 'Overview'] as const,
                    ['corrections', `Intent Corrections (${correctionsTotal})`] as const,
                    ['patterns', `Fix Patterns (${stats?.total_patterns ?? 0})`] as const,
                ]).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === id
                                ? 'text-blue-400 border-b-2 border-blue-400'
                                : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' ? (
                <div className="flex-1 overflow-hidden">
                    <OverviewTab cs={compStats} patterns={patterns} />
                </div>
            ) : activeTab === 'corrections' ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="bg-gray-800 border-b border-gray-700 p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <StatCard label="Total Events" value={correctionsTotal} color="text-blue-400" />
                            <StatCard label="Corrections" value={corrections.filter(c => !c.is_confirmation).length} color="text-amber-400" />
                            <StatCard label="Confirmations" value={corrections.filter(c => c.is_confirmation).length} color="text-green-400" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <CorrectionsList corrections={corrections} />
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-2/3 border-r border-gray-700 overflow-hidden flex flex-col">
                        {stats && (
                            <div className="bg-gray-800 border-b border-gray-700 p-4">
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <StatCard label="Attempts" value={stats.total_attempts} color="text-blue-400" />
                                    <StatCard label="Successes" value={stats.total_successes} color="text-green-400" />
                                    <StatCard label="Failures" value={stats.total_failures} color="text-red-400" />
                                    <StatCard label="Success Rate" value={`${stats.overall_success_rate.toFixed(1)}%`} color="text-purple-400" />
                                </div>
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                            <PatternsList patterns={patterns} selectedPattern={selectedPattern} onSelect={handleSelect} />
                        </div>
                    </div>
                    <div className="w-1/3 overflow-hidden">
                        <PatternDetail pattern={selected} />
                    </div>
                </div>
            )}
        </div>
    );
}
