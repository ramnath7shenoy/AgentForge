"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ShieldAlert, Pause } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function ApprovalNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id} className="!border-2 !border-amber-500/40 ring-2 ring-amber-500/20 animate-[pulse_3s_ease-in-out_infinite]">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-tighter mb-1">
          <div className="relative">
            <ShieldAlert size={14} />
            <Pause size={8} className="absolute -bottom-0.5 -right-0.5 text-amber-300" />
          </div>
          <span>{data.label || "Approval Gate"}</span>
        </div>
        {data.gatekeeperMessage && (
          <p className="text-[8px] text-amber-300/60 font-medium max-w-[140px] truncate">
            &ldquo;{data.gatekeeperMessage}&rdquo;
          </p>
        )}
        <p className="text-[9px] opacity-50 font-medium italic">
          {data.timeoutMinutes ? `Timeout: ${data.timeoutMinutes}m` : "Pauses for approval"}
        </p>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
