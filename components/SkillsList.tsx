import React from 'react';
import { SkillExecutionSummary } from '@/lib/atlasSkillsClient';

interface SkillsListProps {
    executions: SkillExecutionSummary[];
    selectedId: number | null;
    onSelect: (id: number) => void;
}

export default function SkillsList({ executions, selectedId, onSelect }: SkillsListProps) {
    if (executions.length === 0) {
        return (
            <div className="p-4 text-gray-500 text-center">
                No skill executions found
            </div>
        );
    }

    return (
        <div className="overflow-auto h-full">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800 sticky top-0">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Time
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Project
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Message
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                    {executions.map((execution) => (
                        <tr
                            key={execution.id}
                            onClick={() => onSelect(execution.id)}
                            className={`cursor-pointer hover:bg-gray-800 transition-colors ${selectedId === execution.id ? 'bg-gray-800 border-l-4 border-blue-500' : ''
                                }`}
                        >
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-300">
                                {new Date(execution.created_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-100 font-medium">
                                {execution.name}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-300">
                                {execution.target_project}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm">
                                <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${execution.status === 'OK'
                                            ? 'bg-green-900 text-green-200'
                                            : execution.status === 'APPLY_ERROR' || execution.status === 'TEST_ERROR'
                                                ? 'bg-yellow-900 text-yellow-200'
                                                : 'bg-red-900 text-red-200'
                                        }`}
                                >
                                    {execution.status}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-400 truncate max-w-md">
                                {execution.message}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
