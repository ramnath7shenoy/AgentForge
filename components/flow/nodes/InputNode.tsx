"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Play } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

export default function InputNode({ id, data, selected }: NodeProps) {
  const { theme } = useFlowStore();

  const packet = data?.packet || {};
  const text: string = packet.payload || "";
  const attachments: any[] = packet.attachments || [];
  const fileContext: string = packet.fileContext || "";
  const packedFileCount = fileContext
    ? (fileContext.match(/^--- File:/gm) || []).length
    : 0;

  return (
    <NodeCard nodeId={id} selected={selected} className="min-w-[200px]">
      <div className="flex items-center gap-2 font-bold text-blue-500 uppercase tracking-tighter mb-2 select-none">
        <Play size={14} fill="currentColor" />
        <span>Starting Point</span>
      </div>

      {/* Text preview */}
      <div
        className={cn(
          "w-full min-h-[28px] px-2 py-1 text-[10px] rounded-lg border select-none",
          theme === "dark"
            ? "bg-slate-900/60 border-slate-800 text-slate-400"
            : "bg-white border-slate-200 text-slate-400"
        )}
      >
        {text ? (
          <span className={theme === "dark" ? "text-slate-200" : "text-slate-700"}>
            {text.slice(0, 70)}{text.length > 70 ? "…" : ""}
          </span>
        ) : (
          <span className="italic opacity-40">Configure in Settings →</span>
        )}
      </div>

      {/* Attachment summary chips */}
      {(attachments.length > 0 || packedFileCount > 0) && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {attachments.length > 0 && (
            <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
              {attachments.length} img{attachments.length !== 1 ? "s" : ""}
            </span>
          )}
          {packedFileCount > 0 && (
            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              {packedFileCount} file{packedFileCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
