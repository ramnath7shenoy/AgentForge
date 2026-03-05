"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Cpu } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function AINode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-indigo-500 uppercase tracking-tighter mb-1">
        <Cpu size={14} />
        <span>AI Node</span>
      </div>
      <p className="text-[10px] opacity-50 font-mono italic">
        {data.prompt || "Processing..."}
      </p>

      {/* Centered Top Handle */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 !bg-slate-400 border-2 border-[#0b0e14] !left-1/2 !-translate-x-1/2 !top-[-6px]" 
      />

      {/* Centered Bottom Handle */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 !bg-slate-400 border-2 border-[#0b0e14] !left-1/2 !-translate-x-1/2 !bottom-[-6px]" 
      />
    </NodeCard>
  );
}