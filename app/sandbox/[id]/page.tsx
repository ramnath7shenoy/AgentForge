import { notFound } from "next/navigation";
import { getFlow } from "@/app/actions/flow";
import { createClient } from "@/lib/supabase/server";
import SandboxClient from "./SandboxClient";

interface SandboxPageProps {
  params: Promise<{ id: string }>;
}

export default async function SandboxPage({ params }: SandboxPageProps) {
  const { id } = await params;
  const result = await getFlow(id);

  if (!result.success || !result.flow) {
    notFound();
  }

  const flow = result.flow as any;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === flow.userId;

  if (!flow.isPublic && !isOwner) {
    notFound();
  }

  return (
    <SandboxClient
      flowId={flow.id}
      flowName={flow.name || "Untitled Agent"}
      description={flow.description || ""}
      nodes={flow.nodes || []}
      edges={flow.edges || []}
    />
  );
}
