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
  Folder as FolderIcon,
  LayoutTemplate,
  History,
  ChevronRight,
  PlusCircle,
  FolderPlus,
  ShoppingBag,
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import { useLogStore } from "@/stores/useLogStore";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/lib/utils";
import { getUserFlows, publishFlow, deleteFlow } from "@/app/actions/flow";
import { getProjects, createProject, deleteProject } from "@/app/actions/project";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/stores/flowStore";

interface FlowRecord {
  id: string;
  name: string;
  isPublic: boolean;
  updated_at: Date;
  nodes: object;
  edges: object;
  projectId?: string | null;
  folderId?: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  _count?: { flows: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useFlowStore();
  const logs = useLogStore((s) => s.logs);
  const vaultEntries = useVaultStore((s) => s.entries);
  const [mounted, setMounted] = useState(false);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"recent" | "projects" | "templates">("recent");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    setMounted(true);
    getUserFlows().then((result) => {
      if (result.success && result.flows) {
        setFlows(result.flows as FlowRecord[]);
      }
    });
    getProjects().then((result) => {
      if (result.projects) {
        setProjects(result.projects as ProjectRecord[]);
      }
    });
  }, []);

  if (!mounted) return null;

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const result = await createProject(newProjectName);
    if (result.project) {
      setProjects([...projects, { ...result.project, _count: { flows: 0 } } as ProjectRecord]);
      setNewProjectName("");
      setShowNewProjectInput(false);
      setSelectedProjectId(result.project.id);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const res = await deleteProject(id);
    if (res.success) {
      setProjects(projects.filter(p => p.id !== id));
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const filteredFlows = flows.filter(flow => {
    if (activeTab === "projects") {
      // Check both projectId and folderId for legacy support, but prioritize projectId
      const matchId = flow.projectId || flow.folderId;
      return selectedProjectId ? matchId === selectedProjectId : !!matchId;
    }
    if (activeTab === "recent") return true;
    return true;
  });

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

  const handleDelete = async (flowId: string) => {
    const originalFlows = [...flows];
    setFlows((prev) => prev.filter((f) => f.id !== flowId));
    setDeletingId(null);

    const result = await deleteFlow(flowId);
    if (!result.success) {
      setFlows(originalFlows);
      alert("Failed to delete flow.");
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
    <div className={cn(
      "min-h-screen bg-background text-foreground relative z-10 flex flex-col transition-colors duration-300",
      theme === "dark" ? "dark" : ""
    )}>
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex gap-8">
        
        {/* SIDEBAR */}
        <div className="w-64 flex flex-col gap-6 border-r border-border pr-6">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 mb-2">Workspace</h2>
            <SidebarTab 
              icon={<History size={14} />} 
              label="Recent Flows" 
              active={activeTab === "recent"} 
              onClick={() => { setActiveTab("recent"); setSelectedProjectId(null); }}
            />
            <SidebarTab 
              icon={<FolderIcon size={14} />} 
              label="Projects" 
              active={activeTab === "projects"} 
              onClick={() => setActiveTab("projects")}
            />
            <SidebarTab 
              icon={<LayoutTemplate size={14} />} 
              label="Templates" 
              active={activeTab === "templates"} 
              onClick={() => setActiveTab("templates")}
            />
          </div>

          <AnimatePresence>
            {activeTab === "projects" && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between px-3 mb-2">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">My Projects</h2>
                  <button 
                    onClick={() => setShowNewProjectInput(true)}
                    className="text-muted-foreground hover:text-indigo-400 transition-colors"
                  >
                    <PlusCircle size={14} />
                  </button>
                </div>

                {showNewProjectInput && (
                  <div className="px-3 mb-2">
                    <input 
                      autoFocus
                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500 transition-all"
                      placeholder="Project name..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                      onBlur={() => !newProjectName && setShowNewProjectInput(false)}
                    />
                  </div>
                )}

                {projects.map(project => (
                  <div key={project.id} className="group relative">
                    <button
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all",
                        selectedProjectId === project.id 
                          ? "bg-indigo-600/10 text-indigo-400 font-bold" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FolderIcon size={12} className={cn(selectedProjectId === project.id ? "text-indigo-400" : "text-muted-foreground")} />
                        {project.name}
                      </div>
                      <span className="text-[10px] opacity-50 group-hover:opacity-0">{project._count?.flows ?? 0}</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete the project "${project.name}"?`)) {
                          handleDeleteProject(project.id);
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {projects.length === 0 && !showNewProjectInput && (
                  <div className="px-3 py-4 text-center border border-dashed border-border rounded-xl">
                    <p className="text-[10px] text-muted-foreground italic">No projects yet</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto p-4 bg-card border border-border rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-indigo-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider">System Health</h3>
            </div>
            <div className="space-y-2">
              <HealthItem label="Core Engine" status="online" />
              <HealthItem label="AI Gateway" status="online" />
              <HealthItem label="Cloud Sync" status="online" />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {activeTab === "recent" && "Mission Control"}
                {activeTab === "projects" && (selectedProjectId ? projects.find(f => f.id === selectedProjectId)?.name : "Projects")}
                {activeTab === "templates" && "Agent Blueprints"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === "recent" && "Agent fleet overview & system diagnostics"}
                {activeTab === "projects" && "Organize your agents into specialized mission projects"}
                {activeTab === "templates" && "Starting points for advanced automation"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/store")}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-xs font-bold rounded-xl text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all active:scale-95"
              >
                <ShoppingBag size={14} />
                AgentStore
              </button>
              <button
                onClick={() => router.push(selectedProjectId ? `/editor?projectId=${selectedProjectId}` : "/editor")}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                <Plus size={14} />
                New Agent
              </button>
            </div>
          </div>

          {/* STATS ROW */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={<Cpu size={16} />} label="Active Flows" value={totalFlows} color="indigo" />
            <StatCard icon={<Activity size={16} />} label="Recent Events" value={recentLogs.length} color="blue" />
            <StatCard icon={<BarChart3 size={16} />} label="Public Reach" value={publicFlows} color="emerald" />
            <StatCard icon={<Lock size={16} />} label="Vault Keys" value={vaultEntries.length} color="cyan" />
          </div>

          {/* CONTENT GRID */}
          <div className="grid grid-cols-12 gap-6">
            
            {/* Flows List */}
            <div className="col-span-8 flex flex-col gap-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-indigo-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {activeTab === "recent" ? "Recent Deployments" : "Project Contents"}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {filteredFlows.length === 0 ? (
                  <div className="col-span-2 bg-card border border-dashed border-border rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Cpu size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">No agents detected</p>
                    <button 
                      onClick={() => router.push("/editor")}
                      className="mt-4 text-[10px] text-indigo-500 hover:text-indigo-400 font-bold flex items-center gap-1 mx-auto"
                    >
                      Initialize first agent <ChevronRight size={10} />
                    </button>
                  </div>
                ) : (
                  filteredFlows.map(flow => (
                    <motion.div
                      layout
                      key={flow.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card backdrop-blur-md border border-border rounded-2xl p-4 hover:border-indigo-500/40 transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="flex gap-1">
                            <button
                              onClick={() => router.push(`/editor?id=${flow.id}`)}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => setDeletingId(flow.id)}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                         </div>
                      </div>

                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Cpu size={18} className="text-indigo-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">{flow.name}</h3>
                          <p className="text-[10px] text-slate-500 font-medium">{formatDate(flow.updated_at)}</p>
                        </div>
                      </div>

                      {deletingId === flow.id ? (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 animate-in fade-in zoom-in duration-200">
                           <p className="text-[10px] text-rose-400 font-bold mb-2">Confirm deletion?</p>
                           <div className="flex gap-2">
                             <button onClick={() => setDeletingId(null)} className="flex-1 py-1.5 text-[10px] font-bold text-slate-400 hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
                             <button onClick={() => handleDelete(flow.id)} className="flex-1 py-1.5 text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors">Delete</button>
                           </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-2 pt-4 border-t border-border">
                          <div className="flex items-center gap-2">
                            {flow.isPublic ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                                <Eye size={10} /> Public
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-bold">Private</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleShare(flow)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                              copiedId === flow.id
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                            )}
                          >
                            {copiedId === flow.id ? <Check size={10} /> : <Share2 size={10} />}
                            {copiedId === flow.id ? "Copied" : "Share"}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Diagnostics Column */}
            <div className="col-span-4 flex flex-col gap-6">
               <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <Activity size={14} className="text-blue-400" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Event Stream</h2>
                  </div>
                  <div className="bg-card border border-border rounded-3xl overflow-hidden backdrop-blur-sm">
                    {recentLogs.length === 0 ? (
                      <div className="p-12 text-center">
                        <Activity size={20} className="mx-auto mb-2 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Quiet Sector</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {recentLogs.map(log => (
                          <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                            <div className="mt-1 flex-shrink-0">
                              {log.type === "SUCCESS" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                              {log.type === "ERROR" && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />}
                              {log.type === "INFO" && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                              {log.type === "WARN" && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-[11px] font-medium leading-tight", logColorMap[log.type] || "text-slate-400")}>
                                {log.message}
                              </p>
                              <span className="text-[9px] text-slate-600 font-mono mt-1 block">{formatTime(log.timestamp)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <Lock size={14} className="text-cyan-400" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Vault Access</h2>
                  </div>
                  <div className="bg-card border border-border rounded-3xl p-5 backdrop-blur-sm">
                     <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                           <div className={cn("w-2 h-2 rounded-full", vaultEntries.length > 0 ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                           <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                             {vaultEntries.length > 0 ? "Encrypted" : "Empty"}
                           </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground font-bold">{vaultEntries.length} Keys</span>
                     </div>
                     <div className="space-y-2">
                        {vaultEntries.slice(0, 3).map(entry => (
                          <div key={entry.key} className="flex items-center justify-between px-3 py-2 bg-muted border border-border rounded-xl">
                            <span className="text-[10px] font-mono text-cyan-400">{entry.key}</span>
                            <span className="text-[9px] text-slate-600 font-mono">••••••</span>
                          </div>
                        ))}
                        {vaultEntries.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-2">No active secrets</p>}
                     </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      <button
        onClick={() => router.push("/editor")}
        className="fixed bottom-8 right-8 z-50 bg-slate-800/50 backdrop-blur-xl p-4 rounded-full border border-slate-700/50 text-slate-400 hover:text-indigo-400 transition-all shadow-2xl group active:scale-95"
      >
        <HelpCircle size={24} className="group-hover:rotate-12 transition-transform" />
      </button>
    </div>
  );
}

function SidebarTab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative group",
          active 
            ? "bg-indigo-600/10 text-indigo-400" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
    >
      {active && <motion.div layoutId="sidebar-active" className="absolute left-0 w-1 h-5 bg-indigo-500 rounded-r-full" />}
      <span className={cn("transition-colors", active ? "text-indigo-400" : "group-hover:text-slate-300")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorClasses: Record<string, string> = {
    indigo: "border-indigo-500/10 bg-indigo-500/5 text-indigo-400",
    blue: "border-blue-500/10 bg-blue-500/5 text-blue-400",
    emerald: "border-emerald-500/10 bg-emerald-500/5 text-emerald-400",
    cyan: "border-cyan-500/10 bg-cyan-500/5 text-cyan-400",
  };

  return (
    <div className={cn(
      "rounded-3xl border p-5 flex items-center gap-4 transition-all hover:scale-[1.02] backdrop-blur-sm",
      colorClasses[color] || colorClasses.indigo
    )}>
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight">{value}</p>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function HealthItem({ label, status }: { label: string; status: "online" | "offline" | "busy" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-slate-400 font-medium capitalize">{status}</span>
        <div className={cn("w-1.5 h-1.5 rounded-full", status === "online" ? "bg-emerald-500" : "bg-rose-500")} />
      </div>
    </div>
  );
}
