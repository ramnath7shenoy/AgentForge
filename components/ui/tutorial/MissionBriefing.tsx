"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/stores/flowStore";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  Cpu,
  SlidersHorizontal,
  Sparkles,
  Play,
  History,
  Rocket,
  Share2,
  BookOpen,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  accent: string;
  /** data-tutorial selectors to highlight */
  highlights: string[];
}

const sections: Section[] = [
  {
    icon: <BookOpen size={20} />,
    title: "Welcome to AgentForge Editor",
    subtitle: "A quick tour of every tool on this page. Use the arrows or dots to flip through.",
    bullets: [
      "Build AI agent pipelines visually by connecting nodes on the canvas.",
      "Each node is a step in your workflow — trigger, think, act, output.",
      "Your flow auto-saves to the cloud whenever you make changes.",
    ],
    accent: "indigo",
    highlights: [],
  },
  {
    icon: <PlusCircle size={20} />,
    title: "Create Your First Flow — 3 Steps",
    subtitle: "From a blank canvas to a running AI agent in under a minute.",
    bullets: [
      "Step 1 — Drag an Input node from the left sidebar onto the canvas. This is where your flow starts.",
      "Step 2 — Drag an Agent Brain node onto the canvas. Connect it to the Input node by dragging from the right handle of Input to the left handle of Agent Brain.",
      "Step 3 — Drag an Output node and connect it to the Agent Brain. Click the Agent Brain, write a prompt in the right panel (e.g. 'Summarise the input in one sentence'), then hit Run Flow.",
      "Shortcut: click AI Build (✦) in the toolbar, describe what you want in plain English, and your entire flow is generated automatically — no dragging required.",
    ],
    accent: "teal",
    highlights: ["node-palette", "ai-build"],
  },
  {
    icon: <Layers size={20} />,
    title: "Left Sidebar — Node Palette",
    subtitle: "Your building blocks. Drag any node onto the canvas to add it.",
    bullets: [
      "Triggers: Start your flow (schedule, webhook, manual). Every flow needs one.",
      "Intelligence: Agent Brain — the LLM step. Write a system prompt to define its behaviour.",
      "Actions: App integrations (Slack, GitHub, email, etc.). Reads and writes data.",
      "Output: Ends the flow and surfaces the final result.",
      "Switch to the Vault tab to store API keys used by action nodes.",
    ],
    accent: "violet",
    highlights: ["node-palette"],
  },
  {
    icon: <Cpu size={20} />,
    title: "Canvas — The Workflow",
    subtitle: "Drag, drop, and wire your nodes together here.",
    bullets: [
      "Drag nodes from the left sidebar onto the canvas to place them.",
      "Connect nodes by dragging from an output handle (right of a node) to an input handle (left of another node).",
      "Click a node to select it — its settings appear in the right panel.",
      "Delete a node by selecting it and pressing Backspace, or use the trash icon on hover.",
      "Ctrl+Z undoes the last action.",
    ],
    accent: "blue",
    highlights: [],
  },
  {
    icon: <SlidersHorizontal size={20} />,
    title: "Right Sidebar — Node Settings",
    subtitle: "Configure the selected node. Click the arrow on the right edge to open it.",
    bullets: [
      "Click any node on the canvas to open its settings here.",
      "Agent Brain: write a system prompt to define what the LLM does in this step.",
      "Action nodes: choose the provider (e.g. Slack), pick an action, fill in inputs like channel IDs.",
      "Every node has an optional label field — rename it to keep your canvas readable.",
    ],
    accent: "cyan",
    highlights: ["right-sidebar"],
  },
  {
    icon: <Sparkles size={20} />,
    title: "AI Build + Templates",
    subtitle: "Start faster — skip the blank canvas.",
    bullets: [
      "AI Build (✦): describe what you want in plain English and the AI generates a complete workflow.",
      "Templates: load a pre-built flow such as 'Omnichannel Content Generator' as a starting point.",
      "You can freely modify any generated or template flow after it's loaded.",
    ],
    accent: "violet",
    highlights: ["ai-build", "templates"],
  },
  {
    icon: <Play size={20} />,
    title: "Run Flow",
    subtitle: "Execute your agent and review its output.",
    bullets: [
      "Click 'Run Flow' to execute your workflow with live API calls.",
      "Use the dropdown arrow (▾) to switch to 'Dry Run' — simulates without making real requests.",
      "Output appears in the Response Gallery panel below the canvas after the run completes.",
    ],
    accent: "emerald",
    highlights: ["run-flow"],
  },
  {
    icon: <History size={20} />,
    title: "Utility Toolbar",
    subtitle: "Undo, version control, export — the small icons in the pill.",
    bullets: [
      "Undo (↺): step back through edits. Keyboard shortcut: Ctrl+Z.",
      "Minimap: toggle a bird's-eye view of your canvas in the corner.",
      "Snapshots (clock): save a named version of your flow and restore any past snapshot.",
      "Export (↓): download your canvas as PNG, JPEG, or PDF.",
      "Theme toggle (sun/moon): switch between light and dark mode.",
    ],
    accent: "amber",
    highlights: ["utility-pill"],
  },
  {
    icon: <Rocket size={20} />,
    title: "Publish",
    subtitle: "Export your agent as runnable code.",
    bullets: [
      "Opens the Code Sandbox — view generated Python/JS code for your flow.",
      "Attach files, set environment variables, and run the agent with a real text input.",
      "Use this to verify your agent works end-to-end before sharing it.",
    ],
    accent: "teal",
    highlights: ["publish"],
  },
  {
    icon: <Share2 size={20} />,
    title: "Share",
    subtitle: "Share your flow or collaborate with others.",
    bullets: [
      "Generate a public link to your flow with one click.",
      "Toggle between View Only and Can Edit permissions before sharing.",
      "Public flows can be cloned by others from the Agent Store.",
      "Sign in to enable real-time collaboration with teammates.",
    ],
    accent: "fuchsia",
    highlights: ["share"],
  },
];

