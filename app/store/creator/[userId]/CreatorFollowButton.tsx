"use client";

import React, { useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toggleFollow } from "@/app/actions/flow";
import { cn } from "@/lib/utils";

interface CreatorFollowButtonProps {
  targetUserId: string;
  initialFollowing: boolean;
  currentUserId: string;
}

export default function CreatorFollowButton({ targetUserId, initialFollowing, currentUserId }: CreatorFollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (loading || currentUserId === targetUserId) return;
    setLoading(true);
    const newFollowing = !following;
    setFollowing(newFollowing);
    const result = await toggleFollow(targetUserId);
    if (!result.success) setFollowing(!newFollowing);
    setLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[11px] font-bold transition-all flex-shrink-0",
        following
          ? "bg-sky-500/10 border-sky-500/30 text-sky-500 hover:bg-sky-500/20"
          : "border-border text-muted-foreground hover:text-sky-500 hover:border-sky-500/30"
      )}
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : following
          ? <UserCheck size={12} />
          : <UserPlus size={12} />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
