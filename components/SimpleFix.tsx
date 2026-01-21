"use client";

import React from "react";

interface SimpleFix {
  selectedRunId: string | null;
  selectedIssueIds: Set<string>;
  deselectAll: () => void;
}

const SimpleFix: React.FC<SimpleFix> = ({ selectedRunId, selectedIssueIds, deselectAll }) => {
  
  const generateFixes = async () => {
    if (!selectedRunId || selectedIssueIds.size === 0) {
      alert("Please select issues to fix");
      return;
    }

    try {
      // Start fix generation
      const res = await fetch("/api/fix/generate", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRunId,
          issue_ids: Array.from(selectedIssueIds),
          create_proposal: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log(`Fix job started: ${data.job_id}`);
      
      // Open log file for monitoring
      window.open(`/private/tmp/warp-backend.log`, '_blank');
      
      // Clear selections
      deselectAll();
      
      alert(`Fix generation started! Job ID: ${data.job_id.slice(0,8)}\nMonitor progress in the opened log file.\nProposal will appear in Proposals tab when complete.`);
      
    } catch (e) {
      console.error("Fix generation failed:", e);
      alert(`Failed to start fix generation: ${e}`);
    }
  };

  return (
    <button
      onClick={generateFixes}
      disabled={selectedIssueIds.size === 0}
      className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
    >
      Generate Fixes ({selectedIssueIds.size})
    </button>
  );
};

export default SimpleFix;