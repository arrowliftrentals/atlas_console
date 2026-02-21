'use client';

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

// --- Types for intent corrections ---
interface IntentCorrection {
    query: string;
    predicted_intent: string;
    correct_intent: string;
    confidence: number;
    timestamp: string;
    session_id: string | null;
    is_confirmation: boolean;
}

type LearningTab = 'corrections' | 'patterns';

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
    const [activeTab, setActiveTab] = useState<LearningTab>('corrections');
    const [patterns, setPatterns] = useState<FixPattern[]>([]);
    const [stats, setStats] = useState<LearningStats | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
    const [corrections, setCorrections] = useState<IntentCorrection[]>([]);
    const [correctionsTotal, setCorrectionsTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Memoize the onSelect callback to prevent PatternsList re-renders
    const handleSelect = useCallback((patternId: string) => {
        setSelectedPattern(patternId);
    }, []);

    // Load patterns
    const loadPatterns = async (isInitial = false) => {
        try {
            if (isInitial) {
                setLoading(true);
            }
            setError(null);
            const data = await fetchLearningPatterns();
            setPatterns(data.patterns);
            setStats(data.stats);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load learning patterns');
        } finally {
            if (isInitial) {
                setLoading(false);
            }
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
        } catch {
            // Non-blocking: corrections are supplementary
        }
    };

    // Initial load and auto-refresh
    useEffect(() => {
        loadPatterns(true);
        loadCorrections();
        const interval = setInterval(() => {
            loadPatterns(false);
            loadCorrections();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Loading learning data...
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

    const selected = selectedPattern 
        ? patterns.find(p => `${p.tool}:${p.error_code}` === selectedPattern) || null
        : null;

    return (
        <div className="flex h-full flex-col">
            <TabHeader
                title="Learning System"
                subtitle={
                    stats 
                        ? `${stats.total_patterns} pattern${stats.total_patterns !== 1 ? 's' : ''} learned • ${correctionsTotal} correction${correctionsTotal !== 1 ? 's' : ''} recorded`
                        : 'No patterns learned yet'
                }
                statusConnected={health.learning === 'connected'}
                statusLabel={health.learning === 'connected' ? 'Active' : 'Inactive'}
            />

            {/* Tab switcher */}
            <div className="flex border-b border-gray-700 bg-gray-900">
                <button
                    onClick={() => setActiveTab('corrections')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'corrections'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    Intent Corrections ({correctionsTotal})
                </button>
                <button
                    onClick={() => setActiveTab('patterns')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'patterns'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    Fix Patterns ({stats?.total_patterns ?? 0})
                </button>
            </div>
            
            {activeTab === 'corrections' ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Corrections stats */}
                    <div className="bg-gray-800 border-b border-gray-700 p-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-blue-400">{correctionsTotal}</div>
                                <div className="text-xs text-gray-400">Total Events</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-amber-400">
                                    {corrections.filter(c => !c.is_confirmation).length}
                                </div>
                                <div className="text-xs text-gray-400">Corrections</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-400">
                                    {corrections.filter(c => c.is_confirmation).length}
                                </div>
                                <div className="text-xs text-gray-400">Confirmations</div>
                            </div>
                        </div>
                    </div>
                    {/* Corrections list */}
                    <div className="flex-1 overflow-hidden">
                        <CorrectionsList corrections={corrections} />
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 overflow-hidden">
                    {/* Left panel: Stats + List */}
                    <div className="w-2/3 border-r border-gray-700 overflow-hidden flex flex-col">
                        {/* Stats Card */}
                        {stats && (
                            <div className="bg-gray-800 border-b border-gray-700 p-4">
                                <div className="grid grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-blue-400">{stats.total_attempts}</div>
                                        <div className="text-xs text-gray-400">Attempts</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-400">{stats.total_successes}</div>
                                        <div className="text-xs text-gray-400">Successes</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-red-400">{stats.total_failures}</div>
                                        <div className="text-xs text-gray-400">Failures</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-purple-400">
                                            {stats.overall_success_rate.toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-400">Success Rate</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Patterns List */}
                        <div className="flex-1 overflow-hidden">
                            <PatternsList
                                patterns={patterns}
                                selectedPattern={selectedPattern}
                                onSelect={handleSelect}
                            />
                        </div>
                    </div>

                    {/* Right panel: Detail */}
                    <div className="w-1/3 overflow-hidden">
                        <PatternDetail pattern={selected} />
                    </div>
                </div>
            )}
        </div>
    );
}
