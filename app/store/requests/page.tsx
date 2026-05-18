import { getRequests } from "@/app/actions/community";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/ui/Navbar";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RequestsClient from "./RequestsClient";

export default async function RequestsPage() {
  const [{ requests }, supabase] = await Promise.all([
    getRequests("top"),
    createClient(),
  ]);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
        <Link
          href="/store"
          className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft size={12} />
          Back to Store
        </Link>
        <RequestsClient requests={requests as any} currentUserId={user?.id ?? null} />
      </div>
    </div>
  );
}
