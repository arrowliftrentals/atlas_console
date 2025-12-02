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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTabId>("code");

  const renderTabContent = () => {
    if (activeTab === "code") {
      return <FileViewer />;
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
      <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
    </main>
  );
}
