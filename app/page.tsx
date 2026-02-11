"use client";

import { useState } from "react";
import MainTabs, { MainTabId } from "@/components/MainTabs";
import FileViewer from "@/components/FileViewer";
import LogsView from "@/components/LogsView";
import MetaView from "@/components/MetaView";
import TasksView from "@/components/TasksView";
import SecurityView from "@/components/SecurityView";
import SkillsView from "@/components/SkillsView";
import LearningView from "@/components/LearningView";
import SandboxView from "@/components/SandboxView";
import SystemsView from "@/components/SystemsView";
import DriftReviewView from "@/components/DriftReviewView";
import dynamic from "next/dynamic";

const ArchitectureViewV2 = dynamic(() => import("@/components/ArchitectureViewV2"), { ssr: false });
const NeuralOrganismView = dynamic(() => import("@/components/NeuralOrganismView"), { ssr: false });

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTabId>("code");

  return (
    <main className="h-full w-full flex flex-col">
      <MainTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 h-full relative" style={{ minHeight: 0 }}>
        {/* Keep all tabs mounted, just toggle visibility for instant switching */}
        <div style={{ display: activeTab === "code" ? "block" : "none", height: "100%" }}>
          <FileViewer />
        </div>
        <div style={{ display: activeTab === "architecture" ? "block" : "none", height: "100%" }}>
          <ArchitectureViewV2 />
        </div>
        <div style={{ display: activeTab === "neural-organism" ? "block" : "none", height: "100%" }}>
          <NeuralOrganismView />
        </div>
        <div style={{ display: activeTab === "meta" ? "block" : "none", height: "100%" }}>
          <MetaView onNavigateToTab={setActiveTab} />
        </div>
        <div style={{ display: activeTab === "logs" ? "block" : "none", height: "100%" }}>
          <LogsView />
        </div>
        <div style={{ display: activeTab === "tasks" ? "block" : "none", height: "100%" }}>
          <TasksView />
        </div>
        <div style={{ display: activeTab === "security" ? "block" : "none", height: "100%" }}>
          <SecurityView />
        </div>
        <div style={{ display: activeTab === "skills" ? "block" : "none", height: "100%" }}>
          <SkillsView />
        </div>
        <div style={{ display: activeTab === "learning" ? "block" : "none", height: "100%" }}>
          <LearningView />
        </div>
        <div style={{ display: activeTab === "sandbox" ? "block" : "none", height: "100%" }}>
          <SandboxView />
        </div>
        <div style={{ display: activeTab === "systems" ? "block" : "none", height: "100%" }}>
          <SystemsView />
        </div>
        <div style={{ display: activeTab === "drift-review" ? "block" : "none", height: "100%" }}>
          <DriftReviewView />
        </div>
      </div>
    </main>
  );
}
