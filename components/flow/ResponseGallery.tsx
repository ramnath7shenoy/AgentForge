"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLogStore, LogType } from "@/stores/useLogStore";
import { useFlowStore } from "@/stores/flowStore";
import { useCostStore } from "@/stores/useCostStore";
import { Trash2, Terminal as TerminalIcon, Download, Sparkles, Copy, CheckCheck, Bot, Clock, Workflow, FlaskConical, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeExecutionStatus } from "@/types/flowStoreTypes";

const colorMap: Record<LogType, string> = {
  INFO: "text-slate-500 dark:text-slate-400",
  SUCCESS: "text-emerald-600 dark:text-emerald-400",
  ERROR: "text-rose-600 dark:text-rose-400",
  WARN: "text-amber-600 dark:text-amber-400",
};

const badgeMap: Record<LogType, string> = {
  INFO: "text-slate-400 dark:text-slate-500",
  SUCCESS: "text-emerald-500",
  ERROR: "text-rose-500",
  WARN: "text-amber-500",
};

export default function ResponseGallery() {
  const { logs, clearLogs } = useLogStore();
  const { currentContext, finalResult, running, nodes, activeProject, nodeStatuses, executedNodeIds, isDryRun, nodeOutputs } = useFlowStore();
  const { formatted: costFormatted } = useCostStore();
  const [activeTab, setActiveTab] = useState<"terminal" | "result">("terminal");
  const [stateSearch, setStateSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "terminal") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Auto-switch to terminal on run start
  useEffect(() => {
    if (running) setActiveTab("terminal");
  }, [running]);

  // Auto-switch to Final Result when flow completes
  useEffect(() => {
    if (!running && finalResult) setActiveTab("result");
  }, [running, finalResult]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const stateData = currentContext ? {
    variables: currentContext.variables || {},
    nodes: currentContext.nodes || {},
  } : null;

  const filterState = (obj: Record<string, unknown>) => {
    if (!stateSearch) return obj;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.toLowerCase().includes(stateSearch.toLowerCase())) {
        filtered[key] = value;
      }
    }
    return filtered;
  };

  const handleDownloadReport = () => {
    const lines: string[] = [];
    lines.push("=== AgentForge Execution Report ===");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total Log Entries: ${logs.length}`);
    lines.push("");
    lines.push("--- EXECUTION LOGS ---");
    logs.forEach(log => {
      lines.push(`[${formatTime(log.timestamp)}] [${log.type}] ${log.message}${log.elapsed ? ` (${log.elapsed}ms)` : ""}`);
    });
    lines.push("");
    lines.push("--- FINAL RESULT ---");
    if (finalResult) {
      lines.push(`Type: ${finalResult.type}`);
      lines.push(typeof finalResult.payload === "string" ? finalResult.payload : JSON.stringify(finalResult.payload, null, 2));
    } else {
      lines.push("No result.");
    }
    lines.push("");
    lines.push("--- STATE SNAPSHOT ---");
    if (stateData) lines.push(JSON.stringify(stateData, null, 2));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agentforge_report_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-100 dark:bg-zinc-950 rounded-2xl border border-zinc-300 dark:border-zinc-800 overflow-hidden shadow-2xl transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0b0e14]">
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 px-4 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-60" />
          </div>

          <TabButton active={activeTab === "terminal"} onClick={() => setActiveTab("terminal")} color={isDryRun ? "amber" : "indigo"}>
            {isDryRun
              ? <><AlertTriangle size={10} className="text-amber-400" /> Simulation Log</>
              : <><TerminalIcon size={10} /> Terminal</>
            }
          </TabButton>
          <TabButton active={activeTab === "result"} onClick={() => setActiveTab("result")} color="emerald">
            <Sparkles size={10} /> Final Result
            {finalResult && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </TabButton>
        </div>

        <div className="flex items-center gap-2 px-4">
          {costFormatted !== "$0.00" && (
            <span
              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400"
              title="Session token cost"
            >
              {costFormatted}
            </span>
          )}
          {activeTab === "terminal" && logs.length > 0 && (
            <>
              <span className="text-[9px] text-slate-600 font-mono">{logs.length}</span>
              <button
                onClick={clearLogs}
                className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 font-bold uppercase tracking-wider"
              >
                <Trash2 size={10} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Terminal Tab */}
      {activeTab === "terminal" && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-hide space-y-0.5 text-zinc-900 dark:text-zinc-100">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-700 text-[10px] italic">Awaiting execution...</div>
          ) : logs.map((log) => {
            const displayType = isDryRun && log.type === "SUCCESS" ? "SIM" : log.type;
            const badgeClass = isDryRun && log.type === "SUCCESS" ? "text-amber-500" : badgeMap[log.type];
            const textClass  = isDryRun && log.type === "SUCCESS" ? "text-amber-600 dark:text-amber-400" : colorMap[log.type];
            return (
            <div key={log.id} className="flex items-start gap-2 hover:bg-zinc-500/5 dark:hover:bg-slate-800/30 px-2 py-0.5 rounded transition-colors">
              <span className="text-zinc-500 dark:text-zinc-600 flex-shrink-0 select-none">{formatTime(log.timestamp)}</span>
              <span className={cn("font-bold flex-shrink-0 w-16 text-right select-none", badgeClass)}>[{displayType}]</span>
              <span className={cn("flex-1", textClass)}>
                {log.message}
                {log.elapsed !== undefined && <span className="text-zinc-500 dark:text-zinc-600 ml-2">({log.elapsed}ms)</span>}
              </span>
            </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}


      {/* Final Result Tab */}
      {activeTab === "result" && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {finalResult || Object.keys(nodeStatuses).length > 0 ? (
            <ExecutionManifest
              finalResult={finalResult}
              logs={logs}
              nodes={nodes}
              nodeStatuses={nodeStatuses}
              nodeOutputs={nodeOutputs}
              executedNodeIds={executedNodeIds}
              projectName={activeProject?.name}
              isDryRun={isDryRun}
              copied={copied}
              onCopy={() => {
                const hasErrors = logs.some(l => l.type === "ERROR");
                const execMs = logs.length >= 2
                  ? logs[logs.length - 1].timestamp - logs[0].timestamp
                  : 0;
                const execSecs = (execMs / 1000).toFixed(1);
                const projectLabel = activeProject?.name || "Untitled Flow";
                const raw = finalResult
                  ? (typeof finalResult.payload === "string"
                    ? finalResult.payload
                    : JSON.stringify(finalResult.payload, null, 2))
                  : "";

                const nodeLines = executedNodeIds
                  .map(id => {
                    const node = nodes.find(n => n.id === id);
                    const status = nodeStatuses[id] || "idle";
                    const icon = status === "success" ? "✓" : status === "error" ? "✗" : "⏭";
                    return `  ${icon} ${node?.data?.label || id} [${(node?.type || "node").toUpperCase()}]`;
                  })
                  .join("\n");

                const summary = [
                  `Execution Manifest — ${projectLabel}`,
                  `Status: ${hasErrors ? "Partial" : "Action Complete"}`,
                  `Time: ${execSecs}s`,
                  ``,
                  `Nodes:`,
                  nodeLines,
                  ``,
                  `─── Final Output ───`,
                  raw,
                ].join("\n");

                navigator.clipboard.writeText(summary).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              onDownload={handleDownloadReport}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
              <Sparkles size={24} className="opacity-20" />
              <span className="text-[10px] italic">Run a flow to see the execution manifest</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ExecutionManifest — per-node status list + final output
// ─────────────────────────────────────────────────────────────────────
function ExecutionManifest({
  finalResult,
  logs,
  nodes,
  nodeStatuses,
  nodeOutputs,
  executedNodeIds,
  projectName,
  isDryRun,
  copied,
  onCopy,
  onDownload,
}: {
  finalResult: { type: string; payload: any } | null;
  logs: { timestamp: number; type: string }[];
  nodes: { id: string; type?: string | null; data?: { label?: string } }[];
  nodeStatuses: Record<string, NodeExecutionStatus>;
  nodeOutputs: Record<string, { payload: any }>;
  executedNodeIds: string[];
  projectName: string | undefined;
  isDryRun: boolean;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const hasErrors = logs.some(l => l.type === "ERROR");
  const execMs = logs.length >= 2
    ? logs[logs.length - 1].timestamp - logs[0].timestamp
    : 0;
  const execSecs = (execMs / 1000).toFixed(1);
  const agentCount = nodes.filter(n => n.type === "ai").length;

  // Order: execution sequence first, then any remaining with a status
  const orderedIds = [
    ...executedNodeIds,
    ...nodes
      .filter(n => !executedNodeIds.includes(n.id) && nodeStatuses[n.id] && nodeStatuses[n.id] !== "idle")
      .map(n => n.id),
  ];
  const manifestNodes = orderedIds
    .map(id => nodes.find(n => n.id === id))
    .filter(Boolean) as typeof nodes;

  const rawOutput = finalResult
    ? (typeof finalResult.payload === "string"
      ? finalResult.payload
      : JSON.stringify(finalResult.payload, null, 2))
    : null;

  // Structured display: JSON objects render as labelled key-value rows;
  // plain text (including multi-line action results) renders verbatim.
  type PrettifiedOutput =
    | { type: "json"; entries: [string, unknown][] }
    | { type: "image"; src: string }
    | { type: "text"; value: string };
  const prettifiedOutput: PrettifiedOutput | null = React.useMemo(() => {
    if (!rawOutput) return null;
    const trimmed = rawOutput.trim();
    if (trimmed.startsWith("data:image/")) return { type: "image", src: trimmed };
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { type: "json", entries: Object.entries(parsed) };
        }
      } catch { /* fall through */ }
    }
    return { type: "text", value: rawOutput };
  }, [rawOutput]);

  return (
    <div className="space-y-3">
      {/* ── Dry-run banner ── */}
      {isDryRun && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 flex items-start gap-3">
          <FlaskConical size={15} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">Simulation Mode</p>
            <p className="text-[10px] text-amber-300/70 mt-0.5">
              No live API calls were made. Integration and App Action nodes returned mock payloads.
            </p>
          </div>
        </div>
      )}

      {/* ── Simulated payloads ── */}
      {isDryRun && (() => {
        const simNodes = nodes.filter(
          (n) =>
            (n.type === "action" || n.type === "appaction") &&
            nodeOutputs[n.id]?.payload?.status === "simulated"
        );
        if (simNodes.length === 0) return null;
        return (
          <div className="space-y-1.5">
            <p className="text-[8px] font-black uppercase tracking-widest text-amber-500/70 px-1">
              Simulated Payloads
            </p>
            {simNodes.map((node) => {
              const payload = nodeOutputs[node.id]?.payload;
              return (
                <div
                  key={node.id}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical size={10} className="text-amber-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-amber-300">
                      {node.data?.label || node.id}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider text-amber-500/60 ml-auto">
                      {node.type}
                    </span>
                  </div>
                  <pre className="text-[9px] font-mono text-amber-200/70 whitespace-pre-wrap overflow-auto max-h-32">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Header ── */}
      <div className="rounded-xl border border-zinc-300 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/60 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-0.5">
              Execution Manifest
            </p>
            <p className="text-[13px] font-semibold text-zinc-800 dark:text-slate-200 truncate">
              {projectName || "Untitled Flow"}
            </p>
          </div>
          <span className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold shrink-0 border",
            isDryRun
              ? "bg-amber-500/10 text-amber-500 border-amber-500/25"
              : hasErrors
              ? "bg-amber-500/10 text-amber-500 border-amber-500/25 dark:text-amber-400"
              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400"
          )}>
            {isDryRun ? "⬡ Simulated" : hasErrors ? "⚠ Partial" : "✓ Action Complete"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[9px] text-zinc-500 dark:text-slate-500">
          <span className="flex items-center gap-1"><Clock size={9} /> {execSecs}s</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Bot size={9} /> {agentCount} AI agent{agentCount !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Workflow size={9} /> {manifestNodes.length} nodes</span>
        </div>
      </div>

      {/* ── Per-node status list ── */}
      {manifestNodes.length > 0 && (
        <div className="space-y-1">
          {manifestNodes.map(node => (
            <NodeStatusRow
              key={node.id}
              label={node.data?.label || node.id}
              type={node.type || "node"}
              status={nodeStatuses[node.id] || "idle"}
            />
          ))}
        </div>
      )}

      {/* ── Final output ── */}
      {prettifiedOutput && (
        <div className="bg-zinc-900 dark:bg-[#0b0e14] rounded-xl border border-zinc-700 dark:border-slate-800 p-4 overflow-auto">
          <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-slate-600 mb-2">
            Final Output
          </p>
          {prettifiedOutput.type === "image" ? (
            <img src={prettifiedOutput.src} alt="Agent screenshot" className="rounded-lg shadow-xl max-w-full" />
          ) : prettifiedOutput.type === "json" ? (
            <div className="space-y-2">
              {prettifiedOutput.entries.map(([key, val]) => (
                <div key={key} className="border border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 block mb-1">
                    {key}
                  </span>
                  <span className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {typeof val === "string" ? val : JSON.stringify(val, null, 2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-[11px] font-mono text-zinc-100 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {prettifiedOutput.value}
            </pre>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all"
          style={copied
            ? { color: "#4ade80", borderColor: "rgba(74,222,128,.3)", background: "rgba(74,222,128,.08)" }
            : { color: "#818cf8", borderColor: "rgba(99,102,241,.25)", background: "transparent" }}
        >
          {copied ? <CheckCheck size={10} /> : <Copy size={10} />}
          {copied ? "Copied!" : "Copy Manifest"}
        </button>
        <button
          onClick={onDownload}
          className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg border border-white/8 hover:bg-white/5 font-bold uppercase tracking-wider"
        >
          <Download size={10} /> Export
        </button>
      </div>

      <div className="flex items-center gap-2 text-[9px] text-slate-600">
        <span>{logs.length} log entries</span>
        <span>·</span>
        <span className={hasErrors ? "text-rose-500" : ""}>
          {logs.filter(l => l.type === "ERROR").length} errors
        </span>
        <span>·</span>
        <span>{logs.filter(l => l.type === "SUCCESS").length} successes</span>
      </div>
    </div>
  );
}

const NODE_STATUS_CONFIG: Record<NodeExecutionStatus, { icon: string; rowClass: string; iconClass: string }> = {
  idle:    { icon: "○", rowClass: "border-transparent bg-transparent",                                       iconClass: "text-slate-600" },
  running: { icon: "⟳", rowClass: "border-blue-500/20 bg-blue-500/8 dark:bg-blue-500/5",                    iconClass: "text-blue-400 animate-spin" },
  success: { icon: "✓", rowClass: "border-emerald-500/20 bg-emerald-500/8 dark:bg-emerald-500/5",            iconClass: "text-emerald-400" },
  error:   { icon: "✗", rowClass: "border-rose-500/20 bg-rose-500/8 dark:bg-rose-500/5",                     iconClass: "text-rose-400" },
  skipped: { icon: "⏭", rowClass: "border-zinc-600/20 bg-zinc-500/5 dark:bg-zinc-800/40",                   iconClass: "text-slate-600" },
};

function NodeStatusRow({
  label,
  type,
  status,
}: {
  label: string;
  type: string;
  status: NodeExecutionStatus;
}) {
  const cfg = NODE_STATUS_CONFIG[status] || NODE_STATUS_CONFIG.idle;
  return (
    <div className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px] transition-colors", cfg.rowClass)}>
      <span className={cn("font-bold w-4 text-center flex-shrink-0 text-[12px]", cfg.iconClass)}>
        {cfg.icon}
      </span>
      <span className="flex-1 text-zinc-800 dark:text-slate-300 font-medium truncate">{label}</span>
      <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-600 shrink-0">
        {type}
      </span>
    </div>
  );
}

function TabButton({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  const activeClass: Record<string, string> = {
    indigo: "text-slate-300 border-indigo-500 bg-indigo-500/5",
    cyan: "text-slate-300 border-cyan-500 bg-cyan-500/5",
    emerald: "text-slate-300 border-emerald-500 bg-emerald-500/5",
    amber: "text-amber-300 border-amber-500 bg-amber-500/5",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-all border-b-2",
        active ? activeClass[color] : "text-slate-600 border-transparent hover:text-slate-400"
      )}
    >
      {children}
    </button>
  );
}
