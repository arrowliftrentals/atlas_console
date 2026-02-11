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

export default function LearningView() {
    const { health } = useHealth();
    const [patterns, setPatterns] = useState<FixPattern[]>([]);
    const [stats, setStats] = useState<LearningStats | null>(null);
    const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
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

    // Initial load and auto-refresh every 30 seconds (reduced from 10s)
    useEffect(() => {
        loadPatterns(true);
        const interval = setInterval(() => loadPatterns(false), 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Loading learning patterns...
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
                        ? `${stats.total_patterns} pattern${stats.total_patterns !== 1 ? 's' : ''} learned • ${stats.overall_success_rate.toFixed(1)}% success rate`
                        : 'No patterns learned yet'
                }
                statusConnected={health.learning === 'connected'}
                statusLabel={health.learning === 'connected' ? 'Active' : 'Inactive'}
            />
            
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
        </div>
    );
}
