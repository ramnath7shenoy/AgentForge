"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { GitFork } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function ParallelMapNode({ id, data, selected }: NodeProps) {
  const concurrency: number = data.concurrency || 3;
  const separator: string = data.separator || "newline";
  const prompt: string = data.itemPrompt || "";

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-fuchsia-400 uppercase tracking-tighter mb-1">
        <GitFork size={14} />
        <span>Parallel Map</span>
        <span className="ml-auto text-[9px] font-mono text-fuchsia-600 bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
          ×{concurrency}
        </span>
      </div>
      <p className="text-[9px] text-muted-foreground truncate">
        {prompt ? `"${prompt.slice(0, 40)}${prompt.length > 40 ? "…" : ""}"` : "Map a prompt over each item in a list"}
      </p>
      <p className="text-[8px] text-fuchsia-600/70 mt-1">
        Split by: {separator} · {concurrency} concurrent
      </p>
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
