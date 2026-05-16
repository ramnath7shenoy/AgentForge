"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  Eye,
  Package,
  ArrowLeft,
  ExternalLink,
  Copy,
  Workflow,
  Code2,
  CheckCircle,
  Loader2,
  Send,
  Trash2,
  Flag,
  Heart,
  FlaskConical,
  Sparkles,
  Bookmark,
  Link2,
  Cpu,
} from "lucide-react";
import {
  cloneFlow,
  incrementViewCount,
  incrementSandboxRunCount,
  toggleStar,
  toggleWishlist,
  reportFlow,
  getFlowComments,
  postFlowComment,
  deleteFlowComment,
} from "@/app/actions/flow";
import { cn } from "@/lib/utils";
import AgentVisual from "@/components/store/AgentVisual";
import WorkflowLightbox from "@/app/store/WorkflowLightbox";
import CodeModal from "@/app/store/CodeModal";

interface DetailFlow {
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
  cloneCount?: number;
  starCount?: number;
  commentCount?: number;
  sandboxRunCount?: number;
  changelog?: string | null;
  tags?: string[];
  isFeatured?: boolean;
  isStarred?: boolean;
  isVerified?: boolean;
  isWishlisted?: boolean;
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

function detectCompat(nodes: any[]) {
  const ai = new Set<string>();
  const oauth = new Set<string>();
  for (const n of nodes) {
    if (n.type === "ai" && n.data?.provider && n.data.provider !== "auto") ai.add(n.data.provider);
    if (n.type === "appaction" && n.data?.appProvider) oauth.add(n.data.appProvider);
  }
  return { ai: [...ai], oauth: [...oauth] };
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

interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date | string;
  userId: string | null;
}

const REPORT_REASONS = ["Broken agent", "Spam", "Inappropriate content", "Other"];

interface DetailClientProps {
  flow: DetailFlow;
  related: DetailFlow[];
  currentUserId: string | null;
}

function RelatedMiniCard({
  flow,
  currentUserId,
}: {
  flow: DetailFlow;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);

  const handleClone = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (cloning || cloned) return;
    if (!currentUserId) {
      try { localStorage.setItem("agentforge_guest_flow", JSON.stringify({ nodes: flow.nodes, edges: flow.edges })); } catch { }
      setCloned(true);
      setTimeout(() => router.push("/editor"), 700);
      return;
    }
    setCloning(true);
    const result = await cloneFlow(flow.id);
    if (result.success && result.flow) {
      setCloned(true);
      setTimeout(() => router.push(`/editor?id=${result.flow!.id}`), 700);
    }
    setCloning(false);
  };

