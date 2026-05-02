"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Zap, AlertTriangle, ShieldCheck } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { cn } from "@/lib/utils";

const METHOD_COLORS: Record<string, string> = {
  GET:    "text-sky-400 bg-sky-500/10 border-sky-500/30",
  POST:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  PUT:    "text-amber-400 bg-amber-500/10 border-amber-500/30",
  PATCH:  "text-orange-400 bg-orange-500/10 border-orange-500/30",
  DELETE: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

export default function ActionNode({ id, data, selected }: NodeProps) {
  const missingUrl = !data.url?.trim();
  const method = (data.method || 'POST').toUpperCase();
  const methodColor = METHOD_COLORS[method] ?? METHOD_COLORS.POST;
  const hasAuth = data.authType && data.authType !== 'none' && (data.authValue || data.persistence);

  return (
    <NodeCard nodeId={id} selected={selected}>
      <div className="flex items-center gap-2 font-bold text-emerald-500 uppercase tracking-tighter mb-1">
        <Zap size={14} fill="currentColor" />
        <span>Integration</span>
        {hasAuth && (
          <ShieldCheck size={10} className="text-emerald-400/60 ml-auto" />
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded border font-mono tracking-wider", methodColor)}>
          {method}
        </span>
        <p className="text-[10px] opacity-70 font-medium truncate">
          {data.connectionType || "Select a destination..."}
        </p>
      </div>

      {data.url && (
        <p className="text-[9px] text-slate-600 font-mono truncate mt-0.5" title={data.url}>
          {data.url.replace(/^https?:\/\//, '')}
        </p>
      )}

      {data.connectionType && missingUrl && (
        <div className="flex items-center gap-1 mt-1.5 px-1.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20">
          <AlertTriangle size={9} className="text-rose-400 shrink-0" />
          <span className="text-[8px] font-semibold text-rose-400 leading-tight">
            No endpoint URL configured
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
