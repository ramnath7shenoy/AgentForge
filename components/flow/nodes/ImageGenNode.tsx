"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { ImageIcon, AlertTriangle } from "lucide-react";
import { NodeCard } from "./NodeCard";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI DALL-E",
  replicate: "Replicate",
};

export default function ImageGenNode({ id, data, selected }: NodeProps) {
  const provider = data.imageProvider || "";
  const model = data.imageModel || "";
  const isConfigured = !!provider && !!model;

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-fuchsia-400 uppercase tracking-tighter mb-1">
        <ImageIcon size={14} />
        <span>Image Gen</span>
      </div>

      {isConfigured ? (
        <div className="flex flex-col min-w-0 mt-0.5">
          <p className="text-[10px] font-bold text-foreground truncate">{PROVIDER_LABELS[provider] || provider}</p>
          <p className="text-[9px] text-muted-foreground truncate">{model} · {data.imageSize || "1024×1024"}</p>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-1.5 px-1.5 py-1 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20">
          <AlertTriangle size={9} className="text-fuchsia-400 shrink-0" />
          <span className="text-[8px] font-semibold text-fuchsia-400 leading-tight">
            Select provider and model
          </span>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !top-[-6px]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
