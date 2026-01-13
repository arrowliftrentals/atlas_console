"use client";

import React, { useState, useEffect } from "react";
import SessionSelector from "./SessionSelector";
import ConsoleFileExplorer from "./ConsoleFileExplorer";
import { useConsole } from "./ConsoleProvider";

const SIDEBAR_WIDTH_KEY = "atlas_console_sidebar_width";
const SIDEBAR_COLLAPSED_KEY = "atlas_console_sidebar_collapsed";
const DEFAULT_SIDEBAR_WIDTH = 256;
const COLLAPSED_SIDEBAR_WIDTH = 48;

const Sidebar: React.FC = () => {
  const { setSelectedFile, selectedFile } = useConsole();
  const [width, setWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load initial width and collapsed state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Load collapse state
    const collapsedStored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    const collapsed = collapsedStored === "true";
    setIsCollapsed(collapsed);
    
    // Load width
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed > 150 && parsed < 600) {
        setWidth(parsed);
        const actualWidth = collapsed ? COLLAPSED_SIDEBAR_WIDTH : parsed;
        document.documentElement.style.setProperty("--sidebar-width", `${actualWidth}px`);
      }
    } else {
      const actualWidth = collapsed ? COLLAPSED_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH;
      document.documentElement.style.setProperty("--sidebar-width", `${actualWidth}px`);
    }
  }, []);

  // Keep CSS variable in sync when width or collapsed state changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const actualWidth = isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : width;
    document.documentElement.style.setProperty("--sidebar-width", `${actualWidth}px`);
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width, isCollapsed]);
  
  // Save collapsed state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);
  
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return (
    <>
      {/* Sidebar Content */}
      <div className="flex flex-col h-full w-full text-sm text-gray-200">
        {!isCollapsed ? (
          <>
            {/* Header with collapse button */}
            <div className="px-3 py-2 bg-[#252526] border-b border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-300 font-medium">Explorer</span>
              <button
                onClick={toggleCollapse}
                className="text-gray-400 hover:text-gray-200 text-xs"
                title="Collapse sidebar"
              >
                ◀
              </button>
            </div>
            
            <SessionSelector />

            <div className="px-3 py-2 border-b border-gray-700 font-semibold">
              Workspace Files
            </div>
            <div className="flex-1 overflow-auto">
              <ConsoleFileExplorer 
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile || undefined}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2 bg-[#252526] border-b border-gray-700 flex items-center justify-center">
              <button
                onClick={toggleCollapse}
                className="text-gray-400 hover:text-gray-200 text-xs"
                title="Expand sidebar"
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 h-full cursor-col-resize hover:bg-yellow-300 transition-colors duration-200 delay-[400ms] ${
          isResizing ? "bg-yellow-300" : "bg-transparent"
        }`}
        style={{ flexShrink: 0 }}
      />
    </>
  );
};

export default Sidebar;
