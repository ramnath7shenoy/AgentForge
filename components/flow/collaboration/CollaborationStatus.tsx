"use client";
import { useState } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

function getOtherUser(other: any) {
  return other?.info || other?.presence?.collaborationUser || { name: "Guest", color: "#64748b" };
}

export default function CollaborationStatus() {
  const liveblocks = useFlowStore((s) => (s as any).liveblocks);
  const self = useFlowStore((s) => s.collaborationUser);
  const [showPanel, setShowPanel] = useState(false);

  if (!liveblocks) return null;

  const others = liveblocks.others ?? [];
  const status = liveblocks.status ?? "disconnected";
  const isStorageLoading = liveblocks.isStorageLoading ?? false;

  const isConnected = status === "connected" && !isStorageLoading;
  const isSyncing = status === "connecting" || status === "reconnecting" || isStorageLoading;

  if (status === "initial" || status === "disconnected") return null;

  const visibleOthers = others.slice(0, 4);
  const extraCount = others.length - 4;

  return (
    <div className="relative flex items-center gap-2">
      {isConnected ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      ) : isSyncing ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Syncing…
        </span>
      ) : null}

      {others.length > 0 && (
        <button
          onClick={() => setShowPanel((p) => !p)}
          className="flex items-center -space-x-1.5"
          title={`${others.length} collaborator${others.length !== 1 ? "s" : ""} online`}
        >
          {visibleOthers.map((other: any, i: number) => {
            const u = getOtherUser(other);
            return (
              <span
                key={other.connectionId ?? i}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white shadow"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {u.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            );
          })}
          {extraCount > 0 && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-slate-600 text-[10px] font-bold text-white shadow">
              +{extraCount}
            </span>
          )}
        </button>
      )}

      {showPanel && others.length > 0 && (
        <div className="absolute right-0 top-9 z-[200] w-56 rounded-xl border border-border bg-popover p-3 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Online now
          </p>
          <ul className="space-y-2">
            {others.map((other: any, i: number) => {
              const u = getOtherUser(other);
              const hoveredNodeId = other?.presence?.hoveredNodeId;
              return (
                <li key={other.connectionId ?? i} className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-foreground">{u.name}</p>
                    {hoveredNodeId && (
                      <p className="truncate text-[10px] text-muted-foreground">hovering a node</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
