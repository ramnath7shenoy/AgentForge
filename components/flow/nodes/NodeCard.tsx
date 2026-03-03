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
        "min-w-40 rounded-xl border bg-white shadow-sm px-3 py-2 text-xs flex flex-col gap-1 transition-all",
        "hover:shadow-md",
        isActive
          ? "border-indigo-500 ring-2 ring-indigo-200"
          : "border-gray-200",
      )}
    >
      {children}
    </div>
  );
};

