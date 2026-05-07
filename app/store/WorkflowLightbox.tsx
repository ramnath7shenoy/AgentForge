"use client";

import React, { useEffect, useRef } from "react";
import { X, Zap } from "lucide-react";
import dynamic from "next/dynamic";

const ReadOnlyCanvas = dynamic(
  () => import("@/components/flow/canvas/ReadOnlyCanvas"),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0b0e14]">
      <div className="w-6 h-6 rounded-full border-2 border-violet-500/40 border-t-violet-500 animate-spin" />
    </div>
  )}
);

interface WorkflowLightboxProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  nodes: any[];
  edges: any[];
}

export default function WorkflowLightbox({ open, onClose, flowName, nodes, edges }: WorkflowLightboxProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-8"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="flex flex-col w-full max-w-5xl h-[75vh] bg-[#0b0e14] border border-white/10 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-[#0d1017]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
              <Zap size={13} className="text-violet-400 fill-current" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Workflow Preview</p>
              <p className="text-sm font-black text-white leading-tight mt-0.5">{flowName || "Untitled Agent"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[10px] text-white/25 font-bold uppercase tracking-widest">
              <span>{nodes.length} node{nodes.length !== 1 ? "s" : ""}</span>
              <span className="opacity-40">·</span>
              <span>{edges.length} edge{edges.length !== 1 ? "s" : ""}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0">
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
              <Zap size={28} className="opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">No nodes in this workflow</p>
            </div>
          ) : (
            <ReadOnlyCanvas nodes={nodes} edges={edges} editable={false} />
          )}
        </div>
      </div>
    </div>
  );
}
