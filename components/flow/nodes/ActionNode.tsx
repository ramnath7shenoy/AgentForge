"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap, AlertTriangle } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function ActionNode({ id, data, selected }: NodeProps) {
  const missingUrl = !data.url?.trim();

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-emerald-500 uppercase tracking-tighter mb-1">
        <Zap size={14} fill="currentColor" />
        <span>Integration</span>
      </div>
      <p className="text-[10px] opacity-70 font-medium">
        {data.connectionType || "Select a destination..."}
      </p>

      {/* Config warning — shown when no endpoint URL has been configured */}
      {data.connectionType && missingUrl && (
        <div className="flex items-center gap-1 mt-1.5 px-1.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20">
          <AlertTriangle size={9} className="text-rose-400 shrink-0" />
          <span className="text-[8px] font-semibold text-rose-400 leading-tight">
            No endpoint URL configured
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
