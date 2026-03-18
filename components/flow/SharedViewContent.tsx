"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Map,
  Moon,
  Sun,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Eye,
  Pencil,
  Lock
} from "lucide-react";

import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import ResponseGallery from "@/components/flow/ResponseGallery";
import ApprovalBanner from "@/components/flow/ApprovalBanner";

import { useFlowStore } from "@/stores/flowStore";
import { saveSharedFlow } from "@/app/actions/flow";
import { cn } from "@/lib/utils";
import { ReactFlowProvider } from "reactflow";

interface SharedViewContentProps {
  flow: any;
  editable: boolean;
}

function SharedEditor({ flow, editable }: SharedViewContentProps) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedNodeId,
    simulateFlow,
    showMinimap,
    setShowMinimap,
    theme,
    setTheme,
    running,
    clearCanvas
  } = useFlowStore();

  const [mounted, setMounted] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | "">("");
  const [hasHydrated, setHasHydrated] = useState(false);

  // Initial Hydration from the server-passed flow
  useEffect(() => {
    const dbNodes = typeof flow.nodes === "string" ? JSON.parse(flow.nodes) : flow.nodes;
    const dbEdges = typeof flow.edges === "string" ? JSON.parse(flow.edges) : flow.edges;
    if (Array.isArray(dbNodes)) setNodes(dbNodes);
    if (Array.isArray(dbEdges)) setEdges(dbEdges);
    setHasHydrated(true);
  }, [flow, setNodes, setEdges]);

  // Auto-save logic for shared editable flows
  useEffect(() => {
    if (!mounted || !hasHydrated || !editable) return;

    setSaveStatus("saving");
    const timeoutId = setTimeout(async () => {
      try {
        const result = await saveSharedFlow(flow.id, nodes, edges);
        if (result.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, mounted, hasHydrated, editable, flow.id]);

  useEffect(() => {
    setMounted(true);
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    if (running) setShowTerminal(true);
  }, [running]);

  if (!mounted) return null;

  const startNodeId = Array.isArray(nodes) && nodes.length > 0 ? nodes[0].id : "";

  const handleClearCanvas = () => {
    if (confirm("Are you sure you want to clear the entire canvas? This cannot be undone.")) {
      clearCanvas();
    }
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
          <span className="text-slate-400 text-sm font-medium truncate max-w-xs">{flow.name}</span>
          
          {editable ? (
            <span className="flex items-center gap-1.5 text-[10px] text-amber-400 uppercase tracking-widest font-bold px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <Pencil size={10} />
              Guest Editor
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-widest font-bold px-2 py-1 bg-slate-800 rounded-md">
              <Eye size={10} />
              Read Only
            </span>
          )}

          {editable && saveStatus && (
            <span className={cn(
              "text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md",
              saveStatus === "saving" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                saveStatus === "saved" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                  "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
            )}>
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved to Cloud" : "Save Error"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
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
          </div>

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all shadow-sm border border-transparent"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
              onClick={() => simulateFlow(startNodeId, flow.userId)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          >
              <Play size={14} className="fill-current" />
              Run Flow
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* LEFT SIDEBAR TOGGLE (Only if editable) */}
        {editable && (
          <button
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-50 p-2 rounded-full border transition-all shadow-lg backdrop-blur-sm",
              "bg-slate-800/80 border-slate-700/50 text-white hover:bg-slate-700",
              isLeftSidebarOpen ? "left-[252px]" : "left-2"
            )}
          >
            {isLeftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        )}

        {/* LEFT SIDEBAR (Only if editable) */}
        <AnimatePresence initial={false}>
          {editable && isLeftSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] flex-shrink-0"
            >
              <div className="w-64 h-full">
                <NodeSidebar onClearCanvas={handleClearCanvas} isOwner={false} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* CANVAS */}
        <main className="flex-1 relative bg-slate-50 dark:bg-[#0b0e14]">
          <FlowCanvas setSelectedNodeId={setSelectedNodeId} editable={editable} />

          {/* APPROVAL BANNER */}
          <ApprovalBanner />

          {/* LIVE TERMINAL */}
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

          {!showTerminal && (
            <button
              onClick={() => setShowTerminal(true)}
              className="absolute bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all shadow-lg uppercase tracking-wider"
            >
              <Terminal size={12} />
              Terminal
            </button>
          )}
        </main>

        {/* RIGHT SIDEBAR TOGGLE (Only if editable) */}
        {editable && (
          <button
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-50 p-2 rounded-full border transition-all shadow-lg backdrop-blur-sm",
              "bg-slate-800/80 border-slate-700/50 text-white hover:bg-slate-700",
              isRightSidebarOpen ? "right-[308px]" : "right-2"
            )}
          >
            {isRightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        )}

        {/* RIGHT SIDEBAR (Only if editable) */}
        <AnimatePresence initial={false}>
          {editable && isRightSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] flex-shrink-0"
            >
              <div className="w-80 h-full overflow-y-auto">
                <NodeSettingsSidebar isOwner={false} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default function SharedViewContent({ flow, editable }: SharedViewContentProps) {
  return (
    <ReactFlowProvider>
      <SharedEditor flow={flow} editable={editable} />
    </ReactFlowProvider>
  );
}
