"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLogStore, LogType } from "@/stores/useLogStore";
import { useFlowStore } from "@/stores/flowStore";
import { Trash2, Terminal as TerminalIcon, FileText, Download, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const colorMap: Record<LogType, string> = {
  INFO: "text-slate-400",
  SUCCESS: "text-emerald-400",
  ERROR: "text-rose-400",
  WARN: "text-amber-400",
};

const badgeMap: Record<LogType, string> = {
  INFO: "text-slate-500",
  SUCCESS: "text-emerald-500",
  ERROR: "text-rose-500",
  WARN: "text-amber-500",
};

export default function ResponseGallery() {
  const { logs, clearLogs } = useLogStore();
  const { finalResult, running } = useFlowStore();
  const [activeTab, setActiveTab] = useState<"terminal" | "output">("terminal");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (activeTab === "terminal") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Auto-switch to output tab when flow completes
  useEffect(() => {
    if (!running && finalResult) {
      setActiveTab("output");
    }
  }, [running, finalResult]);

  // Switch to terminal when flow starts
  useEffect(() => {
    if (running) setActiveTab("terminal");
  }, [running]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
    lines.push("--- FINAL OUTPUT ---");
    if (finalResult) {
      lines.push(`Type: ${finalResult.type}`);
      lines.push(`Payload:`);
      lines.push(typeof finalResult.payload === "string" ? finalResult.payload : JSON.stringify(finalResult.payload, null, 2));
    } else {
      lines.push("No output produced.");
    }

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
    <div className="flex flex-col h-full bg-[#05070a] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#0b0e14]">
        <div className="flex items-center">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 px-4 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-60" />
          </div>

          {/* Tabs */}
          <button
            onClick={() => setActiveTab("terminal")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-all border-b-2",
              activeTab === "terminal"
                ? "text-slate-300 border-indigo-500 bg-indigo-500/5"
                : "text-slate-600 border-transparent hover:text-slate-400"
            )}
          >
            <TerminalIcon size={10} />
            Terminal Logs
          </button>
          <button
            onClick={() => setActiveTab("output")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest transition-all border-b-2",
              activeTab === "output"
                ? "text-slate-300 border-emerald-500 bg-emerald-500/5"
                : "text-slate-600 border-transparent hover:text-slate-400"
            )}
          >
            <Layers size={10} />
            Final Output
            {finalResult && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 px-4">
          {activeTab === "terminal" && (
            <>
              <span className="text-[9px] text-slate-600 font-mono">{logs.length} lines</span>
              {logs.length > 0 && (
                <button
                  onClick={clearLogs}
                  className="flex items-center gap-1 text-[9px] text-rose-500/70 hover:text-rose-400 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10"
                >
                  <Trash2 size={10} />
                  Clear
                </button>
              )}
            </>
          )}
          {activeTab === "output" && finalResult && (
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10 font-bold uppercase tracking-wider"
            >
              <Download size={10} />
              Download Report
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "terminal" && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-hide space-y-0.5">
          {logs.length === 0 && (
            <div className="flex items-center justify-center h-full text-slate-700 text-[10px] italic">
              Awaiting execution...
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-slate-800/30 px-2 py-0.5 rounded transition-colors">
              <span className="text-slate-600 flex-shrink-0 select-none">{formatTime(log.timestamp)}</span>
              <span className={cn("font-bold flex-shrink-0 w-16 text-right select-none", badgeMap[log.type])}>
                [{log.type}]
              </span>
              <span className={cn("flex-1", colorMap[log.type])}>
                {log.message}
                {log.elapsed !== undefined && (
                  <span className="text-slate-600 ml-2">({log.elapsed}ms)</span>
                )}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {activeTab === "output" && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {finalResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Execution Complete</span>
                <span className={cn(
                  "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ml-auto",
                  finalResult.type === "text" ? "bg-blue-500/10 text-blue-400" :
                  finalResult.type === "file" ? "bg-emerald-500/10 text-emerald-400" :
                  "bg-purple-500/10 text-purple-400"
                )}>
                  {finalResult.type}
                </span>
              </div>
              <div className="bg-[#0b0e14] rounded-xl border border-slate-800 p-4 overflow-auto">
                <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {typeof finalResult.payload === "string"
                    ? finalResult.payload
                    : JSON.stringify(finalResult.payload, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-slate-600">
                <FileText size={10} />
                <span>{logs.length} log entries recorded</span>
                <span>·</span>
                <span>{logs.filter(l => l.type === "ERROR").length} errors</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
              <Layers size={24} className="opacity-20" />
              <span className="text-[10px] italic">Run a flow to see output</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
