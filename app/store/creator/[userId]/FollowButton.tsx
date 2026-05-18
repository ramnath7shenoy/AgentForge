"use client";

import React, { useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toggleFollowCreator } from "@/app/actions/community";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  creatorId: string;
  initialFollowing: boolean;
  initialCount: number;
  currentUserId: string | null;
}

export default function FollowButton({ creatorId, initialFollowing, initialCount, currentUserId }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  if (!currentUserId) return null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    const prev = following;
    setFollowing(!prev);
    setCount(n => n + (prev ? -1 : 1));
    const result = await toggleFollowCreator(creatorId);
    setFollowing(result.following);
    if (result.following !== !prev) {
      setCount(n => n + (result.following ? 1 : -1) - (prev ? -1 : 1));
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      {count > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {count} follower{count !== 1 ? "s" : ""}
        </span>
      )}
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
    </div>
  );
}
