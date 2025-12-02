"use client";

import React, { useState } from "react";

const TerminalPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [height, setHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight >= 100 && newHeight <= 600) {
          setHeight(newHeight);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div 
      className="bg-[#1e1e1e] border-t border-gray-700 flex flex-col"
      style={{ height: isCollapsed ? '32px' : `${height}px` }}
    >
      {/* Resize handle */}
      {!isCollapsed && (
        <div
          className="h-1 cursor-ns-resize hover:bg-blue-500 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCollapse}
            className="text-gray-400 hover:text-gray-200 text-xs"
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
          <span className="text-xs text-gray-300 font-medium">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded hover:bg-[#2a2d2e]"
            title="New Terminal"
          >
            +
          </button>
        </div>
      </div>

      {/* Terminal content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-3 font-mono text-xs text-gray-300">
          <div className="text-green-400">$ atlas --version</div>
          <div className="text-gray-400 mt-1">ATLAS Core v0.1.0</div>
          <div className="text-gray-400">Autonomous Technical Logic & Analysis System</div>
          <div className="flex items-center mt-3">
            <span className="text-green-400">$ </span>
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-gray-300 ml-1"
              placeholder="Type command..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // TODO: Handle command execution
                  console.log('Command:', e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalPanel;
