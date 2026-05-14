"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  CheckCircle,
  Loader2,
  ImageIcon,
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
} from "lucide-react";
import { cloneFlow, incrementViewCount, getFlowComments, postFlowComment, deleteFlowComment } from "@/app/actions/flow";
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
  isMultimodal: boolean;
  nodes: any[];
  edges: any[];
  viewCount?: number | null;
  commentCount?: number;
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
      {/* Post input */}
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

      {/* Comments list */}
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

function AgentCard({ flow, currentUserId }: { flow: StoreFlow; currentUserId: string | null }) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(flow.commentCount ?? 0);

  const isOwner = currentUserId && flow.userId === currentUserId;
  const creatorHandle = flow.creatorName || (flow.userId ? flow.userId.slice(-8).toUpperCase() : "COMMUNITY");

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

  const toggleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentsOpen(p => !p);
  };

  return (
    <>
      <div className="group relative flex flex-col bg-card border border-border rounded-2xl overflow-hidden hover:border-violet-500/40 dark:hover:border-violet-400/30 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-200 backdrop-blur-sm">
        {/* Thumbnail */}
        <div className="relative h-36 overflow-hidden border-b border-border">
          {flow.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
          ) : (
            <AgentVisual agentId={flow.id} width={320} height={144} className="w-full h-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          {isOwner && (
            <ManagePanel flowId={flow.id} flowName={flow.name} flowDescription={flow.description} />
          )}
          {flow.isMultimodal && (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 bg-sky-500/15 border border-sky-500/30 rounded-full backdrop-blur-sm">
              <ImageIcon size={9} className="text-sky-400" />
              <span className="text-[8px] font-black uppercase tracking-wider text-sky-400">Multimodal</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <h3 className="text-sm font-black text-foreground leading-snug truncate group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
            {flow.name || "Untitled Agent"}
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[9px] font-bold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded" title="Deployed by">
              by {creatorHandle}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {new Date(flow.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            {/* View count — always shown */}
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground ml-auto">
              <Eye size={9} />
              {formatViews(flow.viewCount ?? 0)}
            </span>
          </div>

          {flow.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
              {flow.description}
            </p>
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

          {/* Comments toggle */}
          <button
            onClick={toggleComments}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
          >
            <MessageSquare size={9} />
            {commentCount > 0 ? `${commentCount} Comment${commentCount !== 1 ? "s" : ""}` : "Comments"}
            {commentsOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </button>
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
}: {
  flows: StoreFlow[];
  currentUserId: string | null;
}) {
  if (flows.length === 0) return <AgentGridEmpty />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start">
      {flows.map((flow) => (
        <AgentCard key={flow.id} flow={flow} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
