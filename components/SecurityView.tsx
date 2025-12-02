"use client";

import React, { useEffect, useState } from "react";
import { atlasChat } from "@/lib/atlasClient";
import type { AtlasChatRequest } from "@/lib/types";

interface SecurityEvent {
    timestamp: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    event: string;
    description: string;
}

const SecurityView: React.FC = () => {
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parseLogLine = (line: string): SecurityEvent => {
        // Extract timestamp - look for various date/time patterns
        let timestamp = new Date().toLocaleString();
        const timePatterns = [
            /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,  // 2024-11-19 10:30:45
            /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/,  // 11/19/2024 10:30:45
            /\[([^\]]*\d{2}:\d{2}[^\]]*)\]/  // Anything with time in brackets
        ];
        
        for (const pattern of timePatterns) {
            const match = line.match(pattern);
            if (match) {
                timestamp = match[1];
                break;
            }
        }
        
        // Determine severity based on keywords
        let severity: SecurityEvent['severity'] = 'info';
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('critical') || lowerLine.includes('fatal') || lowerLine.includes('breach')) {
            severity = 'critical';
        } else if (lowerLine.includes('error') || lowerLine.includes('fail') || lowerLine.includes('denied') || lowerLine.includes('unauthorized')) {
            severity = 'high';
        } else if (lowerLine.includes('warn') || lowerLine.includes('suspicious') || lowerLine.includes('attempt')) {
            severity = 'medium';
        } else if (lowerLine.includes('debug') || lowerLine.includes('trace')) {
            severity = 'low';
        }
        
        // Categorize the event
        let category = 'System';
        let event = 'Event';
        
        if (lowerLine.includes('protected core')) {
            category = 'Core Protection';
        } else if (lowerLine.includes('auth') || lowerLine.includes('login') || lowerLine.includes('access')) {
            category = 'Authentication';
        } else if (lowerLine.includes('file') || lowerLine.includes('write') || lowerLine.includes('modify')) {
            category = 'File System';
        } else if (lowerLine.includes('network') || lowerLine.includes('connection')) {
            category = 'Network';
        } else if (lowerLine.includes('api') || lowerLine.includes('request')) {
            category = 'API';
        }
        
        // Extract meaningful event name
        if (lowerLine.includes('blocked')) event = 'Access Blocked';
        else if (lowerLine.includes('allowed')) event = 'Access Granted';
        else if (lowerLine.includes('denied')) event = 'Access Denied';
        else if (lowerLine.includes('validated')) event = 'Validation Success';
        else if (lowerLine.includes('failed')) event = 'Operation Failed';
        else if (lowerLine.includes('started')) event = 'Service Started';
        else if (lowerLine.includes('stopped')) event = 'Service Stopped';
        
        // Clean up description - remove timestamp and log level markers
        let description = line
            // Remove date/time patterns
            .replace(/\[\d{4}-\d{2}-\d{2}[^\]]*\]/g, '')
            .replace(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/g, '')
            .replace(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g, '')
            .replace(/\d{2}:\d{2}:\d{2}/g, '')
            // Remove log level markers
            .replace(/\[(INFO|WARN|ERROR|DEBUG|TRACE|CRITICAL)\]/gi, '')
            // Remove leading/trailing whitespace and dashes
            .replace(/^\s*-\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        return { timestamp, severity, category, event, description };
    };

    const fetchSecurityEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            // v0 placeholder: search logs for 'Protected Core' as a proxy for security events.
            const payload: AtlasChatRequest = {
                query: "search logs Protected Core 20",
                assumptions: [],
                context: null,
                override_unresolved_assumptions: true,
            };
            const resp = await atlasChat(payload);
            const rawLines = resp.answer.split("\n").filter((ln) => ln.trim() !== "");

            if (rawLines.length === 1 && rawLines[0].startsWith("[INFO]")) {
                setEvents([]);
            } else {
                setEvents(rawLines.map(parseLogLine));
            }
        } catch (e: any) {
            console.error("ATLAS SecurityView error:", e);
            setError("Failed to load security events from ATLAS Core.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecurityEvents();
    }, []);

    return (
        <div className="h-full w-full p-4 text-sm text-gray-200 flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-semibold">Security View (v0)</h1>
                <button
                    className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1 rounded"
                    onClick={fetchSecurityEvents}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            {error && (
                <div className="text-red-400 text-xs mb-2 whitespace-pre-wrap">
                    {error}
                </div>
            )}

            {!error && !loading && events.length === 0 && (
                <p className="text-xs text-gray-400">
                    No security-related events found yet.
                </p>
            )}

            {!error && events.length > 0 && (
                <div className="mt-2 flex-1 border border-gray-700 rounded bg-[#1e1e1e] overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-800 sticky top-0">
                            <tr className="border-b border-gray-700">
                                <th className="px-3 py-2 text-left font-semibold text-gray-300 w-12">#</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-300 w-36">Time</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-300 w-20">Severity</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-300 w-32">Category</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-300 w-32">Event</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-300">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event, idx) => {
                                const severityStyles = {
                                    critical: 'bg-red-600 text-white',
                                    high: 'bg-orange-600 text-white',
                                    medium: 'bg-yellow-600 text-black',
                                    low: 'bg-blue-600 text-white',
                                    info: 'bg-gray-600 text-white'
                                };
                                
                                const rowStyles = {
                                    critical: 'bg-red-900/10 hover:bg-red-900/20 border-l-2 border-l-red-600',
                                    high: 'bg-orange-900/10 hover:bg-orange-900/20 border-l-2 border-l-orange-600',
                                    medium: 'bg-yellow-900/10 hover:bg-yellow-900/20 border-l-2 border-l-yellow-600',
                                    low: 'hover:bg-gray-900/30',
                                    info: 'hover:bg-gray-900/30'
                                };
                                
                                return (
                                    <tr key={idx} className={`border-b border-gray-800 ${rowStyles[event.severity]}`}>
                                        <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                                        <td className="px-3 py-2 text-gray-400 font-mono text-[10px]">{event.timestamp}</td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${severityStyles[event.severity]}`}>
                                                {event.severity}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-purple-300 font-medium">{event.category}</td>
                                        <td className="px-3 py-2 text-blue-300 font-medium">{event.event}</td>
                                        <td className="px-3 py-2 text-gray-300">{event.description}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SecurityView;
