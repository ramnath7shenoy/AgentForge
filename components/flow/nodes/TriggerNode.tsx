"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/stores/flowStore";

const TriggerNode = ({ id, data, selected }: NodeProps) => {
  const theme = useFlowStore((state) => state.theme);
  const tutorialStep = useFlowStore((state) => state.tutorialStep);
  
  const isTutorialTarget = tutorialStep === 2 && !selected;

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-center w-32 h-32 rounded-3xl transition-all duration-500",
        "border-2 shadow-xl",
        theme === "dark" 
          ? "bg-[#0b0e14] border-amber-500/30 text-white" 
          : "bg-white border-amber-500/20 text-slate-900",
        selected && "border-amber-500 ring-4 ring-amber-500/20 scale-105",
        isTutorialTarget && "animate-pulse border-amber-500 ring-8 ring-amber-500/10 scale-110"
      )}
    >
      <div className={cn(
        "p-4 rounded-2xl mb-2 transition-transform duration-500 group-hover:scale-110 shadow-lg",
        theme === "dark" ? "bg-amber-500/10" : "bg-amber-50"
      )}>
        <Zap size={32} className="text-amber-500 fill-current" />
      </div>
      
      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">
        {data.label || "Smart Trigger"}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-amber-500 !border-4 !border-white dark:!border-[#0b0e14] !shadow-lg !left-1/2 !-translate-x-1/2"
      />

      {isTutorialTarget && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap shadow-xl animate-bounce">
          SELECT ME TO CONFIGURE
        </div>
      )}
    </div>
  );
};

export default memo(TriggerNode);
