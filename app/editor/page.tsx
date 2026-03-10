"use client";

import { useEffect, useState } from "react";
import { 
  Play, 
  Map, 
  Terminal, 
  Variable, 
  Moon, 
  Sun,
  X,
  Zap,
  Rocket,
  HelpCircle
} from "lucide-react";

import FlowCanvas from "@/components/flow/canvas/FlowCanvas";
import NodeSidebar from "@/components/flow/sidebar/NodeSidebar";
import NodeSettingsSidebar from "@/components/flow/sidebar/NodeSettingsSidebar";
import ExecutionLogPanel from "@/components/flow/ExecutionLogPanel";
import VariableInspectorPanel from "@/components/flow/VariableInspectorPanel";
import MissionBriefing from "@/components/ui/tutorial/MissionBriefing";

import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "reactflow";

function EditorContent() {
  const router = useRouter();
  const {
    nodes,
    setSelectedNodeId,
    simulateFlow,
    finalResult,
    setFinalResult,
    showMinimap,
    setShowMinimap,
    showExecutionLogPanel,
    setShowExecutionLogPanel,
    showVariablesPanel,
    setShowVariablesPanel,
    theme,
    setTheme,
    tutorialStep,
    setTutorialStep,
    completeTutorial,
    running
  } = useFlowStore();

  const [mounted, setMounted] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

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
    // Advance tutorial if flow is run during step 6 (The Test)
    if (tutorialStep === 6 && finalResult) {
      setTutorialStep(7);
    }
  }, [finalResult, tutorialStep, setTutorialStep]);

  // Ensure window size updates on resize
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!mounted) return null;

  const startNodeId = Array.isArray(nodes) && nodes.length > 0 ? nodes[0].id : "";

  return (
    <div className={cn(
      "flex flex-col h-screen w-full transition-colors duration-300",
      theme === "dark" ? "dark bg-[#0b0e14] text-slate-200" : "bg-slate-50 text-slate-900"
    )}>
      
      {/* HEADER: Balanced UI with high-contrast actions */}
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
            <HeaderButton onClick={() => setShowExecutionLogPanel(!showExecutionLogPanel)} icon={<Terminal size={14} />} active={showExecutionLogPanel} />
            <HeaderButton onClick={() => setShowVariablesPanel(!showVariablesPanel)} icon={<Variable size={14} />} active={showVariablesPanel} />
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
        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] overflow-y-auto">
          <NodeSidebar />
        </aside>

        <main className="flex-1 relative bg-slate-50 dark:bg-[#0b0e14]">
          <FlowCanvas setSelectedNodeId={setSelectedNodeId} />
          
          {(finalResult || running) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-white dark:bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl p-5 z-50 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    running ? "bg-amber-500 animate-ping" : "bg-indigo-500 animate-pulse"
                  )} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Agent Output</span>
                </div>
                <div className="flex items-center gap-2">
                  {finalResult && (
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                      finalResult.type === 'text' ? "bg-blue-500/10 text-blue-500" :
                      finalResult.type === 'file' ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-purple-500/10 text-purple-500"
                    )}>
                      {finalResult.type}
                    </span>
                  )}
                  {running && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-500/10 text-amber-500">
                      Processing...
                    </span>
                  )}
                  <button onClick={() => setFinalResult(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
              </div>
              
              <div className="max-h-48 overflow-y-auto font-mono text-sm p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                {running ? (
                  <div className="flex items-center gap-3 text-slate-500 italic">
                    <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" />
                    Engines warming up...
                  </div>
                ) : finalResult ? (
                  typeof finalResult.payload === 'string' ? finalResult.payload : JSON.stringify(finalResult.payload, null, 2)
                ) : null}
              </div>
            </div>
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

        <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0e14] overflow-y-auto">
          <NodeSettingsSidebar />
        </aside>

        {showExecutionLogPanel && (
          <div className="absolute bottom-4 right-84 w-[400px] h-[450px] z-40 transition-all drop-shadow-2xl">
            <ExecutionLogPanel />
          </div>
        )}
        {showVariablesPanel && (
          <div className="absolute top-4 left-68 w-80 h-[450px] z-40 transition-all drop-shadow-2xl">
            <VariableInspectorPanel />
          </div>
        )}
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
}

function HeaderButton({ icon, label, onClick, active, variant = "ghost" }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
        variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20",
        variant === "ghost" && !active && "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800",
        active && variant === "ghost" && "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
