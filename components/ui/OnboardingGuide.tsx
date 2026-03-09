"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingGuideProps {
  onComplete: () => void;
}

const steps = [
  {
    target: "sidebar",
    title: "1. Build Your Agent",
    content: "Search and drag nodes to start your agent. Try the new Amber Smart Trigger or Purple Webhook!",
    position: "left-[280px] top-1/3", 
  },
  {
    target: "canvas",
    title: "2. Connect Logic",
    content: "Connect nodes together on the canvas to define your automated logic flow.",
    position: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", 
  },
  {
    target: "publish",
    title: "3. Deploy & Export",
    content: "Turn your visual flow into a Universal Plugin by clicking Publish & Export up here.",
    position: "right-6 top-20", 
  }
];

export default function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const step = steps[currentStep];

  return (
    <>
      {/* Subtle backdrop overlay, pointer events none so users can still drag if they want */}
      <div className="fixed inset-0 bg-black/5 dark:bg-black/40 z-[100] pointer-events-none" />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "fixed z-[101] w-80 bg-white dark:bg-[#0b0e14] border border-indigo-500/30 rounded-2xl shadow-2xl p-5",
            step.position
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {step.title}
            </h3>
            <button 
              onClick={onComplete}
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            {step.content}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentStep ? "bg-indigo-500 w-4" : "bg-slate-200 dark:bg-slate-800"
                  )}
                />
              ))}
            </div>
            
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              {currentStep < steps.length - 1 ? (
                <>Next <ChevronRight size={14} /></>
              ) : (
                <>Finish <Check size={14} /></>
              )}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
