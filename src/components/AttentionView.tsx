
import React, { useState, useEffect } from 'react';
import TabHeader from './TabHeader';
import { useHealth } from '@/contexts/HealthContext';

interface FocusState {
    timestamp: string;
    primary_goal: string | null;
    active_contexts: string[];
    attention_weights: Record<string, number>;
}

interface AttentionShift {
    timestamp: string;
    from_goal: string | null;
    to_goal: string;
    trigger: string;
    reason: string;
}

interface AttentionStats {
    focus_states_tracked: number;
    attention_shifts: number;
    has_current_focus: boolean;
    goals_tracked: Record<string, number>;
    average_active_contexts: number;
    current_goal: string | null;
    db_focus_states?: number;
    db_attention_shifts?: number;
}

export default function AttentionView() {
    const { health } = useHealth();
    const [currentFocus, setCurrentFocus] = useState<FocusState | null>(null);
    const [focusHistory, setFocusHistory] = useState<FocusState[]>([]);
    const [shiftHistory, setShiftHistory] = useState<AttentionShift[]>([]);
    const [stats, setStats] = useState<AttentionStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAttentionData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            setError(null);

            // Fetch current focus
            const focusRes = await fetch('/v1/memory/l6/focus');
            if (focusRes.ok) {
                const focusData = await focusRes.json();
                setCurrentFocus(focusData.primary_goal ? focusData : null);
            }

            // Fetch stats (includes patterns)
            const statsRes = await fetch('/api/memory/stats');
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                const l6Stats = statsData.l6 || {};
                setStats({
                    focus_states_tracked: l6Stats.focus_states_tracked || 0,
                    attention_shifts: l6Stats.attention_shifts || 0,
                    has_current_focus: l6Stats.has_current_focus || false,
                    goals_tracked: l6Stats.goals_tracked || {},
                    average_active_contexts: l6Stats.average_active_contexts || 0,
                    current_goal: l6Stats.current_goal || null,
                    db_focus_states: l6Stats.db_focus_states,
                    db_attention_shifts: l6Stats.db_attention_shifts,
                });
                
                // Extract focus and shift history from stats if available
                if (l6Stats.focus_history) {
                    setFocusHistory(l6Stats.focus_history);
                }
                if (l6Stats.shift_history) {
                    setShiftHistory(l6Stats.shift_history);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load attention data');
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttentionData(true);
        const interval = setInterval(() => fetchAttentionData(false), 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Loading attention data...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-red-400">
                Error: {error}
            </div>
        );
    }

    const goalsTracked = stats?.goals_tracked || {};
    const sortedGoals = Object.entries(goalsTracked).sort((a, b) => b[1] - a[1]);

    return (
        <div className="flex h-full flex-col">
            <TabHeader
                title="Attention Focus"
                subtitle={
                    stats?.current_goal
                        ? `Currently focused on: ${stats.current_goal}`
                        : 'No active focus'
                }
                statusConnected={health.backend === 'connected'}
                statusLabel={stats?.has_current_focus ? 'Focused' : 'Idle'}
            />
            
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {/* Stats Overview */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-white/90 mb-3">L6 Attention Statistics</h3>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-cyan-400">
                                {stats?.focus_states_tracked || 0}
                            </div>
                            <div className="text-xs text-gray-400">Focus States</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-400">
                                {stats?.attention_shifts || 0}
                            </div>
                            <div className="text-xs text-gray-400">Attention Shifts</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-amber-400">
                                {Object.keys(goalsTracked).length}
                            </div>
                            <div className="text-xs text-gray-400">Unique Goals</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-400">
                                {stats?.average_active_contexts?.toFixed(1) || '0'}
                            </div>
                            <div className="text-xs text-gray-400">Avg Contexts</div>
                        </div>
                    </div>
                </div>

                {/* Current Focus */}
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-white/90 mb-3">Current Focus</h3>
                {currentFocus && currentFocus.primary_goal ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                                <span className="text-lg font-medium text-white">
                                    {currentFocus.primary_goal}
                                </span>
                            </div>
                            
                            {/* Active contexts */}
                            {currentFocus.active_contexts && currentFocus.active_contexts.length > 0 && (
                                <div className="ml-6">
                                    <div className="text-xs text-gray-400 mb-1">Active Contexts:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {currentFocus.active_contexts.map((target: string, i: number) => (
                                            <span
                                                key={i}
                                                className="px-2 py-1 text-xs bg-gray-700 rounded text-gray-300"
                                            >
                                                {target}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Attention weights */}
                            {currentFocus.attention_weights && Object.keys(currentFocus.attention_weights).length > 0 && (
                                <div className="ml-6">
                                    <div className="text-xs text-gray-400 mb-1">Attention Weights:</div>
                                    <div className="space-y-1">
                                        {Object.entries(currentFocus.attention_weights)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([key, weight]) => (
                                                <div key={key} className="flex items-center gap-2">
                                                    <div className="w-24 text-xs text-gray-400 truncate">{key}</div>
                                                    <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-full bg-cyan-500/70"
                                                            style={{ width: `${Math.min(weight * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                    <div className="w-12 text-xs text-gray-400 text-right">
                                                        {(weight * 100).toFixed(0)}%
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : stats?.current_goal ? (
                        <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                            <span className="text-lg font-medium text-white">{stats.current_goal}</span>
                        </div>
                    ) : (
                        <div className="text-gray-500 italic">No active focus target</div>
                    )}
                </div>

                {/* Goals Distribution */}
                {sortedGoals.length > 0 && (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-white/90 mb-3">Goals Distribution</h3>
                        <div className="space-y-2">
                            {sortedGoals.slice(0, 10).map(([goal, count]) => {
                                const maxCount = sortedGoals[0][1];
                                const percentage = (count / maxCount) * 100;
                                return (
                                    <div key={goal} className="flex items-center gap-3">
                                        <div className="w-32 text-xs text-gray-400 truncate" title={goal}>
                                            {goal}
                                        </div>
                                        <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500/70"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <div className="w-8 text-xs text-gray-400 text-right">{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Attention Shifts History */}
                {shiftHistory.length > 0 && (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-white/90 mb-3">Recent Attention Shifts</h3>
                        <div className="space-y-2 max-h-64 overflow-auto">
                            {shiftHistory.slice(-20).reverse().map((shift, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 p-2 rounded bg-gray-700/50 text-xs"
                                >
                                    <div className="text-gray-500 w-16">
                                        {new Date(shift.timestamp).toLocaleTimeString()}
                                    </div>
                                    <div className="text-gray-400">{shift.from_goal || '(none)'}</div>
                                    <div className="text-cyan-400">→</div>
                                    <div className="text-white font-medium">{shift.to_goal}</div>
                                    <div className="flex-1 text-gray-500 text-right truncate" title={shift.reason}>
                                        {shift.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Focus History Timeline */}
                {focusHistory.length > 0 && (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                        <h3 className="text-sm font-semibold text-white/90 mb-3">Focus History</h3>
                        <div className="space-y-2 max-h-64 overflow-auto">
                            {focusHistory.slice(-20).reverse().map((focus, i) => (
                                <div
                                    key={i}
                                    className="flex items-center gap-3 p-2 rounded bg-gray-700/50 text-xs"
                                >
                                    <div className="text-gray-500 w-16">
                                        {new Date(focus.timestamp).toLocaleTimeString()}
                                    </div>
                                    <div className="text-white font-medium">
                                        {focus.primary_goal || '(no goal)'}
                                    </div>
                                    {focus.active_contexts && focus.active_contexts.length > 0 && (
                                        <div className="flex-1 flex gap-1 justify-end">
                                            {focus.active_contexts.slice(0, 3).map((ctx, j) => (
                                                <span
                                                    key={j}
                                                    className="px-1.5 py-0.5 bg-gray-600 rounded text-gray-300"
                                                >
                                                    {ctx}
                                                </span>
                                            ))}
                                            {focus.active_contexts.length > 3 && (
                                                <span className="text-gray-500">
                                                    +{focus.active_contexts.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!stats?.focus_states_tracked && !currentFocus && (
                    <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
                        <div className="text-gray-500 mb-2">No attention data recorded yet</div>
                        <div className="text-xs text-gray-600">
                            Attention states will appear here as ATLAS processes requests
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
