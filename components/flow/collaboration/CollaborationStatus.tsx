"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";

import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";
import type { CollaborationUser } from "@/liveblocks.config";

function getOtherUser(other: any): CollaborationUser {
  return (
    other?.info ||
    other?.presence?.collaborationUser || {
      name: "Guest",
      color: "#64748b",
    }
  );
}

interface CollaborationStatusProps {
  enabled: boolean;
}

export default function CollaborationStatus({ enabled }: CollaborationStatusProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const nodes = useFlowStore((state) => state.nodes);
  const self = useFlowStore((state) => state.collaborationUser);
  const others = useFlowStore((state) => state.liveblocks.others);
  const status = useFlowStore((state) => state.liveblocks.status);
  const isStorageLoading = useFlowStore((state) => state.liveblocks.isStorageLoading);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!enabled) return null;

  const otherUsers = others.map(getOtherUser);
  const users = [self, ...otherUsers].filter(Boolean) as CollaborationUser[];
  const connected = status === "connected" && !isStorageLoading;
  const getHoveredLabel = (nodeId?: string | null) => {
    if (!nodeId) return null;
    const node = nodes.find((candidate) => candidate.id === nodeId);
    return node?.data?.label || node?.type || nodeId;
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
          connected
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
            : "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15"
        )}
        title={connected ? "Live collaboration connected" : "Connecting live collaboration"}
      >
        <Users size={12} />
        <span>{connected ? "Live" : "Syncing"}</span>
        <div className="flex -space-x-1">
          {users.slice(0, 4).map((user, index) => (
            <span
              key={`${user.name}-${index}`}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-background text-[9px] text-white shadow-sm"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
          ))}
          {users.length > 4 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-slate-700 text-[8px] text-white">
              +{users.length - 4}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Collaboration
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                  connected
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-500/10 text-amber-500"
                )}
              >
                {connected ? "Connected" : "Connecting"}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Room status: {status}. Storage: {isStorageLoading ? "loading" : "ready"}.
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {users.map((user, index) => {
              const other = index > 0 ? others[index - 1] : null;
              const hoveredLabel = getHoveredLabel(other?.presence?.hoveredNodeId);

              return (
              <div
                key={`${user.name}-${index}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {hoveredLabel
                      ? `Hovering ${hoveredLabel}`
                      : index === 0
                        ? "You"
                        : "Collaborator"}
                  </p>
                </div>
              </div>
              );
            })}

            {otherUsers.length === 0 && (
              <div className="px-2 py-3 text-[10px] leading-relaxed text-muted-foreground">
                No other collaborators are connected to this room yet. Open the same shared editable link in another browser session to test live sync.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
