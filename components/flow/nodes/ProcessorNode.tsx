"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Terminal, GitBranch, Layers, Clock, Variable } from "lucide-react";
import { NodeCard } from "./NodeCard";

const MODE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  iterate:   { label: "Iterate / Loop", icon: <Layers size={12} /> },
  template:  { label: "Template",       icon: <Terminal size={12} /> },
  switch:    { label: "Switch/Case",    icon: <GitBranch size={12} /> },
  transform: { label: "Transform",      icon: <Layers size={12} /> },
  delay:     { label: "Delay",          icon: <Clock size={12} /> },
  set:       { label: "Set Variables",  icon: <Variable size={12} /> },
};

export default function ProcessorNode({ id, data, selected }: NodeProps) {
  const mode = data.processorMode || "template";
  const info = MODE_LABELS[mode] ?? MODE_LABELS.template;

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-slate-400 uppercase tracking-tighter mb-1">
        <Terminal size={14} fill="currentColor" />
        <span>Logic Processor</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] opacity-70 font-medium">
        <span className="text-slate-400">{info.icon}</span>
        <span>{info.label}</span>
        {mode === "delay" && data.delayMs != null && (
          <span className="text-slate-500">· {data.delayMs}ms</span>
        )}
        {mode === "switch" && Array.isArray(data.switchCases) && (
          <span className="text-slate-500">· {data.switchCases.length} case{data.switchCases.length !== 1 ? "s" : ""}</span>
        )}
        {mode === "transform" && data.transformOp && (
          <span className="text-slate-500">· {data.transformOp}</span>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
