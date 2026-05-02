"use client";

import React, { useEffect, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { PlugZap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { cn } from "@/lib/utils";
import { getApp, getAction } from "@/lib/providers";

export default function AppActionNode({ id, data, selected }: NodeProps) {
  const app = data.appProvider ? getApp(data.appProvider) : undefined;
  const action = app && data.appAction ? getAction(app.id, data.appAction) : undefined;
  const isConfigured = !!app && !!action;

  // Connection status checked once on mount via the integrations server action.
  // We do this at the node level so the canvas reflects live connectivity.
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!data.appProvider) { setConnected(null); return; }
    import("@/app/actions/integration").then(({ getIntegrations }) =>
      getIntegrations().then((res) => {
        const found = (res.integrations ?? []).some((i) => i.provider === data.appProvider);
        setConnected(found);
      })
    );
  }, [data.appProvider]);

  return (
    <NodeCard nodeId={id} selected={selected}>
      {/* Header row */}
      <div className="flex items-center gap-2 font-bold text-violet-400 uppercase tracking-tighter mb-1">
        <PlugZap size={14} fill="currentColor" />
        <span>App Action</span>
        {/* Live connectivity dot */}
        {isConfigured && connected !== null && (
          <span
            className={cn(
              "ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0",
              connected ? "bg-emerald-400 shadow-[0_0_4px_#34d399]" : "bg-rose-400"
            )}
            title={connected ? "Integration connected" : "Integration not connected — go to Settings → Integrations"}
          />
        )}
      </div>

      {isConfigured ? (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-sm leading-none select-none">{app.icon}</span>
          <div className="flex flex-col min-w-0">
            <p className="text-[10px] font-bold text-foreground truncate">{app.name}</p>
            <p className="text-[9px] text-muted-foreground truncate">{action.label}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-1.5 px-1.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/20">
          <AlertTriangle size={9} className="text-violet-400 shrink-0" />
          <span className="text-[8px] font-semibold text-violet-400 leading-tight">
            Select an app and action
          </span>
        </div>
      )}

      {/* Not-connected warning shown beneath the action label */}
      {isConfigured && connected === false && (
        <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/15">
          <AlertTriangle size={8} className="text-rose-400 shrink-0" />
          <span className="text-[8px] text-rose-400 font-medium">Not connected</span>
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
