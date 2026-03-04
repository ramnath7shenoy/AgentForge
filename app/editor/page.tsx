"use client";

import React from "react";
import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import { useFlowStore } from "@/stores/flowStore";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import ExecutionLogPanel from "@/components/flow/ExecutionLogPanel";
import VariableInspectorPanel from "@/components/flow/VariableInspectorPanel";
import { useThemeStore } from "@/stores/themeStore";
import FinalResultPanel from "@/components/flow/FinalResultPanel";

const EditorPage: React.FC = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const setNodes = useFlowStore((state) => state.setNodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);
  const simulateFlow = useFlowStore((state) => state.simulateFlow);
  const running = useFlowStore((state) => state.running);
  const showMinimap = useFlowStore((state) => state.showMinimap);
  const showExecutionLogPanel = useFlowStore(
    (state) => state.showExecutionLogPanel,
  );
  const showVariablesPanel = useFlowStore(
    (state) => state.showVariablesPanel,
  );
  const setShowMinimap = useFlowStore((state) => state.setShowMinimap);
  const setShowExecutionLogPanel = useFlowStore(
    (state) => state.setShowExecutionLogPanel,
  );
  const setShowVariablesPanel = useFlowStore(
    (state) => state.setShowVariablesPanel,
  );
  const { theme, toggleTheme } = useThemeStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div
      className={
        theme === "dark"
          ? "dark flex flex-col md:flex-row h-screen"
          : "flex flex-col md:flex-row h-screen"
      }
    >
      <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-gray-200 p-4">
        <NodeSidebar />
      </div>

      <div className="flex-1 flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
            AgentForge Editor
          </span>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-800 text-xs bg-card">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => {
                const rootNodeId = nodes[0]?.id;
                if (rootNodeId) {
                  simulateFlow(rootNodeId);
                }
              }}
              className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground disabled:opacity-60"
            >
              {running && (
                <span className="w-3 h-3 border-2 border-primary-foreground/70 border-t-transparent rounded-full animate-spin" />
              )}
              <span>{running ? "Running…" : "Run Flow"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMinimap(!showMinimap)}
              className="px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground bg-background hover:bg-secondary/40"
            >
              {showMinimap ? "Hide Minimap" : "Show Minimap"}
            </button>

            <button
              type="button"
              onClick={() =>
                setShowExecutionLogPanel(!showExecutionLogPanel)
              }
              className="px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground bg-background hover:bg-secondary/40"
            >
              {showExecutionLogPanel ? "Hide Log" : "Show Log"}
            </button>

            <button
              type="button"
              onClick={() => setShowVariablesPanel(!showVariablesPanel)}
              className="px-2 py-1 rounded-md border border-border text-[11px] text-muted-foreground bg-background hover:bg-secondary/40"
            >
              {showVariablesPanel ? "Hide Variables" : "Show Variables"}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground bg-background hover:bg-secondary/40"
          >
            <span>🌙</span>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>

        <div className="flex-1">
          <FlowCanvas setSelectedNodeId={setSelectedNodeId} />
        </div>
        <FinalResultPanel />
        {(showExecutionLogPanel || showVariablesPanel) && (
          <div className="grid grid-cols-1 md:grid-cols-2 bg-card">
            {showExecutionLogPanel ? <ExecutionLogPanel /> : <div />}
            {showVariablesPanel ? <VariableInspectorPanel /> : <div />}
          </div>
        )}
      </div>

      <NodeSettingsSidebar />
    </div>
  );
};

export default EditorPage;
