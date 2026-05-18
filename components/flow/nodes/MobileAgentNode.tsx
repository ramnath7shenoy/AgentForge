"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Navigation, ShieldCheck } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function MobileAgentNode({ id, data, selected }: NodeProps) {
  const environments: Array<{ name: string; type: string; task: string }> = data.environments || [];

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-sky-400 uppercase tracking-tighter mb-1">
        <Navigation size={14} />
        <span>Mobile Agent</span>
        <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-sky-600 bg-sky-500/10 px-1.5 py-0.5 rounded">
          <ShieldCheck size={8} />
          {environments.length || 2} stage{(environments.length || 2) !== 1 ? "s" : ""}
        </span>
      </div>
      {environments.length > 0 ? (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {environments.slice(0, 3).map((env, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[8px] text-sky-600 font-mono w-3">{i + 1}.</span>
              <span className="text-[9px] text-muted-foreground truncate">{env.name}</span>
              <span className="text-[8px] text-sky-700 ml-auto shrink-0">isolated</span>
            </div>
          ))}
          {environments.length > 3 && (
            <span className="text-[8px] text-muted-foreground ml-3">+{environments.length - 3} more</span>
          )}
        </div>
      ) : (
        <p className="text-[10px] opacity-70 font-medium italic">
          Each stage runs in a fully isolated sandbox — only output passes forward
        </p>
      )}
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
