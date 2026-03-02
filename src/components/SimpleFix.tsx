
import React, { useState, useEffect } from "react";

interface SimpleFix {
  selectedRunId: string | null;
  selectedIssueIds: Set<string>;
  deselectAll: () => void;
}

interface ActiveJob {
  job_id: string;
  started_at: number;
  issue_count: number;
}

const SimpleFix: React.FC<SimpleFix> = ({ selectedRunId, selectedIssueIds, deselectAll }) => {
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Load active job from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('active_fix_job');
    if (stored) {
      try {
        const job = JSON.parse(stored) as ActiveJob;
        // Clear if older than 10 minutes
        if (Date.now() - job.started_at < 10 * 60 * 1000) {
          setActiveJob(job);
          setIsGenerating(true);
        } else {
          localStorage.removeItem('active_fix_job');
        }
      } catch (e) {
        localStorage.removeItem('active_fix_job');
      }
    }
  }, []);
  
  // Poll for completion
  useEffect(() => {
    if (!activeJob) return;
    
    const checkCompletion = async () => {
      try {
        // Check if new proposals appeared
        const res = await fetch('/api/sandbox/proposals');
        const data = await res.json();
        
        // Look for recent proposals (within last 2 minutes of job start)
        const recentProposals = data.proposals?.filter((p: any) => {
          const proposalTime = new Date(p.created_at ||  0).getTime();
          return proposalTime >= activeJob.started_at - 30000; // 30s buffer
        }) || [];
        
        if (recentProposals.length > 0) {
          // Job completed!
          setIsGenerating(false);
          setActiveJob(null);
          localStorage.removeItem('active_fix_job');
          
          // Show completion notification
          alert(`✅ Fix generation complete!\n\nProposal created: ${recentProposals[0].proposal_id || 'unknown'}\nCheck the Proposals tab to review and apply.`);
        }
      } catch (e) {
        console.error('Failed to check completion:', e);
      }
    };
    
    const interval = setInterval(checkCompletion, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [activeJob]);
  
  const generateFixes = async () => {
    if (!selectedRunId || selectedIssueIds.size === 0) {
      alert("Please select issues to fix");
      return;
    }

    setIsGenerating(true);
    
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
      
      // Store active job in localStorage for persistence across tab switches
      const job: ActiveJob = {
        job_id: data.job_id,
        started_at: Date.now(),
        issue_count: selectedIssueIds.size,
      };
      localStorage.setItem('active_fix_job', JSON.stringify(job));
      setActiveJob(job);
      
      // Clear selections
      deselectAll();
      
      alert(`🔧 Fix generation started!\n\nJob ID: ${data.job_id.slice(0,8)}\nIssues: ${selectedIssueIds.size}\n\nProgress will be tracked automatically.\nYou can switch tabs - we'll notify you when complete.`);
      
    } catch (e) {
      console.error("Fix generation failed:", e);
      alert(`Failed to start fix generation: ${e}`);
      setIsGenerating(false);
      setActiveJob(null);
      localStorage.removeItem('active_fix_job');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generateFixes}
        disabled={selectedIssueIds.size === 0 || isGenerating}
        className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
      >
        {isGenerating ? '🔧 Generating...' : `Generate Fixes (${selectedIssueIds.size})`}
      </button>
      {isGenerating && activeJob && (
        <span className="text-xs text-yellow-400 animate-pulse">
          Job {activeJob.job_id.slice(0, 8)} in progress... {Math.floor((Date.now() - activeJob.started_at) / 1000)}s
        </span>
      )}
    </div>
  );
};

export default SimpleFix;
