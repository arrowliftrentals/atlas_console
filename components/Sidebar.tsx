"use client";

import React, { useState, useEffect } from "react";
import SessionSelector from "./SessionSelector";
import ConsoleFileExplorer from "./ConsoleFileExplorer";
import { useConsole } from "./ConsoleProvider";

const SIDEBAR_WIDTH_KEY = "atlas_console_sidebar_width";
const DEFAULT_SIDEBAR_WIDTH = 256;

const Sidebar: React.FC = () => {
  const { setSelectedFile, selectedFile } = useConsole();
  const [width, setWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // Load initial width from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed > 150 && parsed < 600) {
        setWidth(parsed);
        document.documentElement.style.setProperty("--sidebar-width", `${parsed}px`);
      }
    } else {
      document.documentElement.style.setProperty("--sidebar-width", `${DEFAULT_SIDEBAR_WIDTH}px`);
    }
  }, []);

  // Keep CSS variable in sync when width changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width]);

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
