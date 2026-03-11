"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLogStore, LogType } from "@/stores/useLogStore";
import { useFlowStore } from "@/stores/flowStore";
import { Trash2, Terminal as TerminalIcon, Braces, Search, Download, Sparkles } from "lucide-react";
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
  const { currentContext, finalResult, running } = useFlowStore();
  const [activeTab, setActiveTab] = useState<"terminal" | "state" | "result">("terminal");
  const [stateSearch, setStateSearch] = useState("");
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
    <div className="flex flex-col h-full bg-[#05070a] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#0b0e14]">
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 px-4 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 opacity-60" />
          </div>

          <TabButton active={activeTab === "terminal"} onClick={() => setActiveTab("terminal")} color="indigo">
            <TerminalIcon size={10} /> Terminal
          </TabButton>
          <TabButton active={activeTab === "state"} onClick={() => setActiveTab("state")} color="cyan">
            <Braces size={10} /> State
            {currentContext && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
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
              <button onClick={clearLogs} className="flex items-center gap-1 text-[9px] text-rose-500/70 hover:text-rose-400 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/10">
                <Trash2 size={10} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Terminal Tab */}
      {activeTab === "terminal" && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-hide space-y-0.5">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-700 text-[10px] italic">Awaiting execution...</div>
          ) : logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-slate-800/30 px-2 py-0.5 rounded transition-colors">
              <span className="text-slate-600 flex-shrink-0 select-none">{formatTime(log.timestamp)}</span>
              <span className={cn("font-bold flex-shrink-0 w-16 text-right select-none", badgeMap[log.type])}>[{log.type}]</span>
              <span className={cn("flex-1", colorMap[log.type])}>
                {log.message}
                {log.elapsed !== undefined && <span className="text-slate-600 ml-2">({log.elapsed}ms)</span>}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* State Tab */}
      {activeTab === "state" && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {stateData ? (
            <div className="space-y-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="Filter keys..."
                  value={stateSearch}
                  onChange={(e) => setStateSearch(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/30 transition-colors placeholder:text-slate-700"
                />
              </div>
              {Object.keys(filterState(stateData.variables as Record<string, unknown>)).length > 0 && (
                <div>
                  <h4 className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 mb-2">Variables</h4>
                  <pre className="bg-[#0b0e14] rounded-xl border border-slate-800 p-3 text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-auto">
                    {JSON.stringify(filterState(stateData.variables as Record<string, unknown>), null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Node Outputs</h4>
                {Object.entries(filterState(stateData.nodes as Record<string, unknown>)).map(([nodeId, data]) => (
                  <div key={nodeId} className="mb-2 bg-[#0b0e14] rounded-xl border border-slate-800 p-3 overflow-auto">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{nodeId}</span>
                    <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
                    </pre>
                  </div>
                ))}
                {Object.keys(filterState(stateData.nodes as Record<string, unknown>)).length === 0 && (
                  <p className="text-[10px] text-slate-700 italic text-center py-4">{stateSearch ? "No matching keys" : "No node outputs yet"}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-2">
              <Braces size={24} className="opacity-20" />
              <span className="text-[10px] italic">Run a flow to see live state</span>
            </div>
          )}
        </div>
      )}

      {/* Final Result Tab */}
      {activeTab === "result" && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {finalResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Execution Complete</span>
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ml-2",
                    finalResult.type === "text" ? "bg-blue-500/10 text-blue-400" :
                    finalResult.type === "file" ? "bg-emerald-500/10 text-emerald-400" :
                    "bg-purple-500/10 text-purple-400"
                  )}>{finalResult.type}</span>
                </div>
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 border border-indigo-500/20 font-bold uppercase tracking-wider"
                >
                  <Download size={10} /> Download Report
                </button>
              </div>
              <div className="bg-[#0b0e14] rounded-xl border border-slate-800 p-4 overflow-auto">
                <pre className="text-[12px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {typeof finalResult.payload === "string" ? finalResult.payload : JSON.stringify(finalResult.payload, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-slate-600">
                <span>{logs.length} log entries</span>
                <span>·</span>
                <span>{logs.filter(l => l.type === "ERROR").length} errors</span>
                <span>·</span>
                <span>{logs.filter(l => l.type === "SUCCESS").length} successes</span>
              </div>
            </div>
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
