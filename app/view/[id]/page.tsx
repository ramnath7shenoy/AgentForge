import { notFound } from "next/navigation";
import { getFlow } from "@/app/actions/flow";
import { Lock } from "lucide-react";
import SharedViewContent from "@/components/flow/SharedViewContent";
import { createClient } from "@/lib/supabase/server";

interface ViewPageProps {
  params: Promise<{ id: string }>;
}

function getDisplayName(user: any) {
  const metadataName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.preferred_username;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (typeof user?.email === "string" && user.email) {
    return user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || user.email;
  }

  return null;
}

export default async function ViewPage({ params }: ViewPageProps) {
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

  const isEditable: boolean = isOwner || !!flow.publicEditable;

  return (
    <SharedViewContent 
      flow={flow} 
      editable={isEditable} 
      currentUserName={getDisplayName(user)}
    />
  );
}
