"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { MessageSquare } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function OutputNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-rose-400 uppercase tracking-tighter mb-1">
        <MessageSquare size={14} />
        <span>Output</span>
      </div>
      <p className="text-[10px] opacity-50 font-mono italic">
        {data.template || "Rendering result..."}
      </p>

      {/* FIXED: Mathematically centered handle */}
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ left: '50%', transform: 'translateX(-50%)', top: '-6px' }}
        className="w-3 h-3 !bg-slate-400 border-2 border-[#0b0e14] !opacity-100" 
      />
    </NodeCard>
  );
}