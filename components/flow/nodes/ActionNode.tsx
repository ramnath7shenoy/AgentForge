"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Globe } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function ActionNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-semibold text-emerald-400">
        <Globe size={14} />
        <span>Action</span>
      </div>
      <div className="mt-1 text-[10px] text-slate-400 italic">
        {data.label || "Configure Tool..."}
      </div>

      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 !bg-slate-400 border-2 border-slate-900 !top-[-6px] left-1/2 -translate-x-1/2" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 !bg-slate-400 border-2 border-slate-900 !bottom-[-6px] left-1/2 -translate-x-1/2" 
      />
    </NodeCard>
  );
}