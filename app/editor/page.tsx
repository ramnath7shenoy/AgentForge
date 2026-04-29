"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Map,
  Moon,
  Sun,
  X,
  Zap,
  Rocket,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  Terminal,
  Share2,
  Check,
  LogIn,
  Eye,
  Pencil,
  LayoutTemplate,
  BookOpen,
  LogOut,
  Globe,
  Lock,
  Sparkles,
  History
} from "lucide-react";

import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import MissionBriefing from "@/components/ui/tutorial/MissionBriefing";
import ResponseGallery from "@/components/flow/ResponseGallery";
import ApprovalBanner from "@/components/flow/ApprovalBanner";
import ChatHub from "@/components/flow/chat/ChatHub";

import { useFlowStore, isAwaitingApproval } from "@/stores/flowStore";
import { saveFlow, getLatestFlow, publishFlow } from "@/app/actions/flow";
import { generateWorkflow } from "@/app/actions/ai-architect";
import type { ArchitectProvider } from "@/app/actions/ai-architect";
import AIArchitectModal from "@/components/flow/AIArchitectModal";
import { FLOW_TEMPLATES } from "@/lib/constants/templates";
import { getSnapshots, saveSnapshot, deleteSnapshot, FlowSnapshot } from "@/lib/versionSnapshots";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactFlowProvider } from "reactflow";
import { createClient } from "@/lib/supabase/client";
import { getProjects } from "@/app/actions/project";

