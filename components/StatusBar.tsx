"use client";

import React from "react";

const StatusBar: React.FC = () => {
  return (
    <div className="h-6 bg-[#007acc] text-xs text-white flex items-center px-3 justify-between">
      <div>ATLAS Web Console</div>
      <div className="flex gap-4">
        <span>Project: atlas_core</span>
        <span>Mode: Normal</span>
        <span>ATLAS API: Connected (live)</span>
      </div>
    </div>
  );
};

export default StatusBar;
