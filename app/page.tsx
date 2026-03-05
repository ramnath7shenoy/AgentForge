"use client";

import { useEffect, useState } from "react";

import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import ExecutionLogPanel from "@/components/flow/ExecutionLogPanel";
import VariableInspectorPanel from "@/components/flow/VariableInspectorPanel";

import { useFlowStore } from "@/stores/flowStore";

export default function EditorPage() {
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useFlowStore((state) => state.setSelectedNodeId);

  const simulateFlow = useFlowStore((state) => state.simulateFlow);
  const finalResult = useFlowStore((state) => state.finalResult);

  const showMinimap = useFlowStore((state) => state.showMinimap);
  const setShowMinimap = useFlowStore((state) => state.setShowMinimap);

  const showExecutionLogPanel = useFlowStore(
    (state) => state.showExecutionLogPanel,
  );
  const setShowExecutionLogPanel = useFlowStore(
    (state) => state.setShowExecutionLogPanel,
  );

  const showVariablesPanel = useFlowStore(
    (state) => state.showVariablesPanel,
  );
  const setShowVariablesPanel = useFlowStore(
    (state) => state.setShowVariablesPanel,
  );

  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);

    const stored = localStorage.getItem("theme") as "light" | "dark" | null;

    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";

    setTheme(next);
    localStorage.setItem("theme", next);

    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted) return null;

  const selectedNode =
    Array.isArray(nodes) && selectedNodeId
      ? nodes.find((n) => n.id === selectedNodeId)
      : null;

  const startNodeId =
    Array.isArray(nodes) && nodes.length > 0 ? nodes[0].id : "";

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">

        <div className="font-semibold">
          AgentForge
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => simulateFlow(startNodeId)}
            className="px-3 py-1 rounded border border-border hover:bg-muted"
          >
            Run Flow
          </button>

          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className="px-3 py-1 rounded border border-border hover:bg-muted"
          >
            Minimap
          </button>

          <button
            onClick={() =>
              setShowExecutionLogPanel(!showExecutionLogPanel)
            }
            className="px-3 py-1 rounded border border-border hover:bg-muted"
          >
            Logs
          </button>

          <button
            onClick={() =>
              setShowVariablesPanel(!showVariablesPanel)
            }
            className="px-3 py-1 rounded border border-border hover:bg-muted"
          >
            Variables
          </button>

          {/* DARK MODE */}
          <button
            onClick={toggleTheme}
            className="px-3 py-1 rounded border border-border hover:bg-muted"
          >
            {theme === "dark" ? "Dark" : "Light"}
          </button>

        </div>
      </div>

      {/* MAIN EDITOR */}
      <div className="flex flex-1 overflow-hidden">

        {/* NODE SIDEBAR */}
        <div className="w-64 border-r border-border p-3">
          <NodeSidebar />
        </div>

        {/* CANVAS */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1">
            <FlowCanvas setSelectedNodeId={setSelectedNodeId} />
          </div>

          {/* FINAL RESULT */}
          {finalResult && (
            <div className="border-t border-border p-3 text-sm bg-muted">
              <div className="font-semibold mb-1">Final Result</div>
              <pre className="whitespace-pre-wrap">{finalResult}</pre>
            </div>
          )}
        </div>

        {/* NODE SETTINGS */}
        <div className="w-72 border-l border-border p-3 overflow-auto">
          {selectedNode ? (
            <NodeSettingsSidebar node={selectedNode} />
          ) : (
            <div className="text-xs text-muted-foreground">
              Select a node to edit settings
            </div>
          )}
        </div>
      </div>

      {showExecutionLogPanel && <ExecutionLogPanel />}
      {showVariablesPanel && <VariableInspectorPanel />}
    </div>
  );
}