  return (
    <div className="flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-violet-500/40 transition-all">
      <Link href={`/store/${flow.id}`} className="relative h-28 block overflow-hidden border-b border-border">
        {flow.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
        ) : (
          <AgentVisual agentId={flow.id} name={flow.name} width={240} height={112} className="w-full h-full" />
        )}
      </Link>
      <div className="p-3 flex flex-col gap-2">
        <Link href={`/store/${flow.id}`} className="text-[11px] font-black text-foreground leading-snug truncate hover:text-violet-500 transition-colors">
          {flow.name || "Untitled Agent"}
        </Link>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <Star size={8} className="text-amber-400 fill-current" />
            {flow.starCount ?? 0}
          </span>
          <button
            onClick={handleClone}
            disabled={cloning || cloned}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border transition-all",
              cloned
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-violet-500/5 border-violet-500/20 text-violet-500 hover:bg-violet-500/10"
            )}
          >
            {cloning ? <Loader2 size={8} className="animate-spin" /> : cloned ? <CheckCircle size={8} /> : <Copy size={8} />}
            {cloned ? "Done" : "Clone"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DetailClient({ flow, related, currentUserId }: DetailClientProps) {
  const router = useRouter();
  const [starred, setStarred] = useState(flow.isStarred ?? false);
  const [starCount, setStarCount] = useState(flow.starCount ?? 0);
  const [wishlisted, setWishlisted] = useState(flow.isWishlisted ?? false);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reporting, setReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(flow.commentCount ?? 0);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);

  const isOwner = currentUserId && flow.userId === currentUserId;

  const compat = detectCompat(flow.nodes);
  const daysSinceUpdate = (Date.now() - new Date(flow.updated_at).getTime()) / 86400000;
  const isStale = daysSinceUpdate > 180;
  const monthsAgo = Math.floor(daysSinceUpdate / 30);

  useEffect(() => {
    incrementViewCount(flow.id).catch(() => {});
    getFlowComments(flow.id).then(r => {
      if (r.success) setComments(r.comments as Comment[]);
      setCommentsLoading(false);
    });
  }, [flow.id]);

  const handleStar = async () => {
    if (!currentUserId) { router.push("/login"); return; }
    const newStarred = !starred;
    setStarred(newStarred);
    setStarCount(n => n + (newStarred ? 1 : -1));
    const result = await toggleStar(flow.id);
    if (!result.success) {
      setStarred(!newStarred);
      setStarCount(n => n + (newStarred ? -1 : 1));
    }
  };

  const handleWishlist = async () => {
    if (!currentUserId) { router.push("/login"); return; }
    const newWishlisted = !wishlisted;
    setWishlisted(newWishlisted);
    const result = await toggleWishlist(flow.id);
    if (!result.success) setWishlisted(!newWishlisted);
  };

  const handleClone = async () => {
    if (cloning || cloned) return;
    if (!currentUserId) {
      try { localStorage.setItem("agentforge_guest_flow", JSON.stringify({ nodes: flow.nodes, edges: flow.edges })); } catch { }
      setCloned(true);
      setTimeout(() => router.push("/editor"), 700);
      return;
    }
    setCloning(true);
    setCloneError(null);
    const result = await cloneFlow(flow.id);
    if (result.success && result.flow) {
      setCloned(true);
      setTimeout(() => router.push(`/editor?id=${result.flow!.id}`), 700);
    } else {
      setCloneError(result.error || "Clone failed");
      setTimeout(() => setCloneError(null), 3000);
    }
    setCloning(false);
  };

  const handleReport = async () => {
    if (reporting) return;
    setReporting(true);
    await reportFlow(flow.id, reportReason);
    setReportDone(true);
    setTimeout(() => setReportOpen(false), 1500);
    setReporting(false);
  };

  const submitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    const result = await postFlowComment(flow.id, trimmed);
    if (result.success && result.comment) {
      setComments(prev => [result.comment as Comment, ...prev]);
      setCommentText("");
      setCommentCount(n => n + 1);
    }
    setPosting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (deletingComment) return;
    setDeletingComment(commentId);
    const result = await deleteFlowComment(commentId);
    if (result.success) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(n => n - 1);
    }
    setDeletingComment(null);
  };

  const creatorHandle = flow.creatorName || "Anonymous";
  const isOtherCreator = flow.userId && flow.userId !== currentUserId;

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/store"
        className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} />
        Back to Store
      </Link>

      {/* Hero visual */}
      <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-border">
        {flow.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
        ) : (
          <AgentVisual agentId={flow.id} name={flow.name} width={800} height={256} className="w-full h-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        {flow.isFeatured && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 bg-violet-500/20 border border-violet-500/40 rounded-full backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-wider text-violet-300">✦ Featured</span>
          </div>
        )}
      </div>

      {/* Title + stats */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">
            {flow.name || "Untitled Agent"}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleStar}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-sm font-bold",
                starred
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "border-border text-muted-foreground hover:text-amber-500 hover:border-amber-500/30"
              )}
            >
              <Star size={13} className={starred ? "fill-current" : ""} />
              {starCount}
            </button>
            <button
              onClick={handleWishlist}
              className={cn(
                "flex items-center justify-center h-9 w-9 rounded-xl border transition-all",
                wishlisted
                  ? "bg-violet-500/10 border-violet-500/30 text-violet-500"
                  : "border-border text-muted-foreground hover:text-violet-500 hover:border-violet-500/30"
              )}
              title={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
            >
              <Bookmark size={13} className={wishlisted ? "fill-current" : ""} />
            </button>
            <button
              onClick={() => setTipOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 transition-all"
              title="Support Creator"
            >
              <Heart size={13} />
            </button>
            <button
              onClick={() => setReportOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-muted-foreground hover:text-amber-500 hover:border-amber-500/30 transition-all"
              title="Report"
            >
              <Flag size={13} />
            </button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Eye size={11} />
            <span className="font-bold">{formatViews(flow.viewCount ?? 0)}</span> views
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Package size={11} />
            <span className="font-bold">{flow.cloneCount ?? 0}</span> clone{(flow.cloneCount ?? 0) !== 1 ? "s" : ""}
          </div>
          {(flow.sandboxRunCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-500/80" title="Tested by this many people">
              <FlaskConical size={11} />
              <span className="font-bold">{flow.sandboxRunCount}</span> tested
            </div>
          )}
          <span className="text-muted-foreground">·</span>
          by{" "}
          {flow.userId ? (
            <Link
              href={`/store/creator/${flow.userId}`}
              className="font-bold text-[11px] text-violet-500 hover:underline flex items-center gap-1"
            >
              {creatorHandle}
              {flow.isVerified && (
                <span title="Verified Creator" className="text-sky-400 text-[10px]">✓</span>
              )}
            </Link>
          ) : (
            <span className="font-bold text-[11px] text-foreground">{creatorHandle}</span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(flow.updated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          {flow.isFeatured && (
            <span className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/30 rounded-full text-[9px] font-black text-violet-400">
              ✦ Featured
            </span>
          )}
        </div>

        {/* Tags */}
        {flow.tags && flow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flow.tags.map(tag => (
              <span key={tag} className="text-[9px] px-2 py-0.5 bg-muted border border-border rounded-full text-muted-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Compatibility */}
        {(compat.ai.length > 0 || compat.oauth.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {compat.ai.map(provider => (
              <span
                key={provider}
                className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wide"
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
                className="text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wide"
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

        {/* Freshness warning */}
        {isStale && (
          <p className="text-[10px] text-amber-500/80">⚠ Last updated {monthsAgo} month{monthsAgo !== 1 ? "s" : ""} ago — may be outdated</p>
        )}

        {/* What's new / Changelog */}
        {flow.changelog && (
          <div className="flex items-start gap-2.5 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <Sparkles size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400 mb-1">What&apos;s New</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{flow.changelog}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {flow.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {flow.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href={`/sandbox/${flow.id}`}
            onClick={() => incrementSandboxRunCount(flow.id).catch(() => {})}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <ExternalLink size={11} />
            Open Sandbox
          </Link>

          <button
            onClick={handleClone}
            disabled={cloning || cloned}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border",
              cloned
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : cloneError
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  : "bg-violet-500/5 border-violet-500/20 text-violet-500 hover:bg-violet-500/10"
            )}
          >
            {cloning ? <Loader2 size={11} className="animate-spin" /> : cloned ? <CheckCircle size={11} /> : <Copy size={11} />}
            {cloned ? "Opening…" : cloneError ? "Failed" : "Clone Agent"}
          </button>

          <button
            onClick={() => { setWorkflowOpen(true); incrementViewCount(flow.id).catch(() => {}); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <Workflow size={11} />
            Workflow
          </button>

          <button
            onClick={() => { setCodeOpen(true); incrementViewCount(flow.id).catch(() => {}); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 text-[11px] font-bold text-sky-500 hover:bg-sky-500/10 transition-all"
          >
            <Code2 size={11} />
            View Code
          </button>

          {isOtherCreator && (
            <button
              onClick={() => setTipOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 transition-all"
            >
              <Heart size={11} />
              Support Creator
            </button>
          )}
        </div>
      </div>

      {/* API Access */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">API Access</h2>
        <p className="text-[11px] text-muted-foreground">
          Trigger this agent programmatically via webhook, or connect it to any MCP-compatible client like Claude Desktop or Cursor.
        </p>

        {/* Webhook */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <Link2 size={10} />
            Webhook
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border rounded-xl">
            <code className="flex-1 text-[11px] font-mono text-foreground truncate">
              POST {typeof window !== "undefined" ? window.location.origin : ""}/api/webhook/{flow.id}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/webhook/${flow.id}`);
                setCopiedWebhook(true);
                setTimeout(() => setCopiedWebhook(false), 2000);
              }}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              {copiedWebhook ? <CheckCircle size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copiedWebhook ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground pl-1">
            Body: <code className="font-mono bg-muted px-1 rounded">{"{ input: string, apiKeys?: object }"}</code>
          </p>
        </div>

        {/* MCP */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <Cpu size={10} />
            MCP Endpoint
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border border-border rounded-xl">
            <code className="flex-1 text-[11px] font-mono text-foreground truncate">
              POST {typeof window !== "undefined" ? window.location.origin : ""}/api/mcp
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/mcp`);
                setCopiedMcp(true);
                setTimeout(() => setCopiedMcp(false), 2000);
              }}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              {copiedMcp ? <CheckCircle size={10} className="text-emerald-500" /> : <Copy size={10} />}
              {copiedMcp ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground pl-1">
            Add to Claude Desktop or Cursor — this agent appears as a callable tool named{" "}
            <code className="font-mono bg-muted px-1 rounded">
              {flow.name?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ?? flow.id}
            </code>
          </p>
        </div>
      </div>

      {/* Comments */}
      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">
          Comments ({commentCount})
        </h2>

        {currentUserId ? (
          <div className="flex gap-3 items-end">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              placeholder="Write a comment…"
              rows={3}
              maxLength={1000}
              className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 transition-colors"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || posting}
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500 text-white disabled:opacity-40 hover:bg-violet-600 transition-colors flex-shrink-0"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-violet-500 hover:underline font-semibold">Sign in</Link> to leave a comment.
          </p>
        )}

        {commentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
        ) : (
          <ul className="space-y-4">
            {comments.map(c => {
              const canDelete = currentUserId && (c.userId === currentUserId || flow.userId === currentUserId);
              return (
                <li key={c.id} className="flex gap-3 group/comment">
                  <span className="flex-shrink-0 h-8 w-8 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-sm font-black flex items-center justify-center">
                    {c.authorName[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{c.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={deletingComment === c.id}
                          className="ml-auto opacity-0 group-hover/comment:opacity-100 flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-rose-500 transition-all"
                          title="Delete comment"
                        >
                          {deletingComment === c.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Trash2 size={11} />}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed break-words">{c.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Related agents */}
      {related.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">Related Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map(r => (
              <RelatedMiniCard key={r.id} flow={r} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
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

      {/* Tip / Support Creator modal */}
      {tipOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setTipOpen(false); }}
        >
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <p className="text-sm font-black text-foreground flex items-center gap-2">
                <Heart size={13} className="text-rose-500" />
                Support Creator
              </p>
              <button onClick={() => setTipOpen(false)} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">
                ×
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Heart size={24} className="text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground mb-1">Creator Support Coming Soon</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  We&apos;re building a way to tip and support creators directly on AgentForge. Star the agent to show your appreciation for now!
                </p>
              </div>
              <button
                onClick={() => { setTipOpen(false); handleStar(); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm font-bold text-amber-500 hover:bg-amber-500/20 transition-all"
              >
                <Star size={13} className={starred ? "fill-current" : ""} />
                {starred ? "Already Starred!" : "Star this Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setReportOpen(false); }}
        >
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <p className="text-sm font-black text-foreground flex items-center gap-2">
                <Flag size={13} className="text-amber-500" />
                Report Agent
              </p>
              <button onClick={() => setReportOpen(false)} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">
                ×
              </button>
            </div>
            {reportDone ? (
              <div className="px-4 py-6 text-center">
                <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-bold text-foreground">Report submitted. Thank you!</p>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-3">
                <p className="text-[11px] text-muted-foreground">Select the reason for reporting:</p>
                <div className="flex flex-col gap-1.5">
                  {REPORT_REASONS.map(r => (
                    <label key={r} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="detail-reason"
                        value={r}
                        checked={reportReason === r}
                        onChange={() => setReportReason(r)}
                        className="accent-violet-500"
                      />
                      <span className={cn(
                        "text-[11px] font-medium",
                        reportReason === r ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {r}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setReportOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={reporting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {reporting ? <Loader2 size={9} className="animate-spin" /> : <Flag size={9} />}
                    Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