const LS_GUEST_FLOW_KEY = "agentforge_guest_flow";

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  const flowIdParam = searchParams.get("id");

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedNodeId,
    simulateFlow,
    finalResult,
    showMinimap,
    setShowMinimap,
    theme,
    setTheme,
    tutorialStep,
    setTutorialStep,
    completeTutorial,
    runClientFlow,
    running: isRunning,
    clearCanvas,
    undo,
    past,
    activeProject,
    setActiveProject,
    projects,
    setProjects
  } = useFlowStore();

  const [mounted, setMounted] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  // Menus & Refs
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [snapshots, setSnapshots] = useState<FlowSnapshot[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "">("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Auth & Sharing States
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentFlowId, setCurrentFlowId] = useState<string | undefined>(undefined);
  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "copied" | "private_copied">("idle");
  const [isPublic, setIsPublic] = useState(false);
  const [publicEditable, setPublicEditable] = useState(false);
  const [flowName, setFlowName] = useState("Untitled Agent");

  // Agent Configuration States
  const [showAIModal, setShowAIModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get auth user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setUser(user ?? null);
    });
    // Listen for auth changes (e.g. login in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  // Initial Fetch on Load
  useEffect(() => {
    async function fetchInitialFlow() {
      // If navigating via New Agent (has projectId but no flow id), start blank canvas
      if (projectIdParam && !flowIdParam) {
        setNodes([]);
        setEdges([]);
        setCurrentFlowId(undefined);
        setIsPublic(false);
        setPublicEditable(false);
        setFlowName("Untitled Agent");
        setHasHydrated(true);
        return;
      }

      const result = await getLatestFlow();

      if (result.success && result.flow) {
        // Hydrate from DB
        const dbNodes = typeof result.flow.nodes === "string" ? JSON.parse(result.flow.nodes) : result.flow.nodes;
        const dbEdges = typeof result.flow.edges === "string" ? JSON.parse(result.flow.edges) : result.flow.edges;
        if (Array.isArray(dbNodes) && dbNodes.length > 0) setNodes(dbNodes);
        if (Array.isArray(dbEdges) && dbEdges.length > 0) setEdges(dbEdges);
        setCurrentFlowId(result.flow.id);
        setIsPublic(result.flow.isPublic ?? false);
        setPublicEditable(result.flow.publicEditable ?? false);
        setFlowName(result.flow.name || "Untitled Agent");
      } else {
        // Guest: load from localStorage
        try {
          const raw = localStorage.getItem(LS_GUEST_FLOW_KEY);
          if (raw) {
            const { nodes: lsNodes, edges: lsEdges } = JSON.parse(raw);
            if (Array.isArray(lsNodes) && lsNodes.length > 0) setNodes(lsNodes);
            if (Array.isArray(lsEdges)) setEdges(lsEdges);
          }
        } catch { /* ignore */ }
      }
      setHasHydrated(true);
    }
    fetchInitialFlow();
  }, [setNodes, setEdges, projectIdParam, flowIdParam]);

  // Fetch projects list
  useEffect(() => {
    if (userId) {
      getProjects().then((res) => {
        if (res.projects) {
          setProjects(res.projects);
        }
      });
    }
  }, [userId, setProjects]);

  // Project ID syncing matching user requested snippet
  useEffect(() => {
    if (projectIdParam && projects.length > 0) {
      const matchedProject = projects.find(p => p.id === projectIdParam);
      if (matchedProject) {
        setActiveProject(matchedProject);
        console.log("Auto-selected project:", matchedProject.name);
      }
    }
  }, [projectIdParam, projects, setActiveProject]);

  // Migrate guest localStorage flow to DB on login
  useEffect(() => {
    if (!userId || !hasHydrated) return;
    const raw = localStorage.getItem(LS_GUEST_FLOW_KEY);
    if (!raw) return;

    try {
      const { nodes: lsNodes, edges: lsEdges } = JSON.parse(raw);
      if (Array.isArray(lsNodes) && lsNodes.length > 0) {
        saveFlow(userId, "Migrated Flow", JSON.stringify(lsNodes), JSON.stringify(lsEdges), undefined, false, false, activeProject?.id).then((res) => {
          if (res.success) {
            localStorage.removeItem(LS_GUEST_FLOW_KEY);
            if (res.flow) {
              setCurrentFlowId(res.flow.id);
              setNodes(typeof res.flow.nodes === "string" ? JSON.parse(res.flow.nodes) : (res.flow.nodes as any[]));
              setEdges(typeof res.flow.edges === "string" ? JSON.parse(res.flow.edges) : (res.flow.edges as any[]));
            }
          }
        });
      }
    } catch { /* ignore */ }
  }, [userId, hasHydrated, setNodes, setEdges]);

  // Auto-save logic
  useEffect(() => {
    if (!mounted || !hasHydrated) return;

    setSaveStatus("saving");
    const timeoutId = setTimeout(async () => {
      try {
        if (userId) {
          console.log("Attempting to save flow for project:", activeProject?.id);
          const serializedNodes = JSON.stringify(nodes);
          const serializedEdges = JSON.stringify(edges);
          const result = await saveFlow(userId, "My Flow", serializedNodes, serializedEdges, currentFlowId, isPublic, publicEditable, activeProject?.id);
          if (result.success) {
            setSaveStatus("saved");
            setSaveError(null);
            if (result.flow && !currentFlowId) setCurrentFlowId(result.flow.id);
          } else {
            console.error("FRONTEND_SAVE_ERROR:", result.error);
            setSaveStatus("error");
            setSaveError(result.error || "Failed to save flow");
          }
        } else {
          localStorage.setItem(LS_GUEST_FLOW_KEY, JSON.stringify({ nodes, edges }));
          setSaveStatus("saved");
        }
      } catch (e: any) {
        console.error("FRONTEND_SAVE_ERROR:", e);
        setSaveStatus("error");
        setSaveError(e?.message || "Unknown client error");
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, mounted, hasHydrated, userId, currentFlowId, isPublic, publicEditable]);

  useEffect(() => {
    setMounted(true);
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const hasSeenTutorial = localStorage.getItem('agentforge_onboarding_complete');
    if (!hasSeenTutorial && tutorialStep === 0) {
      setTutorialStep(1);
    }
  }, [theme, setTutorialStep, tutorialStep]);

  useEffect(() => {
    if (tutorialStep === 6 && finalResult) setTutorialStep(7);
  }, [finalResult, tutorialStep, setTutorialStep]);

  // Terminal surfaces only when an output node fires (finalResult is set),
  // not while the walker is merely running. This decouples the terminal
  // visibility from execution state so chat can work without it.
  useEffect(() => {
    if (finalResult) setShowTerminal(true);
  }, [finalResult]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => isAwaitingApproval(), 200);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Click outside handler for menus
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(e.target as Node)) setShowVersionMenu(false);
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) setShowShareMenu(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!mounted) return null;

  const startNodeId = Array.isArray(nodes) && nodes.length > 0 ? nodes[0].id : "";

  const handleSaveSnapshot = () => {
    const name = `v${snapshots.length + 1} — ${new Date().toLocaleTimeString()}`;
    const snap = saveSnapshot(name, nodes, edges);
    setSnapshots(prev => [snap, ...prev].slice(0, 10));
  };

  const handleRestoreSnapshot = (snap: FlowSnapshot) => {
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setShowVersionMenu(false);
  };

  const handleOpenVersionMenu = () => {
    setSnapshots(getSnapshots());
    setShowVersionMenu(!showVersionMenu);
  };

  const handleShare = async () => {
    if (!currentFlowId && userId) return;
    setShareStatus("sharing");
    try {
      let shareId = currentFlowId;

      if (!userId) {
        // Guest mode - create a new public flow
        const serializedNodes = JSON.stringify(nodes);
        const serializedEdges = JSON.stringify(edges);
        const result = await saveFlow(null, "Guest Shared Flow", serializedNodes, serializedEdges, undefined, true, publicEditable, activeProject?.id);
        if (result.success && result.flow) {
          shareId = result.flow.id;
        } else {
          throw new Error("Failed to save guest flow");
        }
      } else if (shareId) {
        // Logged-in user: publish existing immediately for share link
        const result = await publishFlow(shareId, publicEditable);
        if (!result.success) throw new Error("Failed to publish flow");
      }

      if (shareId) {
        const url = `${window.location.origin}/view/${shareId}`;
        await navigator.clipboard.writeText(url);

        // Check Privacy Gate Logic
        if (!isPublic && userId) {
          setShareStatus("private_copied");
        } else {
          setShareStatus("copied");
        }

        setTimeout(() => setShareStatus("idle"), 3000);
      }
    } catch {
      setShareStatus("idle");
    }
  };

  const handleClearCanvas = async () => {
    if (confirm("Are you sure you want to clear the entire canvas? This cannot be undone.")) {
      clearCanvas();
      if (userId && currentFlowId) {
        setSaveStatus("saving");
        const result = await saveFlow(userId, "My Flow", "[]", "[]", currentFlowId, isPublic, publicEditable, activeProject?.id);
        if (result.success) setSaveStatus("saved");
        else setSaveStatus("error");
      } else if (!userId) {
        localStorage.setItem(LS_GUEST_FLOW_KEY, JSON.stringify({ nodes: [], edges: [] }));
        setSaveStatus("saved");
      }
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = FLOW_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    if (nodes.length > 0) {
      const ok = confirm(`Loading "${template.name}" will replace your current canvas. Continue?`);
      if (!ok) return;
    }

    setNodes(template.nodes as any);
    setEdges(template.edges as any);
    setShowTemplateModal(false);

    setTimeout(async () => {
      if (userId) {
        setSaveStatus("saving");
        const result = await saveFlow(userId, template.name, JSON.stringify(template.nodes), JSON.stringify(template.edges), currentFlowId, isPublic, publicEditable, activeProject?.id);
        if (result.success) {
          setSaveStatus("saved");
          if (result.flow && !currentFlowId) setCurrentFlowId(result.flow.id);
        } else setSaveStatus("error");
      } else {
        localStorage.setItem(LS_GUEST_FLOW_KEY, JSON.stringify({ nodes: template.nodes, edges: template.edges }));
        setSaveStatus("saved");
      }
    }, 100);
  };

  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const handleGenerateAI = async (prompt: string, pastedKey: string, provider: ArchitectProvider) => {
    const vaultStore = (await import("@/stores/vaultStore")).useVaultStore.getState();

    const providerVaultKeys: Record<ArchitectProvider, string[]> = {
      gemini: ["GEMINI_API_KEY", "API_KEY"],
      groq:   ["GROQ_API_KEY",   "API_KEY"],
      openai: ["OPENAI_API_KEY", "API_KEY"],
    };

    // JIT: explicit paste takes priority, then vault lookup
    let jitKey: string | null = pastedKey.trim() || null;
    if (!jitKey) {
      for (const keyName of providerVaultKeys[provider]) {
        const entry = vaultStore.entries.find((e: any) => e.key === keyName);
        if (entry?.value) { jitKey = entry.value; break; }
      }
    }

    if (!jitKey) {
      alert(`Please paste an API key or add ${providerVaultKeys[provider][0]} to the Vault.`);
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateWorkflow({ prompt, provider, decryptedKey: jitKey });
      if (result.success && result.data?.nodes) {
        setNodes(result.data.nodes);
        setEdges(result.data.edges);
      } else {
        alert(result.error || "Failed to generate workflow via AI.");
      }
    } finally {
      jitKey = null;
      setIsGenerating(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-screen w-full transition-colors duration-300",
      theme === "dark" ? "dark bg-background text-foreground" : "bg-background text-foreground"
    )}>

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-background/40 backdrop-blur-xl z-50 shadow-sm relative">

        {/* ── LEFT SECTION ── */}
        <div className="flex items-center gap-2">

          {/* Logo */}
          <div className="flex items-center gap-2 pr-3">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap size={12} className="text-white fill-current" />
            </div>
            <span className="font-bold tracking-tighter text-indigo-500 text-sm">AGENTFORGE</span>
          </div>
        </div>

        {/* ── RIGHT SECTION ── */}
        <div className="flex items-center gap-2">

          {/* Status Badges */}
          <div className="flex items-center gap-2 pr-2">
            {userId ? (
              <span className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold transition-colors",
                saveStatus === "saved" 
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" 
                  : (saveStatus === "error" ? "border-rose-500/30 bg-rose-500/5 text-rose-400" : "border-indigo-500/30 bg-indigo-500/5 text-indigo-400")
              )}>
                <Globe size={10} />
                Cloud Synced
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/5 text-[10px] font-bold text-amber-500">
                <Lock size={10} />
                Guest Mode
              </span>
            )}

            {saveStatus && (
              <span 
                className={cn(
                  "text-[10px] font-medium cursor-help",
                  saveStatus === "error" ? "text-rose-400 animate-pulse underline decoration-dashed" : "text-slate-500"
                )}
                title={saveStatus === "error" ? (saveError || "Error saving flow") : "Save Status"}
              >
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Error"}
              </span>
            )}
          </div>

          {/* ── GLASSMORPHISM PILL ── */}
          <div className="flex items-center gap-0.5 backdrop-blur-md bg-slate-900/30 border border-white/10 rounded-full px-2 py-1">

            {/* Undo */}
            <button
              onClick={undo}
              disabled={past.length === 0}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                past.length > 0
                  ? "text-slate-400 hover:text-indigo-400"
                  : "text-slate-700 cursor-not-allowed"
              )}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={15} />
            </button>

            {/* Minimap Toggle */}
            <button
              onClick={() => setShowMinimap(!showMinimap)}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                showMinimap
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-indigo-400"
              )}
              title="Toggle Minimap"
            >
              <Map size={15} />
            </button>

            {/* Snapshot (Camera) */}
            <div className="relative" ref={versionRef}>
              <button
                onClick={handleOpenVersionMenu}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  showVersionMenu
                    ? "text-indigo-400"
                    : "text-slate-400 hover:text-indigo-400"
                )}
                title="Snapshots"
              >
                <History size={15} />
              </button>

              {showVersionMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Snapshots</span>
                    <button
                      onClick={handleSaveSnapshot}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      + Save Now
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {snapshots.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[10px] text-slate-500 italic">
                        No snapshots yet
                      </div>
                    ) : (
                      snapshots.map((snap) => (
                        <div
                          key={snap.id}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors group cursor-pointer border-b border-slate-800 last:border-0"
                        >
                          <div onClick={() => handleRestoreSnapshot(snap)} className="flex-1 flex flex-col">
                            <span className="text-xs font-medium text-slate-300">{snap.name}</span>
                            <span className="text-[9px] text-slate-400">{formatTs(snap.timestamp)} · {snap.nodes.length} nodes</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleRestoreSnapshot(snap)}
                              className="p-1 text-indigo-400 hover:text-indigo-300"
                              title="Restore"
                            >
                              <RotateCcw size={12} />
                            </button>
                            <button
                              onClick={() => { deleteSnapshot(snap.id); setSnapshots(prev => prev.filter(s => s.id !== snap.id)); }}
                              className="p-1 text-slate-500 hover:text-rose-400"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>

          {/* Vertical separator */}
          <div className="h-5 w-[1px] bg-white/10" />

          {/* Templates button */}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all border border-white/10"
            title="Load a Template"
          >
            <LayoutTemplate size={13} />
            Templates
          </button>

          {/* Agent Configuration (Magic Wand) — breathing glow */}
          <motion.button
            onClick={() => setShowAIModal(true)}
            animate={{
              boxShadow: [
                "0 0 5px rgba(139, 92, 246, 0.2)",
                "0 0 15px rgba(139, 92, 246, 0.5)",
                "0 0 5px rgba(139, 92, 246, 0.2)"
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border group",
              nodes.length === 0
                ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                : "bg-violet-600/10 hover:bg-violet-600/30 border-violet-500/20 text-violet-400 hover:text-white"
            )}
            title="Agent Configuration"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Sparkles size={13} className="group-hover:rotate-12 transition-transform" />
            </motion.div>
            AI Build
          </motion.button>

          {/* Run Flow */}
          <button
            onClick={() => runClientFlow("Initial Input")}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
              isRunning ? "opacity-75 cursor-wait bg-indigo-500" : (
                tutorialStep === 6
                  ? "bg-gradient-to-br from-indigo-600 to-violet-700 text-white ring-4 ring-indigo-500/40 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_20px_rgba(99,102,241,0.5)] z-10"
                  : "bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white shadow-lg shadow-indigo-500/20"
              )
            )}
          >
            {isRunning ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Running...</span>
              </div>
            ) : (
              <>
                <Play size={13} className="fill-current" />
                Run Flow
              </>
            )}
          </button>

          {/* Publish */}
          <button
            onClick={() => {
              completeTutorial();
              router.push('/publish');
            }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 transition-all rounded-lg text-xs font-bold active:scale-95",
              (tutorialStep === 7 && finalResult)
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-4 ring-emerald-500/40 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10"
                : "bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20"
            )}
          >
            <Rocket size={13} />
            Publish
          </button>

          {/* 5. SHARE MENU */}
          <div className="relative" ref={shareMenuRef}>
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md",
                showShareMenu
                  ? "bg-violet-700 text-white shadow-violet-500/30"
                  : "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20"
              )}
              title="Share or Collaborate"
            >
              <Share2 size={14} />
              Share
            </button>

            {showShareMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150 p-4 flex flex-col gap-3">

                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Share & Privacy</h3>
                  <button onClick={() => setShowShareMenu(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X size={12} />
                  </button>
                </div>

                {userId && (
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col">
                      <p className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        {isPublic ? <Globe size={12} className="text-emerald-500" /> : <Lock size={12} className="text-slate-500" />}
                        Public Access
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Allow anyone with link to view.</p>
                    </div>
                    <button
                      onClick={() => setIsPublic(!isPublic)}
                      className={cn(
                        "w-8 h-4 rounded-full transition-colors relative outline-none border border-transparent focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500",
                        isPublic ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                      )}
                    >
                      <div className={cn("absolute top-[1px] w-[12px] h-[12px] bg-white rounded-full transition-all duration-200", isPublic ? "left-[18px]" : "left-[2px]")} />
                    </button>
                  </div>
                )}

                {/* Permission toggle */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Editor Permissions</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPublicEditable(false)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all justify-center",
                        !publicEditable
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-500 dark:text-indigo-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <Eye size={12} /> View Only
                    </button>
                    <button
                      onClick={() => setPublicEditable(true)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all justify-center",
                        publicEditable
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      )}
                    >
                      <Pencil size={12} /> Can Edit
                    </button>
                  </div>
                </div>

                {/* Copy link button */}
                <div className="flex flex-col gap-2 mt-1">
                  <button
                    onClick={handleShare}
                    disabled={shareStatus === "sharing"}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-bold transition-all justify-center w-full",
                      (shareStatus === "copied" || shareStatus === "private_copied")
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : shareStatus === "sharing"
                          ? "opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-500"
                          : "bg-indigo-600 border-transparent text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                    )}
                  >
                    {(shareStatus === "copied" || shareStatus === "private_copied")
                      ? <><Check size={14} /> {shareStatus === "private_copied" ? "Copied! (Private)" : "Link Copied!"}</>
                      : shareStatus === "sharing"
                        ? "Generating link..."
                        : <><Share2 size={14} /> Copy Link</>}
                  </button>

                  {shareStatus === "private_copied" && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-tight text-center bg-amber-50 dark:bg-amber-500/10 p-1.5 rounded-md border border-amber-200 dark:border-amber-500/20">
                      ⚠️ Link copied, but access is <strong>Private</strong>. Others won't be able to view it until you toggle to Public.
                    </p>
                  )}
                </div>

                {!userId && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-violet-500 dark:text-violet-400">Collaborate in Real-Time</h3>
                    <p className="text-[10px] text-slate-500">Sign in to sync & collaborate with a team.</p>
                    <button
                      onClick={() => router.push("/login?message=collaborate")}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 text-xs font-bold transition-all justify-center w-full"
                    >
                      <LogIn size={14} />
                      Sign In to Collaborate
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* 6. ACCOUNT UI DROPDOWN */}
          <div className="relative" ref={profileMenuRef}>
            {user ? (
              <>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold border border-indigo-400 transition-colors shadow-lg shadow-indigo-500/20 outline-none"
                  title={user.email}
                >
                  {user.email?.[0].toUpperCase() || "U"}
                </button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl shadow-xl z-[100] overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Logged in as</p>
                        <p className="text-xs text-slate-700 dark:text-slate-200 truncate mt-0.5 font-medium">{user.email}</p>
                      </div>

                      <div className="py-1">
                        <a
                          href="https://github.com/ramnath7shenoy/AgentForge/blob/main/README.md"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <BookOpen size={14} className="text-indigo-500 dark:text-indigo-400" /> Documentation
                        </a>

                        <button
                          onClick={async () => {
                            const supabase = createClient();
                            await supabase.auth.signOut();
                            window.location.href = "/";
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 w-full text-left transition-colors"
                        >
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="text-xs font-bold px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity shadow-md"
              >
                Sign In
              </button>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* LEFT SIDEBAR TOGGLE */}
        <button
          onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-50 p-2 rounded-full border transition-all shadow-lg backdrop-blur-sm",
            "bg-slate-800/80 border-slate-700/50 text-white hover:bg-slate-700",
            isLeftSidebarOpen ? "left-[252px]" : "left-2"
          )}
          title={isLeftSidebarOpen ? "Collapse Nodes" : "Expand Nodes"}
        >
          {isLeftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* LEFT SIDEBAR */}
        <AnimatePresence initial={false}>
          {isLeftSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden border-r border-border bg-card flex-shrink-0"
            >
              <div className="w-64 h-full">
                <NodeSidebar onClearCanvas={handleClearCanvas} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* CANVAS */}
        <main className="flex-1 relative bg-background">
          <FlowCanvas setSelectedNodeId={setSelectedNodeId} />

          {/* SHIMMER OVERLAY (Generating AI) */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[45] pointer-events-none"
              >
                <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[2px]" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent skew-x-12"
                  animate={{
                    x: ["-100%", "200%"],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-slate-900/80 backdrop-blur-md border border-indigo-500/30 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                    <Sparkles className="text-indigo-400 animate-pulse" size={20} />
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest animate-pulse">Architecting Agent Intelligence...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* APPROVAL BANNER */}
          <ApprovalBanner />

          {/* LIVE TERMINAL (bottom of canvas) */}
          <AnimatePresence>
            {showTerminal && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 220, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute bottom-0 left-0 right-0 z-40"
              >
                <div className="relative h-full">
                  <button
                    onClick={() => setShowTerminal(false)}
                    className="absolute -top-3 right-4 z-50 p-1 bg-slate-900 border border-slate-700 rounded-full text-slate-400 hover:text-white transition-colors shadow-lg"
                  >
                    <X size={12} />
                  </button>
                  <ResponseGallery />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Terminal Toggle (if hidden) */}
          {!showTerminal && (
            <button
              onClick={() => setShowTerminal(true)}
              className="absolute bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all shadow-lg uppercase tracking-wider"
            >
              <Terminal size={12} />
              Terminal
            </button>
          )}

          {/* HELP FAB */}
          <button
            onClick={() => {
              localStorage.removeItem('agentforge_onboarding_complete');
              setTutorialStep(1);
            }}
            className="fixed bottom-6 right-6 z-[50] bg-slate-800/50 backdrop-blur-md p-3 rounded-full border border-slate-700 text-slate-400 hover:text-indigo-400 transition-all shadow-2xl group active:scale-95"
            title="Restart Mission"
          >
            <HelpCircle size={20} className="group-hover:rotate-12 transition-transform" />
          </button>

          {/* CHAT HUB */}
          <ChatHub />
        </main>

        {/* RIGHT SIDEBAR TOGGLE */}
        <button
          onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-50 p-2 rounded-full border transition-all shadow-lg backdrop-blur-sm",
            "bg-slate-800/80 border-slate-700/50 text-white hover:bg-slate-700",
            isRightSidebarOpen ? "right-[308px]" : "right-2"
          )}
          title={isRightSidebarOpen ? "Collapse Settings" : "Expand Settings"}
        >
          {isRightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* RIGHT SIDEBAR */}
        <AnimatePresence initial={false}>
          {isRightSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden border-l border-border bg-card flex-shrink-0"
            >
              <div className="w-80 h-full overflow-y-auto">
                <NodeSettingsSidebar />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>

      {/* TEMPLATE MODAL */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            onClick={() => setShowTemplateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <div>
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-indigo-400" />
                    Choose a Template
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Load a pre-built flow to get started quickly.</p>
                </div>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Template Grid */}
              <div className="p-6 grid grid-cols-1 gap-3">
                {FLOW_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-indigo-500/40 hover:bg-slate-800/50 transition-all group cursor-pointer"
                    onClick={() => handleLoadTemplate(template.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 bg-indigo-600/15 border border-indigo-500/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {template.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {template.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 max-w-md">{template.description}</p>
                        <p className="text-[10px] text-slate-600 mt-1 font-mono">
                          {template.nodes.length} nodes · {template.edges.length} edges
                        </p>
                      </div>
                    </div>
                    <button
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex-shrink-0 ml-4 shadow-lg shadow-indigo-500/20"
                      onClick={(e) => { e.stopPropagation(); handleLoadTemplate(template.id); }}
                    >
                      Load
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AGENT CONFIGURATION MODAL */}
      <AIArchitectModal
        open={showAIModal}
        onClose={() => setShowAIModal(false)}
        onSubmit={handleGenerateAI}
      />

      <MissionBriefing />
    </div>
  );
}

export default function EditorPage({ searchParams }: { searchParams: { projectId?: string } }) {
  return (
    <ReactFlowProvider>
      <Suspense fallback={<div className="h-screen w-screen bg-black flex items-center justify-center text-white">Loading Editor...</div>}>
        <EditorContent />
      </Suspense>
    </ReactFlowProvider>
  );
}