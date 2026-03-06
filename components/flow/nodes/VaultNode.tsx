"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function VaultNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-cyan-400 uppercase tracking-tighter mb-1">
        <Database size={14} fill="currentColor" />
        <span>Knowledge Vault</span>
      </div>
      <p className="text-[10px] opacity-70 font-medium">
        {data.persistence || "Short-term"}
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