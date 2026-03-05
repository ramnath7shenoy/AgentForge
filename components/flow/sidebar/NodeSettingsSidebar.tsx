"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";
import { Split, Info, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NodeSettingsSidebar: React.FC = () => {
  const nodes = useFlowStore((state) => state.nodes);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const setNodes = useFlowStore((state) => state.setNodes);
  const theme = useFlowStore((state) => state.theme); // Global Theme Sync

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const updateNodeData = (id: string, newData: any) => {
    setNodes(
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  // EMPTY STATE: Theme-aware placeholder
  if (!selectedNode) {
    return (
      <div className={cn(
        "w-full h-full p-6 flex flex-col items-center justify-center text-center transition-colors duration-300 border-l",
        theme === "dark" ? "bg-[#0b0e14] border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-400"
      )}>
        <Settings size={24} className="mb-2 opacity-20" />
        <p className="italic text-sm">Select a node to edit settings</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full h-full p-6 overflow-y-auto border-l transition-colors duration-300",
      // FIXED: Dynamic Background and Border
      theme === "dark" 
        ? "bg-[#0b0e14] border-slate-800 text-white" 
        : "bg-white border-slate-200 text-slate-900"
    )}>
      {/* HEADER SECTION */}
      <div className={cn(
        "flex items-center justify-between mb-8 border-b pb-4 transition-colors",
        theme === "dark" ? "border-slate-800" : "border-slate-200"
      )}>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold">Settings</span>
          <h2 className="text-lg font-bold capitalize">{selectedNode.type}</h2>
        </div>
      </div>

      {/* BASIC NODE LABEL SETTING */}
      <div className="flex flex-col gap-2 mb-8">
        <label className="text-[10px] font-bold uppercase text-slate-500">Node Label</label>
        <input
          className={cn(
            "rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all border",
            // FIXED: Input Field Theme awareness
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-white focus:border-indigo-500"
              : "bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500"
          )}
          value={selectedNode.data.label || ""}
          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
        />
      </div>

      {/* ROUTER-SPECIFIC CONDITIONAL LOGIC */}
      {(selectedNode.type === "router" || selectedNode.type === "decision") && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 text-orange-500">
            <Split size={16} />
            <h3 className="text-sm font-bold uppercase tracking-tight">Route Logic</h3>
          </div>

          <div className={cn(
            "border rounded-lg p-3 flex gap-3 mb-2",
            theme === "dark" ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50 border-orange-200"
          )}>
            <Info size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <p className={cn(
              "text-[10px] leading-relaxed",
              theme === "dark" ? "text-slate-400" : "text-slate-600"
            )}>
              The agent evaluates conditions in order. It follows the <b>first</b> path that evaluates to true.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {(selectedNode.data.routes || []).map((route: string) => (
              <div key={route} className={cn(
                "flex flex-col gap-2 p-3 border rounded-xl transition-colors",
                theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <label className="text-[10px] font-black uppercase text-orange-500">{route} Condition</label>
                <textarea
                  rows={2}
                  placeholder="e.g. {{ai.result}} > 0.5"
                  className={cn(
                    "border rounded-md p-2 text-[11px] font-mono focus:ring-2 focus:ring-orange-500/20 outline-none resize-none transition-all",
                    theme === "dark"
                      ? "bg-[#05070a] border-slate-800 text-white focus:border-orange-500"
                      : "bg-white border-slate-200 text-slate-900 focus:border-orange-500"
                  )}
                  value={selectedNode.data.conditions?.[route] || ""}
                  onChange={(e) => {
                    const currentConditions = selectedNode.data.conditions || {};
                    updateNodeData(selectedNode.id, {
                      conditions: { ...currentConditions, [route]: e.target.value }
                    });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FALLBACK PANEL */}
      {!["router", "decision"].includes(selectedNode.type || "") && (
        <div className={cn(
          "p-4 border border-dashed rounded-lg text-center transition-colors",
          theme === "dark" ? "bg-slate-900/30 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <p className="text-[10px] text-slate-500 italic">Advanced settings coming soon.</p>
        </div>
      )}
    </div>
  );
};

export default NodeSettingsSidebar;