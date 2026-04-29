"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ShieldAlert, Pause, FileText } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";

export default function ApprovalNode({ id, data, selected }: NodeProps) {
  const edges = useFlowStore((s) => s.edges);
  const nodeOutputs = useFlowStore((s) => s.nodeOutputs);
  const isRunning = useFlowStore((s) => s.isRunning);

  const parentEdge = edges.find((e) => e.target === id);
  const upstreamPacket = parentEdge ? nodeOutputs[parentEdge.source] : null;

  const previewText = upstreamPacket
    ? typeof upstreamPacket.payload === "string"
      ? upstreamPacket.payload
      : JSON.stringify(upstreamPacket.payload)
    : null;

  const truncated = previewText
    ? previewText.length > 180
      ? previewText.slice(0, 180) + "…"
      : previewText
    : null;

  return (
    <NodeCard nodeId={id} selected={selected} className="!border-2 !border-amber-500/40 ring-2 ring-amber-500/20 animate-[pulse_3s_ease-in-out_infinite]">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-tighter mb-1">
          <div className="relative">
            <ShieldAlert size={14} />
            <Pause size={8} className="absolute -bottom-0.5 -right-0.5 text-amber-300" />
          </div>
          <span>{data.label || "Approval Gate"}</span>
        </div>

        {data.gatekeeperMessage && (
          <p className="text-[8px] text-amber-300/60 font-medium max-w-[140px] truncate">
            &ldquo;{data.gatekeeperMessage}&rdquo;
          </p>
        )}

        {/* Upstream content preview — only shown while flow is running or paused */}
        {isRunning && (
          <div className="mt-1 w-full rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 max-w-[160px]">
            <div className="flex items-center gap-1 mb-0.5">
              <FileText size={8} className="text-amber-400/60 shrink-0" />
              <span className="text-[7px] font-semibold uppercase tracking-widest text-amber-400/50">
                Content to approve
              </span>
            </div>
            {truncated ? (
              <p className="text-[8px] text-amber-200/70 leading-relaxed break-words whitespace-pre-wrap line-clamp-4">
                {truncated}
              </p>
            ) : (
              <p className="text-[8px] text-amber-400/30 italic">
                Waiting for content…
              </p>
            )}
          </div>
        )}

        <p className="text-[9px] opacity-50 font-medium italic mt-0.5">
          {data.timeoutMinutes ? `Timeout: ${data.timeoutMinutes}m` : "Pauses for approval"}
        </p>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
