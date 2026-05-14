import type { Json } from "@liveblocks/client";

export type CollaborationCursorPoint = {
  x: number;
  y: number;
  [key: string]: Json | undefined;
};

export type CollaborationCursor = CollaborationCursorPoint | null;

export type CollaborationUser = {
  name: string;
  color: string;
  [key: string]: Json | undefined;
};

declare global {
  interface Liveblocks {
    Presence: {
      collaborationCursor: CollaborationCursor;
      collaborationUser: CollaborationUser | null;
      hoveredNodeId: string | null;
      selectedNodeId: string | null;
    };
    Storage: {
      nodes: Json;
      edges: Json;
      thread: Json;
    };
    UserMeta: {
      id: string;
      info: {
        name?: string;
        color?: string;
        email?: string | null;
        isGuest?: boolean;
        [key: string]: Json | undefined;
      };
    };
  }
}
