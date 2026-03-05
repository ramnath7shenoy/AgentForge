"use client";

import React from "react";
import { 
  Database, 
  Cpu, 
  Split, 
  Play, 
  MessageSquare, 
  Save, 
  Upload,
  Trash2 
} from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import {
  downloadFlowJson,
  parseFlowJson,
  serializeFlow,
} from "@/lib/flowPersistence";
import { cn } from "@/lib/utils";

// Updated node definitions to match your new Action/Router architecture
const nodeTemplates = [
  { type: "input", label: "Input Node", icon: <Play size={14} className="text-blue-500" /> },
  { type: "action", label: "Action Node", icon: <Database size={14} className="text-emerald-500" /> },
  { type: "ai", label: "AI Node", icon: <Cpu size={14} className="text-indigo-500" /> },
  { type: "router", label: "Router", icon: <Split size={14} className="text-orange-500" /> },
  { type: "output", label: "Output Node", icon: <MessageSquare size={14} className="text-rose-500" /> },
];

const NodeSidebar: React.FC = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);
  const clearCanvas = useFlowStore((state) => state.clearCanvas); //
  const theme = useFlowStore((state) => state.theme);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0b0e14] p-4 transition-colors duration-300">
      {/* Node Templates Section */}
      <div className="flex-1">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
          Available Nodes
        </h2>

        <div className="space-y-2">
          {nodeTemplates.map((node) => (
            <div
              key={node.type}
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
              className="flex items-center gap-3 p-3 cursor-grab bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all shadow-sm group"
            >
              <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform">
                {node.icon}
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {node.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Persistence & Utility Section */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {/* FRESH START BUTTON */}
        <button
          className="w-full flex items-center justify-center gap-2 border border-rose-500/30 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-500/5 mb-4 group"
          type="button"
          onClick={clearCanvas}
        >
          <Trash2 size={14} className="group-hover:animate-pulse" />
          Clear Canvas
        </button>

        <button
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
          type="button"
          onClick={() => {
            const flow = serializeFlow(nodes, edges);
            downloadFlowJson(flow);
          }}
        >
          <Save size={14} />
          Save Flow (JSON)
        </button>

        <label className="w-full">
          <span className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-700">
            <Upload size={14} />
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

        <p className="text-[9px] text-center text-slate-400 dark:text-slate-500 mt-4 leading-relaxed uppercase tracking-tighter">
          Drag nodes onto the canvas<br />to build your flow
        </p>
      </div>
    </div>
  );
};

export default NodeSidebar;