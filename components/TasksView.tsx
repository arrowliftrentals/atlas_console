"use client";

import React, { useState, useEffect } from "react";
import { fetchTasks } from "@/lib/atlasClient";
import type { TaskInfo } from "@/lib/types";
import TabHeader from "./TabHeader";
import { useHealth } from "@/contexts/HealthContext";

const TasksView: React.FC = () => {
  const { health } = useHealth();
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  const loadTasks = async () => {
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks =
    filter === "ALL"
      ? tasks
      : tasks.filter((task) => task.status === filter);

  const getStatusChip = (status: string) => {
    const chipClasses = {
      pending: "atlas-badge-default",
      running: "atlas-badge-info",
      success: "atlas-badge-success",
      failed: "atlas-badge-error",
    }[status] || "atlas-badge-default";

    return (
      <span className={`atlas-status-chip ${chipClasses}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const taskCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <TabHeader
        title="Tasks & Goals"
        subtitle={`${tasks.length} active tasks`}
        statusConnected={health.tasks === 'connected'}
        statusLabel={health.tasks === 'connected' ? 'Connected' : 'Disconnected'}
      >
        <button
          onClick={loadTasks}
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center gap-2 transition-colors"
          aria-label="Refresh tasks"
        >
          Refresh
        </button>
      </TabHeader>
      
      {/* Filters */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700">
        <div className="flex items-center gap-2">
          {["ALL", "pending", "running", "success", "failed"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                filter === status
                  ? "bg-[var(--atlas-accent-primary)] text-white"
                  : "bg-[var(--atlas-bg-subtle)] text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-bg-hover)]"
              }`}
            >
              {status === "ALL" ? "ALL" : status.toUpperCase()}
              {status !== "ALL" && taskCounts[status] ? (
                <span className="ml-1 opacity-70">({taskCounts[status]})</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <div className="text-center text-[var(--atlas-text-muted)] py-8">
            Loading tasks...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center text-[var(--atlas-text-muted)] py-8">
            No tasks to display
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-[var(--atlas-bg-subtle)] hover:bg-[var(--atlas-bg-hover)] rounded border border-[var(--atlas-border-subtle)] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusChip(task.status)}
                      <span className="text-xs font-mono text-[var(--atlas-text-muted)]">
                        #{task.id}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-[var(--atlas-text-primary)] truncate">
                      {task.name}
                    </h3>
                  </div>
                </div>

                {task.progress !== undefined && task.progress !== null && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-[var(--atlas-text-muted)] mb-1">
                      <span>Progress</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--atlas-bg-body)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--atlas-accent-primary)] transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--atlas-text-muted)]">
                  <span>Created: {task.createdAt}</span>
                  {task.updatedAt && <span>Updated: {task.updatedAt}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--atlas-border-subtle)] flex items-center justify-between text-xs text-[var(--atlas-text-muted)]">
        <span>
          {filteredTasks.length} of {tasks.length} tasks
        </span>
        <span>
          {taskCounts.running || 0} running · {taskCounts.pending || 0} pending
        </span>
      </div>
    </div>
  );
};

export default TasksView;
