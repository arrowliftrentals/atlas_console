"use client";

import React from "react";

const StatusBar: React.FC = () => {
  return (
    <div className="h-6 bg-[#007acc] text-xs text-white flex items-center px-3 justify-between">
      <div className="flex items-center gap-4">
        <span>ATLAS Web Console</span>
      </div>
    </div>
  );
};

export default StatusBar;
