"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronUp, Plus, X, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { upvoteRequest, createRequest } from "@/app/actions/community";
import { cn } from "@/lib/utils";

interface AgentRequest {
  id: string;
  title: string;
  description: string;
  tags: string[];
  upvotes: number;
  authorName: string;
  createdAt: string;
  fulfilledByFlowId: string | null;
  _count: { upvoteRecords: number };
}

interface RequestsClientProps {
  requests: AgentRequest[];
  currentUserId: string | null;
}

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function SubmitModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: AgentRequest) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || loading) return;
    setLoading(true);
    setError(null);
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const result = await createRequest(title.trim(), description.trim(), tags);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    onCreated(result.request as AgentRequest);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <p className="text-sm font-black text-foreground flex items-center gap-2">
            <Plus size={13} className="text-amber-500" />
            Submit Agent Request
          </p>
          <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="An agent that does..."
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the agent you'd like to see built..."
              rows={4}
              maxLength={2000}
              className="w-full resize-none px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tags (comma-separated)</label>
            <input
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="automation, research, writing"
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          {error && <p className="text-[10px] text-rose-400">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RequestsClient({ requests: initial, currentUserId }: RequestsClientProps) {
  const [requests, setRequests] = useState<AgentRequest[]>(initial);
  const [sort, setSort] = useState<"top" | "recent">("top");
  const [showModal, setShowModal] = useState(false);
  const [upvoting, setUpvoting] = useState<string | null>(null);

  const sorted = [...requests].sort(sort === "top"
    ? (a, b) => b.upvotes - a.upvotes
    : (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleUpvote = async (requestId: string) => {
    if (!currentUserId || upvoting) return;
    setUpvoting(requestId);
    const result = await upvoteRequest(requestId);
    if (result.ok) {
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, upvotes: result.upvotes } : r));
    }
    setUpvoting(null);
  };

  const handleCreated = (r: AgentRequest) => {
    setRequests(prev => [r, ...prev]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">Agent Requests</h1>
          <p className="text-[11px] text-muted-foreground mt-1">Request agents you want built. Upvote to show demand.</p>
        </div>
        {currentUserId ? (
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-500 hover:bg-amber-500/20 transition-all"
          >
            <Plus size={10} />
            Submit Request
          </button>
        ) : (
          <p className="text-[10px] text-muted-foreground flex-shrink-0">
            <Link href="/login" className="text-amber-500 hover:underline font-semibold">Sign in</Link> to submit
          </p>
        )}
      </div>

      {/* Sort tabs */}
      <div className="flex items-center bg-muted/50 border border-border rounded-full p-0.5 w-fit gap-0.5">
        <button
          onClick={() => setSort("top")}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
            sort === "top" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronUp size={9} /> Top Voted
        </button>
        <button
          onClick={() => setSort("recent")}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
            sort === "recent" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Recent
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
          <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No requests yet</p>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Be the first to request an agent you want built by the community!
          </p>
          {currentUserId && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-500 hover:bg-amber-500/20 transition-all"
            >
              Submit first request
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(req => (
            <div key={req.id} className="flex gap-4 p-4 bg-card border border-border rounded-2xl hover:border-amber-500/30 transition-all">
              {/* Upvote */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleUpvote(req.id)}
                  disabled={!currentUserId || upvoting === req.id}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border transition-all",
                    currentUserId
                      ? "border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/15 cursor-pointer"
                      : "border-border text-muted-foreground cursor-default opacity-50"
                  )}
                  title={currentUserId ? "Upvote" : "Sign in to upvote"}
                >
                  {upvoting === req.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <ChevronUp size={12} />
                  }
                  <span className="text-[9px] font-black">{req.upvotes}</span>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-foreground leading-snug">{req.title}</h3>
                  {req.fulfilledByFlowId && (
                    <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[8px] font-black text-emerald-400">
                      <CheckCircle size={8} />
                      Fulfilled
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                  {req.description}
                </p>
                {req.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {req.tags.map(tag => (
                      <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-muted border border-border rounded-full text-muted-foreground font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-muted-foreground">by <span className="font-bold text-foreground">{req.authorName}</span></span>
                  <span className="text-[9px] text-muted-foreground">·</span>
                  <span className="text-[9px] text-muted-foreground">{timeAgo(req.createdAt)}</span>
                  {req.fulfilledByFlowId && (
                    <>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <Link
                        href={`/store/${req.fulfilledByFlowId}`}
                        className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <ExternalLink size={8} />
                        View Agent
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SubmitModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
