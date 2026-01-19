"use client";

import React, { useEffect, useState } from "react";
import { fetchLogs } from "@/lib/atlasClient";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

interface SecurityEvent {
    timestamp: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    event: string;
    description: string;
}

const SecurityView: React.FC = () => {
    const { health } = useHealth();
    const [events, setEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parseLogEntry = (log: { id: string; timestamp: string; level: string; message: string }): SecurityEvent => {
        const lowerMsg = log.message.toLowerCase();
        const logLevel = log.level.toLowerCase();
        
        // Map log level to security severity
        let severity: SecurityEvent['severity'] = 'info';
        if (logLevel === 'error' || lowerMsg.includes('critical') || lowerMsg.includes('fatal') || lowerMsg.includes('breach')) {
            severity = 'critical';
        } else if (logLevel === 'error' || lowerMsg.includes('fail') || lowerMsg.includes('denied') || lowerMsg.includes('unauthorized')) {
            severity = 'high';
        } else if (logLevel === 'warn' || lowerMsg.includes('suspicious') || lowerMsg.includes('attempt')) {
            severity = 'medium';
        } else if (logLevel === 'debug') {
            severity = 'low';
        }
        
        // Categorize the event
        let category = 'System';
        let event = 'Event';
        
        if (lowerMsg.includes('protected core')) {
            category = 'Core Protection';
        } else if (lowerMsg.includes('auth') || lowerMsg.includes('login') || lowerMsg.includes('access')) {
            category = 'Authentication';
        } else if (lowerMsg.includes('file') || lowerMsg.includes('write') || lowerMsg.includes('modify')) {
            category = 'File System';
        } else if (lowerMsg.includes('network') || lowerMsg.includes('connection')) {
            category = 'Network';
        } else if (lowerMsg.includes('api') || lowerMsg.includes('request')) {
            category = 'API';
        }
        
        // Extract meaningful event name
        if (lowerMsg.includes('blocked')) event = 'Access Blocked';
        else if (lowerMsg.includes('allowed')) event = 'Access Granted';
        else if (lowerMsg.includes('denied')) event = 'Access Denied';
        else if (lowerMsg.includes('validated')) event = 'Validation Success';
        else if (lowerMsg.includes('failed')) event = 'Operation Failed';
        else if (lowerMsg.includes('started')) event = 'Service Started';
        else if (lowerMsg.includes('stopped')) event = 'Service Stopped';
        
        // Format timestamp for display
        const timestamp = new Date(log.timestamp).toLocaleString();
        
        return {
            timestamp,
            severity,
            category,
            event,
            description: log.message
        };
    };

    const fetchSecurityEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch logs from ATLAS and filter for security-related entries
            const logs = await fetchLogs();
            
            // Filter for security-relevant logs (Protected Core, auth, access, etc.)
            const securityLogs = logs.filter(log => {
                const msg = log.message.toLowerCase();
                return (
                    msg.includes('protected core') ||
                    msg.includes('security') ||
                    msg.includes('auth') ||
                    msg.includes('access') ||
                    msg.includes('denied') ||
                    msg.includes('unauthorized') ||
                    msg.includes('blocked') ||
                    msg.includes('breach') ||
                    msg.includes('violation')
                );
            });
            
            // Convert log entries to security events
            const events = securityLogs.map(log => parseLogEntry(log));
            setEvents(events);
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
        <div className="h-full flex flex-col bg-[#1E1E1E]">
            <TabHeader
                title="Security Monitor"
                subtitle={`${events.length} security events`}
                statusConnected={health.backend === 'connected'}
                statusLabel={health.backend === 'connected' ? 'Connected' : 'Disconnected'}
            >
                <button
                    className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
                    onClick={fetchSecurityEvents}
                    disabled={loading}
                >
                    {loading ? "Refreshing..." : "Refresh"}
                </button>
            </TabHeader>
            
            <div className="flex-1 overflow-auto px-4 py-3 text-sm text-gray-200">

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
        </div>
    );
};

export default SecurityView;
