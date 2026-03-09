"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ShieldCheck } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";

export default function GatekeeperNode({ id, data }: NodeProps) {
  const highlightedNodeId = useFlowStore((s) => s.highlightedNodeId);
  const executedNodeIds = useFlowStore((s) => s.executedNodeIds);
  const isActive = highlightedNodeId === id;
  const isExecuted = executedNodeIds.includes(id) && !isActive;

  const statusClass = isActive 
    ? "!border-rose-500 !ring-4 !ring-rose-500/30" 
    : isExecuted 
      ? "!border-emerald-500 !ring-2 !ring-emerald-500/20" 
      : "";

  return (
    <NodeCard nodeId={id} className={statusClass}>
      <div className="flex items-center gap-2 font-bold text-emerald-500 uppercase tracking-tighter mb-1">
        <ShieldCheck size={14} fill="currentColor" />
        <span>Safety Gatekeeper</span>
      </div>
      <p className="text-[10px] opacity-70 font-medium">
        {isActive ? "Waiting for Approval..." : isExecuted ? "Approved" : (data.verification || "Critic AI")}
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