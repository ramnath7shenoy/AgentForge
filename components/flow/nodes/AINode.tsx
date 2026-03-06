"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Brain } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function AINode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-purple-500 uppercase tracking-tighter mb-1">
        <Brain size={14} fill="currentColor" />
        <span>Agent Brain</span>
      </div>
      <p className="text-[10px] opacity-70 font-medium line-clamp-2 italic">
        {data.instructions || "Ready for instructions..."}
      </p>

      {/* FIXED: Mathematically centered handles */}
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