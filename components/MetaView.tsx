"use client";

import React, { useEffect, useState } from "react";
import { useHealth } from "@/contexts/HealthContext";

interface MetaAssessment {
    _storage_id?: number;
    generated_at: string;
    system_info: {
        version: string;
        phase: string;
        attempt: string;
        python_version: string;
        platform: string;
        project_name: string;
    };
    capability_inventory: any;
    memory_architecture: any;
    architectural_maturity: any;
    jarvis_gap_analysis: any;
    reliability_metrics: any;
    known_limitations: any;
    recommendations?: any;
    overall_score?: any;
}

interface HistorySummary {
    id: number;
    generated_at: string;
    version: string;
    phase: string;
    attempt: string;
    created_at: string;
}

interface AssessmentChange {
    type: "added" | "removed" | "changed";
    path: string;
    old_value?: any;
    new_value?: any;
}

const BACKEND_URL = "http://localhost:8000";

const MetaView: React.FC = () => {
    const { health } = useHealth();
    const [assessment, setAssessment] = useState<MetaAssessment | null>(null);
    const [history, setHistory] = useState<HistorySummary[]>([]);
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
    const [changes, setChanges] = useState<AssessmentChange[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<string | null>("capability_inventory");
    const [showHistory, setShowHistory] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [cleanupConfirm, setCleanupConfirm] = useState(false);

    const loadLatestAssessment = async () => {
        setLoading(true);
        setError(null);
        try {
            await fetchHistory();
            
            // Try to load latest from history first
            const historyResp = await fetch(`${BACKEND_URL}/v1/meta/history?limit=1`);
            if (historyResp.ok) {
                const historyData = await historyResp.json();
                if (historyData.assessments && historyData.assessments.length > 0) {
                    const latestId = historyData.assessments[0].id;
                    await loadHistoricalAssessment(latestId);
                    return;
                }
            }
            
            // No assessments exist, show message
            setError("No assessments available. Click 'New Assessment' to generate one.");
        } catch (e: any) {
            console.error("Failed to load latest assessment:", e);
            setError(`Failed to load assessment: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const generateNewAssessment = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/v1/meta/assess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setAssessment(data);
            setSelectedAssessmentId(data._storage_id);
            setChanges([]); // New assessment has no changes
            await fetchHistory();
        } catch (e: any) {
            console.error("Meta-assessment generation error:", e);
            setError(`Failed to generate meta-assessment: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/v1/meta/history?limit=50`);
            if (!response.ok) return;
            const data = await response.json();
            setHistory(data.assessments || []);
        } catch (e) {
            console.error("Failed to fetch history:", e);
        }
    };

    const loadHistoricalAssessment = async (assessmentId: number) => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/v1/meta/assess/${assessmentId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            setAssessment(data);
            setSelectedAssessmentId(assessmentId);
            
            // Calculate diff if not the latest
            if (history.length > 0 && assessmentId !== history[0].id) {
                const previousIndex = history.findIndex(h => h.id === assessmentId);
                if (previousIndex > 0) {
                    await fetchDiff(assessmentId, history[previousIndex - 1].id);
                } else {
                    setChanges([]);
                }
            } else {
                setChanges([]);
            }
        } catch (e: any) {
            console.error("Failed to load historical assessment:", e);
            setError(`Failed to load assessment: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchDiff = async (currentId: number, previousId: number) => {
        try {
            const response = await fetch(`${BACKEND_URL}/v1/meta/diff/${currentId}/${previousId}`);
            if (!response.ok) return;
            const data = await response.json();
            setChanges(data.changes || []);
        } catch (e) {
            console.error("Failed to fetch diff:", e);
            setChanges([]);
        }
    };

    const deleteAssessment = async (assessmentId: number) => {
        try {
            const response = await fetch(`${BACKEND_URL}/v1/meta/assess/${assessmentId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            // Refresh history and load latest if we deleted the current one
            await fetchHistory();
            if (selectedAssessmentId === assessmentId) {
                await loadLatestAssessment();
            }
            setDeleteConfirmId(null);
        } catch (e: any) {
            console.error("Failed to delete assessment:", e);
            setError(`Failed to delete: ${e.message}`);
        }
    };

    const cleanupOldAssessments = async (keepCount: number = 5) => {
        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/v1/meta/cleanup?keep=${keepCount}`, {
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            await fetchHistory();
            await loadLatestAssessment();
            setCleanupConfirm(false);
            // Could show success message: data.deleted_count, data.kept_count
        } catch (e: any) {
            console.error("Failed to cleanup:", e);
            setError(`Failed to cleanup: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLatestAssessment();
    }, []);

    const getChangesForPath = (path: string): AssessmentChange | null => {
        return changes.find(c => c.path === path || c.path.startsWith(path + ".")) || null;
    };

    const isChanged = (path: string): boolean => {
        return changes.some(c => c.path === path || c.path.startsWith(path + "."));
    };

    const renderChangeIndicator = (change: AssessmentChange) => {
        if (change.type === "added") {
            return <span className="text-green-400 text-xs ml-2">(+)</span>;
        } else if (change.type === "removed") {
            return <span className="text-red-400 text-xs ml-2">(-)</span>;
        } else if (change.type === "changed") {
            return <span className="text-yellow-400 text-xs ml-2">(~)</span>;
        }
        return null;
    };

    const renderFormattedRecommendations = (recommendations: any) => {
        if (!recommendations) return null;

        return (
            <div className="space-y-6">
                {Object.entries(recommendations).map(([categoryKey, items]: [string, any]) => {
                    if (!Array.isArray(items)) return null;
                    
                    const categoryTitle = categoryKey.replace(/_/g, " ").split(" ").map(w => 
                        w.charAt(0).toUpperCase() + w.slice(1)
                    ).join(" ");

                    return (
                        <div key={categoryKey} className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-200 border-b border-gray-700 pb-1">
                                {categoryTitle}
                            </h3>
                            <div className="space-y-3">
                                {items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-gray-800/50 rounded p-3 space-y-1.5">
                                        {item.priority && (
                                            <span className={`text-xs font-bold ${
                                                item.priority === 'P0' ? 'text-red-400' :
                                                item.priority === 'P1' ? 'text-yellow-400' :
                                                'text-blue-400'
                                            }`}>
                                                [{item.priority}]
                                            </span>
                                        )}
                                        <p className="text-xs font-semibold text-gray-200">
                                            {item.recommendation || item.area}
                                        </p>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            <span className="font-semibold">Rationale:</span> {item.rationale}
                                        </p>
                                        {item.impact && (
                                            <p className="text-xs text-gray-400">
                                                <span className="font-semibold">Impact:</span> {item.impact}
                                            </p>
                                        )}
                                        {item.action && (
                                            <p className="text-xs text-gray-400">
                                                <span className="font-semibold">Action:</span> {item.action}
                                            </p>
                                        )}
                                        {item.approach && (
                                            <p className="text-xs text-gray-400">
                                                <span className="font-semibold">Approach:</span> {item.approach}
                                            </p>
                                        )}
                                        {item.effort && (
                                            <p className="text-xs text-gray-500">
                                                <span className="font-semibold">Effort:</span> {item.effort}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMissedOpportunities = (opportunities: string[]) => {
        if (!opportunities || !Array.isArray(opportunities)) return null;

        return (
            <div className="space-y-2">
                {opportunities.map((opp, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-yellow-900/10 border-l-2 border-yellow-600 pl-3 py-2">
                        <span className="text-yellow-500 text-xs font-bold mt-0.5">⚠</span>
                        <p className="text-xs text-gray-300 leading-relaxed">{opp}</p>
                    </div>
                ))}
            </div>
        );
    };

    const renderExecutiveSummary = (overallScore: any) => {
        if (!overallScore) return <p className="text-xs text-gray-400">No summary available.</p>;

        return (
            <div className="space-y-4">
                {/* Overall Score Badge */}
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-200 mb-1">Overall System Score</p>
                            <p className="text-xs text-gray-400">{overallScore.interpretation}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-bold text-blue-400">{overallScore.overall_score}</p>
                            <p className="text-xs text-gray-400">out of 100</p>
                        </div>
                    </div>
                </div>

                {/* Section Scores */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-300 mb-3 border-b border-gray-700 pb-1">
                        Section Breakdown
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(overallScore.section_scores || {}).map(([key, score]: [string, any]) => {
                            const label = key.replace(/_/g, " ").split(" ").map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(" ");
                            
                            const scoreColor = score >= 70 ? "text-green-400" :
                                             score >= 50 ? "text-yellow-400" :
                                             score >= 30 ? "text-orange-400" :
                                             "text-red-400";

                            return (
                                <div key={key} className="bg-gray-800/50 rounded p-3">
                                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                                    <p className={`text-lg font-bold ${scoreColor}`}>{score}/100</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Key Findings */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">
                        Key Findings
                    </h3>
                    <div className="space-y-2 text-xs text-gray-300 leading-relaxed">
                        <p>
                            <span className="font-semibold">Current Maturity:</span> ATLAS is in early development phase with {overallScore.section_scores?.capability_inventory || 0}% of planned capabilities operational.
                        </p>
                        <p>
                            <span className="font-semibold">Strongest Area:</span> Architectural foundation scores {Math.max(...(Object.values(overallScore.section_scores || {}) as number[]))}/100, indicating solid design principles.
                        </p>
                        <p>
                            <span className="font-semibold">Primary Gap:</span> Jarvis-level AI gap at {overallScore.section_scores?.jarvis_gap_analysis || 0}/100 reflects significant distance from production-ready autonomous assistant.
                        </p>
                        <p>
                            <span className="font-semibold">Immediate Priority:</span> Critical path items include testing infrastructure, sandbox VM integration, and memory layer activation.
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const renderMemoryArchitectureSection = (content: any) => {
        if (!content) return null;

        const score = content.score;

        return (
            <div className="space-y-4">
                {/* Score Display */}
                {score !== undefined && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-300">Section Score</p>
                            <p className={`text-xl font-bold ${
                                score >= 70 ? 'text-green-400' :
                                score >= 50 ? 'text-yellow-400' :
                                score >= 30 ? 'text-orange-400' :
                                'text-red-400'
                            }`}>
                                {score}/100
                            </p>
                        </div>
                    </div>
                )}

                {/* Section Content */}
                <div className="space-y-3">
                    {/* 1. Cognitive Design Summary */}
                    {content.cognitive_design_summary && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                1. Cognitive Design Overview
                            </h4>
                            <div className="pl-4 border-l-2 border-gray-700">
                                <div className="bg-blue-900/10 border border-blue-800 rounded p-3">
                                    <p className="text-xs text-gray-300 leading-relaxed">
                                        {content.cognitive_design_summary}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Implementation Status */}
                    {content.implementation_status && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                2. Implementation Status
                            </h4>
                            <div className="pl-4 border-l-2 border-gray-700">
                                {renderSection("implementation_status", content.implementation_status, "memory_architecture")}
                            </div>
                        </div>
                    )}

                    {/* 3. Actual Usage */}
                    {content.actual_usage && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                3. Actual Usage
                            </h4>
                            <div className="pl-4 border-l-2 border-gray-700">
                                {renderSection("actual_usage", content.actual_usage, "memory_architecture")}
                            </div>
                        </div>
                    )}

                    {/* 4. Missed Opportunities */}
                    {content.missed_opportunities && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                4. Missed Opportunities
                            </h4>
                            <div className="pl-4 border-l-2 border-gray-700">
                                {renderMissedOpportunities(content.missed_opportunities)}
                            </div>
                        </div>
                    )}

                    {/* 5. Other fields */}
                    {Object.entries(content)
                        .filter(([key]) => !['score', 'implementation_score', 'usage_score', 'cognitive_design_summary', 'implementation_status', 'actual_usage', 'missed_opportunities'].includes(key))
                        .map(([key, value], idx) => {
                            const heading = key.replace(/_/g, " ").split(" ").map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(" ");

                            return (
                                <div key={key} className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        {5 + idx}. {heading}
                                    </h4>
                                    <div className="pl-4 border-l-2 border-gray-700">
                                        {renderSection(key, value, "memory_architecture")}
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        );
    };

    const renderBusinessFormatSection = (sectionKey: string, content: any) => {
        if (!content || typeof content !== 'object') {
            return renderSection(sectionKey, content, "");
        }

        // Extract score if present
        const score = content.score;
        const hasScore = score !== undefined;

        return (
            <div className="space-y-4">
                {/* Score Display */}
                {hasScore && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-300">Section Score</p>
                            <p className={`text-xl font-bold ${
                                score >= 70 ? 'text-green-400' :
                                score >= 50 ? 'text-yellow-400' :
                                score >= 30 ? 'text-orange-400' :
                                'text-red-400'
                            }`}>
                                {score}/100
                            </p>
                        </div>
                    </div>
                )}

                {/* Section Content */}
                <div className="space-y-3">
                    {Object.entries(content)
                        .filter(([key]) => key !== 'score')
                        .map(([key, value], idx) => {
                            // Format key as heading
                            const heading = key.replace(/_/g, " ").split(" ").map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(" ");

                            return (
                                <div key={key} className="space-y-2">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                        {idx + 1}. {heading}
                                    </h4>
                                    <div className="pl-4 border-l-2 border-gray-700">
                                        {renderSection(key, value, sectionKey)}
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        );
    };

    const renderSection = (title: string, content: any, pathPrefix: string = "") => {
        const currentPath = pathPrefix ? `${pathPrefix}.${title}` : title;
        const change = getChangesForPath(currentPath);
        const hasChanges = isChanged(currentPath);
        
        const textColor = change ? "text-red-400" : "text-gray-300";

        if (typeof content === "string") {
            return (
                <p className={`${textColor} text-xs leading-relaxed`}>
                    {content}
                    {change && renderChangeIndicator(change)}
                </p>
            );
        }

        if (Array.isArray(content)) {
            return (
                <ul className="list-disc list-inside space-y-1 text-xs">
                    {content.map((item, i) => {
                        const itemPath = `${currentPath}[]`;
                        const itemChange = changes.find(c => c.path === itemPath && (c.new_value === item || c.old_value === item));
                        const itemColor = itemChange ? "text-red-400" : "text-gray-300";
                        return (
                            <li key={i} className={`${itemColor} leading-relaxed`}>
                                {typeof item === "string" ? item : JSON.stringify(item)}
                                {itemChange && renderChangeIndicator(itemChange)}
                            </li>
                        );
                    })}
                </ul>
            );
        }

        if (typeof content === "object" && content !== null) {
            return (
                <div className="space-y-2">
                    {Object.entries(content).map(([key, value]) => {
                        const keyPath = currentPath ? `${currentPath}.${key}` : key;
                        const keyHasChanges = isChanged(keyPath);
                        return (
                            <div key={key} className="border-l-2 border-gray-700 pl-3">
                                <p className={`text-xs font-semibold ${keyHasChanges ? 'text-red-400' : 'text-gray-400'} mb-1`}>
                                    {key.replace(/_/g, " ").toUpperCase()}
                                    {getChangesForPath(keyPath) && renderChangeIndicator(getChangesForPath(keyPath)!)}
                                </p>
                                {renderSection(key, value, currentPath)}
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
            <p className={`text-xs ${hasChanges ? 'text-red-400' : 'text-gray-400'}`}>
                {String(content)}
                {change && renderChangeIndicator(change)}
            </p>
        );
    };

    const sections = [
        { id: "overall_score", label: "Executive Summary" },
        { id: "capability_inventory", label: "1. Capability Inventory" },
        { id: "memory_architecture", label: "2. Memory Architecture" },
        { id: "architectural_maturity", label: "3. Architectural Maturity" },
        { id: "jarvis_gap_analysis", label: "4. Jarvis Gap Analysis" },
        { id: "reliability_metrics", label: "5. Reliability Metrics" },
        { id: "known_limitations", label: "6. Known Limitations" },
        { id: "recommendations", label: "7. Recommendations" },
    ];

    return (
        <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <div className="relative" title={`Meta endpoint: ${health.meta}`}>
                        <div className={`w-2 h-2 rounded-full ${
                            health.meta === 'connected' ? 'bg-green-500' :
                            health.meta === 'error' ? 'bg-red-500' :
                            'bg-gray-600'
                        }`}
                        style={{
                            boxShadow: health.meta === 'connected' 
                                ? '0 0 6px rgba(34, 197, 94, 0.8)' 
                                : health.meta === 'error'
                                ? '0 0 6px rgba(239, 68, 68, 0.8)'
                                : 'none',
                            border: health.meta === 'connected'
                                ? '1.5px solid rgba(34, 197, 94, 0.9)'
                                : health.meta === 'error'
                                ? '1.5px solid rgba(239, 68, 68, 0.9)'
                                : '1.5px solid rgba(75, 85, 99, 0.6)'
                        }}
                        />
                    </div>
                    <h1 className="text-base font-semibold text-gray-100">Meta Assessment</h1>
                    {assessment && (
                        <p className="text-xs text-gray-400">
                            {selectedAssessmentId && `#${selectedAssessmentId} - `}
                            {new Date(assessment.generated_at).toLocaleString()}
                        </p>
                    )}
                    {changes.length > 0 && (
                        <span className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-0.5 rounded">
                            {changes.length} changes
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1.5 rounded transition-colors"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        {showHistory ? "Hide History" : "Show History"}
                    </button>
                    <button
                        className="bg-orange-700 hover:bg-orange-600 text-xs px-3 py-1.5 rounded transition-colors"
                        onClick={() => setCleanupConfirm(true)}
                        disabled={loading}
                    >
                        🧹 Cleanup
                    </button>
                    <button
                        className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1.5 rounded transition-colors"
                        onClick={generateNewAssessment}
                        disabled={loading}
                    >
                        {loading ? "Generating..." : "New Assessment"}
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4">
                    <div className="text-red-400 text-xs bg-red-900/20 border border-red-900 rounded p-3">
                        {error}
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && !assessment && (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-gray-400">Loading meta-assessment...</p>
                </div>
            )}

            {/* Main Content */}
            {!error && assessment && (
                <div className="flex-1 flex overflow-hidden">
                    {/* History Sidebar (conditional) */}
                    {showHistory && (
                        <div className="w-64 border-r border-gray-700 overflow-y-auto bg-[#252526] flex-shrink-0">
                            <div className="p-3">
                                <h3 className="text-xs font-semibold text-gray-400 mb-2">ASSESSMENT HISTORY</h3>
                                <div className="space-y-1">
                                    {history.map((h, index) => (
                                        <div key={h.id} className="relative group">
                                            <button
                                                onClick={() => loadHistoricalAssessment(h.id)}
                                                className={`w-full text-left px-2 py-2 text-xs rounded transition-colors ${
                                                    selectedAssessmentId === h.id
                                                        ? "bg-gray-700 text-gray-100"
                                                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold">#{h.id}</span>
                                                    {index === 0 && <span className="text-green-400 text-xs">Latest</span>}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {new Date(h.generated_at).toLocaleString()}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {h.phase}
                                                </div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteConfirmId(h.id);
                                                }}
                                                className="absolute top-2 right-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete assessment"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section Navigation */}
                    <div className="w-56 border-r border-gray-700 overflow-y-auto bg-[#252526]">
                        <div className="p-2 space-y-1">
                            {sections.map((section) => {
                                const sectionChanges = changes.filter(c => c.path.startsWith(section.id));
                                return (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSection(section.id)}
                                        className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                                            activeSection === section.id
                                                ? "bg-gray-700 text-gray-100"
                                                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{section.label}</span>
                                            {sectionChanges.length > 0 && (
                                                <span className="text-xs text-yellow-400">{sectionChanges.length}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {activeSection && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-semibold text-gray-100 border-b border-gray-700 pb-2">
                                    {sections.find(s => s.id === activeSection)?.label}
                                </h2>
                                
                                {/* Special rendering for specific sections */}
                                {activeSection === "overall_score" && assessment.overall_score ? (
                                    renderExecutiveSummary(assessment.overall_score)
                                ) : activeSection === "recommendations" && assessment.recommendations ? (
                                    renderFormattedRecommendations(assessment.recommendations)
                                ) : activeSection === "memory_architecture" ? (
                                    renderMemoryArchitectureSection(assessment.memory_architecture)
                                ) : activeSection && assessment[activeSection as keyof MetaAssessment] ? (
                                    renderBusinessFormatSection(activeSection, assessment[activeSection as keyof MetaAssessment])
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md border border-gray-700">
                        <h3 className="text-base font-semibold text-gray-100 mb-3">Delete Assessment?</h3>
                        <p className="text-sm text-gray-300 mb-4">
                            Are you sure you want to delete assessment #{deleteConfirmId}?
                        </p>
                        <p className="text-xs text-gray-400 mb-6">
                            This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteAssessment(deleteConfirmId)}
                                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 rounded transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cleanup Confirmation Modal */}
            {cleanupConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md border border-gray-700">
                        <h3 className="text-base font-semibold text-gray-100 mb-3">Cleanup Old Assessments?</h3>
                        <p className="text-sm text-gray-300 mb-2">
                            This will delete all but the <strong>5 most recent</strong> assessments.
                        </p>
                        <p className="text-xs text-gray-400 mb-2">
                            Current total: <strong>{history.length}</strong> assessments
                        </p>
                        <p className="text-xs text-gray-400 mb-6">
                            Will delete: <strong>~{Math.max(0, history.length - 5)}</strong> assessments
                        </p>
                        <p className="text-xs text-red-400 mb-6">
                            This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setCleanupConfirm(false)}
                                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => cleanupOldAssessments(5)}
                                className="px-4 py-2 text-sm bg-orange-600 hover:bg-orange-500 rounded transition-colors"
                            >
                                Cleanup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MetaView;
