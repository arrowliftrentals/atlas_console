
import React, { useEffect, useState } from "react";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

interface SubsystemStatus {
    initialized: boolean;
    category: string;
    description: string;
}

interface SubsystemsData {
    [key: string]: SubsystemStatus;
}

interface DatabaseResult {
    layer: string;
    status: string;
    size_mb: number;
    integrity_ok: boolean;
    row_counts: Record<string, number>;
}

interface DatabaseHealthSummary {
    all_healthy: boolean;
    total_databases: number;
    healthy_count: number;
    corrupted_count: number;
    oversized_count: number;
    total_size_mb: number;
    corrupted: string[];
    oversized: string[];
    checked_at: string;
    results: DatabaseResult[];
}

const BACKEND_URL = "";

// Category colors for visual differentiation
const CATEGORY_COLORS: { [key: string]: string } = {
    Core: "text-blue-400",
    ML: "text-purple-400",
    Knowledge: "text-green-400",
    Learning: "text-teal-400",
    Execution: "text-orange-400",
    Safety: "text-red-400",
    Operations: "text-yellow-400",
    Proactive: "text-pink-400",
    Context: "text-indigo-400",
    Monitoring: "text-gray-400",
};

// Memory layer colors
const LAYER_COLORS: { [key: string]: string } = {
    L1: "text-cyan-400",
    L2: "text-blue-400",
    L3: "text-indigo-400",
    L4: "text-purple-400",
    L5: "text-pink-400",
    L6: "text-rose-400",
    L7: "text-orange-400",
    L8: "text-amber-400",
    L9: "text-yellow-400",
    L10: "text-lime-400",
};

// Memory layer descriptions
const LAYER_INFO: { [key: string]: { name: string; description: string } } = {
    L1: { name: "Sensory Buffer", description: "Raw input processing and immediate context" },
    L2: { name: "Working Memory", description: "Active conversation context and session state" },
    L3: { name: "Episodic Memory", description: "Experience records and interaction history" },
    L4: { name: "Semantic Memory", description: "Extracted facts and knowledge base" },
    L5: { name: "Procedural Memory", description: "Learned procedures and action sequences" },
    L6: { name: "Emotional Memory", description: "Sentiment tracking and emotional context" },
    L7: { name: "World Model", description: "Environmental state and causal understanding" },
    L8: { name: "Planning Memory", description: "Goals, tasks, and execution plans" },
    L9: { name: "Social Memory", description: "User profiles and interaction patterns" },
    L10: { name: "Meta-Cognitive", description: "Self-reflection and learning optimization" },
};

type SubTab = 'subsystems' | 'memory';

