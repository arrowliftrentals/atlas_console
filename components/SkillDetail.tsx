import React, { useState } from 'react';
import { SkillExecutionDetail } from '@/lib/atlasSkillsClient';

interface SkillDetailProps {
    execution: SkillExecutionDetail | null;
}

export default function SkillDetail({ execution }: SkillDetailProps) {
    const [specExpanded, setSpecExpanded] = useState(false);
    const [resultExpanded, setResultExpanded] = useState(false);

    if (!execution) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Select a skill execution to view details
            </div>
        );
    }

    return (
        <div className="p-4 overflow-auto h-full bg-gray-900">
            <div className="space-y-4">
                {/* Header */}
                <div className="border-b border-gray-700 pb-3">
                    <h2 className="text-xl font-bold text-gray-100">{execution.name}</h2>
                    <p className="text-sm text-gray-400">Version {execution.version}</p>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">ID</span>
                        <p className="text-gray-100">{execution.id}</p>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Target Project</span>
                        <p className="text-gray-100">{execution.target_project}</p>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Status</span>
                        <p>
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
                        </p>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase">Created</span>
                        <p className="text-gray-100">
                            {new Date(execution.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Message */}
                <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase">Message</span>
                    <p className="text-gray-300 mt-1">{execution.message}</p>
                </div>

                {/* SkillSpec JSON */}
                <div className="border border-gray-700 rounded">
                    <button
                        onClick={() => setSpecExpanded(!specExpanded)}
                        className="w-full px-4 py-2 text-left bg-gray-800 hover:bg-gray-750 transition-colors flex items-center justify-between"
                    >
                        <span className="font-semibold text-gray-200">Skill Specification</span>
                        <span className="text-gray-400">{specExpanded ? '▼' : '▶'}</span>
                    </button>
                    {specExpanded && (
                        <pre className="p-4 bg-gray-950 text-gray-300 text-xs overflow-x-auto">
                            {JSON.stringify(execution.spec_json, null, 2)}
                        </pre>
                    )}
                </div>

                {/* Result JSON */}
                <div className="border border-gray-700 rounded">
                    <button
                        onClick={() => setResultExpanded(!resultExpanded)}
                        className="w-full px-4 py-2 text-left bg-gray-800 hover:bg-gray-750 transition-colors flex items-center justify-between"
                    >
                        <span className="font-semibold text-gray-200">Execution Result</span>
                        <span className="text-gray-400">{resultExpanded ? '▼' : '▶'}</span>
                    </button>
                    {resultExpanded && (
                        <pre className="p-4 bg-gray-950 text-gray-300 text-xs overflow-x-auto">
                            {JSON.stringify(execution.result_json, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
}
