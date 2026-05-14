"use client";
import { createClient } from "@liveblocks/client";

export const liveblocksClient = createClient({
  authEndpoint: async (room) => {
    const res = await fetch("/api/liveblocks-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room }),
    });
    if (!res.ok) throw new Error(`Liveblocks auth failed: ${res.status}`);
    return res.json();
  },
});
