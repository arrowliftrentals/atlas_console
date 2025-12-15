"use client";

import { useState } from "react";
import MainTabs, { MainTabId } from "@/components/MainTabs";
import FileViewer from "@/components/FileViewer";
import LogsView from "@/components/LogsView";
import MetaView from "@/components/MetaView";
import TasksView from "@/components/TasksView";
import SecurityView from "@/components/SecurityView";
import SkillsView from "@/components/SkillsView";
import SimulationView from "@/components/SimulationView";
import SandboxView from "@/components/SandboxView";
import dynamic from "next/dynamic";

const NeuralArchitecture3D = dynamic(() => import("@/components/Neural3D/NeuralArchitecture3DV2"), { ssr: false });
const ArchitectureViewV2 = dynamic(() => import("@/components/ArchitectureViewV2"), { ssr: false });

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
        <div style={{ display: activeTab === "neural-viz" ? "block" : "none", height: "100%" }}>
          <NeuralArchitecture3D />
        </div>
        <div style={{ display: activeTab === "meta" ? "block" : "none", height: "100%" }}>
          <MetaView />
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
        <div style={{ display: activeTab === "simulation" ? "block" : "none", height: "100%" }}>
          <SimulationView />
        </div>
        <div style={{ display: activeTab === "sandbox" ? "block" : "none", height: "100%" }}>
          <SandboxView />
        </div>
      </div>
    </main>
  );
}
