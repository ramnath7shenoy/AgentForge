"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

function getOtherUser(other: any) {
  return (
    other?.info ||
    other?.presence?.collaborationUser || {
      name: "Guest",
      color: "#64748b",
    }
  );
}

export const NodeCard: React.FC<{ 
  nodeId: string; 
  children: React.ReactNode; 
  className?: string;
  selected?: boolean;
}> = ({ 
  nodeId, 
  children,
  className,
  selected
}) => {
  const highlightedNodeId = useFlowStore((state) => state.highlightedNodeId);
  const theme = useFlowStore((state) => state.theme);
  const others = useFlowStore((state) => state.liveblocks.others);
  const isActive = highlightedNodeId === nodeId;
  const hoveringUsers = others
    .filter((other: any) => other?.presence?.hoveredNodeId === nodeId)
    .map(getOtherUser);

  return (
    <div className="bg-transparent !border-0">
      <div
        className={cn(
          "relative min-w-[180px] rounded-xl border px-5 py-4 shadow-2xl transition-all duration-300",
          theme === "dark" 
            ? "bg-[#0b0e14] border-slate-800 text-white" 
            : "bg-white border-slate-200 text-slate-900",
          selected && "border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02] z-50 shadow-[0_0_20px_rgba(99,102,241,0.3)]",
          isActive && "border-emerald-500 ring-4 ring-emerald-500/20 scale-105 z-50",
          className
        )}
      >
        {hoveringUsers.length > 0 && (
          <div className="pointer-events-none absolute -top-7 right-2 z-[100] flex items-center gap-1">
            {hoveringUsers.slice(0, 3).map((user, index) => (
              <span
                key={`${user.name}-${index}`}
                className="rounded-full border border-white/20 px-2 py-1 text-[10px] font-bold text-white shadow-lg"
                style={{ backgroundColor: user.color }}
              >
                {user.name} hovering
              </span>
            ))}
          </div>
        )}

        {/* Centering Wrapper: Mathematically centers children so handles sit on the exact edge midpoint */}
        <div className="flex flex-col items-center text-center w-full">
          {children}
        </div>
      </div>
    </div>
  );
};
