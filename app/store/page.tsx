import React from "react";
import { getDeployedFlows, getUserStarredFlows, getUserWishlist } from "@/app/actions/flow";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/ui/Navbar";
import StoreClient from "./StoreClient";
import { type StoreFlow } from "./AgentGrid";

export const revalidate = 60;

const MULTIMODAL_PROVIDERS = new Set(["gemini", "openai", "anthropic", "auto"]);

function detectMultimodal(nodes: unknown): boolean {
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (n: any) => n?.type === "ai" && MULTIMODAL_PROVIDERS.has(n?.data?.provider)
  );
}

export default async function StorePage() {
  const [{ flows: raw }, supabase] = await Promise.all([
    getDeployedFlows(),
    createClient(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const currentUserName = user
    ? (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null)
    : null;

  const [starredFlowIds, wishlistedFlowIds] = await Promise.all([
    currentUserId ? getUserStarredFlows(currentUserId) : Promise.resolve([]),
    currentUserId ? getUserWishlist(currentUserId) : Promise.resolve([]),
  ]);

  // Compute verified status per creator: 3+ agents AND 50+ total stars
  const creatorStats = new Map<string, { count: number; stars: number }>();
  for (const f of (raw ?? [])) {
    if (!f.userId) continue;
    const prev = creatorStats.get(f.userId) ?? { count: 0, stars: 0 };
    creatorStats.set(f.userId, {
      count: prev.count + 1,
      stars: prev.stars + (f._count?.stars ?? 0),
    });
  }
  const isVerifiedCreator = (userId: string | null) => {
    if (!userId) return false;
    const s = creatorStats.get(userId);
    return !!s && s.count >= 3 && s.stars >= 50;
  };

  const flows: StoreFlow[] = (raw ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    description: f.description ?? null,
    thumbnail: f.thumbnail ?? null,
    userId: f.userId ?? null,
    creatorName: f.creatorName ?? (f.userId === currentUserId ? currentUserName : null),
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
    isVerified: isVerifiedCreator(f.userId),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <StoreClient flows={flows} currentUserId={currentUserId} starredFlowIds={starredFlowIds} wishlistedFlowIds={wishlistedFlowIds} />
    </div>
  );
}
