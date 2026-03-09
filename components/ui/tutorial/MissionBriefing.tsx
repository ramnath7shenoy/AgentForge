"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/stores/flowStore";
import { Terminal, X, SkipForward, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const missions = [
  {
    step: 1,
    title: "Mission Briefing",
    brief: "Welcome, Architect. Let's deploy your first autonomous agent.",
    task: "Start the walkthrough",
    spotlight: null
  },
  {
    step: 2,
    title: "Tactical Deployment",
    brief: "Every agent needs a trigger. Locate the 'Smart Trigger' in the sidebar.",
    task: "Drag 'Smart Trigger' onto the canvas",
    spotlight: "sidebar"
  },
  {
    step: 3,
    title: "Establish Uplink",
    brief: "Excellent. Now, connect the Trigger to the Brain to establish the logical flow.",
    task: "Connect the Amber Trigger to the Purple Brain",
    spotlight: "canvas"
  },
  {
    step: 4,
    title: "Test your Logic",
    brief: "Let's verify the agent's behavior. Click 'Run Flow' in the header to execute the sequence.",
    task: "Click the 'Run Flow' button",
    spotlight: "header"
  },
  {
    step: 5,
    title: "Deploy as Plugin",
    brief: "Your agent is functional. Deploy it to the network as a universal plugin.",
    task: "Click 'Publish & Export' after the output appears",
    spotlight: "header"
  }
];

export default function MissionBriefing() {
  const { tutorialStep, setTutorialStep, completeTutorial, setSelectedNodeId, nodes, setNodes, edges, setEdges } = useFlowStore();
  const [typedText, setTypedText] = useState("");
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const currentMission = missions.find(m => m.step === tutorialStep);

  useEffect(() => {
    // Clear selections at the start of every mission step
    if (tutorialStep > 0) {
      setSelectedNodeId(null);
      
      // Manually deselect all nodes and edges in the store
      setNodes(nodes.map(n => ({ ...n, selected: false })));
      setEdges(edges.map(e => ({ ...e, selected: false })));
    }
    
    // Auto-select trigger node after drop (transition from 2 to 3)
    if (tutorialStep === 3) {
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        setSelectedNodeId(triggerNode.id);
        setNodes(nodes.map(n => ({ 
          ...n, 
          selected: n.id === triggerNode.id 
        })));
      }
    }
  }, [tutorialStep, setSelectedNodeId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  useEffect(() => {
    if (!currentMission) return;
    
    setTypedText("");
    let i = 0;
    const interval = setInterval(() => {
      setTypedText(currentMission.brief.slice(0, i + 1));
      i++;
      if (i >= currentMission.brief.length) clearInterval(interval);
    }, 30);

    return () => clearInterval(interval);
  }, [tutorialStep, currentMission]);

  if (!currentMission || tutorialStep === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] pointer-events-none">
        {/* Spotlight Overlay */}
        <div className="absolute inset-0 overflow-hidden">
            <svg className="w-full h-full">
                <defs>
                    <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {currentMission.spotlight === "sidebar" && (
                            <rect x="0" y="0" width="256" height="100%" fill="black" />
                        )}
                        {currentMission.spotlight === "settings" && (
                            <rect x={windowSize.width - 320} y="0" width="320" height="100%" fill="black" />
                        )}
                        {currentMission.spotlight === "header" && (
                            <rect x={windowSize.width - 400} y="0" width="400" height="80" fill="black" />
                        )}
                        {currentMission.spotlight === "canvas" && (
                            <rect x="256" y="80" width={windowSize.width - 576} height={windowSize.height - 80} fill="black" />
                        )}
                    </mask>
                </defs>
                <rect 
                    width="100%" 
                    height="100%" 
                    fill="black" 
                    fillOpacity="0.4" 
                    mask="url(#spotlight-mask)" 
                    className="backdrop-blur-[4px] transition-all duration-500"
                />
            </svg>
        </div>

        {/* GHOST DRAG SIMULATION for Step 2 */}
        {tutorialStep === 2 && (
            <motion.div
                initial={{ x: 128, y: 300, opacity: 0, scale: 0.8 }}
                animate={{ 
                    x: [128, 600, 600], 
                    y: [300, 400, 400], 
                    opacity: [0, 1, 1, 0],
                    scale: [0.8, 1, 1, 0.8] 
                }}
                transition={{ 
                    duration: 3, 
                    repeat: Infinity, 
                    times: [0, 0.4, 0.8, 1],
                    ease: "easeInOut"
                }}
                className="absolute z-[1000] pointer-events-none"
            >
                <div 
                    id="ghost-node-trigger"
                    className="flex flex-col items-center justify-center gap-2 p-3 bg-amber-500/20 border-2 border-amber-500 border-dashed rounded-xl backdrop-blur-sm w-32 shadow-2xl shadow-amber-500/40"
                >
                    <div className="p-2 bg-slate-900 rounded-lg border border-amber-500/30">
                        <Zap size={20} className="text-amber-400 fill-current" />
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-tighter">
                        Smart Trigger
                    </span>
                </div>
                {/* Simulated Mouse Cursor */}
                <motion.div 
                    animate={{ x: [0, 10, 0], y: [0, 10, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute -bottom-4 -right-4 text-white drop-shadow-lg"
                >
                    <Target size={24} className="text-white fill-white/20" />
                </motion.div>
            </motion.div>
        )}

        {/* Mission Card */}
        <div className={cn(
            "absolute transition-all duration-500 pointer-events-auto",
            tutorialStep === 1 
                ? "inset-0 flex items-center justify-center p-6" 
                : "bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6"
        )}>
          <motion.div 
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            className="w-full bg-[#0b0e14]/90 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-indigo-500/20 bg-[#111620]">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-indigo-400" />
                    <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
                        System Interface / Mission 0{tutorialStep}
                    </span>
                </div>
                <button 
                  onClick={completeTutorial}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
            </div>

            {/* Content Body */}
            <div className="p-8">
              <div className="min-h-[60px] mb-8">
                <p className="text-xl md:text-2xl font-mono text-white leading-relaxed">
                  {typedText}
                  <span className="inline-block w-2 bg-indigo-500 animate-pulse ml-1">&nbsp;</span>
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                {tutorialStep === 1 ? (
                   <div className="flex flex-col sm:flex-row items-center gap-4">
                        <button
                        onClick={() => setTutorialStep(2)}
                        className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold font-mono text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/20"
                        >
                        [START_INTERACTIVE_WALKTHROUGH]
                        </button>
                        <button
                        onClick={completeTutorial}
                        className="w-full sm:w-auto px-8 py-3 bg-transparent hover:bg-white/5 border border-slate-700 text-slate-400 hover:text-white rounded-xl font-bold font-mono text-sm tracking-wide transition-all"
                        >
                        [SKIP_TUTORIAL]
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 text-emerald-400">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                                TASK: {currentMission.task}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setTutorialStep(tutorialStep + 1)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-[10px] font-mono transition-all border border-slate-800"
                            >
                                <SkipForward size={12} /> [SKIP_STEP]
                            </button>
                        </div>
                    </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
