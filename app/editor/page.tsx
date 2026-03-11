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
  Terminal
} from "lucide-react";

import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import MissionBriefing from "@/components/ui/tutorial/MissionBriefing";
import ResponseGallery from "@/components/flow/ResponseGallery";
import ApprovalBanner from "@/components/flow/ApprovalBanner";

import { useFlowStore, isAwaitingApproval } from "@/stores/flowStore";
import { getSnapshots, saveSnapshot, deleteSnapshot, FlowSnapshot } from "@/lib/versionSnapshots";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "reactflow";

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
    setFinalResult,
    showMinimap,
    setShowMinimap,
    theme,
    setTheme,
    tutorialStep,
    setTutorialStep,
    completeTutorial,
    running
  } = useFlowStore();

  const [mounted, setMounted] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [snapshots, setSnapshots] = useState<FlowSnapshot[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);

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
    if (tutorialStep === 6 && finalResult) {
      setTutorialStep(7);
    }
  }, [finalResult, tutorialStep, setTutorialStep]);

  // Show terminal when running
  useEffect(() => {
    if (running) setShowTerminal(true);
  }, [running]);

  // Poll for approval state (flash safety alert)
  useEffect(() => {
    if (!running) { setIsPaused(false); return; }
    const interval = setInterval(() => {
      setIsPaused(isAwaitingApproval());
    }, 200);
    return () => clearInterval(interval);
  }, [running]);

  // Close version menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(e.target as Node)) {
        setShowVersionMenu(false);
      }
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
            Production Environment
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <HeaderButton onClick={() => setShowMinimap(!showMinimap)} icon={<Map size={14} />} active={showMinimap} />
          </div>

          {/* VERSION HISTORY */}
          <div className="relative" ref={versionRef}>
            <button
              onClick={handleOpenVersionMenu}
              className={cn(
                "p-2.5 rounded-xl border transition-all shadow-sm",
                showVersionMenu
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400"
              )}
              title="Version History"
            >
              <Clock size={16} />
            </button>

            {showVersionMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-1 duration-150">
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

          <div className="flex items-center gap-2 ml-2">
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
                Publish & Export
            </button>
          </div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-slate-500 dark:text-slate-400 shadow-sm"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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
                <NodeSidebar />
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

          {/* HELP FAB: Bottom Right of Canvas */}
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

interface HeaderButtonProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  active?: boolean;
  variant?: "primary" | "ghost";
  flash?: boolean;
}

function HeaderButton({ icon, label, onClick, active, variant = "ghost", flash }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap relative",
        variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20",
        variant === "ghost" && !active && "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800",
        active && variant === "ghost" && "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm",
        flash && "!text-amber-400 animate-pulse ring-2 ring-amber-500/40 !bg-amber-500/10"
      )}
    >
      {icon}
      {label && <span>{label}</span>}
      {flash && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />}
    </button>
  );
}
