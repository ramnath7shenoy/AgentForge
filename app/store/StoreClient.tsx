"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Zap, ArrowRight, X, TrendingUp, Clock, Star, Copy, Loader2, CheckCircle, Bookmark, Tag, FolderOpen, MessageCircle } from "lucide-react";
import AgentVisual from "@/components/store/AgentVisual";
import { cn } from "@/lib/utils";
import AgentGrid, { type StoreFlow } from "./AgentGrid";
import { cloneFlow } from "@/app/actions/flow";
import { useRouter } from "next/navigation";

type SortOrder = "recent" | "popular" | "trending" | "clones";

function computeLeaderboard(flows: StoreFlow[]) {
  const map: Record<string, { name: string; stars: number; views: number; count: number; userId: string }> = {};
  for (const f of flows) {
    if (!f.userId) continue;
    if (!map[f.userId]) map[f.userId] = { name: f.creatorName || "Anonymous", stars: 0, views: 0, count: 0, userId: f.userId };
    map[f.userId].stars += f.starCount ?? 0;
    map[f.userId].views += f.viewCount ?? 0;
    map[f.userId].count += 1;
  }
  return Object.values(map).sort((a, b) => b.stars - a.stars).slice(0, 5);
}

interface StoreClientProps {
  flows: StoreFlow[];
  currentUserId: string | null;
  starredFlowIds: string[];
  wishlistedFlowIds?: string[];
}

function MiniFlowCard({
  flow,
  currentUserId,
}: {
  flow: StoreFlow;
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
    <div className="flex-shrink-0 w-[220px] flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-violet-500/40 transition-all">
      <Link href={`/store/${flow.id}`} className="relative h-28 block overflow-hidden border-b border-border">
        {flow.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flow.thumbnail} alt={flow.name} className="w-full h-full object-cover" />
        ) : (
          <AgentVisual agentId={flow.id} name={flow.name} width={220} height={112} className="w-full h-full" />
        )}
      </Link>
      <div className="p-3 flex flex-col gap-2 flex-1">
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


