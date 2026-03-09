"use client";

import React, { useState } from "react";
import { 
  Zap, 
  Brain, 
  Split, 
  Play, 
  MessageSquare, 
  Save, 
  Upload,
  Trash2,
  Search,
  Database,
  ShieldCheck,
  Terminal,
  Globe
} from "lucide-react";
import { useFlowStore } from "@/stores/flowStore";
import { useRouter } from "next/navigation";
import {
  downloadFlowJson,
  parseFlowJson,
  serializeFlow,
} from "@/lib/flowPersistence";
import { cn } from "@/lib/utils";

const categories = [
  {
    name: "Triggers & Inputs",
    nodes: [
      { type: "input", label: "Starting Point", icon: <Play size={14} className="text-blue-500" /> },
      { type: "trigger", label: "Smart Trigger", icon: <Zap size={14} className="text-amber-400" /> },
      { type: "webhook", label: "Webhook", icon: <Globe size={14} className="text-purple-400" /> },
    ]
  },
  {
    name: "Intelligence",
    nodes: [
      { type: "ai", label: "Agent Brain", icon: <Brain size={14} className="text-purple-500" /> },
      { type: "vault", label: "Knowledge Vault", icon: <Database size={14} className="text-cyan-400" /> },
    ]
  },
  {
    name: "Logic & Safety",
    nodes: [
      { type: "router", label: "Decision", icon: <Split size={14} className="text-orange-500" /> },
      { type: "gatekeeper", label: "Safety Gatekeeper", icon: <ShieldCheck size={14} className="text-emerald-500" /> },
      { type: "processor", label: "Logic Processor", icon: <Terminal size={14} className="text-slate-400" /> },
    ]
  },
  {
    name: "Actions & Output",
    nodes: [
      { type: "action", label: "Integration", icon: <Zap size={14} className="text-emerald-500" /> },
      { type: "output", label: "Final Result", icon: <MessageSquare size={14} className="text-pink-500" /> },
    ]
  }
];

const NodeSidebar: React.FC = () => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { nodes, edges, setNodes, setEdges, clearCanvas, tutorialStep } = useFlowStore();

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const filteredCategories = categories.map(cat => ({
    ...cat,
    nodes: cat.nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
  })).filter(cat => cat.nodes.length > 0);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0b0e14] p-4 transition-colors duration-300 border-r border-slate-200 dark:border-slate-800">
      {/* SEARCH SECTION: Now correctly filtering */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          type="text"
          placeholder="Find a node..."
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* CATEGORIZED NODES: 2-column grid */}
      <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-6">
        {filteredCategories.map((cat) => (
          <div key={cat.name} className="flex flex-col gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              {cat.name}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {cat.nodes.map((node) => {
                const isTutorialTarget = tutorialStep === 2 && node.type === "trigger";
                return (
                  <div
                    key={node.type}
                    id={node.type === "trigger" ? "node-trigger" : undefined}
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 cursor-grab bg-slate-50 dark:bg-slate-900/50 border rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group text-center",
                      isTutorialTarget 
                        ? "border-amber-500 bg-amber-500/10 ring-4 ring-amber-500/30 animate-pulse z-10" 
                        : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform">
                      {node.icon}
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter leading-none">
                      {node.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER ACTIONS RESTORED */}
      <div className={cn(
        "mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 transition-all",
        tutorialStep > 0 && tutorialStep < 6 && "opacity-30 pointer-events-none grayscale"
      )}>
        <button
          className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-500 hover:text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/5"
          type="button"
          onClick={() => {
            const flow = serializeFlow(nodes, edges);
            downloadFlowJson(flow);
          }}
        >
          <Save size={14} />
          Save Workflow
        </button>

        <label className="w-full block">
          <span className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all border border-slate-200 dark:border-slate-800">
            <Upload size={14} />
            Import Workflow
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
                console.error("Failed to load workflow", e);
              } finally {
                event.target.value = "";
              }
            }}
          />
        </label>

        <button
          className="w-full flex items-center justify-center gap-2 border border-rose-500/30 hover:bg-rose-500 text-rose-500 hover:text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-500/5 group"
          type="button"
          onClick={clearCanvas}
        >
          <Trash2 size={14} className="group-hover:animate-pulse" />
          Clear Canvas
        </button>
      </div>
    </div>
  );
};

export default NodeSidebar;