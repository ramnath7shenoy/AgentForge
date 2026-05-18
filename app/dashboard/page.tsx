"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cpu,
  Edit3,
  Trash2,
  Lock,
  Plus,
  Shield,
  Share2,
  Check,
  LayoutTemplate,
  History,
  ChevronRight,
  Tag,
  X,
  FolderOpen,
  UserCircle,
  LogOut,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import Navbar from "@/components/ui/Navbar";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/lib/utils";
import { getUserFlows, publishFlow, deleteFlow, updateFlowGroup } from "@/app/actions/flow";
import { signOut } from "@/app/actions/auth";
import { motion } from "framer-motion";
import { useFlowStore } from "@/stores/flowStore";
import { createClient } from "@/lib/supabase/client";

interface FlowRecord {
  id: string;
  name: string;
  isPublic: boolean;
  updated_at: Date;
  nodes: object;
  edges: object;
  groupName?: string | null;
}

type ActiveTab = "recent" | "templates" | "docs" | "account";

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useFlowStore();
  const vaultEntries = useVaultStore((s) => s.entries);
  const loadVaultFromDb = useVaultStore((s) => s.loadFromDb);
  const [mounted, setMounted] = useState(false);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("recent");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    getUserFlows().then((result) => {
      if (result.success && result.flows) {
        setFlows(result.flows as FlowRecord[]);
      }
    });
    loadVaultFromDb();

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        const meta = user.user_metadata || {};
        setUserName(meta.full_name || meta.name || null);
      }
    });
  }, []);

  if (!mounted) return null;

  const totalFlows = flows.length;

  const handleSaveGroup = async (flowId: string) => {
    const name = groupDraft.trim() || null;
    setFlows((prev) => prev.map((f) => f.id === flowId ? { ...f, groupName: name } : f));
    setEditingGroupId(null);
    await updateFlowGroup(flowId, name);
  };

  // Group flows: named groups first (alphabetical), ungrouped at the bottom
  const grouped: Record<string, FlowRecord[]> = {};
  flows.forEach((f) => {
    const key = f.groupName?.trim() || "";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(f);
  });
  const sortedGroups = [
    ...Object.entries(grouped)
      .filter(([k]) => k !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, flows]) => ({ key, flows })),
    ...(grouped[""] ? [{ key: "", flows: grouped[""] }] : []),
  ];

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

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const handleSwitchAccount = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const formatDate = (ts: Date) => {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const userInitials = userName
    ? userName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : userEmail?.[0]?.toUpperCase() ?? "?";

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
              onClick={() => setActiveTab("recent")}
            />
            <SidebarTab
              icon={<LayoutTemplate size={14} />}
              label="Templates"
              active={activeTab === "templates"}
              onClick={() => setActiveTab("templates")}
            />
            <SidebarTab
              icon={<BookOpen size={14} />}
              label="Documentation"
              active={activeTab === "docs"}
              onClick={() => setActiveTab("docs")}
            />
            <SidebarTab
              icon={<UserCircle size={14} />}
              label="Account"
              active={activeTab === "account"}
              onClick={() => setActiveTab("account")}
            />
          </div>

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
                {activeTab === "recent" ? "Mission Control" : activeTab === "templates" ? "Agent Blueprints" : activeTab === "docs" ? "Documentation" : "Account"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === "recent"
                  ? "Agent fleet overview & system diagnostics"
                  : activeTab === "templates"
                  ? "Starting points for advanced automation"
                  : activeTab === "docs"
                  ? "How FlowForge AI works — nodes, execution, APIs and more"
                  : "Manage your profile and session"}
              </p>
            </div>
            {activeTab !== "account" && activeTab !== "docs" && (
              <button
                onClick={() => router.push("/editor")}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                <Plus size={14} />
                New Agent
              </button>
            )}
          </div>

          {/* STATS ROW — only on recent/templates */}
          {activeTab !== "account" && activeTab !== "docs" && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={<Cpu size={16} />} label="Total Flows" value={totalFlows} color="indigo" />
              <StatCard icon={<Lock size={16} />} label="Vault Keys" value={vaultEntries.length} color="cyan" />
            </div>
          )}

          {/* FLOWS — grouped */}
          {activeTab === "recent" && (
            <div className="flex flex-col gap-8">
              {flows.length === 0 ? (
                <div className="bg-card border border-dashed border-border rounded-3xl p-12 text-center">
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
                sortedGroups.map(({ key, flows: groupFlows }) => (
                  <div key={key || "__ungrouped__"} className="flex flex-col gap-3">
                    {key ? (
                      <div className="flex items-center gap-2">
                        <FolderOpen size={14} className="text-indigo-400" />
                        <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400">{key}</h2>
                        <div className="flex-1 h-px bg-indigo-500/10" />
                      </div>
                    ) : sortedGroups.length > 1 ? (
                      <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ungrouped</h2>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    ) : null}

                    <div className="grid grid-cols-3 gap-4">
                      {groupFlows.map(flow => (
                        <motion.div
                          layout
                          key={flow.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-card backdrop-blur-md border border-border rounded-2xl p-4 hover:border-indigo-500/40 transition-all group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
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

                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                              <Cpu size={16} className="text-indigo-400" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">{flow.name}</h3>
                              <p className="text-[10px] text-slate-500 font-medium">{formatDate(flow.updated_at)}</p>
                            </div>
                          </div>

                          {/* Group tag */}
                          <div className="mb-3">
                            {editingGroupId === flow.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus
                                  value={groupDraft}
                                  onChange={(e) => setGroupDraft(e.target.value)}
                                  onBlur={() => handleSaveGroup(flow.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveGroup(flow.id);
                                    if (e.key === "Escape") setEditingGroupId(null);
                                  }}
                                  placeholder="Group name..."
                                  className="flex-1 bg-muted border border-indigo-500/40 rounded-md px-2 py-0.5 text-[10px] text-foreground outline-none focus:ring-1 focus:ring-indigo-500/40"
                                />
                                {flow.groupName && (
                                  <button
                                    onMouseDown={(e) => { e.preventDefault(); setGroupDraft(""); }}
                                    className="text-rose-400 hover:text-rose-300"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingGroupId(flow.id); setGroupDraft(flow.groupName || ""); }}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-indigo-400 transition-colors"
                              >
                                <Tag size={9} />
                                <span>{flow.groupName || "Add to group"}</span>
                              </button>
                            )}
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
                            <div className="flex items-center justify-end pt-3 border-t border-border">
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
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === "templates" && (
            <div className="flex flex-col gap-4">
              {[
                { name: "Basic Chatbot", desc: "A simple Input → AI → Output pipeline. Great starting point for any conversational agent.", icon: "💬" },
                { name: "Research Assistant", desc: "Input → AI Researcher → AI Summarizer → Output. Ideal for deep-dive analysis workflows.", icon: "🔬" },
                { name: "Omnichannel Content Generator", desc: "AI generates platform-specific content → human approval gate → posts to X, LinkedIn & Medium.", icon: "📡" },
                { name: "Webhook Processor", desc: "Webhook → Data Processor → AI Responder → Output. Automate responses to external events.", icon: "🔗" },
              ].map((tpl) => (
                <div
                  key={tpl.name}
                  className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-indigo-500/40 transition-all group cursor-pointer"
                  onClick={() => router.push("/editor")}
                >
                  <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                    {tpl.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-indigo-400 transition-colors">{tpl.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{tpl.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* DOCUMENTATION TAB */}
          {activeTab === "docs" && (
            <div className="flex flex-col gap-6 max-w-3xl">

              {/* What is FlowForge */}
              <DocSection title="What is FlowForge AI?" accent="indigo">
                <p>FlowForge AI is a <strong>visual AI workflow builder</strong>. You drag nodes onto a canvas, connect them, and run fully functional AI agent pipelines — no code required. When you&apos;re ready to ship, export the entire flow as Python, TypeScript, or JavaScript.</p>
                <p className="mt-2">Think of it as the layer between &ldquo;I have an idea for an AI agent&rdquo; and &ldquo;it&apos;s running in production.&rdquo;</p>
              </DocSection>

              {/* Node Types */}
              <DocSection title="Node Types" accent="violet">
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { name: "Input", desc: "Entry point — accepts text, files, or JSON from the user" },
                    { name: "Agent Brain", desc: "Calls an LLM (GPT, Claude, Gemini, Groq) with your instructions" },
                    { name: "Router / Decision", desc: "N-way branch based on English conditions — routes data to different paths" },
                    { name: "Approval Gate", desc: "Pauses the flow for human review via chat — resume with 'approve'" },
                    { name: "Safety Gatekeeper", desc: "AI critic or human review before sensitive actions execute" },
                    { name: "App Action", desc: "Posts to Slack, GitHub, X, Notion, LinkedIn, Discord and more" },
                    { name: "Webhook", desc: "Accepts external HTTP triggers; exposes the flow as a REST endpoint" },
                    { name: "Smart Trigger", desc: "Cron-scheduled execution — runs your agent on a set schedule" },
                    { name: "ML Model", desc: "HuggingFace or Replicate inference — any model, text output" },
                    { name: "Image Gen", desc: "DALL-E 3 or Replicate — generates images from prompt text" },
                    { name: "RAG", desc: "Retrieval-augmented generation — searches a knowledge base with OpenAI embeddings" },
                    { name: "Speech", desc: "Whisper (STT) or ElevenLabs/OpenAI (TTS) — audio in/out" },
                    { name: "Data Analysis", desc: "Python + matplotlib in an E2B sandbox — produces charts as output" },
                    { name: "Browser Agent", desc: "Headless Chromium via E2B — screenshot, scrape, or run Python/JS remotely" },
                    { name: "Agent Loop", desc: "ReAct reasoning loop — LLM thinks, calls tools (web search, HTTP, calculate, JSON, datetime), iterates until done" },
                    { name: "Mobile Agent", desc: "Security isolation pipeline — each stage runs in a fully isolated E2B sandbox; only output passes forward, no state or secrets carry over" },
                    { name: "Parallel Map", desc: "Splits input into a list and runs your prompt on every item concurrently — configurable concurrency, separator, and output format" },
                    { name: "Subflow", desc: "Nests a saved agent as a reusable sub-pipeline inside any flow" },
                  ].map((n) => (
                    <div key={n.name} className="bg-muted/50 rounded-xl p-3 border border-border">
                      <p className="text-xs font-bold text-foreground">{n.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* Template Variables */}
              <DocSection title="Template Variables" accent="cyan">
                <p>Connect node outputs to downstream prompts using <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded text-[11px]">{"{{node-id}}"}</code> syntax.</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {[
                    { ex: "{{input-1}}", desc: "Full output of the Input node" },
                    { ex: "{{brain-2.output}}", desc: "Text output of Agent Brain node" },
                    { ex: "{{router-1.path}}", desc: "The path taken by a Router node" },
                  ].map((v) => (
                    <div key={v.ex} className="flex items-center gap-3">
                      <code className="text-[10px] font-mono text-cyan-400 bg-slate-900/60 px-2 py-0.5 rounded shrink-0">{v.ex}</code>
                      <span className="text-[10px] text-muted-foreground">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* LLM Providers */}
              <DocSection title="LLM Providers" accent="purple">
                <p>Add API keys to the <strong>Vault</strong> panel in the editor. The platform auto-detects provider from key prefix — no manual selection needed.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { p: "Groq", k: "GROQ_API_KEY", prefix: "gsk_…" },
                    { p: "OpenAI", k: "OPENAI_API_KEY", prefix: "sk-…" },
                    { p: "Anthropic", k: "ANTHROPIC_API_KEY", prefix: "sk-ant-…" },
                    { p: "Google Gemini", k: "GEMINI_API_KEY", prefix: "AIza…" },
                  ].map((lp) => (
                    <div key={lp.p} className="bg-muted/50 rounded-xl p-2.5 border border-border">
                      <p className="text-xs font-bold text-foreground">{lp.p}</p>
                      <code className="text-[9px] text-muted-foreground font-mono">{lp.k}</code>
                      <p className="text-[9px] text-slate-500 mt-0.5">Key prefix: <span className="text-purple-400">{lp.prefix}</span></p>
                    </div>
                  ))}
                </div>
              </DocSection>

              {/* Execution */}
              <DocSection title="How Execution Works" accent="emerald">
                <p>Clicking <strong>Run</strong> triggers a reactive topological executor. Independent branches run concurrently. Each node&apos;s output is stored in the execution context and can be referenced by any downstream node via template variables.</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <DocBullet>The executor resolves all upstream dependencies before running each node.</DocBullet>
                  <DocBullet>Approval Gate nodes pause the flow mid-execution and wait for chat input.</DocBullet>
                  <DocBullet>Router nodes evaluate English conditions and only activate the matching branch.</DocBullet>
                  <DocBullet>If any node outputs <code className="text-emerald-400 text-[9px]">EXIT</code>, all downstream nodes are skipped.</DocBullet>
                </div>
              </DocSection>

              {/* Deploying */}
              <DocSection title="Deploying & Calling Your Agent" accent="indigo">
                <p>Go to <strong>Publish</strong> → <strong>Deploy to Store</strong>. After deploy you get:</p>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="bg-muted/50 rounded-xl p-3 border border-border">
                    <p className="text-xs font-bold text-foreground mb-1">Webhook API</p>
                    <code className="text-[9px] font-mono text-indigo-400">POST /api/webhook/{"{flowId}"}</code>
                    <p className="text-[9px] text-muted-foreground mt-1">Body: <code className="text-indigo-300">{`{ "input": "your prompt" }`}</code></p>
                    <p className="text-[9px] text-muted-foreground">Response: <code className="text-indigo-300">{`{ "success": true, "output": "...", "durationMs": 1200, "costUsd": 0.002 }`}</code></p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 border border-border">
                    <p className="text-xs font-bold text-foreground mb-1">MCP Server</p>
                    <code className="text-[9px] font-mono text-violet-400">GET /api/mcp</code>
                    <p className="text-[9px] text-muted-foreground mt-1">Every deployed public flow is auto-exposed as an MCP tool. Add <code className="text-violet-300">/api/mcp</code> as an MCP server in Claude Desktop to call your agents from Claude directly.</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 border border-border">
                    <p className="text-xs font-bold text-foreground mb-1">Schedule with Cron</p>
                    <p className="text-[9px] text-muted-foreground">Use <span className="text-indigo-400 font-semibold">cron-job.org</span> or <span className="text-indigo-400 font-semibold">EasyCron</span>: create a job, paste the webhook URL, set method POST, add JSON body, pick a schedule. No server needed.</p>
                  </div>
                </div>
              </DocSection>

              {/* App Integrations */}
              <DocSection title="App Integrations" accent="violet">
                <p>Connect apps in <strong>Dashboard → Integrations</strong>. Tokens are stored encrypted and never exposed to the browser after saving. The App Action node reads them automatically at runtime.</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["X (Twitter)", "Slack", "Discord", "GitHub", "Notion", "Instagram", "LinkedIn", "Medium", "YouTube", "Reddit", "Email (SMTP)", "Browser Agent"].map((app) => (
                    <span key={app} className="text-[9px] px-2 py-0.5 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 font-semibold">{app}</span>
                  ))}
                </div>
              </DocSection>

              {/* Advanced */}
              <DocSection title="Advanced Features" accent="sky">
                <div className="flex flex-col gap-2">
                  {[
                    { name: "AI Architect", desc: "Describe a workflow in plain English and the AI auto-generates a validated flow graph — click the wand icon in the toolbar." },
                    { name: "Real-time Collaboration", desc: "Multiple users can edit the same flow simultaneously. Live cursors, presence indicators, and automatic sync via Liveblocks." },
                    { name: "Version Snapshots", desc: "Save named versions of any flow. Up to 20 snapshots per flow — restore any previous state from the toolbar." },
                    { name: "Mirror Mode", desc: "Compile your flow to code and run it in a preview sandbox. HTTP calls print draft payloads instead of sending real requests." },
                    { name: "Agent Loop", desc: "ReAct reasoning loop with 6 built-in tools: web_search, http_get, calculate, extract_json, think, and get_datetime. The LLM reasons and calls tools iteratively until it reaches a final answer." },
                    { name: "Mobile Agent", desc: "Security isolation pipeline across E2B sandboxes. Each stage is a fully isolated container — only the text output of one stage is passed to the next. No shared state, secrets, or side-effects between stages." },
                    { name: "Parallel Map", desc: "Map a prompt over every item in a list concurrently. Splits input by newline, comma, JSON array, or sentence — runs up to 10 LLM calls simultaneously and collects results as a numbered list, JSON array, or concatenated text." },
                  ].map((f) => (
                    <div key={f.name} className="bg-muted/50 rounded-xl p-3 border border-border">
                      <p className="text-xs font-bold text-foreground">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </DocSection>

            </div>
          )}

          {/* ACCOUNT TAB */}
          {activeTab === "account" && (
            <div className="max-w-md flex flex-col gap-4">
              {/* User card */}
              <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-black text-indigo-400">{userInitials}</span>
                </div>
                <div className="min-w-0">
                  {userName && <p className="text-sm font-bold text-foreground truncate">{userName}</p>}
                  <p className="text-xs text-muted-foreground truncate">{userEmail ?? "Loading..."}</p>
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                    Active session
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                <button
                  onClick={handleSwitchAccount}
                  disabled={signingOut}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 text-left"
                >
                  <RefreshCw size={15} className="text-indigo-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Switch Account</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sign out and log in as a different user</p>
                  </div>
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm font-semibold hover:bg-rose-500/5 transition-colors disabled:opacity-50 text-left group"
                >
                  <LogOut size={15} className="text-rose-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-rose-400">
                      {signingOut ? "Signing out..." : "Sign Out"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">End your current session</p>
                  </div>
                </button>
              </div>

              {/* Stats summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-indigo-400">{totalFlows}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Flows</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 text-center">
                  <p className="text-2xl font-black text-cyan-400">{vaultEntries.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Vault Keys</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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

const accentMap: Record<string, string> = {
  indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400",
  violet: "border-violet-500/20 bg-violet-500/5 text-violet-400",
  cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-400",
  purple: "border-purple-500/20 bg-purple-500/5 text-purple-400",
  emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  sky: "border-sky-500/20 bg-sky-500/5 text-sky-400",
};

function DocSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border p-5", accentMap[accent] || accentMap.indigo)}>
      <h2 className="text-sm font-black uppercase tracking-wider mb-3">{title}</h2>
      <div className="text-[11px] text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function DocBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-emerald-500 mt-0.5 shrink-0">›</span>
      <span>{children}</span>
    </div>
  );
}
