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
import ArchitectureView from "@/components/ArchitectureView";
import ArchitectureViewV2 from "@/components/ArchitectureViewV2";
import dynamic from "next/dynamic";

const NeuralArchitecture3D = dynamic(() => import("@/components/Neural3D/NeuralArchitecture3DV2"), { ssr: false });

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTabId>("code");

  const renderTabContent = () => {
    if (activeTab === "code") {
      return <FileViewer />;
    }

    if (activeTab === "architecture") {
      return <ArchitectureViewV2 />;
    }

    if (activeTab === "meta") {
      return <MetaView />;
    }

    if (activeTab === "logs") {
      return <LogsView />;
    }

    if (activeTab === "tasks") {
      return <TasksView />;
    }

    if (activeTab === "security") {
      return <SecurityView />;
    }

    if (activeTab === "skills") {
      return <SkillsView />;
    }

    if (activeTab === "simulation") {
      return <SimulationView />;
    }

    if (activeTab === "sandbox") {
      return <SandboxView />;
    }

    return null;
  };

  return (
    <main className="h-full w-full flex flex-col">
      <MainTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 h-full relative" style={{ minHeight: 0 }}>
        {activeTab === "neural-viz" && <NeuralArchitecture3D key={`neural-viz-${activeTab}`} />}
        {activeTab !== "neural-viz" && renderTabContent()}
      </div>
    </main>
  );
}
