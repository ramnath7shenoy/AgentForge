"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Zap, ArrowRight, X, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import AgentGrid, { type StoreFlow } from "./AgentGrid";

const CATEGORIES = ["All", "Vision", "Text", "Logic", "Productivity"] as const;
type Category = typeof CATEGORIES[number];

function detectCategory(flow: StoreFlow): Category {
  if (flow.isMultimodal) return "Vision";
  const types = new Set(flow.nodes.map((n: any) => n.type as string));
  if (["router", "decision", "gatekeeper"].some(t => types.has(t))) return "Logic";
  if (["trigger", "action", "fetch", "webhook", "appaction"].some(t => types.has(t))) return "Productivity";
  return "Text";
}

interface StoreClientProps {
  flows: StoreFlow[];
  currentUserId: string | null;
}

type SortOrder = "recent" | "popular";

export default function StoreClient({ flows, currentUserId }: StoreClientProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  const filtered = useMemo(() => {
    let result = flows;
    if (activeCategory !== "All") {
      result = result.filter(f => detectCategory(f) === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q)
      );
    }
    if (sortOrder === "popular") {
      result = [...result].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    }
    return result;
  }, [flows, activeCategory, search, sortOrder]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = { All: flows.length, Vision: 0, Text: 0, Logic: 0, Productivity: 0 };
    for (const f of flows) counts[detectCategory(f)]++;
    return counts;
  }, [flows]);

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border">
        {/* Animated dot-grid background */}
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            animation: "heroDrift 20s linear infinite",
          }}
        />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-gradient-radial-hero pointer-events-none" />

        <div className="relative max-w-7xl mx-auto w-full px-6 pt-16 pb-12 flex flex-col items-center text-center gap-5">
          {/* Brand */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/40 backdrop-blur-sm">
            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Zap size={9} className="text-white fill-current" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              AgentForge Store
            </span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-[0.06em] text-foreground leading-[0.9]">
              Agent
              <span className="bg-gradient-to-r from-violet-500 to-indigo-400 bg-clip-text text-transparent">Store</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed font-medium">
              Discover, clone, and deploy community-built AI workflows instantly.
            </p>
          </div>

          {/* Search */}
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

          {/* Deploy CTA */}
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

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-20 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto w-full px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all shrink-0",
                activeCategory === cat
                  ? "bg-foreground text-background border-transparent"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {cat}
              <span className={cn(
                "font-mono text-[8px]",
                activeCategory === cat ? "opacity-60" : "opacity-40"
              )}>
                {categoryCounts[cat]}
              </span>
            </button>
          ))}

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
          </div>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {filtered.length === 0 && (search || activeCategory !== "All") ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-3">
            <p className="text-sm font-black uppercase tracking-[0.15em] text-foreground">No results</p>
            <p className="text-[11px] text-muted-foreground">
              Try a different search term or category.
            </p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("All"); }}
              className="mt-2 px-4 py-2 rounded-xl border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <AgentGrid flows={filtered} currentUserId={currentUserId} />
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