const SystemsView: React.FC = () => {
    const { health } = useHealth();
    const [activeTab, setActiveTab] = useState<SubTab>('subsystems');
    // Subsystems state
    const [subsystems, setSubsystems] = useState<SubsystemsData>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initializingSubsystem, setInitializingSubsystem] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    
    // Memory integrity state
    const [dbHealth, setDbHealth] = useState<DatabaseHealthSummary | null>(null);
    const [dbLoading, setDbLoading] = useState(false);
    const [dbError, setDbError] = useState<string | null>(null);
    const [checkingDb, setCheckingDb] = useState(false);
    const [checkpointingDb, setCheckpointingDb] = useState(false);

    const loadSubsystems = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/api/systems`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setSubsystems(data);
        } catch (e: any) {
            console.error("Failed to load subsystems:", e);
            setError(`Failed to load subsystems: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const initializeSubsystem = async (subsystemName: string) => {
        setInitializingSubsystem(subsystemName);
        try {
            const response = await fetch(`${BACKEND_URL}/api/systems/${subsystemName}/initialize`, {
                method: 'POST',
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            
            // Show result message
            if (data.status === "initialized") {
                alert(`✅ ${subsystemName} initialized successfully`);
            } else if (data.status === "already_initialized") {
                alert(`ℹ️ ${subsystemName} is already initialized`);
            } else if (data.status === "error") {
                alert(`❌ Error: ${data.message}`);
            }
            
            // Reload subsystems status
            await loadSubsystems();
        } catch (e: any) {
            console.error(`Failed to initialize ${subsystemName}:`, e);
            alert(`❌ Failed to initialize ${subsystemName}: ${e.message}`);
        } finally {
            setInitializingSubsystem(null);
        }
    };

    const loadDatabaseHealth = async () => {
        setDbLoading(true);
        setDbError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/api/database/health`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }
            // Normalize API response to match DatabaseHealthSummary interface
            const lastCheck = data.last_check || {};
            const normalized: DatabaseHealthSummary = {
                all_healthy: lastCheck.all_healthy ?? true,
                total_databases: data.databases_monitored ?? 0,
                healthy_count: lastCheck.healthy ?? 0,
                corrupted_count: (lastCheck.corrupted || []).length,
                oversized_count: (lastCheck.oversized || []).length,
                total_size_mb: lastCheck.total_size_mb ?? 0,
                corrupted: lastCheck.corrupted || [],
                oversized: lastCheck.oversized || [],
                checked_at: lastCheck.timestamp || '',
                results: [], // Populated by manual integrity check
            };
            setDbHealth(normalized);
        } catch (e: any) {
            console.error("Failed to load database health:", e);
            setDbError(`Failed to load database health: ${e.message}`);
        } finally {
            setDbLoading(false);
        }
    };

    const runDatabaseCheck = async () => {
        setCheckingDb(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/database/check`, { method: 'POST' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setDbHealth(data);
        } catch (e: any) {
            console.error("Failed to run database check:", e);
            alert(`❌ Failed to run database check: ${e.message}`);
        } finally {
            setCheckingDb(false);
        }
    };

    const runCheckpoint = async () => {
        setCheckpointingDb(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/database/checkpoint`, { method: 'POST' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            alert(`✅ WAL checkpoint completed for ${data.checkpointed?.length || 0} databases`);
            // Reload health after checkpoint
            await loadDatabaseHealth();
        } catch (e: any) {
            console.error("Failed to run checkpoint:", e);
            alert(`❌ Failed to run checkpoint: ${e.message}`);
        } finally {
            setCheckpointingDb(false);
        }
    };

    useEffect(() => {
        loadSubsystems();
        loadDatabaseHealth();
    }, []);

    // Group subsystems by category
    const groupedSubsystems: { [category: string]: [string, SubsystemStatus][] } = {};
    Object.entries(subsystems).forEach(([name, status]) => {
        const category = status.category;
        if (!groupedSubsystems[category]) {
            groupedSubsystems[category] = [];
        }
        groupedSubsystems[category].push([name, status]);
    });

    // Calculate statistics
    const totalSubsystems = Object.keys(subsystems).length;
    const initializedCount = Object.values(subsystems).filter(s => s.initialized).length;
    const uninitializedCount = totalSubsystems - initializedCount;
    const initializationPercentage = totalSubsystems > 0 ? (initializedCount / totalSubsystems * 100).toFixed(0) : 0;

    // Filter by selected category
    const displayedCategories = selectedCategory 
        ? { [selectedCategory]: groupedSubsystems[selectedCategory] }
        : groupedSubsystems;

    return (
        <div className="h-full w-full flex flex-col bg-[#02030a]">
            {/* Header */}
            <TabHeader
                title="System Status"
                subtitle={activeTab === 'subsystems' ? `${initializedCount}/${totalSubsystems} subsystems active` : `${dbHealth?.healthy_count || 0}/${dbHealth?.total_databases || 0} databases healthy`}
                statusConnected={health.backend === 'connected'}
                statusLabel={health.backend === 'connected' ? 'Connected' : 'Disconnected'}
            >
                <button
                    onClick={activeTab === 'subsystems' ? loadSubsystems : loadDatabaseHealth}
                    disabled={loading || dbLoading}
                    className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
                >
                    {(loading || dbLoading) ? "Refreshing..." : "Refresh"}
                </button>
            </TabHeader>

            {/* Sub-tabs */}
            <div className="px-4 py-2 bg-[#252526] border-b border-gray-700">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('subsystems')}
                        className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                            activeTab === 'subsystems'
                                ? 'bg-[#02030a] text-white border-t border-l border-r border-gray-700'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Subsystems
                    </button>
                    <button
                        onClick={() => setActiveTab('memory')}
                        className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                            activeTab === 'memory'
                                ? 'bg-[#02030a] text-white border-t border-l border-r border-gray-700'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Memory Integrity
                    </button>
                </div>
            </div>

            {/* Subsystems Tab Content */}
            {activeTab === 'subsystems' && (
                <>
                    {/* Statistics */}
                    <div className="p-4 border-b border-gray-700">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded bg-[#252526]">
                                <div className="text-2xl font-bold text-blue-400">
                                    {initializedCount}/{totalSubsystems}
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Initialized ({initializationPercentage}%)
                                </div>
                            </div>
                            <div className="p-4 rounded bg-[#252526]">
                                <div className="text-2xl font-bold text-green-400">
                                    {initializedCount}
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Active
                                </div>
                            </div>
                            <div className="p-4 rounded bg-[#252526]">
                                <div className="text-2xl font-bold text-orange-400">
                                    {uninitializedCount}
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Inactive
                                </div>
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                    selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-[#252526] text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                All Categories
                            </button>
                            {Object.keys(groupedSubsystems).sort().map(category => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                        selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-[#252526] text-gray-300 hover:bg-gray-700'
                                    }`}
                                >
                                    {category} ({groupedSubsystems[category].length})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subsystems List */}
                    <div className="flex-1 overflow-auto p-4">
                        {error && (
                            <div className="p-4 mb-4 rounded border-l-4 border-red-500 bg-[#252526]">
                                <p className="text-red-400">{error}</p>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-lg text-gray-400">
                                    Loading subsystems...
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(displayedCategories).sort(([a], [b]) => a.localeCompare(b)).map(([category, systems]) => (
                                    <div key={category}>
                                        <h2 className={`text-lg font-bold mb-3 ${CATEGORY_COLORS[category] || 'text-gray-400'}`}>
                                            {category}
                                        </h2>
                                        <div className="space-y-2">
                                            {systems.sort(([a], [b]) => a.localeCompare(b)).map(([name, status]) => (
                                                <div
                                                    key={name}
                                                    className={`p-4 rounded border flex items-center justify-between bg-[#252526] ${
                                                        status.initialized ? 'border-green-500/30' : 'border-gray-700'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={`w-3 h-3 rounded-full ${
                                                                    status.initialized ? 'bg-green-500' : 'bg-orange-500'
                                                                }`}
                                                            />
                                                            <div>
                                                                <h3 className="font-mono font-medium text-white">
                                                                    {name}
                                                                </h3>
                                                                <p className="text-xs mt-1 text-gray-400">
                                                                    {status.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span
                                                            className={`px-3 py-1 rounded text-xs font-medium ${
                                                                status.initialized ? 'bg-green-900/30 text-green-400' : 'bg-orange-900/30 text-orange-400'
                                                            }`}
                                                        >
                                                            {status.initialized ? 'Initialized' : 'Not Initialized'}
                                                        </span>
                                                        {/* Only show Initialize button for subsystems that support manual init */}
                                                        {!status.initialized && ['classification_service', 'sandbox_manager'].includes(name) && (
                                                            <button
                                                                onClick={() => initializeSubsystem(name)}
                                                                disabled={initializingSubsystem === name}
                                                                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                                                    initializingSubsystem === name ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                                }`}
                                                            >
                                                                {initializingSubsystem === name ? 'Initializing...' : 'Initialize'}
                                                            </button>
                                                        )}
                                                        {!status.initialized && !['classification_service', 'sandbox_manager'].includes(name) && (
                                                            <span className="px-3 py-1 text-xs text-gray-500" title="Requires server restart">
                                                                Restart required
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Note */}
                    <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
                        ⚠️ Note: Manual initialization state is ephemeral and will reset on server restart.
                    </div>
                </>
            )}

            {/* Memory Integrity Tab Content */}
            {activeTab === 'memory' && (
                <>
                    {/* Statistics & Actions */}
                    <div className="p-4 border-b border-gray-700">
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="p-4 rounded bg-[#252526]">
                                <div className={`text-2xl font-bold ${dbHealth?.all_healthy ? 'text-green-400' : 'text-red-400'}`}>
                                    {dbHealth?.all_healthy ? '✓ Healthy' : '✗ Issues'}
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Overall Status
                                </div>
                            </div>
                            <div className="p-4 rounded bg-[#252526]">
                                <div className="text-2xl font-bold text-blue-400">
                                    {dbHealth?.total_databases || 0}
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Memory Layers
                                </div>
                            </div>
                            <div className="p-4 rounded bg-[#252526]">
                                <div className="text-2xl font-bold text-purple-400">
                                    {dbHealth?.total_size_mb?.toFixed(1) || '0'} MB
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Total Size
                                </div>
                            </div>
                            <div className="p-4 rounded bg-[#252526]">
                                <div className={`text-2xl font-bold ${(dbHealth?.corrupted_count || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {dbHealth?.corrupted_count || 0}
                                </div>
                                <div className="text-xs mt-1 text-gray-400">
                                    Corrupted
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={runDatabaseCheck}
                                disabled={checkingDb}
                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                    checkingDb ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                {checkingDb ? 'Checking...' : 'Run Integrity Check'}
                            </button>
                            <button
                                onClick={runCheckpoint}
                                disabled={checkpointingDb}
                                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                                    checkpointingDb ? 'bg-gray-700 text-gray-400' : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`}
                            >
                                {checkpointingDb ? 'Running...' : 'WAL Checkpoint'}
                            </button>
                        </div>
                    </div>

                    {/* Memory Layers List */}
                    <div className="flex-1 overflow-auto p-4">
                        {dbError && (
                            <div className="p-4 mb-4 rounded border-l-4 border-red-500 bg-[#252526]">
                                <p className="text-red-400">{dbError}</p>
                            </div>
                        )}

                        {dbLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-lg text-gray-400">
                                    Loading memory layer status...
                                </div>
                            </div>
                        ) : dbHealth?.results ? (
                            <div className="space-y-3">
                                {dbHealth.results.map((result) => {
                                    const layerKey = result.layer;
                                    const layerColor = LAYER_COLORS[layerKey] || 'text-gray-400';
                                    const layerInfo = LAYER_INFO[layerKey] || { name: layerKey, description: 'Memory layer' };
                                    // Filter out -1 counts (tables that couldn't be counted) and sum valid rows
                                    const validCounts = Object.entries(result.row_counts || {}).filter(([, count]) => count >= 0);
                                    const totalRows = validCounts.reduce((a, [, b]) => a + b, 0);
                                    
                                    return (
                                        <div
                                            key={result.layer}
                                            className={`p-4 rounded border bg-[#252526] ${
                                                result.integrity_ok ? 'border-green-500/30' : 'border-red-500/50'
                                            }`}
                                        >
                                            {/* Header row */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-3 h-3 rounded-full ${
                                                            result.integrity_ok ? 'bg-green-500' : 'bg-red-500'
                                                        }`}
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-mono font-bold ${layerColor}`}>
                                                                {result.layer}
                                                            </span>
                                                            <span className="text-white font-medium">
                                                                {layerInfo.name}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {layerInfo.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-sm font-medium text-white">
                                                            {result.size_mb.toFixed(2)} MB
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {totalRows.toLocaleString()} records
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`px-3 py-1 rounded text-xs font-medium ${
                                                            result.status === 'healthy' ? 'bg-green-900/30 text-green-400' :
                                                            result.status === 'corrupted' ? 'bg-red-900/30 text-red-400' :
                                                            'bg-orange-900/30 text-orange-400'
                                                        }`}
                                                    >
                                                        {result.status}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Table breakdown - only show tables with valid counts */}
                                            {validCounts.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-700">
                                                    <div className="text-xs text-gray-500 mb-2">Tables:</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {validCounts.map(([table, count]) => (
                                                            <span
                                                                key={table}
                                                                className={`px-2 py-1 rounded text-xs ${
                                                                    count > 0 ? 'bg-[#1a1a2e] text-gray-200' : 'bg-[#1a1a1a] text-gray-500'
                                                                }`}
                                                            >
                                                                <span className="text-gray-400">{table}:</span> {count.toLocaleString()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center text-gray-400">
                                    <p>No database health data available</p>
                                    <button
                                        onClick={runDatabaseCheck}
                                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                    >
                                        Run Health Check
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
                        {dbHealth?.checked_at && (
                            <span>Last checked: {new Date(dbHealth.checked_at).toLocaleString()}</span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SystemsView;
