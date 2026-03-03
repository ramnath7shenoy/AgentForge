"use client";

import React from "react";
import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import { useFlowStore } from "@/stores/flowStore";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import ExecutionLogPanel from "@/components/flow/ExecutionLogPanel";
import VariableInspectorPanel from "@/components/flow/VariableInspectorPanel";
import { useThemeStore } from "@/stores/themeStore";

const EditorPage: React.FC = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const setNodes = useFlowStore((state) => state.setNodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);
  const { theme, toggleTheme } = useThemeStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className={theme === "dark" ? "dark flex flex-col md:flex-row h-screen" : "flex flex-col md:flex-row h-screen"}>
      <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-gray-200 p-4">
        <NodeSidebar />
      </div>

      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
            AgentForge Editor
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1 rounded-full border border-gray-300 dark:border-slate-600 px-3 py-1 text-xs text-gray-700 dark:text-slate-100 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <span>🌙</span>
            <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
          </button>
        </div>

        <div className="flex-1">
          <FlowCanvas setSelectedNodeId={setSelectedNodeId} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 bg-white dark:bg-slate-900">
          <ExecutionLogPanel />
          <VariableInspectorPanel />
        </div>
      </div>

      <NodeSettingsSidebar />
    </div>
  );
};

export default EditorPage;
