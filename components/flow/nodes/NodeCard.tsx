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
        "min-w-40 rounded-xl border bg-card shadow-sm px-3 py-2 text-xs flex flex-col gap-1 transition-all",
        "hover:shadow-md hover:-translate-y-0.5",
        isActive
          ? "border-primary ring-2 ring-primary/40"
          : "border-border",
      )}
    >
      {children}
    </div>
  );
};

