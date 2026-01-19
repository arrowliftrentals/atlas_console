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
      className="border-t flex flex-col"
      style={{ 
        height: isCollapsed ? '32px' : `${height}px`,
        backgroundColor: 'var(--atlas-bg-primary)',
        borderColor: 'var(--atlas-border)'
      }}
    >
      {/* Resize handle */}
      {!isCollapsed && (
        <div
          className="h-1 cursor-ns-resize transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--atlas-accent-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ backgroundColor: 'var(--atlas-bg-elevated)', borderColor: 'var(--atlas-border)' }}>
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
            className="text-xs px-2 py-0.5 rounded"
            style={{ color: 'var(--atlas-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--atlas-text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--atlas-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--atlas-text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="New Terminal"
          >
            +
          </button>
        </div>
      </div>

      {/* Terminal content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-3 font-mono text-xs" style={{ color: 'var(--atlas-text-primary)' }}>
          <div style={{ color: 'var(--atlas-success)' }}>$ atlas --version</div>
          <div className="mt-1" style={{ color: 'var(--atlas-text-secondary)' }}>ATLAS Core v0.1.0</div>
          <div style={{ color: 'var(--atlas-text-secondary)' }}>Autonomous Technical Logic & Analysis System</div>
          <div className="flex items-center mt-3">
            <span style={{ color: 'var(--atlas-success)' }}>$ </span>
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none ml-1"
              style={{ color: 'var(--atlas-text-primary)' }}
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
