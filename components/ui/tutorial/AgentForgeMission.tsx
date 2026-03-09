"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/stores/flowStore";
import { Terminal, Target, Zap, Brain, Rocket, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AgentForgeMission() {
  const { tutorialStep, setTutorialStep, completeTutorial } = useFlowStore();
  const [typedText, setTypedText] = useState("");
  
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
      title: "Neural Configuration",
      brief: "Excellent. Now, give your agent its core instructions in the settings panel.",
      task: "Type instructions into the Agent Brain",
      spotlight: "settings"
    },
    {
      step: 4,
      title: "Establish Uplink",
      brief: "Connect the Trigger to the Brain to establish the logical flow.",
      task: "Connect the Amber Trigger to the Purple Brain",
      spotlight: "canvas"
    },
    {
      step: 5,
      title: "Orbital Launch",
      brief: "Your agent is primed. Deploy it to the network.",
      task: "Click the Emerald 'Publish & Export' button",
      spotlight: "header"
    }
  ];

  const currentMission = missions.find(m => m.step === tutorialStep);

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
  }, [tutorialStep]);

  if (!currentMission || tutorialStep === 0 || tutorialStep > 5) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] pointer-events-none">
        {/* Spotlight Overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          style={{
            clipPath: getSpotlightPath(currentMission.spotlight)
          }}
        />

        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 flex gap-1 px-1 pt-1 z-[1001]">
          {[1, 2, 3, 4, 5].map((s) => (
            <div 
              key={s} 
              className={cn(
                "flex-1 h-full rounded-full transition-all duration-500",
                s <= tutorialStep ? "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" : "bg-slate-800"
              )} 
            />
          ))}
        </div>

        {/* Mission HUD */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-auto">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-[#0b0e14]/90 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="flex items-center justify-between px-6 py-3 border-b border-indigo-500/20 bg-indigo-500/5">
              <div className="flex items-center gap-3">
                <Target size={16} className="text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                  Mission 0{tutorialStep}: {currentMission.title}
                </span>
              </div>
              <button 
                onClick={completeTutorial}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-8">
              <div className="min-h-[50px] mb-8">
                <p className="text-lg md:text-xl font-mono text-white leading-relaxed">
                  {typedText}
                  <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse ml-2 align-middle" />
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-widest font-mono">
                    CURRENT_TASK: {currentMission.task}
                  </span>
                </div>

                {tutorialStep === 1 && (
                  <button
                    onClick={() => setTutorialStep(2)}
                    className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold font-mono text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20 group"
                  >
                    [INITIALIZE_SYSTEM]
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}

function getSpotlightPath(spotlight: string | null) {
  if (!spotlight) return "none";
  
  // Custom clip-paths for different UI areas
  switch(spotlight) {
    case "sidebar": // Left sidebar area
      return "polygon(0% 0%, 0% 100%, 256px 100%, 256px 0%, 0% 0%, 100% 0%, 100% 100%, 256px 100%, 256px 0%, 100% 0%)";
    case "settings": // Right sidebar area
      return "polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, calc(100% - 320px) 0%, calc(100% - 320px) 100%, 100% 100%, 100% 0%, calc(100% - 320px) 0%)";
    case "header": // Top right header area
      return "polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, calc(100% - 400px) 0%, calc(100% - 400px) 80px, 100% 80px, 100% 0%, calc(100% - 400px) 0%)";
    case "canvas": // Central canvas area
      return "polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, 256px 80px, 256px calc(100% - 0px), calc(100% - 320px) calc(100% - 0px), calc(100% - 320px) 80px, 256px 80px)";
    default:
      return "none";
  }
}
