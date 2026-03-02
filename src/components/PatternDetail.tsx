import React from 'react';
import { FixPattern } from '@/lib/atlasLearningClient';

interface PatternDetailProps {
    pattern: FixPattern | null;
}

export default function PatternDetail({ pattern }: PatternDetailProps) {
    if (!pattern) {
        return (
            <div className="h-full flex items-center justify-center text-gray-500 p-4 text-center">
                Select a pattern to view details
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto bg-gray-900 text-gray-200">
            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="border-b border-gray-700 pb-3">
                    <h2 className="text-lg font-bold text-gray-100">
                        {pattern.tool}:<span className="font-mono text-blue-400">{pattern.error_code}</span>
                    </h2>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded p-3">
                        <div className="text-xs text-gray-400 mb-1">Total Attempts</div>
                        <div className="text-2xl font-bold text-blue-400">{pattern.attempts}</div>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                        <div className="text-xs text-gray-400 mb-1">Success Rate</div>
                        <div className={`text-2xl font-bold ${
                            pattern.success_rate >= 70 ? 'text-green-400' :
                            pattern.success_rate >= 40 ? 'text-yellow-400' :
                            'text-red-400'
                        }`}>
                            {pattern.success_rate.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                        <div className="text-xs text-gray-400 mb-1">Successes</div>
                        <div className="text-2xl font-bold text-green-400">{pattern.successes}</div>
                    </div>
                    <div className="bg-gray-800 rounded p-3">
                        <div className="text-xs text-gray-400 mb-1">Failures</div>
                        <div className="text-2xl font-bold text-red-400">{pattern.failures}</div>
                    </div>
                </div>

                {/* Learning Status */}
                <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400 mb-2">Learning Status</div>
                    <div className="space-y-2">
                        {pattern.attempts === 0 && (
                            <div className="text-sm text-gray-400">
                                No attempts yet
                            </div>
                        )}
                        {pattern.attempts > 0 && pattern.success_rate === 0 && (
                            <div className="text-sm text-yellow-300">
                                ⚠️ All attempts failed - pattern will be deprioritized
                            </div>
                        )}
                        {pattern.success_rate > 0 && pattern.success_rate < 40 && (
                            <div className="text-sm text-orange-300">
                                ⚠️ Low success rate - needs improvement
                            </div>
                        )}
                        {pattern.success_rate >= 40 && pattern.success_rate < 70 && (
                            <div className="text-sm text-blue-300">
                                📊 Moderate success - continuing to learn
                            </div>
                        )}
                        {pattern.success_rate >= 70 && (
                            <div className="text-sm text-green-300">
                                ✓ High success rate - pattern well learned
                            </div>
                        )}
                        {pattern.attempts < 10 && (
                            <div className="text-xs text-gray-500 mt-1">
                                More samples needed for reliable confidence
                            </div>
                        )}
                    </div>
                </div>

                {/* Last Updated */}
                {pattern.last_updated && (
                    <div className="bg-gray-800 rounded p-3">
                        <div className="text-xs text-gray-400 mb-1">Last Updated</div>
                        <div className="text-sm text-gray-300">
                            {(() => {
                                try {
                                    const date = new Date(pattern.last_updated);
                                    return isNaN(date.getTime()) 
                                        ? pattern.last_updated 
                                        : date.toLocaleString();
                                } catch {
                                    return pattern.last_updated;
                                }
                            })()}
                        </div>
                    </div>
                )}

                {/* Similar Patterns */}
                {pattern.similar_patterns && pattern.similar_patterns.length > 0 && (
                    <div className="bg-gray-800 rounded p-3">
                        <div className="text-xs text-gray-400 mb-2">Similar Patterns</div>
                        <div className="space-y-1">
                            {pattern.similar_patterns.map((similarPattern, idx) => (
                                <div key={idx} className="text-sm text-gray-300 font-mono">
                                    {similarPattern}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Learning Notes */}
                <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400 mb-2">Learning Notes</div>
                    <div className="text-sm text-gray-300 space-y-1">
                        <div>
                            • Pattern is used to inform future fix generation
                        </div>
                        <div>
                            • Higher success rates increase confidence in this approach
                        </div>
                        <div>
                            • Failed patterns help Atlas avoid ineffective strategies
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