export default function StoreClient({ flows, currentUserId, starredFlowIds, wishlistedFlowIds = [] }: StoreClientProps) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [showWishlist, setShowWishlist] = useState(false);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;

  const featuredFlows = useMemo(() => flows.filter(f => f.isFeatured), [flows]);
  const newThisWeek = useMemo(
    () => flows.filter(f => new Date(f.created_at).getTime() > sevenDaysAgo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flows]
  );
  const leaderboard = useMemo(() => computeLeaderboard(flows), [flows]);

  const filtered = useMemo(() => {
    let result = flows;
    if (showWishlist) {
      result = result.filter(f => wishlistedFlowIds.includes(f.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q) ||
        (f.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (tagFilter.trim()) {
      const q = tagFilter.toLowerCase();
      result = result.filter(f => (f.tags ?? []).some(t => t.toLowerCase().includes(q)));
    }
    if (sortOrder === "popular") {
      result = [...result].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    } else if (sortOrder === "trending") {
      result = [...result].sort((a, b) => {
        const scoreA = (a.viewCount ?? 0) / Math.max(1, (now - new Date(a.created_at).getTime()) / 86400000);
        const scoreB = (b.viewCount ?? 0) / Math.max(1, (now - new Date(b.created_at).getTime()) / 86400000);
        return scoreB - scoreA;
      });
    } else if (sortOrder === "clones") {
      result = [...result].sort((a, b) => (b.cloneCount ?? 0) - (a.cloneCount ?? 0));
    }
    return result;
  }, [flows, search, tagFilter, sortOrder, showWishlist, wishlistedFlowIds, now]);

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            animation: "heroDrift 20s linear infinite",
          }}
        />
        <div className="absolute inset-0 bg-gradient-radial-hero pointer-events-none" />

        <div className="relative max-w-7xl mx-auto w-full px-6 pt-16 pb-12 flex flex-col items-center text-center gap-5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/40 backdrop-blur-sm">
            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Zap size={9} className="text-white fill-current" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              AgentForge Store
            </span>
          </div>

          <div>
            <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-[0.06em] text-foreground leading-[0.9]">
              Agent
              <span className="bg-gradient-to-r from-violet-500 to-indigo-400 bg-clip-text text-transparent">Store</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed font-medium">
              Discover, clone, and deploy community-built AI workflows instantly.
            </p>
          </div>

          <div className="relative w-full max-w-md">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agents…"
              className="w-full pl-10 pr-10 py-3 bg-card border border-border rounded-2xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500/50 transition-colors shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <Link
            href="/publish"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-[11px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity shadow-lg"
          >
            <Zap size={11} className="fill-current" />
            Deploy an Agent
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* ── Featured Section ───────────────────────────────────────────── */}
      {featuredFlows.length > 0 && (
        <div className="border-b border-border">
          <div className="max-w-7xl mx-auto w-full px-6 py-5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">✦ Featured Agents</p>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {featuredFlows.map(flow => (
                <MiniFlowCard key={flow.id} flow={flow} currentUserId={currentUserId} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── New This Week ──────────────────────────────────────────────── */}
      {newThisWeek.length > 0 && (
        <div className="border-b border-border">
          <div className="max-w-7xl mx-auto w-full px-6 py-5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">🆕 New This Week</p>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {newThisWeek.map(flow => (
                <MiniFlowCard key={flow.id} flow={flow} currentUserId={currentUserId} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Creators ───────────────────────────────────────────────── */}
      {leaderboard.length > 0 && (
        <div className="border-b border-border">
          <div className="max-w-7xl mx-auto w-full px-6 py-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Top Creators</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {leaderboard.map((creator, i) => (
                <Link
                  key={creator.userId}
                  href={`/store/creator/${creator.userId}`}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl hover:border-violet-500/40 transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
                    {creator.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-foreground truncate max-w-[80px]">{creator.name}</p>
                    <p className="text-[8px] text-muted-foreground flex items-center gap-1">
                      <Star size={7} className="text-amber-400 fill-current" />
                      {creator.stars}
                      <span className="opacity-40">·</span>
                      {creator.count} agent{creator.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {i === 0 && <span className="text-amber-400 text-[10px] ml-1">🏆</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Community Nav ──────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto w-full px-6 py-4">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Community</p>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/store/collections"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/5 border border-violet-500/20 text-[10px] font-bold text-violet-500 hover:bg-violet-500/10 transition-all"
            >
              <FolderOpen size={10} />
              Collections
            </Link>
            <Link
              href="/store/requests"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] font-bold text-amber-500 hover:bg-amber-500/10 transition-all"
            >
              <MessageCircle size={10} />
              Agent Requests
            </Link>
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Wishlist filter — only if logged in */}
          {currentUserId && (
            <button
              onClick={() => setShowWishlist(v => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all shrink-0",
                showWishlist
                  ? "bg-violet-500 text-white border-transparent"
                  : "bg-transparent text-muted-foreground border-border hover:border-violet-500/40 hover:text-violet-500"
              )}
            >
              <Bookmark size={9} className={showWishlist ? "fill-current" : ""} />
              Saved
              {wishlistedFlowIds.length > 0 && (
                <span className={cn("font-mono text-[8px]", showWishlist ? "opacity-70" : "opacity-40")}>
                  {wishlistedFlowIds.length}
                </span>
              )}
            </button>
          )}

          {/* Tag / keyword filter */}
          <div className="relative shrink-0">
            <Tag size={9} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              placeholder="Filter by tag…"
              className="pl-7 pr-7 py-1.5 rounded-full text-[10px] bg-transparent border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500/50 transition-colors w-32 focus:w-44"
              style={{ transition: "width 0.2s" }}
            />
            {tagFilter && (
              <button
                onClick={() => setTagFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={9} />
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center shrink-0 bg-muted/50 border border-border rounded-full p-0.5 gap-0.5">
            <button
              onClick={() => setSortOrder("recent")}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                sortOrder === "recent"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Clock size={8} /> Recent
            </button>
            <button
              onClick={() => setSortOrder("popular")}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                sortOrder === "popular"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp size={8} /> Popular
            </button>
            <button
              onClick={() => setSortOrder("clones")}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                sortOrder === "clones"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Copy size={8} /> Clones
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
            {showWishlist && wishlistedFlowIds.length === 0 ? (
              <>
                <Bookmark size={32} className="text-muted-foreground opacity-30" />
                <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No saved agents yet</p>
                <p className="text-[11px] text-muted-foreground max-w-xs">
                  Click the <Bookmark size={10} className="inline" /> bookmark icon on any agent card to save it here.
                </p>
                <button
                  onClick={() => setShowWishlist(false)}
                  className="mt-2 px-4 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Browse all agents
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No results</p>
                <p className="text-[11px] text-muted-foreground">
                  Try a different search term or category.
                </p>
                <button
                  onClick={() => { setSearch(""); setTagFilter(""); setShowWishlist(false); }}
                  className="mt-2 px-4 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <AgentGrid flows={filtered} currentUserId={currentUserId} starredFlowIds={starredFlowIds} wishlistedFlowIds={wishlistedFlowIds} />
        )}
      </div>

      <style>{`
        @keyframes heroDrift {
          0% { background-position: 0 0; }
          100% { background-position: 28px 28px; }
        }
        .bg-gradient-radial-hero {
          background: radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--violet-glow, 270 60% 50%) / 0.06), transparent 70%);
        }
      `}</style>
    </div>
  );
}
