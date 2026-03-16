"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Play,
  Edit3,
  Trash2,
  Lock,
  Download,
  Activity,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  BarChart3,
  Shield,
  Zap
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import { useRegistryStore, PublishedAgent } from "@/stores/registryStore";
import { useLogStore } from "@/stores/useLogStore";
import { useVaultStore } from "@/stores/vaultStore";
import { compileFlow } from "@/lib/flowCompiler";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { agents, loadAgents, deleteAgent } = useRegistryStore();
  const logs = useLogStore((s) => s.logs);
  const vaultEntries = useVaultStore((s) => s.entries);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadAgents();
  }, [loadAgents]);

  if (!mounted) return null;

  // Analytics
  const totalExecutions = agents.reduce((sum, a) => sum + a.totalRuns, 0);
  const totalSuccess = agents.reduce((sum, a) => sum + a.successRuns, 0);
  const successRate = totalExecutions > 0 ? Math.round((totalSuccess / totalExecutions) * 100) : 0;
  const recentLogs = logs.slice(-10).reverse();

  const handleExport = (agent: PublishedAgent, lang: "typescript" | "python") => {
    const code = compileFlow(agent.nodes, agent.edges, lang);
    const ext = lang === "typescript" ? "ts" : "py";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agent.name.replace(/\s+/g, "_").toLowerCase()}_agent.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const logColorMap: Record<string, string> = {
    INFO: "text-slate-400",
    SUCCESS: "text-emerald-400",
    ERROR: "text-rose-400",
    WARN: "text-amber-400",
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white relative z-10">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
            <p className="text-sm text-slate-500 mt-1">Agent fleet overview & system diagnostics</p>
          </div>
          <button
            onClick={() => router.push("/editor")}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={14} />
            New Agent
          </button>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Cpu size={16} />} label="Published Agents" value={agents.length} color="indigo" />
          <StatCard icon={<Activity size={16} />} label="Total Executions" value={totalExecutions} color="blue" />
          <StatCard icon={<BarChart3 size={16} />} label="Success Rate" value={`${successRate}%`} color="emerald" />
          <StatCard icon={<Lock size={16} />} label="Vault Keys" value={vaultEntries.length} color="cyan" />
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-3 gap-6">

          {/* COLUMN 1: Published Agents */}
          <div className="col-span-1 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Published Agents</h2>
            </div>

            {agents.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
                <Zap size={24} className="mx-auto mb-3 text-slate-700" />
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">No agents published</p>
                <p className="text-[10px] text-slate-700 mt-1 italic">Create and publish an agent from the Editor</p>
              </div>
            ) : (
              agents.map(agent => (
                <div
                  key={agent.id}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/30 transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                        <Cpu size={14} className="text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{agent.name}</h3>
                        <span className="text-[9px] text-slate-500">{formatDate(agent.publishedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => router.push("/editor")}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-indigo-400 transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => deleteAgent(agent.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Stats bar */}
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-[9px] text-slate-500">
                      <Play size={8} className="inline mr-1" />
                      {agent.totalRuns} runs
                    </span>
                    <span className="text-[9px] text-emerald-500">
                      <CheckCircle2 size={8} className="inline mr-1" />
                      {agent.successRuns} ok
                    </span>
                    <span className="text-[9px] text-slate-500">
                      {agent.nodes.length} nodes
                    </span>
                  </div>

                  {/* Export buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExport(agent, "typescript")}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-[9px] font-bold hover:bg-blue-500/20 transition-all"
                    >
                      <Download size={10} />
                      TypeScript
                    </button>
                    <button
                      onClick={() => handleExport(agent, "python")}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-bold hover:bg-emerald-500/20 transition-all"
                    >
                      <Download size={10} />
                      Python
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* COLUMN 2: Recent Logs */}
          <div className="col-span-1 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-blue-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Recent Events</h2>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              {recentLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <Activity size={24} className="mx-auto mb-3 text-slate-700" />
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">No events yet</p>
                  <p className="text-[10px] text-slate-700 mt-1 italic">Run a flow to see activity</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50">
                  {recentLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                      <div className="mt-0.5">
                        {log.type === "SUCCESS" && <CheckCircle2 size={12} className="text-emerald-400" />}
                        {log.type === "ERROR" && <AlertTriangle size={12} className="text-rose-400" />}
                        {log.type === "INFO" && <Activity size={12} className="text-slate-500" />}
                        {log.type === "WARN" && <Shield size={12} className="text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[11px] truncate", logColorMap[log.type] || "text-slate-400")}>
                          {log.message}
                        </p>
                        <span className="text-[9px] text-slate-600">{formatTime(log.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: Vault Status */}
          <div className="col-span-1 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={14} className="text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Security Health</h2>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
              {/* Health summary */}
              <div className={cn(
                "flex items-center gap-3 p-3 rounded-xl border mb-4",
                vaultEntries.length > 0
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              )}>
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  vaultEntries.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-rose-400 animate-pulse"
                )} />
                <div>
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    vaultEntries.length > 0 ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {vaultEntries.length > 0 ? "Vault Initialized" : "Vault Empty"}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {vaultEntries.length} secrets active
                  </p>
                </div>
              </div>

              {/* Key list */}
              <div className="space-y-2">
                {vaultEntries.map(entry => (
                  <div
                    key={entry.key}
                    className="flex items-center justify-between px-3 py-2 bg-[#0b0e14] border border-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Lock size={10} className="text-cyan-400" />
                      <span className="text-[10px] font-mono text-cyan-400">{entry.key}</span>
                    </div>
                    <span className="text-[9px] text-slate-600 font-mono">••••••</span>
                  </div>
                ))}
                {vaultEntries.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-slate-600 italic">Add secrets in the Editor vault tab</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HELP FAB */}
      <button
        onClick={() => router.push("/editor")}
        className="fixed bottom-6 right-6 z-50 bg-slate-800/50 backdrop-blur-md p-3 rounded-full border border-slate-700 text-slate-400 hover:text-indigo-400 transition-all shadow-2xl group active:scale-95"
        title="Open Editor"
      >
        <HelpCircle size={20} className="group-hover:rotate-12 transition-transform" />
      </button>
    </div>
  );
}

// --- Stat Card Component ---
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorClasses: Record<string, string> = {
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400",
  };

  return (
    <div className={cn(
      "rounded-2xl border p-4 flex items-center gap-4 transition-all hover:scale-[1.02]",
      colorClasses[color] || colorClasses.indigo
    )}>
      <div className="p-2.5 rounded-xl bg-slate-900/50">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
