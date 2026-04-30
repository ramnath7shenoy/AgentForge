/**
 * This file contains server-side actions for managing flows and folders in the application.
 * It provides functionality for saving, retrieving, updating, and deleting flows, as well as managing user folders.
 * These actions interact with the Prisma ORM and Supabase authentication to ensure secure and efficient data handling.
 *
 * Functions:
 * - saveFlow: Saves or updates a flow in the database. Handles both authenticated and guest users.
 * - getFlow: Fetches a specific flow by its ID.
 * - getLatestFlow: Retrieves the most recently updated flow for the logged-in user.
 * - getUserFlows: Fetches all flows associated with the current user, optionally filtered by project ID.
 * - createFolder: Creates a new folder for the authenticated user.
 * - getFolders: Retrieves all folders for the current user, including the count of flows in each folder.
 * - publishFlow: Sets a flow to public visibility, with optional guest editability.
 * - updateFlowSettings: Updates the public visibility or editability settings of a flow.
 * - saveSharedFlow: Updates nodes and edges of a public flow, ensuring proper permissions.
 * - deleteFlow: Deletes a flow after verifying ownership by the current user.
 */

'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

/**
 * Save or upsert a flow.
 * - If userId is provided, upserts user record and associates the flow.
 * - If no userId (guest), saves an anonymous flow.
 *
 * @param _userId - The user ID (kept for compatibility but uses auth user).
 * @param name - The name of the flow.
 * @param nodes - The nodes of the flow (string or object).
 * @param edges - The edges of the flow (string or object).
 * @param flowId - Optional ID of the flow to update.
 * @param isPublic - Optional flag to set the flow as public.
 * @param publicEditable - Optional flag to allow public editing.
 * @param projectId - Optional project ID to associate the flow with.
 * @returns An object indicating success or failure, and the saved flow if successful.
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
    // Create a Supabase client to handle user authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Ensure the user is authenticated
    if (!user) return { success: false, error: "User not authenticated" };

    // Parse nodes and edges if they are provided as strings
    const parsedNodes = typeof nodes === "string" ? JSON.parse(nodes) : nodes;
    const parsedEdges = typeof edges === "string" ? JSON.parse(edges) : edges;

    // Default flow name if none is provided
    const flowName = name || "Untitled Agent";

    // Handle project ID, defaulting to null if not provided
    const activeProjectId = (projectId === "default-id" || !projectId) ? null : projectId;

    // Prepare data to save, ensuring only verified columns are included
    const dataToSave = {
      name: flowName,
      nodes: parsedNodes,
      edges: parsedEdges,
      userId: user.id,
      projectId: activeProjectId,
    };

    // Upsert the flow in the database (create or update based on flowId)
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
    // Log and handle errors, including specific database constraint violations
    console.error('SERVER_ACTION_SAVE_ERROR:', error);
    if (error.code === 'P2003' && error.meta?.field_name?.includes('projectId')) {
      return { success: false, error: 'Project Not Found' };
    }
    return { success: false, error: error.message || 'Failed to save flow to database' };
  }
}

/**
 * Fetch a single flow by ID.
 *
 * @param flowId - The ID of the flow to fetch.
 * @returns An object indicating success or failure, and the fetched flow if successful.
 */
export async function getFlow(flowId: string) {
  try {
    // Fetch a flow by its unique ID
    const flow = await prisma.flow.findUnique({
      where: { id: flowId }
    });
    return { success: true, flow };
  } catch (error) {
    // Log and handle errors during flow retrieval
    console.error('Failed to fetch flow:', error);
    return { success: false, error: 'Failed to fetch flow' };
  }
}

/**
 * Get the latest flow for the current logged-in user.
 * Falls back to the most recently updated flow if no user is logged in.
 *
 * @returns An object indicating success or failure, the latest flow, and the user ID if available.
 */
export async function getLatestFlow() {
  try {
    // Create a Supabase client to handle user authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Return null if no user is authenticated
    if (!user) {
      return { success: true, flow: null, userId: null };
    }

    // Fetch the most recently updated flow for the authenticated user
    const flow = await prisma.flow.findFirst({
      where: { userId: user.id },
      orderBy: { updated_at: 'desc' }
    });
    return { success: true, flow, userId: user?.id ?? null };
  } catch (error) {
    // Log and handle errors during flow retrieval
    console.error('Failed to fetch latest flow:', error);
    return { success: false, error: 'Failed to fetch latest flow', userId: null };
  }
}

/**
 * Get all flows for a specific user (for the Dashboard).
 *
 * @param projectId - Optional project ID to filter flows.
 * @returns An object indicating success or failure, and the list of flows if successful.
 */
export async function getUserFlows(projectId?: string) {
  try {
    // Create a Supabase client to handle user authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Ensure the user is authenticated
    if (!user) return { success: false, flows: [], error: 'Not authenticated' };

    // Fetch all flows for the authenticated user, optionally filtered by project ID
    const flows = await prisma.flow.findMany({
      where: { 
        userId: user.id,
        ...(projectId ? { projectId } : {})
      },
      orderBy: { updated_at: 'desc' },
    });
    return { success: true, flows };
  } catch (error) {
    // Log and handle errors during flow retrieval
    console.error('Failed to fetch user flows:', error);
    return { success: false, flows: [], error: 'Failed to fetch flows' };
  }
}

/**
 * Create a new folder for the user.
 *
 * @param name - The name of the folder to create.
 * @returns An object indicating success or failure, and the created folder if successful.
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
 *
 * @returns An object indicating success or failure, and the list of folders with flow counts if successful.
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
 *
 * @param flowId - The ID of the flow to publish.
 * @param publicEditable - Optional flag to allow public editing.
 * @returns An object indicating success or failure, and the updated flow if successful.
 */
export async function publishFlow(flowId: string, publicEditable?: boolean) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Unauthorized' };

    const existingFlow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { userId: true },
    });

    if (!existingFlow) return { success: false, error: 'Flow not found' };
    if (existingFlow.userId !== user.id) return { success: false, error: 'Unauthorized' };

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
 *
 * @param flowId - The ID of the flow to update.
 * @param settings - An object containing the visibility and editability settings.
 * @returns An object indicating success or failure, and the updated flow if successful.
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


export async function saveSharedFlow(
  flowId: string,
  nodes: string | object,
  edges: string | object
)
/**
 * Update nodes/edges of an already-public flow (used for editable shared-view auto-save).
 *
 * @param flowId - The ID of the flow to update.
 * @param nodes - The updated nodes (string or object).
 * @param edges - The updated edges (string or object).
 * @returns An object indicating success or failure, and the updated flow if successful.
 */ {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const existingFlow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: {
        userId: true,
        isPublic: true,
        publicEditable: true,
      },
    });

    if (!existingFlow) {
      return { success: false, error: 'Flow not found' };
    }

    const isOwner = !!user && existingFlow.userId === user.id;
    const canEdit = isOwner || (!!existingFlow.isPublic && !!existingFlow.publicEditable);

    if (!canEdit) {
      return { success: false, error: 'Unauthorized' };
    }

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


export async function deleteFlow(flowId: string) {
  /**
 * Delete a flow.
 * - Verifies the current user owns the flow before deletion.
 *
 * @param flowId - The ID of the flow to delete.
 * @returns An object indicating success or failure.
 */
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
