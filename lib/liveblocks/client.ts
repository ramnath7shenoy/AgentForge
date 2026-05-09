"use client";

import { createClient } from "@liveblocks/client";

export const liveblocksClient = createClient({
  authEndpoint: "/api/liveblocks-auth",
});
