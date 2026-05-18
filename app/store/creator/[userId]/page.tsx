import React from "react";
import { getCreatorFlows } from "@/app/actions/flow";
import { getFollowStatus } from "@/app/actions/community";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/ui/Navbar";
import Link from "next/link";
import { ArrowLeft, Star, Eye, Package, FlaskConical } from "lucide-react";
import AgentGrid, { type StoreFlow } from "@/app/store/AgentGrid";
import FollowButton from "./FollowButton";

const MULTIMODAL_PROVIDERS = new Set(["gemini", "openai", "anthropic", "auto"]);

function detectMultimodal(nodes: unknown): boolean {
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (n: any) => n?.type === "ai" && MULTIMODAL_PROVIDERS.has(n?.data?.provider)
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default async function CreatorPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const [{ flows: raw }, supabase, followData] = await Promise.all([
    getCreatorFlows(userId),
    createClient(),
    getFollowStatus(userId),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const isOwnProfile = currentUserId === userId;
  const currentUserName = user
    ? (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null)
    : null;

  const rawFlows = raw ?? [];

  const flows: StoreFlow[] = rawFlows.map((f: any) => ({
    id: f.id,
    name: f.name,
    description: f.description ?? null,
    thumbnail: f.thumbnail ?? null,
    userId: f.userId ?? null,
    creatorName: f.creatorName ?? null,
    updated_at: f.updated_at,
    created_at: f.created_at,
    isMultimodal: detectMultimodal(f.nodes),
    nodes: Array.isArray(f.nodes) ? f.nodes : [],
    edges: Array.isArray(f.edges) ? f.edges : [],
    viewCount: f.viewCount ?? 0,
    commentCount: f._count?.comments ?? 0,
    starCount: f._count?.stars ?? 0,
    tags: Array.isArray(f.tags) ? f.tags : [],
    isFeatured: f.isFeatured ?? false,
    cloneCount: f.cloneCount ?? 0,
    sandboxRunCount: f.sandboxRunCount ?? 0,
    changelog: f.changelog ?? null,
  }));

  const creatorName = flows[0]?.creatorName ?? (isOwnProfile ? currentUserName : null) ?? "Creator";
  const totalStars = flows.reduce((acc, f) => acc + (f.starCount ?? 0), 0);
  const totalViews = flows.reduce((acc, f) => acc + (f.viewCount ?? 0), 0);
  const totalClones = flows.reduce((acc, f) => acc + (f.cloneCount ?? 0), 0);
  const totalSandboxRuns = flows.reduce((acc, f) => acc + (f.sandboxRunCount ?? 0), 0);
  const isVerified = flows.length >= 3 && totalStars >= 50;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* Back */}
        <Link
          href="/store"
          className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft size={12} />
          Back to Store
        </Link>

        {/* Profile header */}
        <div className="flex items-start gap-5 p-6 bg-card border border-border rounded-2xl">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
            {creatorName[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-foreground">{creatorName}</h1>
              {isVerified && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 border border-sky-500/30 rounded-full text-[9px] font-black text-sky-400">
                  ✓ Verified Creator
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package size={11} />
                <span className="font-bold text-foreground">{flows.length}</span> agent{flows.length !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <Star size={11} className="text-amber-400 fill-current" />
                <span className="font-bold text-foreground">{formatNum(totalStars)}</span> stars
              </span>
              <span className="flex items-center gap-1">
                <Eye size={11} />
                <span className="font-bold text-foreground">{formatNum(totalViews)}</span> views
              </span>
              <span className="flex items-center gap-1">
                <Package size={11} className="text-violet-400" />
                <span className="font-bold text-foreground">{formatNum(totalClones)}</span> clones
              </span>
              {totalSandboxRuns > 0 && (
                <span className="flex items-center gap-1">
                  <FlaskConical size={11} className="text-emerald-400" />
                  <span className="font-bold text-foreground">{formatNum(totalSandboxRuns)}</span> tested
                </span>
              )}
            </div>
          </div>
          {!isOwnProfile && currentUserId && (
            <FollowButton
              creatorId={userId}
              initialFollowing={followData.following}
              initialCount={followData.followerCount}
              currentUserId={currentUserId}
            />
          )}
          {followData.followerCount > 0 && isOwnProfile && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {followData.followerCount} follower{followData.followerCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Analytics (own profile only) */}
        {isOwnProfile && flows.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Analytics Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Views", value: formatNum(totalViews), icon: "👁", color: "text-blue-400" },
                { label: "Total Stars", value: formatNum(totalStars), icon: "⭐", color: "text-amber-400" },
                { label: "Total Clones", value: formatNum(totalClones), icon: "📋", color: "text-violet-400" },
                { label: "Sandbox Runs", value: formatNum(totalSandboxRuns), icon: "🧪", color: "text-emerald-400" },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col gap-1 p-4 bg-card border border-border rounded-xl">
                  <span className="text-xl">{stat.icon}</span>
                  <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Per-agent breakdown */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Agent Performance</p>
              </div>
              <div className="divide-y divide-border">
                {flows.slice(0, 10).map(f => (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <Link href={`/store/${f.id}`} className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground truncate hover:text-violet-500 transition-colors">{f.name}</p>
                    </Link>
                    <div className="flex items-center gap-3 text-[9px] text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <Eye size={9} />
                        {formatNum(f.viewCount ?? 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={9} className="text-amber-400 fill-current" />
                        {f.starCount ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package size={9} className="text-violet-400" />
                        {f.cloneCount ?? 0}
                      </span>
                      {(f.sandboxRunCount ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-emerald-500/70">
                          <FlaskConical size={9} />
                          {f.sandboxRunCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agents grid */}
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-5">
            Agents by {creatorName}
          </h2>
          <AgentGrid flows={flows} currentUserId={currentUserId} starredFlowIds={[]} />
        </div>
      </div>
    </div>
  );
}
