"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Trash2,
  Terminal as TerminalIcon,
  Download,
  Sparkles,
  Copy,
  CheckCheck,
  Bot,
  Clock,
  Workflow,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SandboxLogEntry, SandboxExecutionState } from "@/hooks/useSandboxExecution";
import type { SandboxNodeStatus } from "@/lib/flow/serverExecutor";
import SyntheticContentCard, { parseSyntheticPayload } from "@/components/flow/SyntheticContentCard";
import type { SyntheticPayload } from "@/components/flow/SyntheticContentCard";

type LogType = "INFO" | "SUCCESS" | "ERROR" | "WARN";

const colorMap: Record<LogType, string> = {
  INFO:    "text-slate-500 dark:text-slate-400",
  SUCCESS: "text-emerald-600 dark:text-emerald-400",
  ERROR:   "text-rose-600 dark:text-rose-400",
  WARN:    "text-amber-600 dark:text-amber-400",
};

const badgeMap: Record<LogType, string> = {
  INFO:    "text-slate-400 dark:text-slate-500",
  SUCCESS: "text-emerald-500",
  ERROR:   "text-rose-500",
  WARN:    "text-amber-500",
};

interface SandboxGalleryNode {
  id: string;
  type?: string | null;
  data?: { label?: string };
}

interface SandboxGalleryProps extends SandboxExecutionState {
  nodes: SandboxGalleryNode[];
  onClearLogs?: () => void;
}

