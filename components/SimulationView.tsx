"use client";

import React, { useState } from "react";
import { atlasChat } from "@/lib/atlasClient";
import type { AtlasChatRequest } from "@/lib/types";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

const SimulationView: React.FC = () => {
  const { health } = useHealth();
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
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <TabHeader
        title="Simulation"
        subtitle={loading ? "Running..." : "Scenario planning"}
        statusConnected={health.backend === 'connected'}
        statusLabel={health.backend === 'connected' ? 'Connected' : 'Disconnected'}
      />
      
      <div className="flex-1 overflow-auto px-4 py-3 text-sm text-gray-200">

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
    </div>
  );
};

export default SimulationView;
