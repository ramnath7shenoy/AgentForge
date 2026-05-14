"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Settings, Trash2, Edit3, Loader2, CheckCircle, X, AlertTriangle, ImagePlus } from "lucide-react";
import { unpublishFlow, updateDeployedFlowMeta } from "@/app/actions/flow";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import AgentVisual from "@/components/store/AgentVisual";

function autoTagsFromNodes(nodes: any[]): string[] {
  const tags = new Set<string>();
  const types = new Set(nodes.map((n: any) => n.type as string));
  if (types.has("ai")) {
    tags.add("ai");
    nodes.forEach((n: any) => {
      if (n.type === "ai" && n.data?.provider && n.data.provider !== "auto") tags.add(n.data.provider.toLowerCase());
    });
  }
  if (types.has("trigger") || types.has("webhook")) tags.add("automation");
  if (types.has("appaction")) {
    tags.add("integration");
    nodes.forEach((n: any) => {
      if (n.type === "appaction" && n.data?.appProvider) tags.add(n.data.appProvider.toLowerCase());
    });
  }
  if (types.has("router") || types.has("decision") || types.has("gatekeeper")) tags.add("logic");
  if (types.has("code")) tags.add("code");
  if (types.has("fetch") || types.has("action")) tags.add("api");
  return [...tags].slice(0, 8);
}

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
  flowTags: string[];
  flowThumbnail?: string | null;
  isFeatured: boolean;
  flowChangelog?: string | null;
  flowNodes?: any[];
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ flowId, flowName, flowDescription, flowTags, flowThumbnail, isFeatured: isFeaturedProp, flowChangelog, flowNodes = [], onClose, onSaved }: EditModalProps) {
  const suggestedTags = flowTags.length === 0 ? autoTagsFromNodes(flowNodes) : flowTags;
  const [name, setName] = useState(flowName);
  const [desc, setDesc] = useState(flowDescription ?? "");
  const [tags, setTags] = useState<string[]>(suggestedTags);
  const [tagInput, setTagInput] = useState("");
  const [featured, setFeatured] = useState(isFeaturedProp);
  const [changelog, setChangelog] = useState(flowChangelog ?? "");
  const [thumbnail, setThumbnail] = useState<string | null>(flowThumbnail ?? null);
  const [saving, setSaving] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleThumbnailFile = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 640, MAX_H = 360;
      let { width: w, height: h } = img;
      const ratio = Math.min(MAX_W / w, MAX_H / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      setThumbnail(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const addTag = (raw: string) => {
    const t = raw.trim().slice(0, 20).toLowerCase();
    if (!t || tags.includes(t) || tags.length >= 8) return;
    setTags(prev => [...prev, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const result = await updateDeployedFlowMeta(flowId, {
      name: name.trim(),
      description: desc.trim() || undefined,
      tags,
      isFeatured: featured,
      changelog: changelog.trim() || undefined,
      ...(thumbnail !== flowThumbnail ? { thumbnail: thumbnail ?? null } : {}),
    });
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
      <div className="w-full max-w-lg bg-[#0d0d10] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[88vh]">
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
        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">

          {/* Thumbnail Upload — compact row */}
          <div className="flex items-center gap-3">
            <div
              className="relative w-28 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {thumbnail ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbnail} alt="thumbnail preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImagePlus size={12} className="text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setThumbnail(null); }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  >
                    <X size={7} />
                  </button>
                </>
              ) : (
                <>
                  <AgentVisual agentId={flowId} name={flowName} width={112} height={64} className="w-full h-full" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ImagePlus size={12} className="text-white" />
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">Thumbnail</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors text-left"
              >
                {thumbnail ? "Change image" : "Upload custom image"}
              </button>
              {thumbnail && (
                <button
                  type="button"
                  onClick={() => setThumbnail(null)}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors text-left"
                >
                  Remove → use generated
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbnailFile(f); e.target.value = ""; }}
            />
          </div>

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

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
              Tags <span className="text-white/20 normal-case tracking-normal font-normal">(max 8, press Enter or comma)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-violet-500/15 border border-violet-500/25 rounded-full text-[9px] text-violet-300 font-medium">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-violet-400/60 hover:text-violet-300 transition-colors ml-0.5"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 8 && (
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder="Add a tag…"
                disabled={saving}
                maxLength={22}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
              />
            )}
          </div>

          {/* Changelog / What's new */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">
              What&apos;s New <span className="text-white/20 normal-case tracking-normal font-normal">(optional update notes)</span>
            </label>
            <textarea
              value={changelog}
              onChange={e => setChangelog(e.target.value)}
              placeholder="e.g. Fixed Slack integration, added retry logic…"
              rows={2}
              maxLength={2000}
              disabled={saving}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none disabled:opacity-50"
            />
          </div>

          {/* Featured toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setFeatured(v => !v)}
              className={cn(
                "relative w-8 h-4 rounded-full border transition-all",
                featured
                  ? "bg-violet-500 border-violet-500"
                  : "bg-white/10 border-white/20 group-hover:border-white/30"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                featured ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white/80">✦ Feature this agent</span>
              <span className="text-[9px] text-white/30">Shows in the Featured section on the store</span>
            </div>
          </label>
        </div>

        {/* Actions — sticky so Save is always visible */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#0d0d10] flex gap-2.5 flex-shrink-0">
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
  flowTags?: string[];
  flowThumbnail?: string | null;
  isFeatured?: boolean;
  flowChangelog?: string | null;
  flowNodes?: any[];
}

export default function ManagePanel({ flowId, flowName, flowDescription, flowTags = [], flowThumbnail, isFeatured = false, flowChangelog, flowNodes = [] }: ManagePanelProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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

      {editOpen && mounted && createPortal(
        <EditModal
          flowId={flowId}
          flowName={flowName}
          flowDescription={flowDescription}
          flowTags={flowTags}
          flowThumbnail={flowThumbnail}
          isFeatured={isFeatured}
          flowChangelog={flowChangelog}
          flowNodes={flowNodes}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
        />,
        document.body
      )}

      {toast && mounted && createPortal(<Toast message={toast.message} type={toast.type} />, document.body)}
    </>
  );
}
