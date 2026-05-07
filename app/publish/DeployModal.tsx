"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShoppingBag, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  onConfirm: (name: string, description: string) => Promise<void>;
  loading: boolean;
}

export default function DeployModal({ open, onClose, defaultName, onConfirm, loading }: DeployModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription("");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, defaultName]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, loading]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0 && !loading;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === backdropRef.current && !loading) onClose(); }}
    >
      <div className="bg-[#0d0d10] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ShoppingBag size={15} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Agent Store</p>
              <p className="text-sm font-black text-white leading-none mt-0.5">Deploy to Store</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Form */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Agent Name</label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Awesome Agent"
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Description <span className="text-white/20 normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none disabled:opacity-50"
            />
          </div>

          <p className="text-[10px] text-white/25 leading-relaxed">
            This agent will be publicly listed in the AgentStore and anyone can clone it to their workspace.
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-[11px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => canSubmit && onConfirm(name.trim(), description.trim())}
            disabled={!canSubmit}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border",
              canSubmit
                ? "bg-violet-600 hover:bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                : "bg-white/5 text-white/20 border-white/5 cursor-not-allowed"
            )}
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            {loading ? "Deploying…" : "Deploy"}
          </button>
        </div>
      </div>
    </div>
  );
}
