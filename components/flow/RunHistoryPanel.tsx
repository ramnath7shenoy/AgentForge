"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, Clock, DollarSign, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFlowRuns } from "@/app/actions/flow";

interface FlowRun {
  id: string;
  input: string | null;
  output: unknown;
  status: string;
  costUsd: number;
  durationMs: number | null;
  source: string;
  createdAt: Date;
}

interface RunHistoryPanelProps {
  flowId: string;
}

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTs(date: Date) {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function outputPreview(output: unknown): string {
  if (!output) return "—";
  if (typeof output === "string") return output.slice(0, 120);
  const o = output as any;
  if (o.payload != null) {
    const p = o.payload;
    if (typeof p === "string") return p.slice(0, 120);
    return JSON.stringify(p).slice(0, 120);
  }
  return JSON.stringify(output).slice(0, 120);
}

export default function RunHistoryPanel({ flowId }: RunHistoryPanelProps) {
  const [runs, setRuns] = useState<FlowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const res = await getFlowRuns(flowId, 20);
    if (res.success) setRuns(res.runs as FlowRun[]);
    setLoading(false);
  }, [flowId]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Run History</span>
        <button
          onClick={fetchRuns}
          className="text-slate-500 hover:text-indigo-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && runs.length === 0 && (
          <div className="px-4 py-8 text-center text-[10px] text-slate-500 italic">Loading...</div>
        )}
        {!loading && runs.length === 0 && (
          <div className="px-4 py-8 text-center text-[10px] text-slate-500 italic">
            No runs yet. Execute this flow to see history.
          </div>
        )}
        {runs.map((run) => {
          const isOpen = expanded === run.id;
          const preview = outputPreview(run.output);
          return (
            <div
              key={run.id}
              className="border-b border-border last:border-0"
            >
              <button
                className="w-full flex items-start gap-2 px-4 py-2.5 hover:bg-slate-800/40 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : run.id)}
              >
                {run.status === "success" ? (
                  <CheckCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={12} className="text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-slate-300 truncate">
                      {run.input?.slice(0, 40) || "(no input)"}
                    </span>
                    <span className="text-[9px] text-slate-500 flex-shrink-0">{formatTs(run.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                      <Clock size={8} /> {formatDuration(run.durationMs)}
                    </span>
                    {run.costUsd > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                        <DollarSign size={8} /> {run.costUsd.toFixed(4)}
                      </span>
                    )}
                    <span className={cn(
                      "text-[8px] font-bold uppercase px-1 py-0.5 rounded",
                      run.source === "sandbox" ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"
                    )}>
                      {run.source}
                    </span>
                    {isOpen ? (
                      <ChevronUp size={10} className="ml-auto text-slate-500" />
                    ) : (
                      <ChevronDown size={10} className="ml-auto text-slate-500" />
                    )}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                  {run.input && (
                    <div>
                      <p className="text-[9px] font-bold uppercase text-slate-600 mb-1">Input</p>
                      <pre className="text-[10px] text-slate-400 bg-slate-900/50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                        {run.input}
                      </pre>
                    </div>
                  )}
                  <div>
                    <p className="text-[9px] font-bold uppercase text-slate-600 mb-1">Output</p>
                    <pre className="text-[10px] text-slate-400 bg-slate-900/50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-words font-mono max-h-32">
                      {preview || "—"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
