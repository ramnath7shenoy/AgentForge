"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Edit3,
  Trash2,
  Lock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  BarChart3,
  Shield,
  Zap,
  Share2,
  Check,
  Eye,
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import { useLogStore } from "@/stores/useLogStore";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/lib/utils";
import { getUserFlows, publishFlow } from "@/app/actions/flow";

interface FlowRecord {
  id: string;
  name: string;
  isPublic: boolean;
  updated_at: Date;
  nodes: object;
  edges: object;
}

export default function DashboardPage() {
  const router = useRouter();
  const logs = useLogStore((s) => s.logs);
  const vaultEntries = useVaultStore((s) => s.entries);
  const [mounted, setMounted] = useState(false);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    getUserFlows().then((result) => {
      if (result.success && result.flows) {
        setFlows(result.flows as FlowRecord[]);
      }
    });
  }, []);

  if (!mounted) return null;

  const recentLogs = logs.slice(-10).reverse();
  const totalFlows = flows.length;
  const publicFlows = flows.filter((f) => f.isPublic).length;

  const handleShare = async (flow: FlowRecord) => {
    const result = await publishFlow(flow.id);
    if (result.success) {
      setFlows((prev) => prev.map((f) => f.id === flow.id ? { ...f, isPublic: true } : f));
      const url = `${window.location.origin}/view/${flow.id}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(flow.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const formatDate = (ts: Date) => {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
          <StatCard icon={<Cpu size={16} />} label="Saved Flows" value={totalFlows} color="indigo" />
          <StatCard icon={<Activity size={16} />} label="Recent Events" value={recentLogs.length} color="blue" />
          <StatCard icon={<BarChart3 size={16} />} label="Public Flows" value={publicFlows} color="emerald" />
          <StatCard icon={<Lock size={16} />} label="Vault Keys" value={vaultEntries.length} color="cyan" />
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-3 gap-6">

          {/* COLUMN 1: Saved Flows */}
          <div className="col-span-1 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">My Saved Flows</h2>
            </div>

            {flows.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
                <Zap size={24} className="mx-auto mb-3 text-slate-700" />
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">No saved flows yet</p>
                <p className="text-[10px] text-slate-700 mt-1 italic">Create a flow in the Editor to see it here</p>
              </div>
            ) : (
              flows.map(flow => (
                <div
                  key={flow.id}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/30 transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                        <Cpu size={14} className="text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{flow.name}</h3>
                        <span className="text-[9px] text-slate-500">{formatDate(flow.updated_at)}</span>
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
                    </div>
                  </div>

                  {/* Status + Share row */}
                  <div className="flex items-center justify-between">
                    {flow.isPublic ? (
                      <a
                        href={`/view/${flow.id}`}
                        target="_blank"
                        className="flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Eye size={10} />
                        Public — View Link
                      </a>
                    ) : (
                      <span className="text-[9px] text-slate-600 italic">Private</span>
                    )}

                    <button
                      onClick={() => handleShare(flow)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all",
                        copiedId === flow.id
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20"
                      )}
                    >
                      {copiedId === flow.id ? <Check size={10} /> : <Share2 size={10} />}
                      {copiedId === flow.id ? "Link Copied!" : "Share"}
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
