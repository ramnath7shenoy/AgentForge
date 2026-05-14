import React from "react";
import { getDeployedFlows } from "@/app/actions/flow";
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

  const flows: StoreFlow[] = (raw ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    description: f.description ?? null,
    thumbnail: f.thumbnail ?? null,
    userId: f.userId ?? null,
    creatorName: f.creatorName ?? null,
    updated_at: f.updated_at,
    isMultimodal: detectMultimodal(f.nodes),
    nodes: Array.isArray(f.nodes) ? f.nodes : [],
    edges: Array.isArray(f.edges) ? f.edges : [],
    viewCount: f.viewCount ?? 0,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <StoreClient flows={flows} currentUserId={currentUserId} />
    </div>
  );
}
