"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Mic, Volume2, AlertTriangle } from "lucide-react";
import { NodeCard } from "./NodeCard";

export default function SpeechNode({ id, data, selected }: NodeProps) {
  const mode = data.speechMode || "tts";
  const provider = data.speechProvider || "";
  const isConfigured = !!provider;
  const isTTS = mode === "tts";

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-rose-400 uppercase tracking-tighter mb-1">
        {isTTS ? <Volume2 size={14} /> : <Mic size={14} />}
        <span>{isTTS ? "Text-to-Speech" : "Speech-to-Text"}</span>
      </div>

      {isConfigured ? (
        <div className="flex flex-col min-w-0 mt-0.5">
          <p className="text-[10px] font-bold text-foreground truncate">{provider.toUpperCase()}</p>
          <p className="text-[9px] text-muted-foreground truncate">
            {isTTS ? `Voice: ${data.speechVoice || "alloy"}` : `Model: ${data.speechModel || "whisper-1"}`}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-1.5 px-1.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20">
          <AlertTriangle size={9} className="text-rose-400 shrink-0" />
          <span className="text-[8px] font-semibold text-rose-400 leading-tight">
            Select mode and provider
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
