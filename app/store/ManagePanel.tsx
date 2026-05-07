"use client";

import React, { useState, useRef, useEffect } from "react";
import { Settings, Trash2, Edit3, Loader2, CheckCircle, X, AlertTriangle } from "lucide-react";
import { unpublishFlow, updateDeployedFlowMeta } from "@/app/actions/flow";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/* ── Toast ───────────────────────────────────────────────────────────── */
function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl text-[12px] font-bold",
      type === "success"
        ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300"
        : "bg-rose-950/90 border-rose-500/30 text-rose-300"
    )}>
      {type === "success"
        ? <CheckCircle size={14} className="shrink-0" />
        : <AlertTriangle size={14} className="shrink-0" />
      }
      {message}
    </div>
  );
}

/* ── Edit Modal ──────────────────────────────────────────────────────── */
interface EditModalProps {
  flowId: string;
  flowName: string;
  flowDescription?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ flowId, flowName, flowDescription, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(flowName);
  const [desc, setDesc] = useState(flowDescription ?? "");
  const [saving, setSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const result = await updateDeployedFlowMeta(flowId, { name: name.trim(), description: desc.trim() || undefined });
    setSaving(false);
    if (result.success) onSaved();
    else onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#0d0d10] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center">
              <Edit3 size={12} className="text-violet-400" />
            </div>
            <p className="text-sm font-black text-white">Update Details</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">Agent Name</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Awesome Agent"
              disabled={saving}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
              Description <span className="text-white/20 normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              disabled={saving}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2.5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-[11px] font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border shadow-lg",
              saving || !name.trim()
                ? "bg-white/5 text-white/20 border-white/5 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-500 text-white border-violet-500 shadow-violet-500/20"
            )}
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ManagePanel ─────────────────────────────────────────────────────── */
interface ManagePanelProps {
  flowId: string;
  flowName: string;
  flowDescription?: string | null;
}

export default function ManagePanel({ flowId, flowName, flowDescription }: ManagePanelProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUnpublish = async () => {
    setMenuOpen(false);
    setUnpublishing(true);
    const result = await unpublishFlow(flowId);
    setUnpublishing(false);
    if (result.success) {
      showToast("Agent unpublished from store.", "success");
      setTimeout(() => router.refresh(), 1000);
    } else {
      showToast("Failed to unpublish. Try again.", "error");
    }
  };

  const handleSaved = () => {
    setEditOpen(false);
    showToast("Details updated successfully.", "success");
    router.refresh();
  };

  return (
    <>
      <div ref={menuRef} className="absolute top-2.5 left-2.5 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          disabled={unpublishing}
          className={cn(
            "w-7 h-7 rounded-lg backdrop-blur-sm border flex items-center justify-center transition-all",
            menuOpen
              ? "bg-white/20 border-white/40 text-white"
              : "bg-black/60 border-white/20 text-white/60 hover:text-white hover:border-white/40"
          )}
        >
          {unpublishing ? <Loader2 size={11} className="animate-spin" /> : <Settings size={11} />}
        </button>

        {menuOpen && (
          <div
            className="absolute top-9 left-0 bg-[#111114]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/60 w-44 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              <button
                onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left"
              >
                <Edit3 size={11} />
                Update Details
              </button>
              <div className="h-px bg-white/5 mx-1" />
              <button
                onClick={handleUnpublish}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[11px] font-semibold text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/5 transition-colors text-left"
              >
                <Trash2 size={11} />
                Unpublish
              </button>
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <EditModal
          flowId={flowId}
          flowName={flowName}
          flowDescription={flowDescription}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
