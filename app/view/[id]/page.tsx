import { notFound } from "next/navigation";
import { getFlow } from "@/app/actions/flow";
import { Lock } from "lucide-react";
import SharedViewContent from "@/components/flow/SharedViewContent";
import { createClient } from "@/lib/supabase/server";

interface ViewPageProps {
  params: Promise<{ id: string }>;
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

  const isEditable: boolean = !!flow.publicEditable;

  return (
    <SharedViewContent 
      flow={flow} 
      editable={isEditable} 
    />
  );
}
