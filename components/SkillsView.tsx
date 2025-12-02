'use client';

import React, { useState, useEffect } from 'react';
import SkillsList from './SkillsList';
import SkillDetail from './SkillDetail';
import {
    fetchSkillExecutions,
    fetchSkillExecutionDetail,
    SkillExecutionSummary,
    SkillExecutionDetail,
} from '@/lib/atlasSkillsClient';

export default function SkillsView() {
    const [executions, setExecutions] = useState<SkillExecutionSummary[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedExecution, setSelectedExecution] = useState<SkillExecutionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load executions list
    useEffect(() => {
        async function loadExecutions() {
            try {
                setLoading(true);
                setError(null);
                const data = await fetchSkillExecutions();
                setExecutions(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load skill executions');
            } finally {
                setLoading(false);
            }
        }
        loadExecutions();
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
        <div className="flex h-full">
            {/* Left panel: List */}
            <div className="w-2/3 border-r border-gray-700 overflow-hidden">
                <div className="p-4 bg-gray-800 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-100">Skill Execution History</h2>
                    <p className="text-sm text-gray-400 mt-1">
                        {executions.length} execution{executions.length !== 1 ? 's' : ''} logged
                    </p>
                </div>
                <SkillsList
                    executions={executions}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                />
            </div>

            {/* Right panel: Detail */}
            <div className="w-1/3 overflow-hidden">
                <SkillDetail execution={selectedExecution} />
            </div>
        </div>
    );
}
