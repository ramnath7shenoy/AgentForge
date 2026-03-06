"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Globe } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function WebhookNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-purple-400 uppercase tracking-tighter mb-1">
        <Globe size={14} fill="currentColor" />
        <span>Webhook</span>
      </div>
      <p className="text-[10px] opacity-70 font-medium italic">
        Listening for data...
      </p>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]" 
      />
    </NodeCard>
  );
}