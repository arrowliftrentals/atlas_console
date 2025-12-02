"use client";

import React, { useEffect, useState } from "react";
import { atlasChat } from "@/lib/atlasClient";
import type { AtlasChatRequest } from "@/lib/types";

const MetaView: React.FC = () => {
    const [report, setReport] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMeta = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload: AtlasChatRequest = {
                query: "meta assess",
                assumptions: [],
                context: null,
                override_unresolved_assumptions: true,
            };
            const resp = await atlasChat(payload);
            setReport(resp.answer || "");
        } catch (e: any) {
            console.error("ATLAS MetaView error:", e);
            setError("Failed to load meta-assessment from ATLAS Core.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeta();
    }, []);

    return (
        <div className="h-full w-full p-4 text-sm text-gray-200 flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-semibold">Meta View</h1>
                <button
                    className="bg-gray-700 hover:bg-gray-600 text-xs px-3 py-1 rounded"
                    onClick={fetchMeta}
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

            {!error && !loading && !report && (
                <p className="text-xs text-gray-400">No meta-assessment available yet.</p>
            )}

            {!error && report && (
                <div className="mt-2 flex-1 border border-gray-700 rounded bg-[#1e1e1e] text-xs overflow-auto p-3 whitespace-pre-wrap font-mono">
                    {report}
                </div>
            )}
        </div>
    );
};

export default MetaView;
