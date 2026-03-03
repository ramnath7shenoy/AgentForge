"use client";

import React from "react";
import { Database, Cpu, GitBranch, FileJson, MessageCircle } from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import {
  downloadFlowJson,
  parseFlowJson,
  serializeFlow,
} from "@/lib/flowPersistence";

const nodeTypes = [
  { type: "input", label: "Input Node", icon: <FileJson size={16} /> },
  { type: "fetch", label: "Fetch Node", icon: <Database size={16} /> },
  { type: "ai", label: "AI Node", icon: <Cpu size={16} /> },
  { type: "decision", label: "Decision Node", icon: <GitBranch size={16} /> },
  { type: "output", label: "Output Node", icon: <MessageCircle size={16} /> },
];

const NodeSidebar: React.FC = () => {
  const simulateFlow = useFlowStore((state) => state.simulateFlow);
  const running = useFlowStore((state) => state.running);
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);

  return (
    <div className="text-xs space-y-3">
      <div>
        <h2 className="text-sm font-semibold mb-2 text-gray-800">Nodes</h2>

        {nodeTypes.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/reactflow", node.type);
              event.dataTransfer.effectAllowed = "move";
            }}
            className="cursor-grab w-full mb-2 px-2 py-1 rounded-lg flex items-center gap-2 border border-gray-200 bg-gray-50 text-xs hover:bg-gray-100"
          >
            {node.icon}
            <span>{node.label}</span>
          </div>
        ))}
      </div> {/* ✅ Missing closing div fixed here */}

      <div className="mt-2 space-y-2">
        <button
          className="w-full border border-gray-300 text-xs py-1.5 rounded hover:bg-gray-50"
          type="button"
          onClick={() => {
            const flow = serializeFlow(nodes, edges);
            downloadFlowJson(flow);
          }}
        >
          Save Flow (JSON)
        </button>

        <label className="w-full text-xs flex flex-col gap-1 cursor-pointer">
          <span className="border border-gray-300 py-1.5 rounded text-center hover:bg-gray-50">
            Load Flow (JSON)
          </span>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              try {
                const flow = parseFlowJson(text);
                setNodes(flow.nodes);
                setEdges(flow.edges);
              } catch (e) {
                console.error("Failed to load flow JSON", e);
              } finally {
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>

      <div className="pt-2 border-t border-gray-200">
        <button
          disabled={running}
          className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          onClick={() => simulateFlow("1")}
        >
          {running ? "Running..." : "Run Flow"}
        </button>
      </div>
    </div>
  );
};

export default NodeSidebar;