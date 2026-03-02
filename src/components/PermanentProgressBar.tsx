
import { useEffect, useState } from "react";
import { getAtlasWsUrl } from '@/lib/api';

interface ProgressUpdate {
  type: string;
  session_id?: string;
  task_name?: string;
  current_step?: string;
  progress_percent?: number;
  metadata?: {
    heartbeat?: boolean;
    complete?: boolean;
    [key: string]: any;
  };
}

interface PermanentProgressBarProps {
  sessionId: string | null;
}

export default function PermanentProgressBar({ sessionId }: PermanentProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [taskName, setTaskName] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) {
      console.log("[PermanentProgressBar] No session ID, staying idle");
      setIsActive(false);
      setProgress(0);
      setCurrentStep("");
      setTaskName("");
      return;
    }

    // Connect to progress WebSocket
    const wsUrl = getAtlasWsUrl(`/v1/progress/stream/${sessionId}`);
    console.log("[PermanentProgressBar] Attempting to connect to:", wsUrl);
    let websocket: WebSocket;
    
    try {
      websocket = new WebSocket(wsUrl);
    } catch (error) {
      console.error("[PermanentProgressBar] Failed to create WebSocket:", error);
      return;
    }

    websocket.onopen = () => {
      console.log("[PermanentProgressBar] WebSocket connected for session:", sessionId);
    };

    websocket.onmessage = (event) => {
      try {
        const data: ProgressUpdate = JSON.parse(event.data);
        console.log("[PermanentProgressBar] Received:", data);

        if (data.type === "progress") {
          console.log("[PermanentProgressBar] Progress update:", data.progress_percent, data.current_step);
          setIsActive(true);
          setProgress(data.progress_percent || 0);
          setCurrentStep(data.current_step || "");
          setTaskName(data.task_name || "");

          if (data.metadata?.complete) {
            // Keep showing complete state briefly
            setTimeout(() => {
              setIsActive(false);
              setProgress(0);
              setCurrentStep("");
              setTaskName("");
            }, 3000);
          }
        }
      } catch (error) {
        console.error("[PermanentProgressBar] Parse error:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("[PermanentProgressBar] WebSocket error:", error);
    };

    websocket.onclose = (event) => {
      console.log("[PermanentProgressBar] WebSocket closed:", event.code, event.reason);
    };

    setWs(websocket);

    return () => {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [sessionId]);

  return (
    <div className="px-3 py-2 border-b border-[var(--atlas-border-subtle)] bg-[#1e1e1e]">
      <div className="flex items-center gap-3">
        {/* Activity indicator */}
        <div className={`w-2 h-2 rounded-full transition-colors ${
          isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'
        }`} />
        
        {/* Status text */}
        <div className="flex-1 min-w-0">
          {isActive ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--atlas-text-secondary)] truncate">
                {taskName || "Processing"}
              </span>
              {currentStep && (
                <>
                  <span className="text-xs text-[var(--atlas-text-muted)]">•</span>
                  <span className="text-xs text-[var(--atlas-text-muted)] truncate">
                    {currentStep}
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className="text-xs text-[var(--atlas-text-muted)]">
              Idle
            </span>
          )}
        </div>
        
        {/* Progress percentage */}
        <div className="text-xs text-[var(--atlas-text-secondary)] font-mono w-12 text-right">
          {isActive ? `${progress}%` : '—'}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-1.5 w-full bg-gray-800 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            isActive ? 'bg-blue-500' : 'bg-gray-700'
          }`}
          style={{ width: `${isActive ? progress : 0}%` }}
        />
      </div>
    </div>
  );
}
