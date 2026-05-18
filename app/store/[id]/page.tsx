import { notFound } from "next/navigation";
import { getStoreFlowDetail, getRelatedFlows, getUserStarredFlows, getUserWishlist, getCreatorFlows } from "@/app/actions/flow";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/ui/Navbar";
import DetailClient from "./DetailClient";

const MULTIMODAL_PROVIDERS = new Set(["gemini", "openai", "anthropic", "auto"]);

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ flow }, supabase] = await Promise.all([getStoreFlowDetail(id), createClient()]);
  if (!flow) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const currentUserName = user
    ? (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || null)
    : null;

  const creatorId = flow.userId ?? null;

  const [relatedResult, starredIds, wishlistedIds, creatorFlows] = await Promise.all([
    getRelatedFlows(id, 3),
    currentUserId ? getUserStarredFlows(currentUserId) : Promise.resolve([]),
    currentUserId ? getUserWishlist(currentUserId) : Promise.resolve([]),
    creatorId ? getCreatorFlows(creatorId) : Promise.resolve({ flows: [] }),
  ]);

  // Compute verified status: creator with 3+ agents AND 50+ total stars
  const cFlows = creatorFlows.flows ?? [];
  const creatorTotalStars = cFlows.reduce((acc: number, f: any) => acc + (f._count?.stars ?? 0), 0);
  const isVerified = cFlows.length >= 3 && creatorTotalStars >= 50;

  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];

  const storeFlow = {
    id: flow.id,
    name: flow.name ?? "Untitled Agent",
    description: flow.description ?? null,
    thumbnail: flow.thumbnail ?? null,
    userId: creatorId,
    creatorName: flow.creatorName ?? (flow.userId === currentUserId ? currentUserName : null),
    updated_at: flow.updated_at!,
    created_at: flow.created_at!,
    isMultimodal: nodes.some((n: any) => n?.type === "ai" && MULTIMODAL_PROVIDERS.has(n?.data?.provider)),
    nodes,
    edges,
    viewCount: flow.viewCount ?? 0,
    cloneCount: flow.cloneCount ?? 0,
    sandboxRunCount: (flow as any).sandboxRunCount ?? 0,
    changelog: (flow as any).changelog ?? null,
    starCount: flow._count?.stars ?? 0,
    commentCount: flow._count?.comments ?? 0,
    tags: Array.isArray(flow.tags) ? flow.tags : [],
    isFeatured: flow.isFeatured ?? false,
    isStarred: starredIds.includes(flow.id),
    isWishlisted: wishlistedIds.includes(flow.id),
    isVerified,
    sourceFlowId: (flow as any).sourceFlowId ?? null,
  };

  const related = (relatedResult.flows ?? []).map((f: any) => ({
    id: f.id,
    name: f.name ?? "Untitled Agent",
    description: f.description ?? null,
    thumbnail: f.thumbnail ?? null,
    userId: f.userId ?? null,
    creatorName: f.creatorName ?? null,
    updated_at: f.updated_at!,
    created_at: f.created_at!,
    isMultimodal: Array.isArray(f.nodes) && f.nodes.some((n: any) => n?.type === "ai" && MULTIMODAL_PROVIDERS.has(n?.data?.provider)),
    nodes: Array.isArray(f.nodes) ? f.nodes : [],
    edges: Array.isArray(f.edges) ? f.edges : [],
    viewCount: f.viewCount ?? 0,
    cloneCount: f.cloneCount ?? 0,
    starCount: f._count?.stars ?? 0,
    commentCount: f._count?.comments ?? 0,
    tags: Array.isArray(f.tags) ? f.tags : [],
    isFeatured: f.isFeatured ?? false,
    isStarred: starredIds.includes(f.id),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <DetailClient flow={storeFlow} related={related} currentUserId={currentUserId} />
    </div>
  );
}
