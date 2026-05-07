'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

/**
 * Save or upsert a flow.
 * - If userId is provided, upserts user record and associates the flow.
 * - If no userId (guest), saves an anonymous flow.
 */
export async function saveFlow(
  _userId: string | null, // Kept for signature compatibility but we use auth user
  name: string,
  nodes: string | object,
  edges: string | object,
  flowId?: string,
  isPublic?: boolean,
  publicEditable?: boolean,
  projectId?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "User not authenticated" };

    const parsedNodes = typeof nodes === "string" ? JSON.parse(nodes) : nodes;
    const parsedEdges = typeof edges === "string" ? JSON.parse(edges) : edges;
    const flowName = name || "Untitled Agent";
    const activeProjectId = (projectId === "default-id" || !projectId) ? null : projectId;

    // WHITE-LIST PAYLOAD: Only send columns verified to exist
    const dataToSave = {
      name: flowName,
      nodes: parsedNodes,
      edges: parsedEdges,
      userId: user.id,
      projectId: activeProjectId,
    };

    const flow = await prisma.flow.upsert({
      where: { id: flowId || crypto.randomUUID() },
      update: dataToSave,
      create: {
        id: flowId || crypto.randomUUID(),
        ...dataToSave
      }
    });

    return { success: true, flow };
  } catch (error: any) {
    console.error('SERVER_ACTION_SAVE_ERROR:', error);
    if (error.code === 'P2003' && error.meta?.field_name?.includes('projectId')) {
      return { success: false, error: 'Project Not Found' };
    }
    return { success: false, error: error.message || 'Failed to save flow to database' };
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
export async function getUserFlows(projectId?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, flows: [], error: 'Not authenticated' };

    const flows = await prisma.flow.findMany({
      where: { 
        userId: user.id,
        ...(projectId ? { projectId } : {})
      },
      orderBy: { updated_at: 'desc' },
    });
    return { success: true, flows };
  } catch (error) {
    console.error('Failed to fetch user flows:', error);
    return { success: false, flows: [], error: 'Failed to fetch flows' };
  }
}

/**
 * Create a new folder for the user.
 */
export async function createFolder(name: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    const folder = await prisma.folder.create({
      data: {
        name,
        userId: user.id
      }
    });

    return { success: true, folder };
  } catch (error) {
    console.error('Failed to create folder:', error);
    return { success: false, error: 'Failed to create folder' };
  }
}

/**
 * Get all folders for the current user.
 */
export async function getFolders() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, folders: [] };

    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      include: { _count: { select: { flows: true } } },
      orderBy: { name: 'asc' }
    });

    return { success: true, folders };
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    return { success: false, folders: [] };
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
 * Update a flow's public visibility or editability permissions.
 */
export async function updateFlowSettings(
  flowId: string, 
  settings: { isPublic?: boolean; publicEditable?: boolean }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const flow = await prisma.flow.update({
      where: { 
        id: flowId,
        userId: user.id // Safety: only owner can update settings
      },
      data: {
        ...(settings.isPublic !== undefined ? { isPublic: settings.isPublic } : {}),
        ...(settings.publicEditable !== undefined ? { publicEditable: settings.publicEditable } : {}),
      } as any,
    });

    return { success: true, flow };
  } catch (error) {
    console.error('Failed to update flow settings:', error);
    return { success: false, error: 'Failed to update flow settings' };
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

/**
 * Toggle the isDeployed flag for a flow (Agent Store listing).
 * Only the owner can deploy/undeploy their flow.
 */
export async function toggleStoreDeployment(flowId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { userId: true, isPublic: true, isDeployed: true } as any,
    }) as any;

    if (!flow) return { success: false, error: 'Flow not found' };
    if (flow.userId !== user.id) return { success: false, error: 'Unauthorized' };

    const updated = await prisma.flow.update({
      where: { id: flowId },
      data: { isDeployed: !flow.isDeployed, isPublic: true } as any,
    });

    return { success: true, isDeployed: !(flow.isDeployed), flow: updated };
  } catch (error: any) {
    console.error('Failed to toggle store deployment:', error);
    return { success: false, error: error.message || 'Failed to toggle deployment' };
  }
}

/**
 * Fetch all publicly deployed flows for the Agent Store.
 */
export async function getDeployedFlows() {
  try {
    const flows = await (prisma.flow as any).findMany({
      where: { isDeployed: true, isPublic: true },
      select: { id: true, name: true, description: true, thumbnail: true, userId: true, updated_at: true },
      orderBy: { updated_at: 'desc' },
    });
    return { success: true, flows };
  } catch (error: any) {
    console.error('Failed to fetch deployed flows:', error);
    return { success: false, flows: [], error: error.message };
  }
}

/**
 * Delete a flow.
 * - Verifies the current user owns the flow before deletion.
 */
export async function deleteFlow(flowId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Not authenticated' };

    // Check if flow exists and belongs to user
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { userId: true }
    });

    if (!flow) return { success: false, error: 'Flow not found' };
    if (flow.userId !== user.id) return { success: false, error: 'Unauthorized deletion' };

    await prisma.flow.delete({
      where: { id: flowId }
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete flow:', error);
    return { success: false, error: 'Failed to delete flow' };
  }
}
