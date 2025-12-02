"use client";

import { useEffect, useState } from "react";

interface ProgressUpdate {
  type: string;
  session_id?: string;
  task_name?: string;
  current_step?: string;
  progress_percent?: number;
  estimated_total_steps?: number;
  current_step_number?: number;
  timestamp?: number;
  metadata?: {
    heartbeat?: boolean;
    complete?: boolean;
    total_duration_seconds?: number;
    [key: string]: any;
  };
}

interface ProgressIndicatorProps {
  sessionId: string;
  onComplete?: () => void;
}

export default function ProgressIndicator({ sessionId, onComplete }: ProgressIndicatorProps) {
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [taskName, setTaskName] = useState("");
  const [isHeartbeat, setIsHeartbeat] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to progress WebSocket
    const wsUrl = `ws://localhost:8000/v1/progress/stream/${sessionId}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("[ProgressIndicator] Connected to progress stream");
      setConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data: ProgressUpdate = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("[ProgressIndicator] Stream ready");
        } else if (data.type === "progress") {
          setProgress(data.progress_percent || 0);
          setCurrentStep(data.current_step || "");
          setTaskName(data.task_name || "");
          setIsHeartbeat(data.metadata?.heartbeat || false);

          if (data.metadata?.complete) {
            setIsComplete(true);
            setTimeout(() => {
              onComplete?.();
            }, 2000); // Show complete state for 2 seconds
          }
        }
      } catch (error) {
        console.error("[ProgressIndicator] Error parsing message:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("[ProgressIndicator] WebSocket error:", error);
    };

    websocket.onclose = () => {
      console.log("[ProgressIndicator] Connection closed");
      setConnected(false);
    };

    setWs(websocket);

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [sessionId, onComplete]);

  if (!connected && !isComplete) {
    return null; // Don't show anything until connected
  }

  if (isComplete) {
    return (
      <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 mb-4 animate-pulse">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-xl">✓</span>
          <div className="flex-1">
            <div className="text-green-400 font-medium">Task Complete</div>
            <div className="text-green-300/70 text-sm">{currentStep}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-400 text-xl">
          {isHeartbeat ? "💓" : "⚙️"}
        </span>
        <div className="flex-1">
          <div className="text-blue-300 font-medium text-sm">
            {taskName || "Processing..."}
          </div>
          <div className="text-blue-200/70 text-xs">{currentStep}</div>
        </div>
        <div className="text-blue-400 font-mono text-sm">{progress}%</div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-blue-950/50 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-500 h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
