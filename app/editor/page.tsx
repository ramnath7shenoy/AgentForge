"use client";

import { useEffect, useState, useRef } from "react";
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
  Clock,
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
  Lock
} from "lucide-react";

import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import MissionBriefing from "@/components/ui/tutorial/MissionBriefing";
import ResponseGallery from "@/components/flow/ResponseGallery";
import ApprovalBanner from "@/components/flow/ApprovalBanner";

import { useFlowStore, isAwaitingApproval } from "@/stores/flowStore";
import { saveFlow, getLatestFlow, publishFlow } from "@/app/actions/flow";
import { FLOW_TEMPLATES } from "@/lib/constants/templates";
import { getSnapshots, saveSnapshot, deleteSnapshot, FlowSnapshot } from "@/lib/versionSnapshots";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "reactflow";
import { createClient } from "@/lib/supabase/client";

const LS_GUEST_FLOW_KEY = "agentforge_guest_flow";

function EditorContent() {
  const router = useRouter();
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
    running,
    clearCanvas
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
  const [hasHydrated, setHasHydrated] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Auth & Sharing States
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentFlowId, setCurrentFlowId] = useState<string | undefined>(undefined);
  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "copied" | "private_copied">("idle");
  const [isPublic, setIsPublic] = useState(false);
  const [publicEditable, setPublicEditable] = useState(false);

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

  // Initial Fetch on Load
  useEffect(() => {
    async function fetchInitialFlow() {
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
  }, [setNodes, setEdges]);

  // Migrate guest localStorage flow to DB on login
  useEffect(() => {
    if (!userId || !hasHydrated) return;
    const raw = localStorage.getItem(LS_GUEST_FLOW_KEY);
    if (!raw) return;

    try {
      const { nodes: lsNodes, edges: lsEdges } = JSON.parse(raw);
      if (Array.isArray(lsNodes) && lsNodes.length > 0) {
        saveFlow(userId, "Migrated Flow", JSON.stringify(lsNodes), JSON.stringify(lsEdges)).then((res) => {
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
          const serializedNodes = JSON.stringify(nodes);
          const serializedEdges = JSON.stringify(edges);
          const result = await saveFlow(userId, "My Flow", serializedNodes, serializedEdges, currentFlowId, isPublic, publicEditable);
          if (result.success) {
            setSaveStatus("saved");
            if (result.flow && !currentFlowId) setCurrentFlowId(result.flow.id);
          } else {
            setSaveStatus("error");
          }
        } else {
          localStorage.setItem(LS_GUEST_FLOW_KEY, JSON.stringify({ nodes, edges }));
          setSaveStatus("saved");
        }
      } catch {
        setSaveStatus("error");
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

  useEffect(() => {
    if (running) setShowTerminal(true);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => isAwaitingApproval(), 200);
    return () => clearInterval(interval);
  }, [running]);

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
        const result = await saveFlow(null, "Guest Shared Flow", serializedNodes, serializedEdges, undefined, true, publicEditable);
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
        const result = await saveFlow(userId, "My Flow", "[]", "[]", currentFlowId, isPublic, publicEditable);
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
        const result = await saveFlow(userId, template.name, JSON.stringify(template.nodes), JSON.stringify(template.edges), currentFlowId, isPublic, publicEditable);
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

  return (
    <div className={cn(
      "flex flex-col h-screen w-full transition-colors duration-300",
      theme === "dark" ? "dark bg-[#0b0e14] text-slate-200" : "bg-slate-50 text-slate-900"
    )}>

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-3 bg-white dark:bg-[#0b0e14] z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap size={16} className="text-white fill-current" />
            </div>
            <span className="font-bold tracking-tight text-sm uppercase">AgentForge</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest hidden md:block">
            {userId ? "Cloud Mode" : "Guest Mode"}
          </span>
          {saveStatus && (
            <span className={cn(
              "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md",
              saveStatus === "saving" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                saveStatus === "saved" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                  "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            )}>
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? (userId ? "Saved to Cloud" : "Saved Locally") : "Save Error"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* UTILITY GROUP */}
          <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowMinimap(!showMinimap)}
              className={cn(
                "p-2 rounded-lg transition-all",
                showMinimap
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
              title="Toggle Minimap"
            >
              <Map size={14} />
            </button>

            {/* VERSION HISTORY / SNAPSHOTS */}
            <div className="relative" ref={versionRef}>
              <button
                onClick={handleOpenVersionMenu}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  showVersionMenu
                    ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                )}
                title="Version History"
              >
                <Clock size={16} />
              </button>

              {showVersionMenu && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
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
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <div onClick={() => handleRestoreSnapshot(snap)} className="flex-1 flex flex-col">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{snap.name}</span>
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
          </div>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* 1. TEMPLATES */}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all border border-transparent"
            title="Load a Template"
          >
            <LayoutTemplate size={14} />
            Templates
          </button>

          {/* 2. DARK MODE TOGGLE */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm border border-transparent"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* 3. RUN FLOW */}
          <button
            onClick={() => simulateFlow(startNodeId)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
              tutorialStep === 6
                ? "bg-indigo-600 hover:bg-indigo-500 text-white ring-4 ring-indigo-500/40 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_20px_rgba(99,102,241,0.5)] z-10"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            )}
          >
            <Play size={14} className="fill-current" />
            Run Flow
          </button>

          {/* 4. PUBLISH */}
          <button
            onClick={() => {
              completeTutorial();
              router.push('/publish');
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 transition-all rounded-xl text-xs font-bold",
              (tutorialStep === 7 && finalResult)
                ? "bg-emerald-500 hover:bg-emerald-400 text-white ring-4 ring-emerald-500/40 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            )}
          >
            <Rocket size={14} />
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
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150 p-4 flex flex-col gap-3">

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
                      className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-[100] overflow-hidden"
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
              className="overflow-hidden border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] flex-shrink-0"
            >
              <div className="w-64 h-full">
                <NodeSidebar onClearCanvas={handleClearCanvas} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* CANVAS */}
        <main className="flex-1 relative bg-slate-50 dark:bg-[#0b0e14]">
          <FlowCanvas setSelectedNodeId={setSelectedNodeId} />

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
            className="fixed bottom-6 right-6 z-50 bg-slate-800/50 backdrop-blur-md p-3 rounded-full border border-slate-700 text-slate-400 hover:text-indigo-400 transition-all shadow-2xl group active:scale-95"
            title="Restart Mission"
          >
            <HelpCircle size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
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
              className="overflow-hidden border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] flex-shrink-0"
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
              className="w-full max-w-2xl bg-[#0d1117] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
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

      <MissionBriefing />
    </div>
  );
}

export default function EditorPage() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  );
}