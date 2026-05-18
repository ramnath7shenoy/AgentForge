"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { RefreshCw } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function AgentLoopNode({ id, data, selected }: NodeProps) {
  const maxIter = data.maxIterations || 10;
  const hasSearch = data.enableWebSearch !== false;

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-emerald-400 uppercase tracking-tighter mb-1">
        <RefreshCw size={14} />
        <span>Agent Loop</span>
        <span className="ml-auto text-[9px] font-mono text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
          ×{maxIter}
        </span>
      </div>
      <p className="text-[10px] opacity-70 font-medium line-clamp-2 italic">
        {data.systemPrompt
          ? data.systemPrompt.slice(0, 60) + (data.systemPrompt.length > 60 ? "…" : "")
          : "ReAct reasoning loop — think, act, observe…"}
      </p>
      {hasSearch && (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20">
            web search
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
