import React from 'react';
import { FixPattern } from '@/lib/atlasLearningClient';

interface PatternsListProps {
    patterns: FixPattern[];
    selectedPattern: string | null;
    onSelect: (patternId: string) => void;
}

function PatternsList({ patterns, selectedPattern, onSelect }: PatternsListProps) {
    if (patterns.length === 0) {
        return (
            <div className="p-4 text-gray-500 text-center">
                No patterns learned yet
            </div>
        );
    }

    return (
        <div className="overflow-auto h-full">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800 sticky top-0">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Tool
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Error Code
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Attempts
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Successes
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Failures
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Success Rate
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                    {patterns.map((pattern) => {
                        const patternId = `${pattern.tool}:${pattern.error_code}`;
                        const isSelected = selectedPattern === patternId;
                        
                        return (
                            <tr
                                key={patternId}
                                onClick={() => onSelect(patternId)}
                                className={`cursor-pointer hover:bg-gray-800 transition-colors ${
                                    isSelected ? 'bg-gray-800 border-l-4 border-blue-500' : ''
                                }`}
                            >
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-100 font-medium">
                                    {pattern.tool}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-300 font-mono">
                                    {pattern.error_code}
                                </td>
                                <td className="px-3 py-2 text-center text-sm text-blue-400 font-semibold">
                                    {pattern.attempts}
                                </td>
                                <td className="px-3 py-2 text-center text-sm text-green-400 font-semibold">
                                    {pattern.successes}
                                </td>
                                <td className="px-3 py-2 text-center text-sm text-red-400 font-semibold">
                                    {pattern.failures}
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap text-sm">
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-semibold ${
                                            pattern.success_rate >= 70
                                                ? 'bg-green-900 text-green-200'
                                                : pattern.success_rate >= 40
                                                ? 'bg-yellow-900 text-yellow-200'
                                                : 'bg-red-900 text-red-200'
                                        }`}
                                    >
                                        {pattern.success_rate.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// Memoize to prevent unnecessary re-renders when patterns haven't changed
export default React.memo(PatternsList, (prevProps, nextProps) => {
    if (prevProps.selectedPattern !== nextProps.selectedPattern) return false;
    if (prevProps.patterns.length !== nextProps.patterns.length) return false;
    
    // Check if any pattern changed
    for (let i = 0; i < prevProps.patterns.length; i++) {
        const prev = prevProps.patterns[i];
        const next = nextProps.patterns[i];
        const prevId = `${prev.tool}:${prev.error_code}`;
        const nextId = `${next.tool}:${next.error_code}`;
        if (prevId !== nextId || prev.attempts !== next.attempts || prev.success_rate !== next.success_rate) {
            return false;
        }
    }
    
    return true;
});
