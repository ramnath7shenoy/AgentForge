"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { BarChart2 } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function DataAnalysisNode({ id, data, selected }: NodeProps) {
  const instructions = data.daInstructions || "";

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-tighter mb-1">
        <BarChart2 size={14} />
        <span>Data Analysis</span>
      </div>

      <div className="flex flex-col min-w-0 mt-0.5">
        {instructions ? (
          <p className="text-[9px] text-muted-foreground truncate">{instructions}</p>
        ) : (
          <p className="text-[9px] text-slate-600 italic">e.g. "bar chart of sales by month"</p>
        )}
        <p className="text-[8px] text-amber-500/60 mt-0.5">E2B · Python · matplotlib</p>
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
