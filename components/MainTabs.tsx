"use client";

import React from "react";

export type MainTabId = "code" | "meta" | "logs" | "tasks" | "security" | "skills" | "simulation" | "sandbox";

interface MainTabsProps {
  activeTab: MainTabId;
  onTabChange: (tab: MainTabId) => void;
}

const MainTabs: React.FC<MainTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: MainTabId; label: string; badge?: number }[] = [
    { id: "code", label: "Code" },
    { id: "meta", label: "Meta" },
    { id: "logs", label: "Logs" },
    { id: "tasks", label: "Tasks" },
    { id: "security", label: "Security" },
    { id: "skills", label: "Skills" },
    { id: "simulation", label: "Simulation" },
    { id: "sandbox", label: "Sandbox" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent, tabId: MainTabId) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    let newIndex = currentIndex;

    if (e.key === "ArrowLeft") {
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      e.preventDefault();
    } else if (e.key === "Home") {
      newIndex = 0;
      e.preventDefault();
    } else if (e.key === "End") {
      newIndex = tabs.length - 1;
      e.preventDefault();
    }

    if (newIndex !== currentIndex) {
      onTabChange(tabs[newIndex].id);
    }
  };

  return (
    <div
      className="flex border-b border-[var(--atlas-border-subtle)] bg-[var(--atlas-bg-elevated)] text-xs"
      role="tablist"
      aria-label="Main navigation tabs"
    >
      {tabs.map((t) => {
        const isActive = t.id === activeTab;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${t.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`
              relative px-4 py-2.5 font-medium transition-all
              border-b-2 outline-none
              ${
                isActive
                  ? "border-[var(--atlas-accent-primary)] text-[var(--atlas-text-primary)] bg-[var(--atlas-bg-body)]"
                  : "border-transparent text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-bg-hover)]"
              }
              focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--atlas-bg-elevated)]
            `}
            onClick={() => onTabChange(t.id)}
            onKeyDown={(e) => handleKeyDown(e, t.id)}
          >
            <span className="flex items-center gap-2">
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="atlas-badge-primary">
                  {t.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default MainTabs;
