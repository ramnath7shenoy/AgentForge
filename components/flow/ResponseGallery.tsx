"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLogStore, LogType } from "@/stores/useLogStore";
import { useFlowStore } from "@/stores/flowStore";
import { Trash2, Terminal as TerminalIcon, Download, Sparkles, Copy, CheckCheck, Bot, Clock, Workflow, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { currentContext, finalResult, running, nodes, activeProject } = useFlowStore();
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

          <TabButton active={activeTab === "terminal"} onClick={() => setActiveTab("terminal")} color="indigo">
            <TerminalIcon size={10} /> Terminal
          </TabButton>
          <TabButton active={activeTab === "result"} onClick={() => setActiveTab("result")} color="emerald">
            <Sparkles size={10} /> Final Result
            {finalResult && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </TabButton>
        </div>

        <div className="flex items-center gap-2 px-4">
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
          ) : logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-zinc-500/5 dark:hover:bg-slate-800/30 px-2 py-0.5 rounded transition-colors">
              <span className="text-zinc-500 dark:text-zinc-600 flex-shrink-0 select-none">{formatTime(log.timestamp)}</span>
              <span className={cn("font-bold flex-shrink-0 w-16 text-right select-none", badgeMap[log.type])}>[{log.type}]</span>
              <span className={cn("flex-1", colorMap[log.type])}>
                {log.message}
                {log.elapsed !== undefined && <span className="text-zinc-500 dark:text-zinc-600 ml-2">({log.elapsed}ms)</span>}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}


      {/* Final Result Tab */}
      {activeTab === "result" && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {finalResult ? (
            <WorkflowReport
              finalResult={finalResult}
              logs={logs}
              nodes={nodes}
              projectName={activeProject?.name}
              copied={copied}
              onCopy={() => {
                const agentCount = nodes.filter(n => n.type === "ai").length;
                const hasErrors = logs.some(l => l.type === "ERROR");
                const execMs = logs.length >= 2
                  ? logs[logs.length - 1].timestamp - logs[0].timestamp
                  : 0;
                const execSecs = (execMs / 1000).toFixed(1);
                const projectLabel = activeProject?.name || "Untitled Flow";
                const raw = typeof finalResult.payload === "string"
                  ? finalResult.payload
                  : JSON.stringify(finalResult.payload, null, 2);

                const summary = [
                  `✅ Workflow: ${projectLabel}`,
                  `⏱️ Execution Time: ${execSecs}s`,
                  `🤖 Agents Involved: ${agentCount}`,
                  `📊 Status: ${hasErrors ? "Partial" : "Complete"}`,
                  "",
                  "─── Output ───",
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
              <span className="text-[10px] italic">Run a flow to see the final result</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WorkflowReport — structured result view for the Final Result tab
// ─────────────────────────────────────────────────────────────────────
function WorkflowReport({
  finalResult,
  logs,
  nodes,
  projectName,
  copied,
  onCopy,
  onDownload,
}: {
  finalResult: { type: string; payload: any };
  logs: { timestamp: number; type: string }[];
  nodes: { type?: string | null }[];
  projectName: string | undefined;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const agentCount = nodes.filter(n => n.type === "ai").length;
  const hasErrors = logs.some(l => l.type === "ERROR");
  const execMs = logs.length >= 2
    ? logs[logs.length - 1].timestamp - logs[0].timestamp
    : 0;
  const execSecs = (execMs / 1000).toFixed(1);
  const status = hasErrors ? "Partial" : "Complete";
  const rawOutput = typeof finalResult.payload === "string"
    ? finalResult.payload
    : JSON.stringify(finalResult.payload, null, 2);

  return (
    <div className="space-y-4">
      {/* ── Workflow Report header ── */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            Workflow Report
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCopy}
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-all"
              style={copied
                ? { color: "#4ade80", borderColor: "rgba(74,222,128,.3)", background: "rgba(74,222,128,.08)" }
                : { color: "#818cf8", borderColor: "rgba(99,102,241,.25)", background: "transparent" }}
            >
              {copied ? <CheckCheck size={10} /> : <Copy size={10} />}
              {copied ? "Copied!" : "Copy Summary"}
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg border border-white/8 hover:bg-white/5 font-bold uppercase tracking-wider"
            >
              <Download size={10} /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ReportStat
            icon={<Workflow size={11} className="text-violet-400" />}
            label="Workflow"
            value={projectName || "Untitled Flow"}
            color="violet"
          />
          <ReportStat
            icon={<Clock size={11} className="text-blue-400" />}
            label="Execution Time"
            value={`${execSecs}s`}
            color="blue"
          />
          <ReportStat
            icon={<Bot size={11} className="text-amber-400" />}
            label="Agents Involved"
            value={String(agentCount)}
            color="amber"
          />
          <ReportStat
            icon={<BarChart3 size={11} className={hasErrors ? "text-rose-400" : "text-emerald-400"} />}
            label="Status"
            value={status}
            color={hasErrors ? "rose" : "emerald"}
          />
        </div>
      </div>

      {/* ── Raw output ── */}
      <div className="bg-[#0b0e14] rounded-xl border border-slate-800 p-4 overflow-auto">
        <pre className="text-[12px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
          {rawOutput}
        </pre>
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

function ReportStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  const bg: Record<string, string> = {
    violet: "bg-violet-500/8 border-violet-500/20",
    blue:   "bg-blue-500/8 border-blue-500/20",
    amber:  "bg-amber-500/8 border-amber-500/20",
    emerald:"bg-emerald-500/8 border-emerald-500/20",
    rose:   "bg-rose-500/8 border-rose-500/20",
  };
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", bg[color] || bg.violet)}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
        <p className="text-[11px] font-semibold text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  const activeClass: Record<string, string> = {
    indigo: "text-slate-300 border-indigo-500 bg-indigo-500/5",
    cyan: "text-slate-300 border-cyan-500 bg-cyan-500/5",
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
