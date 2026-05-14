"use client";
import { useEffect, useMemo } from "react";
import { getFlowRoomId } from "@/lib/liveblocks/rooms";
import { useFlowStore } from "@/stores/flowStore";

const COLLAB_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea",
  "#ea580c", "#0891b2", "#be123c", "#4f46e5",
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % COLLAB_COLORS.length;
  }
  return COLLAB_COLORS[hash];
}

function getLocalGuestName() {
  if (typeof window === "undefined") return "Guest";
  const existing = localStorage.getItem("agentforge_collab_name");
  if (existing) return existing;
  const name = `Guest ${Math.floor(Math.random() * 900 + 100)}`;
  localStorage.setItem("agentforge_collab_name", name);
  return name;
}

interface Props {
  flowId?: string | null;
  enabled: boolean;
  displayName?: string | null;
}

export default function FlowCollaboration({ flowId, enabled, displayName }: Props) {
  const enterRoom = useFlowStore((s) => (s as any).liveblocks?.enterRoom);
  const leaveRoom = useFlowStore((s) => (s as any).liveblocks?.leaveRoom);
  const setCollaborationUser = useFlowStore((s) => s.setCollaborationUser);
  const setCollaborationCursor = useFlowStore((s) => s.setCollaborationCursor);

  const localUser = useMemo(() => {
    const name = displayName?.trim() || getLocalGuestName();
    return { name, color: colorForName(name) };
  }, [displayName]);

  useEffect(() => {
    setCollaborationUser(localUser);
  }, [localUser, setCollaborationUser]);

  useEffect(() => {
    if (!enabled || !flowId || !enterRoom) return;
    try {
      enterRoom(getFlowRoomId(flowId));
    } catch {
      // Liveblocks not configured — silently skip collaboration
      return;
    }
    return () => {
      setCollaborationCursor(null);
      if (leaveRoom) {
        // Snapshot nodes/edges before leaveRoom — the Liveblocks middleware resets
        // storageMapping fields (nodes, edges) to [] on disconnect, so we persist
        // a copy to sessionStorage for the publish page to restore from.
        const state = useFlowStore.getState() as any;
        if (state.nodes?.length > 0) {
          try {
            sessionStorage.setItem("agentforge_flow_snapshot", JSON.stringify({
              nodes: state.nodes,
              edges: state.edges || [],
            }));
          } catch {}
        }
        leaveRoom();
      }
    };
  }, [enabled, enterRoom, flowId, leaveRoom, setCollaborationCursor]);

  return null;
}
