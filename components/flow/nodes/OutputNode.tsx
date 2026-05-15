"use client";

import React, { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { MessageSquare } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";
import { ImageLightbox } from "@/components/flow/ImageLightbox";

export default function OutputNode({ id, data, selected }: NodeProps) {
  const nodeStatuses = useFlowStore((s) => s.nodeStatuses);
  const nodeOutputs  = useFlowStore((s) => s.nodeOutputs);
  const isRunning = useFlowStore((s) => s.isRunning);

  const outputPayload = nodeOutputs[id]?.payload;
  const isImageOutput = typeof outputPayload === "string" && outputPayload.startsWith("data:image/");
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const errorEntries = React.useMemo(() => {
    if (isRunning) return [] as { nodeId: string; label: string; error: string }[];
    return Object.entries(nodeStatuses)
      .filter(([nodeId, status]) => status === "error" && nodeId !== id)
      .map(([nodeId]) => {
        const match = allNodes.find((n) => n.id === nodeId);
        const error = nodeOutputs[nodeId]?.error || "Unknown error";
        return { nodeId, label: (match?.data as any)?.label || nodeId, error };
      });
  }, [nodeStatuses, nodeOutputs, isRunning, allNodes, id]);

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
        <span>Output</span>
      </div>
      {isImageOutput ? (
        <>
          <img
            src={outputPayload as string}
            alt="Agent Result"
            onClick={() => setLightboxOpen(true)}
            className="w-full rounded-lg border border-white/10 shadow-2xl mt-1 cursor-zoom-in"
          />
          <ImageLightbox
            src={outputPayload as string}
            alt="Agent Result"
            open={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        </>
      ) : (
        <p className="text-[10px] opacity-70 font-medium line-clamp-2">
          {data.resultFormat ? (typeof data.resultFormat === 'string' ? data.resultFormat : 'Complex Result') : "Format your result..."}
        </p>
      )}

      {errorEntries.length > 0 && !isRunning && (
        <div className="mt-2 w-full rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1.5 text-left">
          <p className="text-[9px] font-semibold text-red-400 uppercase tracking-wide mb-1">
            Nodes Failed
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {errorEntries.slice(0, SHOW_MAX).map(({ nodeId, label, error }) => (
              <li key={nodeId} className="text-[8.5px] text-red-300/80 leading-tight">
                <span className="font-medium">{label}:</span>{" "}
                <span className="text-red-300/60 truncate">{error.slice(0, 60)}{error.length > 60 ? "…" : ""}</span>
              </li>
            ))}
            {errorEntries.length > SHOW_MAX && (
              <li className="text-[8.5px] text-red-300/50 leading-tight">
                +{errorEntries.length - SHOW_MAX} more failed
              </li>
            )}
          </ul>
        </div>
      )}

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