"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Play } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function InputNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-blue-500 uppercase tracking-tighter mb-1">
        <Play size={14} fill="currentColor" />
        <span>Input</span>
      </div>
      <p className="text-[10px] opacity-50 font-mono italic">
        {data.inputText || "Waiting for data..."}
      </p>

      {/* FIXED: Mathematically centered handle */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: '-6px' }}
        className="w-3 h-3 !bg-slate-400 border-2 border-[#0b0e14] !opacity-100" 
      />
    </NodeCard>
  );
}