const accentMap: Record<string, {
  bg: string; border: string; text: string; dot: string; btn: string; ring: string;
}> = {
  indigo:  { bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  text: "text-indigo-400",  dot: "bg-indigo-500",  btn: "bg-indigo-600 hover:bg-indigo-500",  ring: "rgba(99,102,241,0.9)" },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/30",  text: "text-violet-400",  dot: "bg-violet-500",  btn: "bg-violet-600 hover:bg-violet-500",  ring: "rgba(139,92,246,0.9)" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    dot: "bg-blue-500",    btn: "bg-blue-600 hover:bg-blue-500",    ring: "rgba(59,130,246,0.9)" },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-400",    dot: "bg-cyan-500",    btn: "bg-cyan-600 hover:bg-cyan-500",    ring: "rgba(6,182,212,0.9)" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-500", ring: "rgba(16,185,129,0.9)" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   dot: "bg-amber-500",   btn: "bg-amber-600 hover:bg-amber-500",   ring: "rgba(245,158,11,0.9)" },
  teal:    { bg: "bg-teal-500/10",    border: "border-teal-500/30",    text: "text-teal-400",    dot: "bg-teal-500",    btn: "bg-teal-600 hover:bg-teal-500",    ring: "rgba(20,184,166,0.9)" },
  fuchsia: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", text: "text-fuchsia-400", dot: "bg-fuchsia-500", btn: "bg-fuchsia-600 hover:bg-fuchsia-500", ring: "rgba(217,70,239,0.9)" },
};

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useHighlightRects(selectors: string[]): HighlightRect[] {
  const [rects, setRects] = useState<HighlightRect[]>([]);

  const measure = useCallback(() => {
    const result: HighlightRect[] = [];
    for (const id of selectors) {
      const el = document.querySelector(`[data-tutorial="${id}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        result.push({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    }
    setRects(result);
  }, [selectors]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return rects;
}

function HighlightRings({ selectors, color }: { selectors: string[]; color: string }) {
  const rects = useHighlightRects(selectors);
  if (rects.length === 0) return null;
  const pad = 5;

  return (
    <>
      {rects.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            top: r.top - pad,
            left: r.left - pad,
            width: r.width + pad * 2,
            height: r.height + pad * 2,
            borderRadius: 12,
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 4px ${color.replace("0.9", "0.15")}, 0 0 16px ${color.replace("0.9", "0.4")}`,
            pointerEvents: "none",
            zIndex: 998,
          }}
        />
      ))}
    </>
  );
}

export default function MissionBriefing() {
  const { tutorialStep, completeTutorial } = useFlowStore();
  const [page, setPage] = useState(0);

  // Reset to first page when tutorial reopens
  useEffect(() => {
    if (tutorialStep > 0) setPage(0);
  }, [tutorialStep]);

  if (tutorialStep === 0) return null;

  const section = sections[page];
  const accent = accentMap[section.accent];
  const isFirst = page === 0;
  const isLast = page === sections.length - 1;

  return (
    <>
      {/* Highlight rings rendered outside the card, over the whole page */}
      <AnimatePresence mode="wait">
        <HighlightRings
          key={page}
          selectors={section.highlights}
          color={accent.ring}
        />
      </AnimatePresence>

      {/* Guide card */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999] w-full max-w-2xl px-4 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto w-full bg-[#0b0e14]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            {/* Top bar */}
            <div className={cn("flex items-center justify-between px-5 py-3 border-b border-white/5", accent.bg)}>
              <div className="flex items-center gap-2.5">
                <span className={cn("flex-shrink-0", accent.text)}>{section.icon}</span>
                <div>
                  <p className="text-xs font-black text-white leading-tight">{section.title}</p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{section.subtitle}</p>
                </div>
              </div>
              <button
                onClick={completeTutorial}
                className="text-slate-500 hover:text-white transition-colors flex-shrink-0 ml-4"
                title="Close guide"
              >
                <X size={14} />
              </button>
            </div>

            {/* Bullets */}
            <div className="px-5 py-4 flex flex-col gap-2">
              {section.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", accent.dot)} />
                  <p className="text-[12px] text-slate-300 leading-relaxed">{b}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {sections.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={cn(
                      "rounded-full transition-all",
                      i === page
                        ? cn("w-4 h-1.5", accent.dot)
                        : "w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500"
                    )}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-600 font-medium mr-1">
                  {page + 1} / {sections.length}
                </span>
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={isFirst}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                {isLast ? (
                  <button
                    onClick={completeTutorial}
                    className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all", accent.btn)}
                  >
                    Done
                  </button>
                ) : (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className={cn("flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition-all", accent.btn)}
                  >
                    Next <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
