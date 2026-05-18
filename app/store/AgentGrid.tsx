"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  CheckCircle,
  Loader2,
  ExternalLink,
  ShoppingBag,
  Code2,
  Workflow,
  Eye,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Trash2,
  Star,
  Flag,
  Bookmark,
} from "lucide-react";
import {
  cloneFlow,
  incrementViewCount,
  getFlowComments,
  postFlowComment,
  deleteFlowComment,
  toggleStar,
  toggleWishlist,
  reportFlow,
} from "@/app/actions/flow";
import { cn } from "@/lib/utils";
import AgentVisual from "@/components/store/AgentVisual";
import WorkflowLightbox from "./WorkflowLightbox";
import CodeModal from "./CodeModal";
import ManagePanel from "./ManagePanel";

export interface StoreFlow {
  id: string;
  name: string;
  description?: string | null;
  thumbnail?: string | null;
  userId?: string | null;
  creatorName?: string | null;
  updated_at: Date;
  created_at: Date;
  isMultimodal: boolean;
  nodes: any[];
  edges: any[];
  viewCount?: number | null;
  commentCount?: number;
  starCount?: number;
  isStarred?: boolean;
  tags?: string[];
  isFeatured?: boolean;
  cloneCount?: number;
  sandboxRunCount?: number;
  changelog?: string | null;
  isVerified?: boolean;
  isWishlisted?: boolean;
  sourceFlowId?: string | null;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function detectCompat(nodes: any[]) {
  const ai = new Set<string>();
  const oauth = new Set<string>();
  for (const n of nodes) {
    if (n.type === "ai" && n.data?.provider && n.data.provider !== "auto") ai.add(n.data.provider);
    if (n.type === "appaction" && n.data?.appProvider) oauth.add(n.data.appProvider);
  }
  return { ai: [...ai], oauth: [...oauth] };
}

const AI_COLORS: Record<string, string> = {
  gemini: "#4285F4",
  openai: "#10a37f",
  anthropic: "#d97757",
  groq: "#f55036",
};

const OAUTH_COLORS: Record<string, string> = {
  slack: "#4A154B",
  discord: "#5865F2",
  github: "#24292e",
  notion: "#000000",
  x: "#000000",
  instagram: "#E1306C",
  linkedin: "#0077B5",
  medium: "#00AB6C",
};

function cloneMilestoneBadge(count: number): { label: string; className: string } | null {
  if (count >= 500) return { label: "💎 Platinum", className: "bg-violet-500/20 border-violet-500/30 text-violet-300" };
  if (count >= 100) return { label: "🥇 100+ Clones", className: "bg-amber-500/20 border-amber-500/30 text-amber-300" };
  if (count >= 50) return { label: "🥈 50+ Clones", className: "bg-slate-400/20 border-slate-400/30 text-slate-300" };
  if (count >= 10) return { label: "🥉 10+ Clones", className: "bg-orange-700/20 border-orange-700/30 text-orange-300" };
  return null;
}

interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date | string;
  userId: string | null;
}

