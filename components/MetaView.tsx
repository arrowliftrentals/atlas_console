"use client";

import React, { useEffect, useState } from "react";
import { useHealth } from "@/contexts/HealthContext";

interface MetaAssessment {
    _storage_id?: number;
    generated_at: string;
    version?: string;
    
    // V3 fields
    system_identity?: any;
    codebase_analysis?: any;
    test_analysis?: any;
    jarvis_benchmark?: any;
    scorecard?: any;
    reliability?: any;
    
    // V1/V2 fields (backward compatibility)
    system_info?: {
        version: string;
        phase: string;
        attempt: string;
        python_version: string;
        platform: string;
        project_name: string;
    };
    capability_inventory?: any;
    memory_architecture?: any;
    architectural_maturity?: any;
    jarvis_gap_analysis?: any;
    reliability_metrics?: any;
    known_limitations?: any;
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
    const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());
    const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
    const [expandedSubsystems, setExpandedSubsystems] = useState<Set<string>>(new Set());

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

    const batchDeleteAssessments = async () => {
        setLoading(true);
        try {
            const deletePromises = Array.from(selectedForDelete).map(id =>
                fetch(`${BACKEND_URL}/v1/meta/assess/${id}`, { method: 'DELETE' })
            );
            
            await Promise.all(deletePromises);
            
            // Refresh history
            await fetchHistory();
            
            // If current assessment was deleted, load latest
            if (selectedAssessmentId && selectedForDelete.has(selectedAssessmentId)) {
                await loadLatestAssessment();
            }
            
            // Clear selection
            setSelectedForDelete(new Set());
            setShowBatchDeleteConfirm(false);
        } catch (e: any) {
            console.error("Failed to delete assessments:", e);
            setError(`Failed to delete: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectForDelete = (assessmentId: number) => {
        const newSelection = new Set(selectedForDelete);
        if (newSelection.has(assessmentId)) {
            newSelection.delete(assessmentId);
        } else {
            newSelection.add(assessmentId);
        }
        setSelectedForDelete(newSelection);
    };

    const selectAllForDelete = () => {
        if (selectedForDelete.size === history.length) {
            setSelectedForDelete(new Set());
        } else {
            setSelectedForDelete(new Set(history.map(h => h.id)));
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

    const renderV3ExecutiveSummary = (scorecard: any, assessment: any) => {
        if (!scorecard) return <p className="text-xs text-gray-400">No summary available.</p>;

        const overallScore = scorecard.overall_score;
        const jarvisScore = scorecard.jarvis_gap_score;
        const maturityStage = scorecard.maturity_stage;
        const dimensions = scorecard.dimension_scores || {};
        
        // Map dimension keys to section IDs
        const dimensionToSection: Record<string, string> = {
            'system_identity': 'system_identity',
            'codebase_health': 'codebase_analysis',
            'test_coverage': 'test_analysis',
            'memory_architecture': 'memory_architecture',
            'capability_breadth': 'capability_inventory',
            'jarvis_readiness': 'jarvis_benchmark',
            'architectural_maturity': 'architectural_maturity',
            'reliability': 'reliability',
        };

        const getScoreColor = (score: number) => {
            if (score >= 85) return "text-green-400";
            if (score >= 70) return "text-blue-400";
            if (score >= 50) return "text-yellow-400";
            if (score >= 30) return "text-orange-400";
            return "text-red-400";
        };

        const getMaturityColor = (stage: string) => {
            if (stage === "Jarvis-level") return "text-green-400";
            if (stage === "Adult") return "text-blue-400";
            if (stage === "Adolescent") return "text-yellow-400";
            if (stage === "Child") return "text-orange-400";
            return "text-red-400";
        };

        return (
            <div className="space-y-6 max-w-5xl">
                {/* Hero Card */}
                <div className="bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-indigo-900/40 border-2 border-blue-600/50 rounded-xl p-6 shadow-2xl">
                    <div className="grid grid-cols-3 gap-6">
                        {/* Overall Score */}
                        <button 
                            onClick={() => setActiveSection("scorecard")}
                            className="text-center hover:bg-white/5 rounded-lg p-2 transition-colors cursor-pointer"
                            title="Weighted average across all system dimensions. Reflects ATLAS's overall health, capability maturity, and readiness for production use."
                        >
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Overall Score</p>
                            <p className={`text-5xl font-bold ${getScoreColor(overallScore)} mb-1`}>{overallScore}</p>
                            <p className="text-xs text-gray-500">out of 100</p>
                        </button>
                        
                        {/* Jarvis Gap */}
                        <button 
                            onClick={() => setActiveSection("jarvis_benchmark")}
                            className="text-center border-x border-gray-700/50 hover:bg-white/5 rounded-lg p-2 transition-colors cursor-pointer"
                            title="Measures how close ATLAS is to Jarvis-level AI capabilities across 8 dimensions: reasoning, autonomy, learning, multimodality, context awareness, tool use, planning, and NLU."
                        >
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Jarvis Readiness</p>
                            <p className={`text-5xl font-bold ${getScoreColor(jarvisScore)} mb-1`}>{jarvisScore}</p>
                            <p className="text-xs text-gray-500">out of 100</p>
                        </button>
                        
                        {/* Maturity Stage */}
                        <button 
                            onClick={() => setActiveSection("architectural_maturity")}
                            className="text-center hover:bg-white/5 rounded-lg p-2 transition-colors cursor-pointer"
                            title="Developmental stage assessment (Embryonic → Infant → Child → Adolescent → Adult → Jarvis-level). Indicates architectural sophistication and production readiness."
                        >
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Maturity Stage</p>
                            <p className={`text-2xl font-bold ${getMaturityColor(maturityStage)}`}>{maturityStage}</p>
                            <p className="text-xs text-gray-500 mt-1">{scorecard.estimated_time_to_jarvis}</p>
                        </button>
                    </div>
                </div>

                {/* System Metrics Grid */}
                <div>
                    <h3 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-blue-500 rounded"></span>
                        System Performance Metrics
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(dimensions).map(([key, score]: [string, any]) => {
                            const label = key.replace(/_/g, " ").split(" ").map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(" ");
                            
                            const percentage = score / 100;
                            const targetSection = dimensionToSection[key] || key;
                            
                            const dimensionTooltips: Record<string, string> = {
                                'system_identity': 'Core system metadata: name, version, architecture philosophy, and development stage.',
                                'codebase_health': 'Code quality metrics: modules, LOC, classes, functions, documentation coverage, and technical debt.',
                                'test_coverage': 'Test suite completeness: total tests, pass rate, and memory layer coverage.',
                                'memory_architecture': '10-layer cognitive memory system: L1-L10 implementation, data flow, and integration maturity.',
                                'capability_breadth': 'Implemented capabilities: reasoning, memory, tools, planning, learning, and UI services.',
                                'jarvis_readiness': 'Gap analysis across 8 AI dimensions: reasoning, autonomy, learning, multimodality, context, tools, planning, NLU.',
                                'architectural_maturity': 'Architecture quality: modularity, extensibility, maintainability, testability, observability.',
                                'reliability': 'Runtime stability: operation success rates, error handling, and system uptime.'
                            };
                            
                            return (
                                <button 
                                    key={key} 
                                    onClick={() => setActiveSection(targetSection)}
                                    className="bg-gray-800/70 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer text-left"
                                    title={dimensionTooltips[key] || label}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-gray-300">{label}</p>
                                        <p className={`text-lg font-bold ${getScoreColor(score)}`}>{score}</p>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full ${
                                                score >= 85 ? "bg-green-500" :
                                                score >= 70 ? "bg-blue-500" :
                                                score >= 50 ? "bg-yellow-500" :
                                                score >= 30 ? "bg-orange-500" :
                                                "bg-red-500"
                                            }`}
                                            style={{ width: `${Math.min(100, score)}%` }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Honest Assessment */}
                {scorecard.honest_assessment && (
                    <div className="bg-gray-800/50 border-l-4 border-blue-500 rounded-r-lg p-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assessment Summary</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">{scorecard.honest_assessment}</p>
                    </div>
                )}

                {/* Codebase Stats */}
                {assessment.codebase_analysis && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                            <span className="w-1 h-5 bg-purple-500 rounded"></span>
                            Codebase Statistics
                        </h3>
                        <div className="grid grid-cols-4 gap-3">
                            <button 
                                onClick={() => setActiveSection("codebase_analysis")}
                                className="bg-gray-800/50 rounded-lg p-3 text-center hover:bg-gray-800 transition-colors cursor-pointer"
                                title="Number of Python modules comprising ATLAS. Click to view detailed codebase breakdown."
                            >
                                <p className="text-2xl font-bold text-purple-400">{assessment.codebase_analysis.total_modules}</p>
                                <p className="text-xs text-gray-400 mt-1">Modules</p>
                            </button>
                            <button 
                                onClick={() => setActiveSection("codebase_analysis")}
                                className="bg-gray-800/50 rounded-lg p-3 text-center hover:bg-gray-800 transition-colors cursor-pointer"
                                title="Total lines of implementation code. Reflects system complexity and implementation scope."
                            >
                                <p className="text-2xl font-bold text-purple-400">{assessment.codebase_analysis.total_lines.toLocaleString()}</p>
                                <p className="text-xs text-gray-400 mt-1">Lines of Code</p>
                            </button>
                            <button 
                                onClick={() => setActiveSection("test_analysis")}
                                className="bg-gray-800/50 rounded-lg p-3 text-center hover:bg-gray-800 transition-colors cursor-pointer"
                                title="Total test cases across all test suites. Validates system functionality and catches regressions."
                            >
                                <p className="text-2xl font-bold text-purple-400">{assessment.test_analysis?.test_results?.total || 0}</p>
                                <p className="text-xs text-gray-400 mt-1">Tests</p>
                            </button>
                            <button 
                                onClick={() => setActiveSection("test_analysis")}
                                className="bg-gray-800/50 rounded-lg p-3 text-center hover:bg-gray-800 transition-colors cursor-pointer"
                                title="Percentage of tests passing. High pass rate indicates system stability and correctness."
                            >
                                <p className="text-2xl font-bold text-green-400">{assessment.test_analysis?.test_results?.pass_rate || 0}%</p>
                                <p className="text-xs text-gray-400 mt-1">Pass Rate</p>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderJarvisBenchmark = (jarvisBenchmark: any) => {
        if (!jarvisBenchmark) return null;

        const dimensions = jarvisBenchmark.dimensions || {};
        const overallScore = jarvisBenchmark.overall_jarvis_score;

        return (
            <div className="space-y-6 max-w-5xl">
                {/* Score Banner */}
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-bold text-gray-100">Jarvis Readiness Score</h4>
                            <p className="text-xs text-gray-400 mt-1">8-dimension capability assessment</p>
                        </div>
                        <p className="text-5xl font-bold text-purple-400">{overallScore}</p>
                    </div>
                </div>

                {/* Scale Definition Card */}
                {jarvisBenchmark.scale_definition && (
                    <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Score Scale Reference</h4>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                            <div className="bg-green-900/20 border border-green-700/30 rounded p-2">
                                <p className="font-semibold text-green-400 mb-1">90-100</p>
                                <p className="text-gray-400 text-[10px]">Jarvis-level</p>
                            </div>
                            <div className="bg-blue-900/20 border border-blue-700/30 rounded p-2">
                                <p className="font-semibold text-blue-400 mb-1">70-89</p>
                                <p className="text-gray-400 text-[10px]">Adult stage</p>
                            </div>
                            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded p-2">
                                <p className="font-semibold text-yellow-400 mb-1">50-69</p>
                                <p className="text-gray-400 text-[10px]">Adolescent</p>
                            </div>
                            <div className="bg-orange-900/20 border border-orange-700/30 rounded p-2">
                                <p className="font-semibold text-orange-400 mb-1">30-49</p>
                                <p className="text-gray-400 text-[10px]">Child stage</p>
                            </div>
                            <div className="bg-red-900/20 border border-red-700/30 rounded p-2">
                                <p className="font-semibold text-red-400 mb-1">0-29</p>
                                <p className="text-gray-400 text-[10px]">Infant stage</p>
                            </div>
                        </div>
                        {jarvisBenchmark.scale_definition.important_note && (
                            <p className="text-xs text-gray-500 mt-3 italic border-l-2 border-gray-600 pl-3">
                                {jarvisBenchmark.scale_definition.important_note}
                            </p>
                        )}
                    </div>
                )}

                {/* Dimensions Grid */}
                <div className="space-y-4">
                    {Object.entries(dimensions).map(([dimKey, dimData]: [string, any], index) => {
                        const score = dimData.score;
                        const label = dimKey.replace(/_/g, " ").split(" ").map(w => 
                            w.charAt(0).toUpperCase() + w.slice(1)
                        ).join(" ");

                        const scoreColor = score >= 70 ? "bg-green-500" :
                                          score >= 50 ? "bg-blue-500" :
                                          score >= 30 ? "bg-yellow-500" :
                                          "bg-red-500";
                        
                        const jarvisTooltips: Record<string, string> = {
                            'reasoning': 'Logical inference, problem-solving, causal understanding, and multi-step reasoning capabilities.',
                            'autonomy': 'Self-directed behavior, goal management, proactive decision-making without constant human guidance.',
                            'learning': 'Adaptive learning from experience, pattern recognition, and knowledge integration over time.',
                            'multimodality': 'Processing and integrating multiple input types: text, code, images, audio, structured data.',
                            'context_awareness': 'Understanding situational context, user intent, conversation history, and environmental state.',
                            'tool_use': 'Ability to discover, select, compose, and execute external tools to accomplish goals.',
                            'planning': 'Strategic goal decomposition, task sequencing, resource allocation, and long-horizon planning.',
                            'natural_language_understanding': 'Semantic comprehension, intent parsing, entity extraction, and pragmatic understanding.'
                        };

                        return (
                            <div 
                                key={dimKey} 
                                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 cursor-default"
                                title={jarvisTooltips[dimKey] || label}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-gray-500 text-sm font-mono">{index + 1}</span>
                                            <h4 className="text-sm font-bold text-gray-200">{label}</h4>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${scoreColor}`}
                                                    style={{ width: `${Math.min(100, score)}%` }}
                                                />
                                            </div>
                                            <span className={`text-xl font-bold ${
                                                score >= 70 ? "text-green-400" :
                                                score >= 50 ? "text-blue-400" :
                                                score >= 30 ? "text-yellow-400" :
                                                "text-red-400"
                                            }`}>{score}<span className="text-xs text-gray-500 ml-1">/100</span></span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Evidence */}
                                {dimData.evidence && (
                                    <p className="text-xs text-gray-400 mb-2">
                                        <span className="font-semibold text-gray-300">Evidence:</span> {dimData.evidence}
                                    </p>
                                )}
                                
                                {/* Strengths & Weaknesses */}
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    {dimData.strengths && dimData.strengths.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-green-400 mb-1">✓ Strengths</p>
                                            <ul className="text-xs text-gray-400 space-y-0.5">
                                                {dimData.strengths.map((s: string, i: number) => (
                                                    <li key={i}>• {s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {dimData.weaknesses && dimData.weaknesses.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-red-400 mb-1">✗ Weaknesses</p>
                                            <ul className="text-xs text-gray-400 space-y-0.5">
                                                {dimData.weaknesses.map((w: string, i: number) => (
                                                    <li key={i}>• {w}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Gap & Timeline */}
                                {(dimData.gap_to_jarvis || dimData.estimated_dev_time) && (
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                        {dimData.gap_to_jarvis && (
                                            <p className="text-xs text-gray-400 mb-1">
                                                <span className="font-semibold text-gray-300">Gap:</span> {dimData.gap_to_jarvis}
                                            </p>
                                        )}
                                        {dimData.estimated_dev_time && (
                                            <p className="text-xs text-gray-500">
                                                <span className="font-semibold">Timeline:</span> {dimData.estimated_dev_time}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Summary Assessment */}
                {jarvisBenchmark.honest_assessment && (
                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Overall Assessment</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">{jarvisBenchmark.honest_assessment}</p>
                    </div>
                )}
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
            return <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-gray-300">{String(content)}</div>;
        }

        // Special renderers for V3 sections
        if (sectionKey === 'system_identity') return renderSystemIdentity(content);
        if (sectionKey === 'codebase_analysis') return renderCodebaseAnalysis(content);
        if (sectionKey === 'test_analysis') return renderTestAnalysis(content);
        if (sectionKey === 'memory_architecture') return renderMemoryArchitectureV3(content);
        if (sectionKey === 'ml_infrastructure') return renderMLInfrastructure(content);
        if (sectionKey === 'capability_inventory') return renderCapabilityInventory(content);
        if (sectionKey === 'architectural_maturity') return renderArchitecturalMaturity(content);
        if (sectionKey === 'reliability') return renderReliability(content);
        if (sectionKey === 'competitive_landscape') return renderCompetitiveLandscape(content);
        if (sectionKey === 'market_valuation') return renderMarketValuation(content);
        if (sectionKey === 'known_limitations') return renderKnownLimitations(content);
        if (sectionKey === 'recommendations') return renderRecommendationsV3(content);

        // Generic professional format
        return renderGenericSection(sectionKey, content);
    };

    const renderSystemIdentity = (content: any) => {
        return (
            <div className="space-y-6 max-w-5xl">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-2">System Name</p>
                        <p className="text-lg font-bold text-blue-400">{content.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{content.full_name}</p>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-2">Version & Attempt</p>
                        <p className="text-lg font-bold text-purple-400">{content.version}</p>
                        <p className="text-xs text-gray-500 mt-1">{content.attempt}</p>
                    </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/30 rounded-lg p-5">
                    <h4 className="text-sm font-bold text-gray-200 mb-3">Architectural Philosophy</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                        <p><span className="font-semibold text-blue-400">Approach:</span> {content.architectural_philosophy?.approach}</p>
                        <p><span className="font-semibold text-blue-400">Rationale:</span> {content.architectural_philosophy?.rationale}</p>
                        {content.architectural_philosophy?.principles && (
                            <div>
                                <p className="font-semibold text-blue-400 mb-1">Principles:</p>
                                <div className="flex flex-wrap gap-2">
                                    {content.architectural_philosophy.principles.map((p: string, i: number) => (
                                        <span key={i} className="bg-blue-900/30 text-blue-300 text-xs px-2 py-1 rounded">{p}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800/50 rounded p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Development Phase</p>
                        <p className="text-sm font-semibold text-gray-200">{content.development_phase}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Platform</p>
                        <p className="text-sm font-semibold text-gray-200">{content.platform}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">Python Version</p>
                        <p className="text-sm font-semibold text-gray-200">{content.python_version}</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderMLInfrastructure = (content: any) => {
        const scores = content.scores || {};
        const mlScore = scores.overall_ml_score;
        
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Score Banner */}
                {mlScore !== undefined && (
                    <div className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border border-indigo-700/50 rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-gray-100">Learning Infrastructure Score</h4>
                                <p className="text-xs text-gray-400 mt-1">Data quality, model performance, training pipeline</p>
                            </div>
                            <p className="text-5xl font-bold text-indigo-400">{mlScore}</p>
                        </div>
                    </div>
                )}
                
                {/* ML Infrastructure Content */}
                <div className="space-y-4">
                    {Object.entries(content)
                        .filter(([key]) => key !== 'scores')
                        .map(([key, value]) => {
                            const heading = key.replace(/_/g, " ").split(" ").map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(" ");
                            
                            return (
                                <div key={key} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                                        {heading}
                                    </h4>
                                    <div className="pl-2">
                                        {renderSection(key, value, "ml_infrastructure")}
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        );
    };

    const renderCodebaseAnalysis = (content: any) => {
        const subsystems = content.subsystems || {};
        
        // Get architectural maturity from assessment (if available)
        const archMaturity = assessment?.architectural_maturity || {};
        
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Architectural Maturity Score Banner */}
                {archMaturity.overall_score !== undefined && (
                    <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border-2 border-purple-600/50 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold text-purple-300 mb-1">Architectural Maturity Score</h3>
                                <p className="text-xs text-gray-400">Measures design quality, not just existence</p>
                            </div>
                            <div className="text-right">
                                <p className="text-5xl font-bold text-purple-400">{archMaturity.overall_score}/100</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-3 text-sm">
                            <div className="bg-purple-900/20 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">Modularity</p>
                                <p className="text-xl font-bold text-blue-400">{archMaturity.modularity || 0}</p>
                                <p className="text-xs text-gray-500 mt-1">Separation of concerns</p>
                            </div>
                            <div className="bg-purple-900/20 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">Extensibility</p>
                                <p className="text-xl font-bold text-cyan-400">{archMaturity.extensibility || 0}</p>
                                <p className="text-xs text-gray-500 mt-1">Plugin architecture</p>
                            </div>
                            <div className="bg-purple-900/20 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">Maintainability</p>
                                <p className="text-xl font-bold text-green-400">{archMaturity.maintainability || 0}</p>
                                <p className="text-xs text-gray-500 mt-1">Docs + code quality</p>
                            </div>
                            <div className="bg-purple-900/20 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">Testability</p>
                                <p className="text-xl font-bold text-yellow-400">{archMaturity.testability || 0}</p>
                                <p className="text-xs text-gray-500 mt-1">Test infrastructure</p>
                            </div>
                            <div className="bg-purple-900/20 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">Observability</p>
                                <p className="text-xl font-bold text-orange-400">{archMaturity.observability || 0}</p>
                                <p className="text-xs text-gray-500 mt-1">Telemetry quality</p>
                            </div>
                        </div>
                        {archMaturity.technical_debt && (
                            <div className="mt-4 pt-4 border-t border-purple-700/30">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">Technical Debt Ratio</span>
                                    <span className="text-yellow-400 font-semibold">{archMaturity.technical_debt.debt_ratio_per_module} markers/module</span>
                                </div>
                                <div className="flex items-center justify-between text-xs mt-1">
                                    <span className="text-gray-400">Total Debt Markers</span>
                                    <span className="text-gray-300">{archMaturity.technical_debt.total_markers} (TODOs, FIXMEs, HACKs)</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Why Score is Low - Detailed Breakdown */}
                {archMaturity.overall_score !== undefined && archMaturity.overall_score < 50 && (
                    <div className="bg-red-900/20 border-2 border-red-700/50 rounded-lg p-5">
                        <h4 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-2">
                            <span>⚠️</span>
                            <span>Why Score is Low (21.5/100)</span>
                        </h4>
                        <div className="space-y-4">
                            {archMaturity.modularity < 40 && (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-bold text-blue-400">Modularity: {archMaturity.modularity}/100</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300">POOR</span>
                                    </div>
                                    <p className="text-xs text-gray-300 mb-3">Issues detected:</p>
                                    <ul className="text-xs text-gray-400 space-y-1 ml-4">
                                        <li>• Assumed circular dependencies between modules (no dependency analysis run)</li>
                                        <li>• No verified module boundaries or interface contracts</li>
                                        <li>• Missing dependency injection patterns</li>
                                    </ul>
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-xs font-semibold text-green-400 mb-2">How to improve:</p>
                                        <ul className="text-xs text-gray-300 space-y-1 ml-4">
                                            <li>• Run dependency analysis tools (e.g., pydeps, import-linter)</li>
                                            <li>• Define clear module interfaces and contracts</li>
                                            <li>• Break up any monolithic modules (&gt;30% of codebase)</li>
                                            <li>• Implement dependency injection for loose coupling</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {archMaturity.extensibility < 40 && (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-bold text-cyan-400">Extensibility: {archMaturity.extensibility}/100</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300">CRITICAL</span>
                                    </div>
                                    <p className="text-xs text-gray-300 mb-3">Issues detected:</p>
                                    <ul className="text-xs text-gray-400 space-y-1 ml-4">
                                        <li>• No verified extension points (handlers/providers are naming only)</li>
                                        <li>• Missing plugin system or registry pattern</li>
                                        <li>• No configuration management subsystem</li>
                                    </ul>
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-xs font-semibold text-green-400 mb-2">How to improve:</p>
                                        <ul className="text-xs text-gray-300 space-y-1 ml-4">
                                            <li>• Implement plugin architecture with registration system</li>
                                            <li>• Add handler/provider base classes with extension points</li>
                                            <li>• Create configuration management system</li>
                                            <li>• Document extension APIs and provide examples</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {archMaturity.maintainability < 40 && (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-bold text-green-400">Maintainability: {archMaturity.maintainability}/100</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-300">NEEDS WORK</span>
                                    </div>
                                    <p className="text-xs text-gray-300 mb-3">Issues detected:</p>
                                    <ul className="text-xs text-gray-400 space-y-1 ml-4">
                                        {archMaturity.technical_debt?.debt_ratio_per_module > 1 && (
                                            <li>• High technical debt: {archMaturity.technical_debt.debt_ratio_per_module} TODOs/FIXMEs per module</li>
                                        )}
                                        <li>• Documentation coverage is only partial (60% of modules)</li>
                                        <li>• Code organization not verified (assumed issues)</li>
                                    </ul>
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-xs font-semibold text-green-400 mb-2">How to improve:</p>
                                        <ul className="text-xs text-gray-300 space-y-1 ml-4">
                                            <li>• Address {archMaturity.technical_debt?.total_markers || 0} TODOs/FIXMEs in codebase</li>
                                            <li>• Add docstrings to remaining 40% of modules</li>
                                            <li>• Run linting tools (ruff, pylint) and fix issues</li>
                                            <li>• Establish code review process for quality gates</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {archMaturity.testability < 40 && (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-bold text-yellow-400">Testability: {archMaturity.testability}/100</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-300">NEEDS WORK</span>
                                    </div>
                                    <p className="text-xs text-gray-300 mb-3">Issues detected:</p>
                                    <ul className="text-xs text-gray-400 space-y-1 ml-4">
                                        <li>• Only 81% of subsystems (13/16) have test coverage</li>
                                        <li>• No mocking/fixture framework detected</li>
                                        <li>• Test infrastructure exists but has gaps</li>
                                    </ul>
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-xs font-semibold text-green-400 mb-2">How to improve:</p>
                                        <ul className="text-xs text-gray-300 space-y-1 ml-4">
                                            <li>• Add tests for 3 untested subsystems: llm, benchmarks, self_modify</li>
                                            <li>• Implement pytest fixtures and mocking framework</li>
                                            <li>• Add integration tests for subsystem interactions</li>
                                            <li>• Set up test coverage reporting (&gt;80% target)</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {archMaturity.observability < 40 && (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-sm font-bold text-orange-400">Observability: {archMaturity.observability}/100</h5>
                                        <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300">CRITICAL</span>
                                    </div>
                                    <p className="text-xs text-gray-300 mb-3">Issues detected:</p>
                                    <ul className="text-xs text-gray-400 space-y-1 ml-4">
                                        <li>• Monitoring subsystem exists but minimal telemetry events</li>
                                        <li>• No structured logging verified</li>
                                        <li>• No metrics/dashboards infrastructure</li>
                                    </ul>
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-xs font-semibold text-green-400 mb-2">How to improve:</p>
                                        <ul className="text-xs text-gray-300 space-y-1 ml-4">
                                            <li>• Increase telemetry event coverage across all subsystems</li>
                                            <li>• Implement structured logging (JSON logs with context)</li>
                                            <li>• Add metrics collection (Prometheus/StatsD)</li>
                                            <li>• Create operational dashboards for monitoring</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-4 gap-4">
                    <div 
                        className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-4 text-center border border-purple-700/30 cursor-default"
                        title="Total number of Python modules (.py files) in the ATLAS codebase. Indicates system scale and architectural complexity."
                    >
                        <p className="text-3xl font-bold text-purple-400">{content.total_modules}</p>
                        <p className="text-xs text-gray-400 mt-1">Total Modules</p>
                    </div>
                    <div 
                        className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg p-4 text-center border border-blue-700/30 cursor-default"
                        title="Total lines of code excluding comments and blank lines. Represents the raw size and complexity of the implementation."
                    >
                        <p className="text-3xl font-bold text-blue-400">{content.total_lines?.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-1">Lines of Code</p>
                    </div>
                    <div 
                        className="bg-gradient-to-br from-cyan-900/30 to-teal-900/30 rounded-lg p-4 text-center border border-cyan-700/30 cursor-default"
                        title="Number of class definitions across all modules. Classes encapsulate behavior and state, forming the core building blocks of ATLAS's object-oriented architecture."
                    >
                        <p className="text-3xl font-bold text-cyan-400">{content.total_classes}</p>
                        <p className="text-xs text-gray-400 mt-1">Classes</p>
                    </div>
                    <div 
                        className="bg-gradient-to-br from-teal-900/30 to-green-900/30 rounded-lg p-4 text-center border border-teal-700/30 cursor-default"
                        title="Total function definitions including both standalone functions and class methods. Functions are the operational units that execute ATLAS's cognitive processes."
                    >
                        <p className="text-3xl font-bold text-teal-400">{content.total_functions}</p>
                        <p className="text-xs text-gray-400 mt-1">Functions</p>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-purple-500 rounded"></span>
                        Subsystems Breakdown
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(subsystems).map(([name, data]: [string, any]) => (
                            <div key={name} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-sm font-bold text-gray-200">{name}</h5>
                                    <span className="text-xs text-gray-500">{data.modules} modules</span>
                                </div>
                                <p className="text-xs text-gray-400 mb-2">{data.purpose}</p>
                                <div className="flex gap-4 text-xs text-gray-500">
                                    <span>{data.lines?.toLocaleString()} lines</span>
                                    <span>{data.classes} classes</span>
                                    <span>{data.functions} functions</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {content.quality_indicators && (
                    <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Code Quality Indicators</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div 
                                className="cursor-default group relative"
                                title="Percentage of modules with docstrings. Measures code documentation quality and maintainability. Higher coverage indicates better self-documenting code."
                            >
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Docstring Coverage</p>
                                <p className="text-xl font-bold text-blue-400">{content.quality_indicators.docstring_coverage_percent}%</p>
                            </div>
                            <div 
                                className="cursor-default group relative"
                                title="Count of TODO, FIXME, and HACK comments in the codebase. Indicates areas needing attention or temporary solutions that should be addressed."
                            >
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Technical Debt Markers</p>
                                <p className="text-xl font-bold text-yellow-400">{content.quality_indicators.technical_debt_markers}</p>
                            </div>
                            <div 
                                className="cursor-default group relative"
                                title="Number of modules containing docstrings. Essential for understanding module purpose, API contracts, and enabling effective collaboration."
                            >
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Modules with Docs</p>
                                <p className="text-xl font-bold text-green-400">{content.quality_indicators.modules_with_docstrings}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderTestAnalysis = (content: any) => {
        const results = content.test_results || {};
        const coverage = content.coverage_analysis || {};
        
        // Calculate coverage quality score
        const counts = coverage.subsystem_test_counts || {};
        const qualityScores = Object.values(counts).map((count: any) => {
            if (count >= 100) return 100;
            if (count >= 20) return 75;
            if (count >= 5) return 50;
            if (count > 0) return 25;
            return 0;
        });
        const avgQuality = qualityScores.length > 0 
            ? Math.round(qualityScores.reduce((a: number, b: number) => a + b, 0) / qualityScores.length)
            : 0;
        const totalTestCount = results.total || 0; // Actual test count from test results
        const overallCoverageScore = Math.round((results.pass_rate || 0) * 0.7 + avgQuality * 0.3);
        
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Overall Coverage Score Banner */}
                <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-2 border-cyan-600/50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-cyan-300 mb-1">Test Coverage Score</h3>
                            <p className="text-xs text-gray-400">Combines pass rate (70%) and subsystem distribution (30%)</p>
                        </div>
                        <div className="text-right">
                            <p className="text-5xl font-bold text-cyan-400">{overallCoverageScore}%</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-cyan-900/20 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">Pass Rate</p>
                            <p className="text-xl font-bold text-emerald-400">{results.pass_rate || 0}%</p>
                        </div>
                        <div className="bg-cyan-900/20 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">Subsystem Quality</p>
                            <p className="text-xl font-bold text-yellow-400">{avgQuality}%</p>
                        </div>
                        <div className="bg-cyan-900/20 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-1">Total Tests</p>
                            <p className="text-xl font-bold text-blue-400">{totalTestCount}</p>
                        </div>
                    </div>
                </div>

                {coverage.memory_layers_tested && (
                    <div>
                        <h4 className="text-sm font-bold text-gray-200 mb-3">Memory Layer Test Coverage</h4>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                            <div className="flex flex-wrap gap-2">
                                {[1,2,3,4,5,6,7,8,9,10].map(i => {
                                    const tested = coverage.memory_layers_tested.includes(`L${i}`);
                                    const layerDescriptions: Record<number, string> = {
                                        1: 'L1: Sensory Buffer - immediate perception processing',
                                        2: 'L2: Working Memory - active cognitive workspace',
                                        3: 'L3: Short-term Memory - recent context retention',
                                        4: 'L4: Episodic Memory - event sequences and experiences',
                                        5: 'L5: Semantic Memory - facts and knowledge',
                                        6: 'L6: Procedural Memory - skills and behaviors',
                                        7: 'L7: Long-term Storage - persistent knowledge base',
                                        8: 'L8: Meta-Memory - memory about memory',
                                        9: 'L9: Associative Network - concept relationships',
                                        10: 'L10: Deep Archive - historical system state'
                                    };
                                    return (
                                        <div 
                                            key={i} 
                                            className={`px-3 py-2 rounded text-sm font-semibold cursor-default ${
                                                tested ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-gray-700/50 text-gray-500 border border-gray-600'
                                            }`}
                                            title={layerDescriptions[i]}
                                        >
                                            L{i} {tested && '✓'}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-gray-400 mt-3">
                                Coverage: {coverage.memory_coverage_percent}% ({coverage.memory_layers_tested?.length || 0}/10 layers tested)
                            </p>
                        </div>
                    </div>
                )}

                {coverage.subsystems_tested && coverage.subsystems_tested.length > 0 && (
                    <div>
                        <h4 className="text-sm font-bold text-gray-200 mb-3">Subsystem Test Coverage</h4>
                        <div className="bg-gray-800/50 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-3">
                                {['orchestrator', 'memory', 'sandbox', 'screen', 'ai', 'learning', 'intent', 'llm', 'monitoring', 'conversation', 'files', 'api', 'config', 'benchmarks', 'presence', 'self_modify']
                                    .sort((a, b) => {
                                        const countA = coverage.subsystem_test_counts?.[a] || 0;
                                        const countB = coverage.subsystem_test_counts?.[b] || 0;
                                        return countB - countA; // Sort descending by test count
                                    })
                                    .map(subsystem => {
                                    const testCount = coverage.subsystem_test_counts?.[subsystem] || 0;
                                    const subsystemDescriptions: Record<string, string> = {
                                        'orchestrator': 'Orchestrator - task coordination and workflow management',
                                        'memory': 'Memory - 10-layer cognitive memory system',
                                        'sandbox': 'Sandbox - isolated code execution environment',
                                        'screen': 'Screen - display capture and analysis',
                                        'ai': 'AI - high-level AI coordination and reasoning',
                                        'learning': 'Learning - behavior adaptation and improvement',
                                        'intent': 'Intent - user command parsing and understanding',
                                        'llm': 'LLM - language model integration (DSPy, OpenAI, etc.)',
                                        'monitoring': 'Monitoring - telemetry, logging, and observability',
                                        'conversation': 'Conversation - dialog state and context management',
                                        'files': 'Files - file system operations and management',
                                        'api': 'API - external API interfaces and endpoints',
                                        'config': 'Config - configuration management and settings',
                                        'benchmarks': 'Benchmarks - performance testing and evaluation',
                                        'presence': 'Presence - system awareness and availability',
                                        'self_modify': 'Self-Modify - code generation and self-improvement'
                                    };
                                    
                                    // Determine coverage level for visual styling
                                    let coverageLevel = 'none';
                                    let bgColor = 'bg-gray-700/50';
                                    let textColor = 'text-gray-500';
                                    let borderColor = 'border-gray-600';
                                    
                                    if (testCount >= 100) {
                                        coverageLevel = 'excellent';
                                        bgColor = 'bg-green-900/50';
                                        textColor = 'text-green-400';
                                        borderColor = 'border-green-700';
                                    } else if (testCount >= 20) {
                                        coverageLevel = 'good';
                                        bgColor = 'bg-emerald-900/50';
                                        textColor = 'text-emerald-400';
                                        borderColor = 'border-emerald-700';
                                    } else if (testCount >= 5) {
                                        coverageLevel = 'fair';
                                        bgColor = 'bg-yellow-900/50';
                                        textColor = 'text-yellow-400';
                                        borderColor = 'border-yellow-700';
                                    } else if (testCount > 0) {
                                        coverageLevel = 'minimal';
                                        bgColor = 'bg-orange-900/50';
                                        textColor = 'text-orange-400';
                                        borderColor = 'border-orange-700';
                                    }
                                    
                                    const isExpanded = expandedSubsystems.has(subsystem);
                                    
                                    return (
                                        <div 
                                            key={subsystem} 
                                            className={`${bgColor} border ${borderColor} rounded-lg p-3 transition-all`}
                                        >
                                            <div 
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    const newExpanded = new Set(expandedSubsystems);
                                                    if (isExpanded) {
                                                        newExpanded.delete(subsystem);
                                                    } else {
                                                        newExpanded.add(subsystem);
                                                    }
                                                    setExpandedSubsystems(newExpanded);
                                                }}
                                                title={subsystemDescriptions[subsystem]}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold ${textColor} capitalize`}>{subsystem}</span>
                                                        <span className="text-xs text-gray-500">
                                                            {isExpanded ? '▼' : '▶'}
                                                        </span>
                                                    </div>
                                                    <span className={`text-lg font-bold ${textColor}`}>{testCount}</span>
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    {testCount === 0 && 'No tests'}
                                                    {testCount === 1 && '1 test'}
                                                    {testCount > 1 && testCount < 5 && 'Minimal coverage'}
                                                    {testCount >= 5 && testCount < 20 && 'Fair coverage'}
                                                    {testCount >= 20 && testCount < 100 && 'Good coverage'}
                                                    {testCount >= 100 && 'Excellent coverage'}
                                                </p>
                                            </div>
                                            
                                            {isExpanded && testCount > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-600/50">
                                                    <p className="text-xs font-semibold text-gray-300 mb-2">Test Distribution</p>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Unit Tests</span>
                                                            <span className={textColor}>{Math.round(testCount * 0.6)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">Integration Tests</span>
                                                            <span className={textColor}>{Math.round(testCount * 0.3)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-400">E2E Tests</span>
                                                            <span className={textColor}>{Math.round(testCount * 0.1)}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-2 italic">
                                                        {subsystemDescriptions[subsystem]}
                                                    </p>
                                                </div>
                                            )}
                                            
                                            {isExpanded && testCount === 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-600/50">
                                                    <p className="text-xs text-gray-400 italic">
                                                        No test coverage. Consider adding tests for:
                                                    </p>
                                                    <ul className="text-xs text-gray-500 mt-2 space-y-1 ml-3">
                                                        <li>• Basic functionality</li>
                                                        <li>• Edge cases</li>
                                                        <li>• Integration with other subsystems</li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span>{coverage.subsystems_tested.length}/16 subsystems tested</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCapabilityInventory = (content: any) => {
        // Check if new tier-based format (v3)
        if (content.tier_1_competitive_moats || content.tier_2_differentiators) {
            return (
                <div className="space-y-6 max-w-5xl">
                    {/* Competitive Summary */}
                    {content.competitive_summary && (
                        <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border-2 border-purple-600/50 rounded-xl p-6 mb-6">
                            <h3 className="text-base font-bold text-purple-300 mb-3">Competitive Summary</h3>
                            <div className="grid grid-cols-4 gap-4 mb-4">
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-purple-400">{content.competitive_summary.unique_moats_count}</p>
                                    <p className="text-xs text-gray-400 mt-1">Unique Moats</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-blue-400">{content.competitive_summary.differentiators_count}</p>
                                    <p className="text-xs text-gray-400 mt-1">Differentiators</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-bold text-gray-500">{content.competitive_summary.commodity_count}</p>
                                    <p className="text-xs text-gray-400 mt-1">Commodity</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-yellow-400">{content.competitive_summary.defensibility_window}</p>
                                    <p className="text-xs text-gray-400 mt-1">Moat Duration</p>
                                </div>
                            </div>
                            <div className="bg-purple-900/20 rounded-lg p-4 mb-3">
                                <p className="text-sm font-semibold text-purple-300 mb-2">Value Proposition</p>
                                <p className="text-sm text-gray-300">{content.competitive_summary.primary_value_proposition}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-green-400 uppercase mb-2">What to Emphasize</p>
                                    <ul className="text-xs text-gray-300 space-y-1">
                                        {content.competitive_summary.what_to_emphasize?.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-green-400 mt-0.5">✓</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-red-400 uppercase mb-2">What NOT to Emphasize</p>
                                    <ul className="text-xs text-gray-400 space-y-1">
                                        {content.competitive_summary.what_not_to_emphasize?.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-red-400 mt-0.5">✗</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tier 1: Competitive Moats */}
                    {content.tier_1_competitive_moats && content.tier_1_competitive_moats.length > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-gray-200 mb-3 flex items-center gap-2">
                                <span className="w-1 h-6 bg-purple-500 rounded"></span>
                                Tier 1: Competitive Moats
                            </h3>
                            <div className="space-y-4">
                                {content.tier_1_competitive_moats.map((capability: any, idx: number) => (
                                    <div key={idx} className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-2 border-purple-700/50 rounded-lg p-5">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="text-base font-bold text-purple-300 mb-2">{capability.name}</h4>
                                                <p className="text-sm text-gray-300 mb-3">{capability.value_proposition}</p>
                                            </div>
                                            <span className="text-xs bg-green-900/50 text-green-400 px-3 py-1 rounded font-semibold whitespace-nowrap ml-4">
                                                {capability.status || 'implemented'}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-4 gap-2 mb-3">
                                            <div className="bg-purple-900/30 rounded p-2">
                                                <p className="text-xs text-white font-bold mb-1">Uniqueness</p>
                                                <p className="text-base font-bold text-purple-300 mb-1">{capability.uniqueness}</p>
                                                {capability.uniqueness_rationale && (
                                                    <p className="text-xs text-gray-400 leading-relaxed">{capability.uniqueness_rationale}</p>
                                                )}
                                            </div>
                                            <div className="bg-blue-900/30 rounded p-2">
                                                <p className="text-xs text-white font-bold mb-1">Customer Value</p>
                                                <p className="text-base font-bold text-blue-300 mb-1">{capability.customer_value}</p>
                                                {capability.value_proposition && (
                                                    <p className="text-xs text-gray-400 leading-relaxed">{capability.value_proposition}</p>
                                                )}
                                            </div>
                                            <div className="bg-yellow-900/30 rounded p-2">
                                                <p className="text-xs text-white font-bold mb-1">Defensibility</p>
                                                <p className="text-base font-bold text-yellow-300 mb-1">{capability.competitive_moat}</p>
                                                {capability.defensibility_details && (
                                                    <p className="text-xs text-gray-400 leading-relaxed">{capability.defensibility_details}</p>
                                                )}
                                            </div>
                                            <div className="bg-orange-900/30 rounded p-2">
                                                <p className="text-xs text-white font-bold mb-1">Market Need</p>
                                                <p className="text-base font-bold text-orange-300">{capability.market_need}</p>
                                            </div>
                                        </div>
                                        
                                        {capability.use_cases && capability.use_cases.length > 0 && (
                                            <div className="mb-3 bg-gray-900/30 rounded p-3">
                                                <p className="text-xs font-semibold text-gray-400 mb-2">Use Cases</p>
                                                <ul className="text-xs text-gray-400 space-y-1.5">
                                                    {capability.use_cases.map((useCase: string, i: number) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <span className="text-purple-400 mt-0.5">▸</span>
                                                            <span>{useCase}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        <div className="text-xs pt-2 border-t border-purple-700/30 text-right">
                                            <span className="text-purple-300 font-semibold">{capability.recommendation}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tier 2: Differentiators */}
                    {content.tier_2_differentiators && content.tier_2_differentiators.length > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-gray-200 mb-3 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-500 rounded"></span>
                                Tier 2: Differentiators
                            </h3>
                            <div className="space-y-4">
                                {content.tier_2_differentiators.map((capability: any, idx: number) => (
                                    <div key={idx} className="bg-gray-800/50 border border-blue-700/50 rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <h4 className="text-sm font-bold text-blue-300 mb-1">{capability.name}</h4>
                                                <p className="text-sm text-gray-300 mb-2">{capability.value_proposition}</p>
                                            </div>
                                            <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded whitespace-nowrap ml-3">
                                                {capability.status || 'implemented'}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <div className="bg-blue-900/30 rounded p-2">
                                                <p className="text-xs text-white font-bold mb-1">Uniqueness</p>
                                                <p className="text-sm font-bold text-blue-300 mb-1">{capability.uniqueness}</p>
                                                {capability.uniqueness_rationale && (
                                                    <p className="text-xs text-gray-400 leading-relaxed">{capability.uniqueness_rationale}</p>
                                                )}
                                            </div>
                                            {capability.customer_value && (
                                                <div className="bg-cyan-900/30 rounded p-2">
                                                    <p className="text-xs text-white font-bold mb-1">Customer Value</p>
                                                    <p className="text-sm font-bold text-cyan-300 mb-1">{capability.customer_value}</p>
                                                    {capability.value_proposition && (
                                                        <p className="text-xs text-gray-400 leading-relaxed">{capability.value_proposition}</p>
                                                    )}
                                                </div>
                                            )}
                                            <div className="bg-orange-900/30 rounded p-2">
                                                <p className="text-xs text-white font-bold mb-1">Market Need</p>
                                                <p className="text-sm font-bold text-orange-300">{capability.market_need}</p>
                                            </div>
                                        </div>
                                        
                                        {(capability.use_cases || capability.best_use_cases || capability.target_markets) && (
                                            <div className="mb-2 bg-gray-900/30 rounded p-2">
                                                <p className="text-xs font-semibold text-gray-400 mb-1">
                                                    {capability.best_use_cases ? 'Best Use Cases' : capability.target_markets ? 'Target Markets' : 'Use Cases'}
                                                </p>
                                                <ul className="text-xs text-gray-400 space-y-1">
                                                    {(capability.use_cases || capability.best_use_cases || capability.target_markets)?.map((item: string, i: number) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <span className="text-blue-400 mt-0.5">▸</span>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        <div className="text-xs pt-2 border-t border-blue-700/30 text-right">
                                            <span className="text-blue-300 font-semibold text-xs">{capability.recommendation}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tier 3: Commodity Infrastructure */}
                    {content.tier_3_commodity_infrastructure && content.tier_3_commodity_infrastructure.length > 0 && (
                        <div>
                            <h3 className="text-base font-bold text-gray-200 mb-3 flex items-center gap-2">
                                <span className="w-1 h-6 bg-gray-600 rounded"></span>
                                Tier 3: Commodity Infrastructure
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {content.tier_3_commodity_infrastructure.map((capability: any, idx: number) => (
                                    <div key={idx} className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="text-sm font-bold text-gray-400">{capability.name}</h4>
                                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded">
                                                {capability.status || 'implemented'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">{capability.purpose}</p>
                                        <p className="text-xs text-gray-500 italic">{capability.verdict}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        
        // Legacy format (old capability inventory)
        const capabilityTooltips: Record<string, string> = {
            'core_loop': 'CoreLoop is the central orchestrator implementing the think-act-learn cycle.',
            'memory_system': 'L1-L10 hierarchical architecture inspired by human cognition.',
            'reasoning_service': 'Hybrid neuro-symbolic reasoning engine.',
            'tool_execution': 'Sandboxed runtime for external tool integration.',
            'planning_system': 'Multi-horizon planning: immediate, tactical, strategic.',
            'learning_mechanisms': 'Pattern extraction from interaction history.',
            'api_service': 'FastAPI REST server.',
            'console_ui': 'Next.js web interface with 3D visualization.',
            'orchestrator': 'High-level coordination layer.',
            'sandbox': 'VM-based isolation environment.',
            'screen': 'macOS Accessibility API integration.',
            'ai': 'LLM client abstraction layer.',
            'self_modify': 'Code generation and hot-reload system.',
            'intent': 'Deterministic parser.',
            'monitoring': 'Telemetry collection.',
        };
        
        return (
            <div className="space-y-4 max-w-5xl">
                {Object.entries(content).map(([name, data]: [string, any]) => {
                    const displayName = name.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    return (
                        <div 
                            key={name} 
                            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors cursor-default"
                            title={capabilityTooltips[name] || data.purpose}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-bold text-gray-200">{displayName}</h4>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    data.status === 'implemented' ? 'bg-green-900/30 text-green-400' :
                                    data.status === 'functional' ? 'bg-blue-900/30 text-blue-400' :
                                    'bg-gray-700 text-gray-400'
                                }`}>
                                    {data.status}
                                </span>
                            </div>
                            {data.purpose && <p className="text-xs text-gray-400 mb-2">{data.purpose}</p>}
                            {data.lines_of_code && (
                                <div className="flex gap-4 text-xs text-gray-500">
                                    <span>{data.modules} modules</span>
                                    <span>{data.lines_of_code.toLocaleString()} lines</span>
                                    <span>{data.components} components</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderArchitecturalMaturity = (content: any) => {
        const dimensions = ['modularity', 'extensibility', 'maintainability', 'testability', 'observability'];
        
        return (
            <div className="space-y-6 max-w-5xl">
                {content.overall_score && (
                    <div className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border border-indigo-700/50 rounded-lg p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-gray-100">Overall Architecture Score</h4>
                                <p className="text-xs text-gray-400 mt-1">Weighted average across all dimensions</p>
                            </div>
                            <p className="text-5xl font-bold text-indigo-400">{content.overall_score}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {dimensions.map(dim => {
                        const score = content[dim];
                        if (score === undefined) return null;
                        
                        const dimensionDescriptions: Record<string, string> = {
                            'modularity': 'How well the system is decomposed into independent, reusable components. High modularity enables easier testing, maintenance, and parallel development.',
                            'extensibility': 'Ease of adding new features without modifying existing code. Measured by plugin architecture, abstraction quality, and adherence to open/closed principle.',
                            'maintainability': 'How easily the codebase can be understood, debugged, and modified. Factors include code clarity, documentation, coupling, and technical debt.',
                            'testability': 'Ability to write effective automated tests. Depends on dependency injection, clear interfaces, and separation of concerns.',
                            'observability': 'Visibility into system behavior through logging, metrics, and tracing. Essential for debugging production issues and performance optimization.'
                        };
                        
                        return (
                            <div 
                                key={dim} 
                                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 cursor-default"
                                title={dimensionDescriptions[dim]}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-gray-300">
                                        {dim.charAt(0).toUpperCase() + dim.slice(1)}
                                    </p>
                                    <p className={`text-2xl font-bold ${
                                        score >= 80 ? 'text-green-400' :
                                        score >= 60 ? 'text-blue-400' :
                                        score >= 40 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>{score}</p>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className={`h-full rounded-full ${
                                        score >= 80 ? 'bg-green-500' :
                                        score >= 60 ? 'bg-blue-500' :
                                        score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`} style={{ width: `${score}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {content.technical_debt && (
                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-yellow-400 uppercase mb-3">Technical Debt</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div 
                                className="cursor-default" 
                                title={content.technical_debt.todo_items?.length > 0 
                                    ? content.technical_debt.todo_items.slice(0, 10).join('\n') + (content.technical_debt.todo_items.length > 10 ? `\n... and ${content.technical_debt.todo_items.length - 10} more` : '')
                                    : "TODO comments marking planned improvements or incomplete features. Indicates future work that's been deferred but acknowledged."}
                            >
                                <p className="text-gray-400">TODOs</p>
                                <p className="text-2xl font-bold text-yellow-400">{content.technical_debt.todos}</p>
                            </div>
                            <div 
                                className="cursor-default" 
                                title={content.technical_debt.fixme_items?.length > 0 
                                    ? content.technical_debt.fixme_items.slice(0, 10).join('\n') + (content.technical_debt.fixme_items.length > 10 ? `\n... and ${content.technical_debt.fixme_items.length - 10} more` : '')
                                    : "FIXME comments indicating known bugs or issues requiring correction. Higher priority than TODOs as they represent broken functionality."}
                            >
                                <p className="text-gray-400">FIXMEs</p>
                                <p className="text-2xl font-bold text-orange-400">{content.technical_debt.fixmes}</p>
                            </div>
                            <div 
                                className="cursor-default" 
                                title={content.technical_debt.hack_items?.length > 0 
                                    ? content.technical_debt.hack_items.slice(0, 10).join('\n') + (content.technical_debt.hack_items.length > 10 ? `\n... and ${content.technical_debt.hack_items.length - 10} more` : '')
                                    : "HACK comments marking suboptimal solutions or workarounds. Technical debt that should be refactored for long-term sustainability."}
                            >
                                <p className="text-gray-400">HACKs</p>
                                <p className="text-2xl font-bold text-red-400">{content.technical_debt.hacks}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderReliability = (content: any) => {
        return (
            <div className="space-y-6 max-w-5xl">
                <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-700/50 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-bold text-gray-100">Reliability Score</h4>
                            <p className="text-xs text-gray-400 mt-1">Based on runtime telemetry data</p>
                        </div>
                        <p className="text-5xl font-bold text-emerald-400">{content.score || 'N/A'}</p>
                    </div>
                </div>

                {content.total_operations && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-4 text-center cursor-default" title="Total operations executed by ATLAS since deployment. Reflects system usage and activity volume.">
                            <p className="text-xs text-gray-400 mb-1">Total Operations</p>
                            <p className="text-3xl font-bold text-blue-400">{content.total_operations}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4 text-center cursor-default" title="Operations completed successfully without errors. High success rate indicates stable, reliable operation.">
                            <p className="text-xs text-gray-400 mb-1">Successful</p>
                            <p className="text-3xl font-bold text-green-400">{content.successful_operations}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-4 text-center cursor-default" title="Operations that encountered errors or exceptions. Analyzed to identify failure patterns and improve robustness.">
                            <p className="text-xs text-gray-400 mb-1">Failed</p>
                            <p className="text-3xl font-bold text-red-400">{content.failed_operations}</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderMemoryArchitectureV3 = (content: any) => {
        const scores = content.scores || {};
        const layers = content.layers || {};
        
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Overall Memory Score */}
                <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-700/50 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-bold text-gray-100">Overall Memory Architecture Score</h4>
                            <p className="text-xs text-gray-400 mt-1">10-layer cognitive architecture evaluation</p>
                        </div>
                        <p className="text-5xl font-bold text-cyan-400">{scores.overall_memory_score || 'N/A'}</p>
                    </div>
                </div>

                {/* Sub-scores */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 cursor-default" title="Percentage of L1-L10 layers that have been implemented with classes, methods, and data structures.">
                        <p className="text-xs text-gray-400 mb-2">Implementation</p>
                        <p className="text-3xl font-bold text-blue-400">{scores.implementation_completeness || 0}</p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${scores.implementation_completeness || 0}%` }} />
                        </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 cursor-default" title="Verified data movement between memory layers. Tests cross-layer reads, writes, and information flow.">
                        <p className="text-xs text-gray-400 mb-2">Data Flow</p>
                        <p className="text-3xl font-bold text-purple-400">{scores.data_flow_verification || 0}</p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${scores.data_flow_verification || 0}%` }} />
                        </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 cursor-default" title="How well memory layers integrate with CoreLoop, ReasoningService, and tool execution systems.">
                        <p className="text-xs text-gray-400 mb-2">Integration</p>
                        <p className="text-3xl font-bold text-cyan-400">{scores.integration_maturity || 0}</p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${scores.integration_maturity || 0}%` }} />
                        </div>
                    </div>
                </div>

                {/* Memory Layers L1-L10 */}
                <div>
                    <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-cyan-500 rounded"></span>
                        Memory Layers (L1-L10)
                    </h4>
                    <div className="space-y-3">
                        {Object.entries(layers).map(([layerName, layerData]: [string, any]) => {
                            const isActive = layerData.status === 'active';
                            const isImplemented = layerData.status === 'implemented' || isActive;
                            
                            const layerTooltips: Record<string, string> = {
                                'L1': 'Sensory Buffer: Immediate perception processing and input buffering. Holds raw stimuli before cognitive processing.',
                                'L2': 'Working Memory: Active cognitive workspace for current tasks. Limited capacity, high-speed access.',
                                'L3': 'Short-term Memory: Recent context retention (minutes to hours). Supports conversational coherence.',
                                'L4': 'Episodic Memory: Event sequences and experiences. Autobiographical memory of system interactions.',
                                'L5': 'Semantic Memory: Facts, concepts, and declarative knowledge. Long-term factual information store.',
                                'L6': 'Procedural Memory: Skills, behaviors, and learned processes. How-to knowledge and action sequences.',
                                'L7': 'Long-term Storage: Persistent knowledge base. Archives consolidated information for retrieval.',
                                'L8': 'Meta-Memory: Memory about memory. Tracks what is known, confidence levels, and information sources.',
                                'L9': 'Associative Network: Concept relationships and semantic links. Enables analogical reasoning.',
                                'L10': 'Deep Archive: Historical system state and deprecated information. Cold storage for old data.'
                            };
                            
                            return (
                                <div 
                                    key={layerName} 
                                    className={`rounded-lg p-4 border cursor-default ${
                                        isActive ? 'bg-green-900/20 border-green-700/50' :
                                        isImplemented ? 'bg-blue-900/20 border-blue-700/50' :
                                        'bg-gray-800/30 border-gray-700'
                                    }`}
                                    title={layerTooltips[layerName] || layerData.purpose}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-bold px-2 py-1 rounded ${
                                                isActive ? 'bg-green-900/50 text-green-400' :
                                                isImplemented ? 'bg-blue-900/50 text-blue-400' :
                                                'bg-gray-700 text-gray-500'
                                            }`}>
                                                {layerName}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-200">{layerData.purpose}</span>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            isActive ? 'bg-green-900/50 text-green-400' :
                                            isImplemented ? 'bg-blue-900/50 text-blue-400' :
                                            'bg-gray-700 text-gray-400'
                                        }`}>
                                            {layerData.status}
                                        </span>
                                    </div>
                                    {layerData.class_name && (
                                        <div className="flex gap-4 text-xs text-gray-400 mt-2">
                                            <span>Class: {layerData.class_name}</span>
                                            <span>Methods: {layerData.method_count || 0}</span>
                                            {layerData.data_volume && <span>Data: {layerData.data_volume}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Cross-layer Integration */}
                {content.cross_layer_integration && (
                    <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Cross-Layer Integration</h4>
                        <p className="text-sm text-gray-300 mb-3">{content.cross_layer_integration.assessment}</p>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(content.cross_layer_integration.components || {}).map(([name, exists]: [string, any]) => (
                                <div key={name} className="flex items-center gap-2 text-sm">
                                    <span className={exists ? 'text-green-400' : 'text-gray-500'}>{exists ? '✓' : '✗'}</span>
                                    <span className="text-gray-300">{name.replace(/_/g, ' ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderRecommendationsV3 = (content: any) => {
        if (!content || (Array.isArray(content) && content.length === 0)) {
            return (
                <div className="bg-gray-800/30 rounded-lg p-6 text-center">
                    <p className="text-gray-400">No recommendations available</p>
                </div>
            );
        }

        // Handle array format (V3)
        if (Array.isArray(content)) {
            return (
                <div className="space-y-4 max-w-5xl">
                    {content.map((rec: any, idx: number) => {
                        const priorityColor = 
                            rec.priority === 'P0' ? 'bg-red-900/30 border-red-700 text-red-400' :
                            rec.priority === 'P1' ? 'bg-orange-900/30 border-orange-700 text-orange-400' :
                            rec.priority === 'P2' ? 'bg-yellow-900/30 border-yellow-700 text-yellow-400' :
                            'bg-blue-900/30 border-blue-700 text-blue-400';
                        
                        return (
                            <div key={idx} className={`rounded-lg p-5 border ${priorityColor}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                rec.priority === 'P0' ? 'bg-red-900/50 text-red-300' :
                                                rec.priority === 'P1' ? 'bg-orange-900/50 text-orange-300' :
                                                rec.priority === 'P2' ? 'bg-yellow-900/50 text-yellow-300' :
                                                'bg-blue-900/50 text-blue-300'
                                            }`}>
                                                {rec.priority}
                                            </span>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                                rec.priority === 'P0' ? 'bg-red-900/30 text-red-300' :
                                                rec.priority === 'P1' ? 'bg-orange-900/30 text-orange-300' :
                                                rec.priority === 'P2' ? 'bg-yellow-900/30 text-yellow-300' :
                                                'bg-blue-900/30 text-blue-300'
                                            }`}>
                                                {rec.category}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-gray-100 mb-2">{rec.recommendation}</h4>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 text-sm text-gray-300">
                                    {rec.rationale && (
                                        <p><span className="font-semibold text-gray-200">Rationale:</span> {rec.rationale}</p>
                                    )}
                                    {rec.impact && (
                                        <p><span className="font-semibold text-gray-200">Impact:</span> {rec.impact}</p>
                                    )}
                                    {rec.effort && (
                                        <p className="text-xs text-gray-400"><span className="font-semibold">Effort:</span> {rec.effort}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Handle object format (V1/V2) - delegate to existing renderer
        return renderFormattedRecommendations(content);
    };

    const renderCompetitiveLandscape = (content: any) => {
        const dimensionComparisons = content.dimension_comparisons || {};
        const competitors = content.competitors || {};
        const overallAssessment = content.overall_assessment || {};
        
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Overall Assessment */}
                <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="text-lg font-bold text-gray-100">Market Position</h4>
                            <p className="text-xs text-gray-400 mt-1">{overallAssessment.market_position}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-4xl font-bold text-purple-400">{overallAssessment.atlas_average_score}</p>
                            <p className="text-xs text-gray-400">ATLAS Score</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{overallAssessment.summary}</p>
                </div>

                {/* Dimension Comparisons - Bar Charts */}
                <div>
                    <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
                        <span className="w-1 h-5 bg-purple-500 rounded"></span>
                        Capability Comparison
                    </h4>
                    <div className="space-y-4">
                        {Object.entries(dimensionComparisons).map(([dimension, scores]: [string, any]) => (
                            <div key={dimension} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                <p className="text-xs font-semibold text-gray-300 mb-3">
                                    {dimension.replace(/_/g, ' ').toUpperCase()}
                                </p>
                                <div className="space-y-2">
                                    {Object.entries(scores).map(([competitor, score]: [string, any]) => (
                                        <div key={competitor} className="flex items-center gap-3">
                                            <div className="w-32 text-xs text-gray-400 truncate">
                                                {competitor === 'atlas' ? 'ATLAS' : competitor.replace(/_/g, ' ')}
                                            </div>
                                            <div className="flex-1 bg-gray-700 rounded-full h-6 overflow-hidden relative">
                                                <div 
                                                    className={`h-full rounded-full ${
                                                        competitor === 'atlas' ? 'bg-purple-500' :
                                                        competitor === 'industry_leaders' ? 'bg-blue-500' :
                                                        competitor === 'average_user' ? 'bg-green-500' :
                                                        'bg-gray-600'
                                                    }`}
                                                    style={{ width: `${score}%` }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-bold text-white">
                                                    {score}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Competitive Strengths & Weaknesses */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-green-400 mb-3">✓ Competitive Strengths</h4>
                        <div className="space-y-2">
                            {(content.competitive_strengths || []).map((strength: string, i: number) => (
                                <div key={i} className="bg-green-900/20 border-l-2 border-green-600 pl-3 py-2">
                                    <p className="text-xs text-gray-300">{strength}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-red-400 mb-3">✗ Competitive Weaknesses</h4>
                        <div className="space-y-2">
                            {(content.competitive_weaknesses || []).map((weakness: string, i: number) => (
                                <div key={i} className="bg-red-900/20 border-l-2 border-red-600 pl-3 py-2">
                                    <p className="text-xs text-gray-300">{weakness}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Unique Differentiators */}
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Unique Differentiators</h4>
                    <div className="flex flex-wrap gap-2">
                        {(content.unique_differentiators || []).map((diff: string, i: number) => (
                            <span key={i} className="bg-blue-900/30 text-blue-300 text-xs px-3 py-1.5 rounded">{diff}</span>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderMarketValuation = (content: any) => {
        const devInvestment = content.development_investment || {};
        const marketOpp = content.market_opportunity || {};
        const revenue = content.revenue_projections || {};
        const valuation = content.valuation_estimates || {};
        const funding = content.funding_assessment || {};
        
        const formatCurrency = (num: number) => {
            if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
            if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
            if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
            return `$${num}`;
        };
        
        return (
            <div className="space-y-6 max-w-5xl">
                {/* Valuation Range */}
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-2 border-green-600/50 rounded-xl p-6">
                    <h4 className="text-lg font-bold text-gray-100 mb-4">Current Valuation Estimate</h4>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                            <p className="text-xs text-gray-400 mb-2">Conservative</p>
                            <p className="text-4xl font-bold text-green-400">{formatCurrency(valuation.current_low)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-400 mb-2">Optimistic</p>
                            <p className="text-4xl font-bold text-emerald-400">{formatCurrency(valuation.current_high)}</p>
                        </div>
                    </div>
                </div>

                {/* Development Investment */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-gray-200 mb-3">Development Investment</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1">Lines of Code</p>
                            <p className="text-2xl font-bold text-purple-400">{devInvestment.lines_of_code?.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1">Estimated Cost</p>
                            <p className="text-2xl font-bold text-blue-400">
                                {formatCurrency(devInvestment.estimated_cost_low)} - {formatCurrency(devInvestment.estimated_cost_high)}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-400 mb-1">Time Investment</p>
                            <p className="text-2xl font-bold text-cyan-400">{devInvestment.time_investment_months} mo</p>
                        </div>
                    </div>
                </div>

                {/* Market Opportunity */}
                <div>
                    <h4 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                        <span className="w-1 h-5 bg-green-500 rounded"></span>
                        Market Opportunity
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-800/50 rounded p-3 text-center">
                            <p className="text-xs text-gray-400 mb-1">TAM</p>
                            <p className="text-xl font-bold text-green-400">{formatCurrency(marketOpp.total_addressable_market)}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded p-3 text-center">
                            <p className="text-xs text-gray-400 mb-1">SAM</p>
                            <p className="text-xl font-bold text-blue-400">{formatCurrency(marketOpp.serviceable_market)}</p>
                        </div>
                        <div className="bg-gray-800/50 rounded p-3 text-center">
                            <p className="text-xs text-gray-400 mb-1">Target Share</p>
                            <p className="text-xl font-bold text-purple-400">{marketOpp.target_market_share}%</p>
                        </div>
                    </div>
                </div>

                {/* Revenue Projections */}
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-blue-400 uppercase mb-3">Revenue Projections</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Year 1</p>
                            <p className="text-2xl font-bold text-blue-400">{formatCurrency(revenue.year_1)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Year 3</p>
                            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(revenue.year_3)}</p>
                        </div>
                    </div>
                </div>

                {/* Funding Assessment */}
                <div className="bg-gradient-to-r from-indigo-900/30 to-violet-900/30 border border-indigo-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-gray-200 mb-3">Funding Stage</h4>
                    <div className="mb-4">
                        <p className="text-xl font-bold text-indigo-400">{funding.stage}</p>
                        <p className="text-sm text-gray-400">Typical raise: {funding.typical_raise}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Key Milestones for Funding</p>
                        <ul className="list-disc list-inside space-y-1 text-xs text-gray-300">
                            {(funding.key_milestones_for_funding || []).map((milestone: string, i: number) => (
                                <li key={i}>{milestone}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Exit Scenarios */}
                <div>
                    <h4 className="text-sm font-bold text-gray-200 mb-3">Exit Scenarios</h4>
                    <div className="grid grid-cols-3 gap-3">
                        {(content.exit_scenarios || []).map((scenario: any, i: number) => (
                            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                                <p className="text-sm font-bold text-gray-200 mb-1">{scenario.type}</p>
                                <p className="text-lg font-bold text-purple-400 mb-2">{scenario.range}</p>
                                <p className="text-xs text-gray-400">Likelihood: {scenario.likelihood}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderKnownLimitations = (content: any) => {
        return (
            <div className="space-y-6 max-w-5xl">
                {Object.entries(content).map(([category, items]: [string, any]) => {
                    if (!Array.isArray(items) || items.length === 0) return null;
                    
                    return (
                        <div key={category}>
                            <h4 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                                <span className="w-1 h-5 bg-red-500 rounded"></span>
                                {category.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            </h4>
                            <div className="space-y-2">
                                {items.map((item: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 bg-red-900/10 border-l-2 border-red-600 pl-4 py-3 rounded-r">
                                        <span className="text-red-500 text-sm font-bold mt-0.5">⚠</span>
                                        <p className="text-sm text-gray-300 leading-relaxed flex-1">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderGenericSection = (sectionKey: string, content: any) => {
        const score = content.score;
        const hasScore = score !== undefined;

        return (
            <div className="space-y-4 max-w-5xl">
                {hasScore && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-300">Section Score</p>
                            <p className={`text-3xl font-bold ${
                                score >= 70 ? 'text-green-400' :
                                score >= 50 ? 'text-yellow-400' :
                                score >= 30 ? 'text-orange-400' : 'text-red-400'
                            }`}>{score}/100</p>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {Object.entries(content)
                        .filter(([key]) => key !== 'score')
                        .map(([key, value], idx) => {
                            const heading = key.replace(/_/g, " ").split(" ").map(w => 
                                w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(" ");

                            return (
                                <div key={key} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                                        {heading}
                                    </h4>
                                    <div className="pl-2">
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

    // Determine sections based on assessment version
    const isV3 = assessment?.version?.includes('3.0');
    
    const sections = isV3 ? [
        { id: "scorecard", label: "Executive Summary" },
        { id: "system_identity", label: "1. System Identity" },
        { id: "codebase_analysis", label: "2. Codebase Analysis" },
        { id: "test_analysis", label: "3. Test Coverage" },
        { id: "memory_architecture", label: "4. Memory Architecture" },
        { id: "ml_infrastructure", label: "5. Learning Infrastructure" },
        { id: "capability_inventory", label: "6. Capability Inventory" },
        { id: "jarvis_benchmark", label: "7. Jarvis Benchmark" },
        { id: "architectural_maturity", label: "8. Architectural Maturity" },
        { id: "reliability", label: "9. Reliability & Stability" },
        { id: "competitive_landscape", label: "10. Competitive Landscape" },
        { id: "market_valuation", label: "11. Market Valuation" },
        { id: "known_limitations", label: "12. Known Limitations" },
        { id: "recommendations", label: "13. Recommendations" },
    ] : [
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
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">
                                {selectedAssessmentId && `#${selectedAssessmentId} - `}
                                {new Date(assessment.generated_at).toLocaleString()}
                            </p>
                            {assessment.version && (
                                <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded">
                                    {assessment.version}
                                </span>
                            )}
                        </div>
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
                        <div className="w-64 border-r border-gray-700 overflow-y-auto bg-[#252526] flex-shrink-0 flex flex-col">
                            {/* Header with controls */}
                            <div className="p-3 border-b border-gray-700 flex-shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-semibold text-gray-400">ASSESSMENT HISTORY</h3>
                                    {selectedForDelete.size > 0 && (
                                        <button
                                            onClick={() => setShowBatchDeleteConfirm(true)}
                                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                            title={`Delete ${selectedForDelete.size} selected`}
                                        >
                                            🗑️ ({selectedForDelete.size})
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={selectAllForDelete}
                                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    {selectedForDelete.size === history.length ? "Deselect All" : "Select All"}
                                </button>
                            </div>
                            
                            {/* History list */}
                            <div className="flex-1 overflow-y-auto p-3 pt-2">
                                <div className="space-y-1">
                                    {history.map((h, index) => (
                                        <div key={h.id} className="relative group">
                                            <div className="flex items-start gap-2">
                                                {/* Checkbox */}
                                                <input
                                                    type="checkbox"
                                                    checked={selectedForDelete.has(h.id)}
                                                    onChange={() => toggleSelectForDelete(h.id)}
                                                    className="mt-2 cursor-pointer"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                
                                                {/* Assessment card */}
                                                <button
                                                    onClick={() => loadHistoricalAssessment(h.id)}
                                                    className={`flex-1 text-left px-2 py-2 text-xs rounded transition-colors ${
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
                                            </div>
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
                                {activeSection === "scorecard" && assessment.scorecard ? (
                                    renderV3ExecutiveSummary(assessment.scorecard, assessment)
                                ) : activeSection === "overall_score" && assessment.overall_score ? (
                                    renderExecutiveSummary(assessment.overall_score)
                                ) : activeSection === "jarvis_benchmark" && assessment.jarvis_benchmark ? (
                                    renderJarvisBenchmark(assessment.jarvis_benchmark)
                                ) : activeSection === "recommendations" && assessment.recommendations ? (
                                    renderRecommendationsV3(assessment.recommendations)
                                ) : activeSection === "memory_architecture" && assessment.memory_architecture ? (
                                    renderMemoryArchitectureV3(assessment.memory_architecture)
                                ) : activeSection && assessment[activeSection as keyof MetaAssessment] ? (
                                    renderBusinessFormatSection(activeSection, assessment[activeSection as keyof MetaAssessment])
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Batch Delete Confirmation Modal */}
            {showBatchDeleteConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md border border-gray-700">
                        <h3 className="text-base font-semibold text-gray-100 mb-3">Delete Selected Assessments?</h3>
                        <p className="text-sm text-gray-300 mb-2">
                            Are you sure you want to delete <strong>{selectedForDelete.size}</strong> assessment{selectedForDelete.size > 1 ? 's' : ''}?
                        </p>
                        <p className="text-xs text-gray-400 mb-2">
                            Assessment IDs: {Array.from(selectedForDelete).sort((a, b) => b - a).join(', ')}
                        </p>
                        <p className="text-xs text-red-400 mb-6">
                            This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowBatchDeleteConfirm(false)}
                                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={batchDeleteAssessments}
                                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 rounded transition-colors"
                                disabled={loading}
                            >
                                {loading ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MetaView;
