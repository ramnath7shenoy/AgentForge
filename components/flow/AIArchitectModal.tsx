"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2 } from "lucide-react";
import { detectArchitectProvider } from "@/lib/utils";
import { useVaultStore } from "@/stores/vaultStore";
import type { ArchitectProvider } from "@/app/actions/ai-architect";

interface AIArchitectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (prompt: string, pastedKey: string, provider: ArchitectProvider) => void;
}

export default function AIArchitectModal({ open, onClose, onSubmit }: AIArchitectModalProps) {
  const architectKey = useVaultStore((s) => s.architectKey);
  const setArchitectKey = useVaultStore((s) => s.setArchitectKey);

  const [prompt, setPrompt] = useState("");
  // Initialise from the session-persisted vault key so the field is pre-filled
  // on every subsequent open within the same browser session.
  const [pastedKey, setPastedKey] = useState(architectKey);
  const [provider, setProvider] = useState<ArchitectProvider>(
    architectKey ? detectArchitectProvider(architectKey) : "gemini"
  );

  const handleKeyChange = (val: string) => {
    setPastedKey(val);
    setArchitectKey(val);           // persist for session immediately
    if (val.trim()) setProvider(detectArchitectProvider(val.trim()));
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onSubmit(prompt, pastedKey, provider);
    // Key is intentionally NOT cleared — persists for the next architect call.
    setPrompt("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Wand2 size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Agent Configuration</h2>
                <p className="text-xs text-slate-500">Describe your automation and the AI will build the flow for you.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col gap-1.5">
                <input
                  type="password"
                  placeholder="Paste API Key (Gemini / Groq / OpenAI)…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                  value={pastedKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                />
                {pastedKey.trim() && (
                  <p className="text-[10px] text-slate-500 pl-1">
                    Detected provider:{" "}
                    <span className="text-indigo-400 font-bold capitalize">{provider}</span>
                    {" "}· Key saved for this session
                  </p>
                )}
              </div>
              <textarea
                autoFocus
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all resize-none placeholder:text-slate-700"
                placeholder="e.g. A customer support bot that analyzes sentiment and routes negative inquiries to human agents, while thanking positive ones."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">⌘+Enter to build</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Sparkles size={14} />
                  Build Workflow
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
