'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface BenchmarkResult {
    name: string;
    category: string;
    dimension: string;
    score: number;
    target: number | null;
    targetMet: boolean;
    status: 'pending' | 'running' | 'completed' | 'failed';
    samplesProcessed?: number;
    totalSamples?: number;
    accuracy?: number;
    executionTimeMs?: number;
    error?: string;
}

interface SuiteStatus {
    running: boolean;
    totalBenchmarks: number;
    completedBenchmarks: number;
    overallScore: number | null;
    targetsMetCount: number;
    targetsTotalCount: number;
}

interface BenchmarkInfo {
    name: string;
    category: string;
    dimension: string;
    description: string;
    required_fixtures: string[];
}

export default function BenchmarkLiveView() {
    const [results, setResults] = useState<Map<string, BenchmarkResult>>(new Map());
    const [suiteStatus, setSuiteStatus] = useState<SuiteStatus>({
        running: false,
        totalBenchmarks: 0,
        completedBenchmarks: 0,
        overallScore: null,
        targetsMetCount: 0,
        targetsTotalCount: 0,
    });
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    
    // Benchmark selection
    const [availableBenchmarks, setAvailableBenchmarks] = useState<BenchmarkInfo[]>([]);
    const [selectedBenchmarks, setSelectedBenchmarks] = useState<Set<string>>(new Set());
    const [loadingBenchmarks, setLoadingBenchmarks] = useState(true);

    // Fetch available benchmarks on mount
    useEffect(() => {
        const fetchBenchmarks = async () => {
            try {
                const res = await fetch('http://localhost:8000/v1/benchmarks');
                if (res.ok) {
                    const data = await res.json();
                    setAvailableBenchmarks(data.benchmarks || []);
                    // Select all by default
                    setSelectedBenchmarks(new Set(data.benchmarks.map((b: BenchmarkInfo) => b.name)));
                }
            } catch (e) {
                console.error('Failed to fetch benchmarks:', e);
            } finally {
                setLoadingBenchmarks(false);
            }
        };
        fetchBenchmarks();
    }, []);

    const toggleBenchmark = (name: string) => {
        setSelectedBenchmarks(prev => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedBenchmarks(new Set(availableBenchmarks.map(b => b.name)));
    };

    const selectNone = () => {
        setSelectedBenchmarks(new Set());
    };

    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-100), `[${timestamp}] ${message}`]);
    }, []);

    const startBenchmarks = useCallback(async () => {
        // Reset state
        setResults(new Map());
        setLogs([]);
        setError(null);
        setSuiteStatus({
            running: true,
            totalBenchmarks: 0,
            completedBenchmarks: 0,
            overallScore: null,
            targetsMetCount: 0,
            targetsTotalCount: 0,
        });

        addLog('🚀 Starting benchmark suite...');

        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        // Build query params for selected benchmarks
        const selectedList = Array.from(selectedBenchmarks);
        addLog(`Selected benchmarks: ${selectedList.join(', ') || '(none)'}`);
        
        const params = new URLSearchParams();
        // Always send the filter if not all are selected
        if (selectedList.length > 0) {
            params.set('benchmarks', selectedList.join(','));
            addLog(`Filter param: benchmarks=${selectedList.join(',')}`);
        }
        
        // Connect to SSE stream
        const url = `http://localhost:8000/v1/benchmarks/stream${params.toString() ? '?' + params.toString() : ''}`;
        addLog(`Connecting to: ${url}`);
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'suite_start':
                        addLog(`📋 Suite started: ${data.total_benchmarks} benchmarks to run`);
                        setSuiteStatus(prev => ({
                            ...prev,
                            totalBenchmarks: data.total_benchmarks,
                        }));
                        break;

                    case 'benchmark_start':
                        addLog(`▶️ Starting: ${data.name} (${data.category})`);
                        setResults(prev => {
                            const next = new Map(prev);
                            next.set(data.name, {
                                name: data.name,
                                category: data.category,
                                dimension: data.dimension,
                                score: 0,
                                target: null,
                                targetMet: false,
                                status: 'running',
                            });
                            return next;
                        });
                        break;

                    case 'benchmark_progress':
                        setResults(prev => {
                            const next = new Map(prev);
                            const existing = next.get(data.name);
                            if (existing) {
                                next.set(data.name, {
                                    ...existing,
                                    samplesProcessed: data.current,
                                    totalSamples: data.total,
                                    accuracy: data.accuracy,
                                });
                            }
                            return next;
                        });
                        break;

                    case 'sample_result':
                        // Individual sample results - could show in detailed view
                        if (data.correct) {
                            addLog(`  ✓ ${data.benchmark}: "${data.prompt}..." → ${data.predicted}`);
                        } else {
                            addLog(`  ✗ ${data.benchmark}: "${data.prompt}..." expected ${data.expected}, got ${data.predicted}`);
                        }
                        break;

                    case 'benchmark_complete':
                        addLog(`✅ Complete: ${data.name} = ${data.score?.toFixed(1) || 0}/100 ${data.target_met ? '(target met)' : ''}`);
                        setResults(prev => {
                            const next = new Map(prev);
                            next.set(data.name, {
                                name: data.name,
                                category: data.category || prev.get(data.name)?.category || '',
                                dimension: data.dimension || prev.get(data.name)?.dimension || '',
                                score: data.score || 0,
                                target: data.target,
                                targetMet: data.target_met || false,
                                status: data.status === 'failed' ? 'failed' : 'completed',
                                executionTimeMs: data.execution_time_ms,
                                samplesProcessed: data.samples_tested,
                                totalSamples: data.samples_tested,
                                error: data.error_message,
                            });
                            return next;
                        });
                        setSuiteStatus(prev => ({
                            ...prev,
                            completedBenchmarks: prev.completedBenchmarks + 1,
                            targetsMetCount: prev.targetsMetCount + (data.target_met ? 1 : 0),
                            targetsTotalCount: prev.targetsTotalCount + (data.target ? 1 : 0),
                        }));
                        break;

                    case 'suite_complete':
                        addLog(`🏁 Suite complete! Overall score: ${data.overall_score?.toFixed(1) || 0}/100`);
                        setSuiteStatus(prev => ({
                            ...prev,
                            running: false,
                            overallScore: data.overall_score,
                        }));
                        eventSource.close();
                        break;

                    case 'error':
                        addLog(`❌ Error: ${data.message}`);
                        setError(data.message);
                        break;
                }
            } catch (e) {
                console.error('Failed to parse SSE event:', e);
            }
        };

        eventSource.onerror = (e) => {
            addLog('❌ Connection error - stream closed');
            setSuiteStatus(prev => ({ ...prev, running: false }));
            eventSource.close();
        };
    }, [addLog, selectedBenchmarks]);

    const stopBenchmarks = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        addLog('⏹️ Benchmark suite stopped by user');
        setSuiteStatus(prev => ({ ...prev, running: false }));
    }, [addLog]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const resultsArray = Array.from(results.values());
    const completedResults = resultsArray.filter(r => r.status === 'completed' || r.status === 'failed');
    const runningResults = resultsArray.filter(r => r.status === 'running');

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div>
                    <h1 className="text-xl font-bold">Benchmark Dashboard</h1>
                    <p className="text-sm text-gray-400">Real-time benchmark execution</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                        {selectedBenchmarks.size}/{availableBenchmarks.length} selected
                    </span>
                    {suiteStatus.running ? (
                        <button
                            onClick={stopBenchmarks}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium"
                        >
                            ⏹️ Stop
                        </button>
                    ) : (
                        <button
                            onClick={startBenchmarks}
                            disabled={selectedBenchmarks.size === 0}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                selectedBenchmarks.size === 0 
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                            ▶️ Run Selected
                        </button>
                    )}
                </div>
            </div>

            {/* Benchmark Selection */}
            {!suiteStatus.running && (
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-gray-400">SELECT BENCHMARKS</h2>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">Select All</button>
                            <span className="text-gray-600">|</span>
                            <button onClick={selectNone} className="text-xs text-blue-400 hover:text-blue-300">Select None</button>
                        </div>
                    </div>
                    {loadingBenchmarks ? (
                        <div className="text-gray-500 text-sm">Loading benchmarks...</div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {availableBenchmarks.map(benchmark => (
                                <label
                                    key={benchmark.name}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                        selectedBenchmarks.has(benchmark.name)
                                            ? 'bg-blue-500/20 border border-blue-500/40'
                                            : 'bg-gray-700/50 border border-gray-700 hover:border-gray-600'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedBenchmarks.has(benchmark.name)}
                                        onChange={() => toggleBenchmark(benchmark.name)}
                                        className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{benchmark.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{benchmark.category} • {benchmark.dimension}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Overall Status */}
            <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-700">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-400">
                        {suiteStatus.overallScore?.toFixed(1) || '—'}
                    </div>
                    <div className="text-xs text-gray-400">Overall Score</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">
                        {suiteStatus.completedBenchmarks}/{suiteStatus.totalBenchmarks}
                    </div>
                    <div className="text-xs text-gray-400">Completed</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">
                        {suiteStatus.targetsMetCount}/{suiteStatus.targetsTotalCount || '—'}
                    </div>
                    <div className="text-xs text-gray-400">Targets Met</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className={`text-3xl font-bold ${suiteStatus.running ? 'text-amber-400 animate-pulse' : 'text-gray-500'}`}>
                        {suiteStatus.running ? '● RUNNING' : '○ IDLE'}
                    </div>
                    <div className="text-xs text-gray-400">Status</div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Results Panel */}
                <div className="w-1/2 border-r border-gray-700 overflow-auto p-4">
                    <h2 className="text-sm font-semibold text-gray-400 mb-3">BENCHMARK RESULTS</h2>
                    
                    {/* Running benchmarks */}
                    {runningResults.map(result => (
                        <div key={result.name} className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-amber-400">{result.name}</span>
                                <span className="text-xs text-amber-300 animate-pulse">● Running</span>
                            </div>
                            {result.samplesProcessed !== undefined && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>{result.samplesProcessed}/{result.totalSamples} samples</span>
                                        <span>{result.accuracy?.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div 
                                            className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(result.samplesProcessed / (result.totalSamples || 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Completed benchmarks */}
                    {completedResults.map(result => (
                        <div 
                            key={result.name} 
                            className={`mb-3 p-3 rounded-lg border ${
                                result.status === 'failed' 
                                    ? 'bg-red-500/10 border-red-500/30' 
                                    : result.targetMet 
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : 'bg-gray-800 border-gray-700'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-medium">{result.name}</span>
                                    <span className="ml-2 text-xs text-gray-500">{result.category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-lg font-bold ${
                                        result.status === 'failed' ? 'text-red-400' :
                                        result.targetMet ? 'text-green-400' : 'text-gray-300'
                                    }`}>
                                        {result.score.toFixed(1)}
                                    </span>
                                    {result.target && (
                                        <span className="text-xs text-gray-500">/ {result.target}</span>
                                    )}
                                    {result.targetMet && <span className="text-green-400">✓</span>}
                                </div>
                            </div>
                            {result.error && (
                                <div className="mt-2 text-xs text-red-400">{result.error}</div>
                            )}
                            {result.executionTimeMs && (
                                <div className="mt-1 text-xs text-gray-500">
                                    {result.executionTimeMs.toFixed(0)}ms • {result.samplesProcessed} samples
                                </div>
                            )}
                        </div>
                    ))}

                    {resultsArray.length === 0 && !suiteStatus.running && (
                        <div className="text-center text-gray-500 py-8">
                            Click "Run Benchmarks" to start
                        </div>
                    )}
                </div>

                {/* Live Log Panel */}
                <div className="w-1/2 overflow-hidden flex flex-col">
                    <h2 className="text-sm font-semibold text-gray-400 p-4 pb-2">LIVE LOG</h2>
                    <div className="flex-1 overflow-auto p-4 pt-0 font-mono text-xs">
                        {logs.map((log, i) => (
                            <div key={i} className="text-gray-300 py-0.5 hover:bg-gray-800/50">
                                {log}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-900/50 border-t border-red-500 text-red-200">
                    Error: {error}
                </div>
            )}
        </div>
    );
}