function CommentsPanel({
  flowId,
  flowOwnerId,
  currentUserId,
  onCountChange,
}: {
  flowId: string;
  flowOwnerId: string | null | undefined;
  currentUserId: string | null;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getFlowComments(flowId).then(r => {
      if (r.success) setComments(r.comments as Comment[]);
      setLoading(false);
    });
  }, [flowId]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    const result = await postFlowComment(flowId, trimmed);
    if (result.success && result.comment) {
      setComments(prev => [result.comment as Comment, ...prev]);
      setText("");
      onCountChange(1);
    }
    setPosting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (deleting) return;
    setDeleting(commentId);
    const result = await deleteFlowComment(commentId);
    if (result.success) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCountChange(-1);
    }
    setDeleting(null);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <div className="border-t border-border bg-muted/20 px-4 py-3 flex flex-col gap-3">
      {currentUserId ? (
        <div className="flex gap-2 items-end">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Write a review or report a bug…"
            rows={2}
            maxLength={1000}
            className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || posting}
            className="flex items-center justify-center h-8 w-8 rounded-xl bg-violet-500 text-white disabled:opacity-40 hover:bg-violet-600 transition-colors flex-shrink-0"
          >
            {posting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground text-center py-1">
          <Link href="/login" className="text-violet-500 hover:underline font-semibold">Sign in</Link> to leave a comment
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={13} className="animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
      ) : (
        <ul className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
          {comments.map(c => {
            const canDelete = currentUserId && (c.userId === currentUserId || flowOwnerId === currentUserId);
            return (
              <li key={c.id} className="flex gap-2.5 group/comment">
                <span className="flex-shrink-0 h-6 w-6 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-[10px] font-black flex items-center justify-center">
                  {c.authorName[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-foreground">{c.authorName}</span>
                    <span className="text-[9px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="ml-auto opacity-0 group-hover/comment:opacity-100 flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-rose-500 transition-all"
                        title="Delete comment"
                      >
                        {deleting === c.id
                          ? <Loader2 size={9} className="animate-spin" />
                          : <Trash2 size={9} />}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed break-words">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const REPORT_REASONS = ["Broken agent", "Spam", "Inappropriate content", "Other"];

function ReportModal({
  flowId,
  onClose,
}: {
  flowId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    await reportFlow(flowId, reason);
    setDone(true);
    setTimeout(onClose, 1500);
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <p className="text-sm font-black text-foreground flex items-center gap-2">
            <Flag size={13} className="text-amber-500" />
            Report Agent
          </p>
          <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            ×
          </button>
        </div>
        {done ? (
          <div className="px-4 py-6 text-center">
            <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-bold text-foreground">Report submitted. Thank you!</p>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3">
            <p className="text-[11px] text-muted-foreground">Select the reason for reporting this agent:</p>
            <div className="flex flex-col gap-1.5">
              {REPORT_REASONS.map(r => (
                <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-violet-500"
                  />
                  <span className={cn(
                    "text-[11px] font-medium transition-colors",
                    reason === r ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {r}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 size={9} className="animate-spin" /> : <Flag size={9} />}
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({
  flow,
  currentUserId,
  isStarred: isStarredProp,
  isWishlisted: isWishlistedProp,
}: {
  flow: StoreFlow;
  currentUserId: string | null;
  isStarred: boolean;
  isWishlisted: boolean;
}) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(flow.commentCount ?? 0);
  const [starred, setStarred] = useState(isStarredProp);
  const [starCount, setStarCount] = useState(flow.starCount ?? 0);
  const [wishlisted, setWishlisted] = useState(isWishlistedProp);
  const [reportOpen, setReportOpen] = useState(false);

  const isOwner = currentUserId && flow.userId === currentUserId;
  const creatorHandle = flow.creatorName || "Anonymous";

  // Freshness warning
  const daysSinceUpdate = (Date.now() - new Date(flow.updated_at).getTime()) / 86400000;
  const isStale = daysSinceUpdate > 180;
  const monthsAgo = Math.floor(daysSinceUpdate / 30);

  // Compatibility badges
  const compat = detectCompat(flow.nodes);

  // Clone milestone badge
  const milestoneBadge = cloneMilestoneBadge(flow.cloneCount ?? 0);

  const handleClone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cloning || cloned) return;

    if (!currentUserId) {
      try {
        localStorage.setItem("agentforge_guest_flow", JSON.stringify({ nodes: flow.nodes, edges: flow.edges }));
      } catch { }
      setCloned(true);
      setTimeout(() => router.push("/editor"), 700);
      return;
    }

    setCloning(true);
    setCloneError(null);
    try {
      const result = await cloneFlow(flow.id);
      if (result.success && result.flow) {
        setCloned(true);
        setTimeout(() => router.push(`/editor?id=${result.flow!.id}`), 700);
      } else {
        setCloneError(result.error || "Clone failed");
        setTimeout(() => setCloneError(null), 3000);
      }
    } catch {
      setCloneError("Clone failed");
      setTimeout(() => setCloneError(null), 3000);
    } finally {
      setCloning(false);
    }
  };

  const handleStar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    // Optimistic update
    const newStarred = !starred;
    setStarred(newStarred);
    setStarCount(n => n + (newStarred ? 1 : -1));
    const result = await toggleStar(flow.id);
    if (!result.success) {
      // Revert on failure
      setStarred(!newStarred);
      setStarCount(n => n + (newStarred ? -1 : 1));
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) { router.push("/login"); return; }
    const newWishlisted = !wishlisted;
    setWishlisted(newWishlisted);
    const result = await toggleWishlist(flow.id);
    if (!result.success) setWishlisted(!newWishlisted);
  };

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentsOpen(p => !p);
  };

  return (
    <>
      <div className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/40 dark:hover:border-violet-400/30 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-200 backdrop-blur-sm">
        {/* Thumbnail */}
        <div className="relative h-36 overflow-hidden border-b border-border">
          <Link href={`/store/${flow.id}`} className="block w-full h-full">
            {flow.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
            ) : (
              <AgentVisual agentId={flow.id} name={flow.name} width={320} height={144} className="w-full h-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </Link>
          {isOwner && (
            <ManagePanel
              flowId={flow.id}
              flowName={flow.name}
              flowDescription={flow.description}
              flowTags={flow.tags ?? []}
              flowThumbnail={flow.thumbnail}
              isFeatured={flow.isFeatured ?? false}
              flowChangelog={flow.changelog}
              flowNodes={flow.nodes}
            />
          )}
          {/* Featured badge — top left (shown only if not owner; owner has ManagePanel) */}
          {flow.isFeatured && !isOwner && (
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 border border-violet-500/40 rounded-full backdrop-blur-sm">
              <span className="text-[8px] font-black uppercase tracking-wider text-violet-300">✦ Featured</span>
            </div>
          )}
          {flow.isFeatured && isOwner && (
            <div className="absolute top-10 left-2.5 flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 border border-violet-500/40 rounded-full backdrop-blur-sm">
              <span className="text-[8px] font-black uppercase tracking-wider text-violet-300">✦ Featured</span>
            </div>
          )}
          {/* Clone milestone badge — bottom left */}
          {milestoneBadge && (
            <div className={cn(
              "absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 border rounded-full backdrop-blur-sm",
              milestoneBadge.className
            )}>
              <span className="text-[8px] font-bold">{milestoneBadge.label}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/store/${flow.id}`} className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-foreground leading-snug truncate group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
                {flow.name || "Untitled Agent"}
              </h3>
            </Link>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Wishlist/Bookmark button */}
              <button
                onClick={handleWishlist}
                className={cn(
                  "transition-colors",
                  wishlisted
                    ? "text-violet-400"
                    : "text-muted-foreground hover:text-violet-400"
                )}
                title={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
              >
                <Bookmark size={11} className={wishlisted ? "fill-current" : ""} />
              </button>
              {/* Star button */}
              <button
                onClick={handleStar}
                className={cn(
                  "flex items-center gap-1 transition-colors",
                  starred
                    ? "text-amber-400"
                    : "text-muted-foreground hover:text-amber-400"
                )}
                title={starred ? "Unstar" : "Star"}
              >
                <Star size={11} className={starred ? "fill-current" : ""} />
                <span className="text-[9px] font-bold">{starCount > 0 ? starCount : ""}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-mono text-[9px] font-bold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded" title="Deployed by">
              by {creatorHandle}
              {flow.isVerified && (
                <span title="Verified Creator" className="text-sky-400 text-[9px]">✓</span>
              )}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {new Date(flow.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground ml-auto">
              <Eye size={9} />
              {formatViews(flow.viewCount ?? 0)}
            </span>
            {(flow.sandboxRunCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-emerald-500/70" title="Sandbox runs">
                <ExternalLink size={8} />
                {flow.sandboxRunCount}
              </span>
            )}
          </div>

          {/* Usage milestone badges */}
          {((flow.cloneCount ?? 0) >= 25 || (flow.starCount ?? 0) >= 10 || flow.isVerified) && (
            <div className="flex flex-wrap gap-1">
              {((flow.cloneCount ?? 0) >= 100 || (flow.starCount ?? 0) >= 50) && (
                <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full font-bold">
                  🏆 Popular
                </span>
              )}
              {((flow.cloneCount ?? 0) >= 25 || (flow.starCount ?? 0) >= 10) &&
                !((flow.cloneCount ?? 0) >= 100 || (flow.starCount ?? 0) >= 50) && (
                <span className="text-[8px] px-1.5 py-0.5 bg-slate-400/15 border border-slate-400/30 text-slate-300 rounded-full font-bold">
                  ⭐ Rising
                </span>
              )}
              {flow.isVerified && (
                <span className="text-[8px] px-1.5 py-0.5 bg-sky-500/15 border border-sky-500/30 text-sky-300 rounded-full font-bold">
                  ✓ Verified
                </span>
              )}
            </div>
          )}

          {/* Freshness warning */}
          {isStale && (
            <p className="text-[9px] text-amber-500/80">⚠ Last updated {monthsAgo} month{monthsAgo !== 1 ? "s" : ""} ago</p>
          )}

          {flow.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
              {flow.description}
            </p>
          )}

          {/* Tags row */}
          {flow.tags && flow.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {flow.tags.slice(0, 4).map(tag => (
                <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-muted border border-border rounded-full text-muted-foreground font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Compatibility badges */}
          {(compat.ai.length > 0 || compat.oauth.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {compat.ai.map(provider => (
                <span
                  key={provider}
                  className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wide"
                  style={{
                    color: AI_COLORS[provider] ?? "#888",
                    borderColor: `${AI_COLORS[provider] ?? "#888"}40`,
                    backgroundColor: `${AI_COLORS[provider] ?? "#888"}12`,
                  }}
                >
                  {provider}
                </span>
              ))}
              {compat.oauth.map(provider => (
                <span
                  key={provider}
                  className="text-[8px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wide"
                  style={{
                    color: OAUTH_COLORS[provider] ?? "#888",
                    borderColor: `${OAUTH_COLORS[provider] ?? "#888"}40`,
                    backgroundColor: `${OAUTH_COLORS[provider] ?? "#888"}12`,
                  }}
                >
                  {provider}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-auto pt-3 border-t border-border grid grid-cols-2 gap-1.5">
            <Link
              href={`/sandbox/${flow.id}`}
              onClick={(e) => { e.stopPropagation(); incrementViewCount(flow.id); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <ExternalLink size={9} />
              Sandbox
            </Link>

            <button
              onClick={handleClone}
              disabled={cloning || cloned}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all border",
                cloned
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : cloneError
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-violet-500/5 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
              )}
            >
              {cloning ? <Loader2 size={9} className="animate-spin" /> : cloned ? <CheckCircle size={9} /> : <Copy size={9} />}
              {cloned ? "Opening…" : cloneError ? "Failed" : "Clone"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setWorkflowOpen(true); incrementViewCount(flow.id); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <Workflow size={9} />
              Workflow
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setCodeOpen(true); incrementViewCount(flow.id); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-sky-500/20 bg-sky-500/5 text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-all"
            >
              <Code2 size={9} />
              Code
            </button>
          </div>

          {/* Comments toggle + Report button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleComments}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
            >
              <MessageSquare size={9} />
              {commentCount > 0 ? `${commentCount} Comment${commentCount !== 1 ? "s" : ""}` : "Comments"}
              {commentsOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setReportOpen(true); }}
              title="Report this agent"
              className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-7 w-7 rounded-xl border border-border text-muted-foreground hover:text-amber-500 hover:border-amber-500/30 transition-all"
            >
              <Flag size={9} />
            </button>
          </div>
        </div>

        {/* Comments panel */}
        {commentsOpen && (
          <CommentsPanel
            flowId={flow.id}
            flowOwnerId={flow.userId}
            currentUserId={currentUserId}
            onCountChange={(delta) => setCommentCount(n => n + delta)}
          />
        )}
      </div>

      <WorkflowLightbox
        open={workflowOpen}
        onClose={() => setWorkflowOpen(false)}
        flowName={flow.name}
        nodes={flow.nodes}
        edges={flow.edges}
      />

      <CodeModal
        open={codeOpen}
        onClose={() => setCodeOpen(false)}
        flowName={flow.name}
        nodes={flow.nodes}
        edges={flow.edges}
      />

      {reportOpen && (
        <ReportModal flowId={flow.id} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}

export function AgentGridEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-40 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-5">
        <ShoppingBag size={22} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No agents deployed yet</p>
      <p className="text-[11px] text-muted-foreground mt-2 max-w-xs leading-relaxed">
        Open any flow on the Publish page, run a successful sandbox, then click &ldquo;Deploy to Store&rdquo;.
      </p>
    </div>
  );
}

export default function AgentGrid({
  flows,
  currentUserId,
  starredFlowIds,
  wishlistedFlowIds = [],
}: {
  flows: StoreFlow[];
  currentUserId: string | null;
  starredFlowIds: string[];
  wishlistedFlowIds?: string[];
}) {
  if (flows.length === 0) return <AgentGridEmpty />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start">
      {flows.map((flow) => (
        <AgentCard
          key={flow.id}
          flow={flow}
          currentUserId={currentUserId}
          isStarred={starredFlowIds.includes(flow.id)}
          isWishlisted={wishlistedFlowIds.includes(flow.id)}
        />
      ))}
    </div>
  );
}
