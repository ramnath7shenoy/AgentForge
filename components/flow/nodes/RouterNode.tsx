"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Split } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function RouterNode({ id, data }: NodeProps) {
  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center gap-2 font-bold text-orange-500 uppercase tracking-tighter mb-1">
        <Split size={14} fill="currentColor" />
        <span>Decision</span>
      </div>
      
      <div className="flex flex-col gap-1">
        {(data.routes || ["Path A", "Path B"]).map((route: string) => (
          <div key={route} className="flex items-center justify-between text-[10px]">
            <span className="opacity-50 italic">{route}:</span>
            <span className="font-bold text-orange-400 line-clamp-1 max-w-[80px]">
              {data.conditions?.[route] || "No logic"}
            </span>
          </div>
        ))}
      </div>

      {/* TARGET HANDLE (Top) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]" 
      />

      {/* SOURCE HANDLES (Bottom) */}
      <div className="absolute bottom-0 left-0 w-full flex justify-around px-4 pointer-events-none">
        {(data.routes || ["Path A", "Path B"]).map((route: string, idx: number) => {
          // Spread handles evenly
          const count = (data.routes || ["Path A", "Path B"]).length;
          const leftPos = ((idx + 1) / (count + 1)) * 100;
          
          return (
            <Handle
              key={route}
              type="source"
              position={Position.Bottom}
              id={route.toLowerCase()}
              style={{ left: `${leftPos}%` }}
              className="!w-3 !h-3 !bg-orange-500 !border-2 !border-[#0b0e14] !opacity-100 pointer-events-auto !-translate-x-1/2 !bottom-[-6px]"
            />
          );
        })}
      </div>
    </NodeCard>
  );
}