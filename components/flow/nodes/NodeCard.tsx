"use client";

import React from "react";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

interface NodeCardProps {
  nodeId: string;
  children: React.ReactNode;
}

export const NodeCard: React.FC<NodeCardProps> = ({ nodeId, children }) => {
  const highlightedNodeId = useFlowStore((state) => state.highlightedNodeId);

  const isActive = highlightedNodeId === nodeId;

  return (
    <div
      className={cn(
        "relative min-w-[160px] rounded-xl border bg-card shadow-sm px-4 py-3 text-xs flex flex-col gap-1 transition-all",
        "hover:shadow-md",
        isActive
          ? "border-primary ring-2 ring-primary/40"
          : "border-border",
      )}
    >
      {children}
    </div>
  );
};