"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Cpu, AlertTriangle } from "lucide-react";
import { NodeCard } from "./NodeCard";

const PROVIDER_LABELS: Record<string, string> = {
  huggingface: "HuggingFace",
  replicate: "Replicate",
};

export default function MLModelNode({ id, data, selected }: NodeProps) {
  const provider = data.mlProvider || "";
  const model = data.mlModel || "";
  const isConfigured = !!provider && !!model;

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-sky-400 uppercase tracking-tighter mb-1">
        <Cpu size={14} fill="currentColor" />
        <span>ML Model</span>
      </div>

      {isConfigured ? (
        <div className="flex flex-col min-w-0 mt-0.5">
          <p className="text-[10px] font-bold text-foreground truncate">{PROVIDER_LABELS[provider] || provider}</p>
          <p className="text-[9px] text-muted-foreground truncate">{model}</p>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-1.5 px-1.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20">
          <AlertTriangle size={9} className="text-sky-400 shrink-0" />
          <span className="text-[8px] font-semibold text-sky-400 leading-tight">
            Select provider and model
          </span>
        </div>
      )}

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
