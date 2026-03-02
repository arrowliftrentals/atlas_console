
import React, { useState, useEffect, useCallback } from 'react';
import SkillsList from './SkillsList';
import SkillDetail from './SkillDetail';
import TabHeader from './TabHeader';
import { useHealth } from '@/contexts/HealthContext';
import {
    fetchSkillExecutions,
    fetchSkillExecutionDetail,
    SkillExecutionSummary,
    SkillExecutionDetail,
} from '@/lib/atlasSkillsClient';

export default function SkillsView() {
    const { health } = useHealth();
    const [executions, setExecutions] = useState<SkillExecutionSummary[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedExecution, setSelectedExecution] = useState<SkillExecutionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Memoize the onSelect callback to prevent SkillsList re-renders
    const handleSelect = useCallback((id: number) => {
        setSelectedId(id);
    }, []);

    // Load executions list
    const loadExecutions = async (isInitial = false) => {
        try {
            // Only show loading spinner on initial load, not on refreshes
            if (isInitial) {
                setLoading(true);
            }
            setError(null);
            const data = await fetchSkillExecutions();
            setExecutions(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load skill executions');
        } finally {
            if (isInitial) {
                setLoading(false);
            }
        }
    };

    // Initial load and auto-refresh every 30 seconds (reduced from 5s)
    useEffect(() => {
        loadExecutions(true);
        const interval = setInterval(() => loadExecutions(false), 30000);
        return () => clearInterval(interval);
    }, []);

    // Load selected execution detail
    useEffect(() => {
        if (selectedId === null) {
            setSelectedExecution(null);
            return;
        }

        async function loadDetail() {
            if (selectedId === null) return;
            try {
                const detail = await fetchSkillExecutionDetail(selectedId);
                setSelectedExecution(detail);
            } catch (err) {
                console.error('Failed to load execution detail:', err);
                setSelectedExecution(null);
            }
        }
        loadDetail();
    }, [selectedId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Loading skill executions...
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

    return (
        <div className="flex h-full flex-col">
            <TabHeader
                title="Skills Library"
                subtitle={`${executions.length} execution${executions.length !== 1 ? 's' : ''} logged`}
                statusConnected={health.skills === 'connected'}
                statusLabel={health.skills === 'connected' ? 'Connected' : 'Disconnected'}
            />
            
            <div className="flex flex-1 overflow-hidden">
                {/* Left panel: List */}
                <div className="w-2/3 border-r border-gray-700 overflow-hidden">
                    <SkillsList
                        executions={executions}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                    />
                </div>

                {/* Right panel: Detail */}
                <div className="w-1/3 overflow-hidden">
                    <SkillDetail execution={selectedExecution} />
                </div>
            </div>
        </div>
    );
}
