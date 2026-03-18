'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

/**
 * Save or upsert a flow.
 * - If userId is provided, upserts user record and associates the flow.
 * - If no userId (guest), saves an anonymous flow.
 */
export async function saveFlow(
  userId: string | null,
  name: string,
  nodes: string | object,
  edges: string | object,
  flowId?: string,
  isPublic?: boolean,
  publicEditable?: boolean
) {
  try {
    const parsedNodes = typeof nodes === "string" ? JSON.parse(nodes) : nodes;
    const parsedEdges = typeof edges === "string" ? JSON.parse(edges) : edges;

    // Ensure user exists in public.User table (mirrors Supabase auth.users)
    if (userId) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: user?.email ?? `${userId}@unknown.agentforge.com`,
        }
      });
    }

    const createId = flowId ?? crypto.randomUUID();
    const upsertWhere = flowId
      ? { id: flowId }
      : { id: createId };


    const flow = await prisma.flow.upsert({
      where: upsertWhere,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: {
        name,
        nodes: parsedNodes,
        edges: parsedEdges,
        ...(isPublic !== undefined ? { isPublic } : {}),
        ...(publicEditable !== undefined ? { publicEditable } : {}),
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: {
        id: createId,
        userId: userId ?? null,
        name,
        nodes: parsedNodes,
        edges: parsedEdges,
        isPublic: isPublic ?? false,
        publicEditable: publicEditable ?? false,
      } as any,
    });

    return { success: true, flow }
  } catch (error) {
    console.error('Failed to save flow to database:', error)
    return { success: false, error: 'Failed to save flow' }
  }
}

/**
 * Fetch a single flow by ID.
 */
export async function getFlow(flowId: string) {
  try {
    const flow = await prisma.flow.findUnique({
      where: { id: flowId }
    })
    return { success: true, flow }
  } catch (error) {
    console.error('Failed to fetch flow:', error)
    return { success: false, error: 'Failed to fetch flow' }
  }
}

/**
 * Get the latest flow for the current logged-in user.
 * Falls back to the most recently updated flow if no user.
 */
export async function getLatestFlow() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: true, flow: null, userId: null };
    }

    const flow = await prisma.flow.findFirst({
      where: { userId: user.id },
      orderBy: { updated_at: 'desc' }
    })
    return { success: true, flow, userId: user?.id ?? null }
  } catch (error) {
    console.error('Failed to fetch latest flow:', error)
    return { success: false, error: 'Failed to fetch latest flow', userId: null }
  }
}

/**
 * Get all flows for a specific user (for the Dashboard).
 */
export async function getUserFlows() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, flows: [], error: 'Not authenticated' };

    const flows = await prisma.flow.findMany({
      where: { userId: user.id },
      orderBy: { updated_at: 'desc' },
    });
    return { success: true, flows };
  } catch (error) {
    console.error('Failed to fetch user flows:', error);
    return { success: false, flows: [], error: 'Failed to fetch flows' };
  }
}

/**
 * Set a flow to public (for sharing). Optionally make it editable by guests.
 */
export async function publishFlow(flowId: string, publicEditable?: boolean) {
  try {
    const flow = await prisma.flow.update({
      where: { id: flowId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        isPublic: true,
        ...(publicEditable !== undefined ? { publicEditable } : {}),
      } as any,
    });
    return { success: true, flow };
  } catch (error) {
    console.error('Failed to publish flow:', error);
    return { success: false, error: 'Failed to publish flow' };
  }
}

/**
 * Update nodes/edges of an already-public flow (used for editable shared-view auto-save).
 */
export async function saveSharedFlow(
  flowId: string,
  nodes: string | object,
  edges: string | object
) {
  try {
    const parsedNodes = typeof nodes === "string" ? JSON.parse(nodes) : nodes;
    const parsedEdges = typeof edges === "string" ? JSON.parse(edges) : edges;

    const flow = await prisma.flow.update({
      where: { id: flowId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { nodes: parsedNodes, edges: parsedEdges } as any,
    });
    return { success: true, flow };
  } catch (error) {
    console.error('Failed to save shared flow:', error);
    return { success: false, error: 'Failed to save shared flow' };
  }
}
