"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { MessageSquare } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";

export default function OutputNode({ id, data, selected }: NodeProps) {
  const nodeStatuses = useFlowStore((s) => s.nodeStatuses);
  const isRunning = useFlowStore((s) => s.isRunning);
  const allNodes = useFlowStore((s) => s.nodes);

  const skippedEntries = React.useMemo(() => {
    if (isRunning) return [] as { nodeId: string; label: string }[];
    return Object.entries(nodeStatuses)
      .filter(([nodeId, status]) => status === "skipped" && nodeId !== id)
      .map(([nodeId]) => {
        const match = allNodes.find((n) => n.id === nodeId);
        return { nodeId, label: (match?.data as any)?.label || nodeId };
      });
  }, [nodeStatuses, isRunning, allNodes, id]);

  const hasPartialRun =
    !isRunning &&
    Object.keys(nodeStatuses).length > 0 &&
    skippedEntries.length > 0 &&
    nodeStatuses[id] === "success";

  const SHOW_MAX = 3;

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-pink-500 uppercase tracking-tighter mb-1">
        <MessageSquare size={14} fill="currentColor" />
        <span>Final Result</span>
      </div>
      <p className="text-[10px] opacity-70 font-medium line-clamp-2">
        {data.resultFormat ? (typeof data.resultFormat === 'string' ? data.resultFormat : 'Complex Result') : "Format your result..."}
      </p>

      {hasPartialRun && (
        <div className="mt-2 w-full rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-left">
          <p className="text-[9px] font-semibold text-amber-400 uppercase tracking-wide mb-1">
            Flow Complete (Partial Paths Run)
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {skippedEntries.slice(0, SHOW_MAX).map(({ nodeId, label }) => (
              <li key={nodeId} className="text-[8.5px] text-amber-300/70 leading-tight truncate">
                ⏭ {label}
              </li>
            ))}
            {skippedEntries.length > SHOW_MAX && (
              <li className="text-[8.5px] text-amber-300/50 leading-tight">
                +{skippedEntries.length - SHOW_MAX} more skipped
              </li>
            )}
          </ul>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]"
      />
    </NodeCard>
  );
}