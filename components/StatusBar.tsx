"use client";

import React from "react";
import { useHealth } from "@/contexts/HealthContext";
import ThemeSelector from "./ThemeSelector";

const StatusBar: React.FC = () => {
  const { health } = useHealth();
  
  const getStatusText = () => {
    if (health.chat === 'connected') {
      return <span className="text-green-400">Connected</span>;
    } else if (health.chat === 'disconnected') {
      return <span className="text-gray-300">Offline</span>;
    } else {
      return <span className="text-red-400">Error</span>;
    }
  };
  
  return (
    <div className="h-6 text-xs text-white flex items-center px-3 justify-between" style={{ backgroundColor: 'var(--atlas-status-bar)' }}>
      <div>ATLAS Web Console</div>
      <div className="flex items-center gap-4">
        <span>Chat API: {getStatusText()}</span>
        <ThemeSelector />
      </div>
    </div>
  );
};

export default StatusBar;
