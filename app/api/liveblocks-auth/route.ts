import { NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getFlowIdFromRoom } from "@/lib/liveblocks/rooms";

export const runtime = "nodejs";

const COLLAB_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#9333ea",
  "#ea580c", "#0891b2", "#be123c", "#4f46e5",
];

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % COLLAB_COLORS.length;
  }
  return COLLAB_COLORS[hash];
}

function displayNameFromUser(user: any) {
  const metadata = user?.user_metadata;
  const metadataName =
    typeof metadata?.full_name === "string" ? metadata.full_name
    : typeof metadata?.name === "string" ? metadata.name
    : typeof metadata?.preferred_username === "string" ? metadata.preferred_username
    : null;
  if (metadataName?.trim()) return metadataName.trim();
  if (!user?.email) return "Guest";
  const name = user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return name || user.email;
}

const GUEST_COOKIE = "agentforge_liveblocks_guest_id";

async function getGuestId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_COOKIE)?.value;
  if (existing) return existing;
  const guestId = crypto.randomUUID();
  cookieStore.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return guestId;
}

export async function POST(request: NextRequest) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) return new Response("LIVEBLOCKS_SECRET_KEY not configured", { status: 500 });

  const body = await request.json().catch(() => ({}));
  const { room } = body;
  if (!room) return new Response("Missing room", { status: 400 });

  const flowId = getFlowIdFromRoom(room);
  if (!flowId) return new Response("Invalid room", { status: 403 });

  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { userId: true, isPublic: true, publicEditable: true },
  });
  if (!flow) return new Response("Flow not found", { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isOwner = !!user && user.id === flow.userId;
  const isPublic = !!flow.isPublic;
  const canView = isOwner || isPublic;
  const canEdit = isOwner || (isPublic && !!flow.publicEditable);

  if (!canView) return new Response("Unauthorized", { status: 403 });

  const userId = user?.id ?? `guest:${await getGuestId()}`;
  const userInfo = {
    name: displayNameFromUser(user),
    email: user?.email ?? null,
    color: colorForId(userId),
    isGuest: !user,
  };

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(userId, { userInfo });
  session.allow(room, canEdit ? session.FULL_ACCESS : session.READ_ACCESS);

  const { body: responseBody, status } = await session.authorize();
  return new Response(responseBody, { status });
}
