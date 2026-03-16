"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowStore } from "@/stores/flowStore";

const WebhookNode = ({ data, selected }: NodeProps) => {
  const theme = useFlowStore((state) => state.theme);

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-center w-32 h-32 rounded-3xl transition-all duration-500",
        "border-2 shadow-xl",
        theme === "dark" 
          ? "bg-[#0b0e14] border-purple-500/30 text-white" 
          : "bg-white border-purple-500/20 text-slate-900",
        selected && "border-purple-500 ring-4 ring-purple-500/20 scale-105"
      )}
    >
      <div className={cn(
        "p-4 rounded-2xl mb-2 transition-transform duration-500 group-hover:scale-110 shadow-lg",
        theme === "dark" ? "bg-purple-500/10" : "bg-purple-50"
      )}>
        <Globe size={32} className="text-purple-500" />
      </div>
      
      <span className="text-[10px] font-black uppercase tracking-widest text-purple-500/80">
        {data.label || "Webhook"}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-4 !h-4 !bg-purple-500 !border-4 !border-white dark:!border-[#0b0e14] !shadow-lg !left-1/2 !-translate-x-1/2"
      />
    </div>
  );
};

export default memo(WebhookNode);