export default function SandboxGallery({
  logs,
  nodeStatuses,
  nodeOutputs,
  executedNodeIds,
  finalResult,
  running,
  runCostFormatted,
  streamingTokens,
  nodes,
  onClearLogs,
}: SandboxGalleryProps) {
  const [activeTab, setActiveTab] = useState<"terminal" | "result">("terminal");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === "terminal") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  useEffect(() => {
    if (running) setActiveTab("terminal");
  }, [running]);

  useEffect(() => {
    if (!running && finalResult) setActiveTab("result");
  }, [running, finalResult]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const handleDownload = () => {
    const lines: string[] = [
      "=== AgentForge Sandbox Execution Report ===",
      `Generated: ${new Date().toISOString()}`,
      `Total Log Entries: ${logs.length}`,
      "",
      "--- EXECUTION LOGS ---",
      ...logs.map((l) => `[${formatTime(l.timestamp)}] [${l.type}] ${l.message}`),
      "",
      "--- FINAL RESULT ---",
      finalResult
        ? (typeof finalResult.payload === "string"
            ? finalResult.payload
            : JSON.stringify(finalResult.payload, null, 2))
        : "No result.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sandbox_report_${Date.now()}.txt`;
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

          <TabButton active={activeTab === "terminal"} onClick={() => setActiveTab("terminal")} color="indigo">
            <TerminalIcon size={10} /> Terminal
          </TabButton>
          <TabButton active={activeTab === "result"} onClick={() => setActiveTab("result")} color="emerald">
            <Sparkles size={10} /> Final Result
            {finalResult && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </TabButton>
        </div>

        <div className="flex items-center gap-2 px-4">
          {runCostFormatted !== "$0.00" && (
            <span
              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400"
              title="Run token cost"
            >
              {runCostFormatted}
            </span>
          )}
          {activeTab === "terminal" && logs.length > 0 && (
            <>
              <span className="text-[9px] text-slate-600 font-mono">{logs.length}</span>
              <button
                onClick={onClearLogs}
                className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 font-bold uppercase tracking-wider"
              >
                <Trash2 size={10} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Terminal */}
      {activeTab === "terminal" && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-hide space-y-0.5 text-zinc-900 dark:text-zinc-100">
          {logs.length === 0 && !running ? (
            <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-700 text-[10px] italic">
              Awaiting execution...
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 hover:bg-zinc-500/5 dark:hover:bg-slate-800/30 px-2 py-0.5 rounded transition-colors"
              >
                <span className="text-zinc-500 dark:text-zinc-600 flex-shrink-0 select-none">
                  {formatTime(log.timestamp)}
                </span>
                <span className={cn("font-bold flex-shrink-0 w-16 text-right select-none", badgeMap[log.type])}>
                  [{log.type}]
                </span>
                <span className={cn("flex-1", colorMap[log.type])}>{log.message}</span>
              </div>
            ))
          )}
          {/* Live streaming token display */}
          {running && streamingTokens && Object.keys(streamingTokens).length > 0 && (
            <div className="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
              <p className="text-[8px] font-bold uppercase tracking-widest text-indigo-400 mb-1.5">Live Output</p>
              {Object.entries(streamingTokens).map(([nodeId, text]) =>
                text ? (
                  <pre key={nodeId} className="text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {text}<span className="inline-block w-1.5 h-3 bg-indigo-400 animate-pulse ml-0.5 align-text-bottom" />
                  </pre>
                ) : null
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Final Result */}
      {activeTab === "result" && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {finalResult || Object.keys(nodeStatuses).length > 0 ? (
            <SandboxManifest
              finalResult={finalResult}
              logs={logs}
              nodes={nodes}
              nodeStatuses={nodeStatuses}
              executedNodeIds={executedNodeIds}
              copied={copied}
              onCopy={() => {
                const raw = finalResult
                  ? typeof finalResult.payload === "string"
                    ? finalResult.payload
                    : JSON.stringify(finalResult.payload, null, 2)
                  : "";
                navigator.clipboard.writeText(raw).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              onDownload={handleDownload}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
              <Sparkles size={24} className="opacity-20" />
              <span className="text-[10px] italic">Run the sandbox to see results</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manifest ───────────────────────────────────────────────────────────
function SandboxManifest({
  finalResult,
  logs,
  nodes,
  nodeStatuses,
  executedNodeIds,
  copied,
  onCopy,
  onDownload,
}: {
  finalResult: SandboxGalleryProps["finalResult"];
  logs: SandboxLogEntry[];
  nodes: SandboxGalleryNode[];
  nodeStatuses: Record<string, SandboxNodeStatus>;
  executedNodeIds: string[];
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const hasErrors = logs.some((l) => l.type === "ERROR");
  const execMs =
    logs.length >= 2 ? logs[logs.length - 1].timestamp - logs[0].timestamp : 0;
  const execSecs = (execMs / 1000).toFixed(1);
  const agentCount = nodes.filter((n) => n.type === "ai").length;

  const orderedIds = [
    ...executedNodeIds,
    ...nodes
      .filter((n) => !executedNodeIds.includes(n.id) && nodeStatuses[n.id] && nodeStatuses[n.id] !== "idle")
      .map((n) => n.id),
  ];
  const manifestNodes = orderedIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as SandboxGalleryNode[];

  const rawOutput = finalResult
    ? typeof finalResult.payload === "string"
      ? finalResult.payload
      : JSON.stringify(finalResult.payload, null, 2)
    : null;

  type PrettifiedOutput =
    | { type: "synthetic"; payload: SyntheticPayload }
    | { type: "json"; entries: [string, unknown][] }
    | { type: "image"; src: string }
    | { type: "text"; value: string };

  const prettifiedOutput: PrettifiedOutput | null = React.useMemo(() => {
    if (!rawOutput) return null;
    const trimmed = rawOutput.trim();
    if (trimmed.startsWith("data:image/")) return { type: "image", src: trimmed };
    if (trimmed.startsWith("{")) {
      try {
        const synthetic = parseSyntheticPayload(trimmed);
        if (synthetic) return { type: "synthetic", payload: synthetic };
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
      <div className="rounded-xl border border-zinc-300 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/60 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-0.5">
              Sandbox Manifest
            </p>
            <p className="text-[13px] font-semibold text-zinc-800 dark:text-slate-200 truncate">
              Execution Result
            </p>
          </div>
          <span
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold shrink-0 border",
              hasErrors
                ? "bg-amber-500/10 text-amber-500 border-amber-500/25"
                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400"
            )}
          >
            {hasErrors ? "⚠ Partial" : "✓ Complete"}
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

      {manifestNodes.length > 0 && (
        <div className="space-y-1">
          {manifestNodes.map((node) => (
            <NodeStatusRow
              key={node.id}
              label={node.type || node.id}
              type={node.type || "node"}
              status={nodeStatuses[node.id] || "idle"}
            />
          ))}
        </div>
      )}

      {prettifiedOutput && (
        <div className="bg-zinc-900 dark:bg-[#0b0e14] rounded-xl border border-zinc-700 dark:border-slate-800 p-4 overflow-auto">
          <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 dark:text-slate-600 mb-2">
            Final Output
          </p>
          {prettifiedOutput.type === "synthetic" ? (
            <SyntheticContentCard payload={prettifiedOutput.payload} />
          ) : prettifiedOutput.type === "image" ? (
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

      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all"
          style={
            copied
              ? { color: "#4ade80", borderColor: "rgba(74,222,128,.3)", background: "rgba(74,222,128,.08)" }
              : { color: "#818cf8", borderColor: "rgba(99,102,241,.25)", background: "transparent" }
          }
        >
          {copied ? <CheckCheck size={10} /> : <Copy size={10} />}
          {copied ? "Copied!" : "Copy Output"}
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
          {logs.filter((l) => l.type === "ERROR").length} errors
        </span>
      </div>
    </div>
  );
}

const NODE_STATUS_CONFIG: Record<SandboxNodeStatus, { icon: string; rowClass: string; iconClass: string }> = {
  idle:    { icon: "○", rowClass: "border-transparent bg-transparent", iconClass: "text-slate-600" },
  running: { icon: "⟳", rowClass: "border-blue-500/20 bg-blue-500/8", iconClass: "text-blue-400 animate-spin" },
  success: { icon: "✓", rowClass: "border-emerald-500/20 bg-emerald-500/8", iconClass: "text-emerald-400" },
  error:   { icon: "✗", rowClass: "border-rose-500/20 bg-rose-500/8", iconClass: "text-rose-400" },
  skipped: { icon: "⏭", rowClass: "border-zinc-600/20 bg-zinc-500/5", iconClass: "text-slate-600" },
};

function NodeStatusRow({ label, type, status }: { label: string; type: string; status: SandboxNodeStatus }) {
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

function TabButton({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  const activeClass: Record<string, string> = {
    indigo:  "text-slate-300 border-indigo-500 bg-indigo-500/5",
    emerald: "text-slate-300 border-emerald-500 bg-emerald-500/5",
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
