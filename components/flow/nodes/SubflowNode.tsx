"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Briefcase } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useRouter } from "next/navigation";

export default function SubflowNode({ id, data }: NodeProps) {
  const router = useRouter();

  return (
    <NodeCard nodeId={id} className="!border-2 !border-indigo-500/40 ring-2 ring-indigo-500/10 backdrop-blur-sm">
      <div
        onDoubleClick={() => {
          if (data.subflowId) {
            router.push(`/editor?subflow=${data.subflowId}`);
          }
        }}
        className="flex flex-col items-center gap-1 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 font-bold text-indigo-400 uppercase tracking-tighter mb-1">
          <Briefcase size={14} fill="currentColor" />
          <span>{data.subflowName || "Sub-Agent"}</span>
        </div>
        <p className="text-[9px] opacity-50 font-medium italic">
          Double-click to open
        </p>
      </div>

      {/* Centered handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
