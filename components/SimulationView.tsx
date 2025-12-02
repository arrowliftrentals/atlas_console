"use client";

import React, { useState } from "react";
import { atlasChat } from "@/lib/atlasClient";
import type { AtlasChatRequest } from "@/lib/types";

const SimulationView: React.FC = () => {
  const [goal, setGoal] = useState("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    const trimmed = goal.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setOutput("");

    try {
      const payload: AtlasChatRequest = {
        query: "simulate scenario",
        assumptions: [],
        context: trimmed,
        override_unresolved_assumptions: true,
      };

      const resp = await atlasChat(payload);
      setOutput(resp.answer || "");
    } catch (e: any) {
      console.error("ATLAS SimulationView error:", e);
      setError("Failed to run simulation via ATLAS Core.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full p-4 text-sm text-gray-200 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">Simulation (v0)</h1>
        {loading && (
          <span className="text-xs text-gray-400">Running...</span>
        )}
      </div>

      <div className="flex flex-col gap-2 mb-3 text-xs">
        <label className="text-gray-300">
          Simulation goal:
          <textarea
            className="mt-1 w-full h-20 bg-[#1e1e1e] border border-gray-700 rounded px-2 py-1 text-xs"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the system or scenario you want to simulate..."
          />
        </label>
        <button
          className="self-start bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
          onClick={runSimulation}
          disabled={loading}
        >
          Run simulation
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-xs mb-2 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {!error && !output && !loading && (
        <p className="text-xs text-gray-400">
          Enter a simulation goal and click 'Run simulation' to see a plan or result.
        </p>
      )}

      {!error && (
        <div className="mt-2 flex-1 border border-gray-700 rounded bg-[#1e1e1e] text-xs overflow-auto p-3 whitespace-pre-wrap font-mono">
          {output}
        </div>
      )}
    </div>
  );
};

export default SimulationView;
