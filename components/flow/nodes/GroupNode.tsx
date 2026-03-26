"use client";

import React from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { useFlowStore, ExtendedFlowState } from "@/stores/flowStore";
import { Box, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GroupNode({ id, data, selected }: NodeProps) {
  const wrapSubagent = useFlowStore((s: ExtendedFlowState) => s.wrapSubagent);

  return (
    <div
      className={cn(
        "relative rounded-3xl border-2 border-dashed transition-all duration-300",
        selected
          ? "border-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          : "border-slate-700 bg-slate-900/40 shadow-xl",
        "flex flex-col h-full w-full"
      )}
    >
      {/* Header */}
      <div className="absolute -top-4 left-6 flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-white/20 rounded-full shadow-lg z-10">
        <Box size={14} className="text-white" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
          Editing: {data.label}
        </span>
      </div>

      {/* Wrap Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          wrapSubagent(id);
        }}
        className="absolute -top-4 -right-4 flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-900 rounded-full shadow-lg z-20 transition-all hover:scale-105 active:scale-95 group"
        title="Save changes and wrap agent"
      >
        <XCircle size={14} className="group-hover:rotate-90 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">
          Wrap Agent
        </span>
      </button>

      {/* Handles for flow integration */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-4 !h-4 !bg-white !border-4 !border-slate-900 !top-[-8px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-white !border-4 !border-slate-900 !bottom-[-8px]"
      />

      {/* Label/Status */}
      <div className="absolute bottom-4 right-6 pointer-events-none opacity-20">
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
          Unwrapped Mode (Local Changes Only)
        </span>
      </div>
    </div>
  );
}
