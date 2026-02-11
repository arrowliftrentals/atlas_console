"use client";

import React from "react";
import { useHealth } from "@/contexts/HealthContext";

const StatusBar: React.FC = () => {
  const { health } = useHealth();
  
  const getStatusText = () => {
    if (health.backend === 'connected') {
      return <span className="text-green-300">Online</span>;
    } else if (health.backend === 'disconnected') {
      return <span className="text-gray-300">Offline</span>;
    } else {
      return <span className="text-red-300">Error</span>;
    }
  };
  
  return (
    <div className="h-6 bg-[#007acc] text-xs text-white flex items-center px-3 justify-between">
      <div className="flex items-center gap-4">
        <span>ATLAS Web Console</span>
        <span>Server: {getStatusText()}</span>
      </div>
    </div>
  );
};

export default StatusBar;
