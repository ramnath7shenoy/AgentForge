"use client";

import { useEffect, useMemo } from "react";

import { getFlowRoomId } from "@/lib/liveblocks/rooms";
import { useFlowStore } from "@/stores/flowStore";

const COLLAB_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#be123c",
  "#4f46e5",
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
  const existing = window.localStorage.getItem("agentforge_collab_name");
  if (existing) return existing;

  const name = `Guest ${Math.floor(Math.random() * 900 + 100)}`;
  window.localStorage.setItem("agentforge_collab_name", name);
  return name;
}

interface FlowCollaborationProps {
  flowId?: string | null;
  enabled: boolean;
  displayName?: string | null;
}

export default function FlowCollaboration({
  flowId,
  enabled,
  displayName,
}: FlowCollaborationProps) {
  const enterRoom = useFlowStore((state) => state.liveblocks.enterRoom);
  const leaveRoom = useFlowStore((state) => state.liveblocks.leaveRoom);
  const setCollaborationUser = useFlowStore((state) => state.setCollaborationUser);
  const setCollaborationCursor = useFlowStore((state) => state.setCollaborationCursor);

  const localUser = useMemo(() => {
    const name = displayName?.trim() || getLocalGuestName();
    return {
      name,
      color: colorForName(name),
    };
  }, [displayName]);

  useEffect(() => {
    setCollaborationUser(localUser);
  }, [localUser, setCollaborationUser]);

  useEffect(() => {
    if (!enabled || !flowId) return;

    enterRoom(getFlowRoomId(flowId));

    return () => {
      setCollaborationCursor(null);
      leaveRoom();
    };
  }, [enabled, enterRoom, flowId, leaveRoom, setCollaborationCursor]);

  return null;
}
