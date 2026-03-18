"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

export const NodeCard: React.FC<{ nodeId: string; children: React.ReactNode; className?: string }> = ({ 
  nodeId, 
  children,
  className 
}) => {
  const highlightedNodeId = useFlowStore((state) => state.highlightedNodeId);
  const theme = useFlowStore((state) => state.theme);
  const isActive = highlightedNodeId === nodeId;

  return (
    <div className="bg-transparent !border-0">
      <div
        className={cn(
          "relative min-w-[180px] rounded-xl border px-5 py-4 shadow-2xl transition-all duration-300",
          // Theme-aware colors to ensure visibility in both modes
          theme === "dark" 
            ? "bg-[#0b0e14] border-slate-800 text-white" 
            : "bg-white border-slate-200 text-slate-900",
          isActive && "border-indigo-500 ring-4 ring-indigo-500/20 scale-105 z-50",
          className
        )}
      >
        {/* Centering Wrapper: Mathematically centers children so handles sit on the exact edge midpoint */}
        <div className="flex flex-col items-center text-center w-full">
          {children}
        </div>
      </div>
    </div>
  );
};