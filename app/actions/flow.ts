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

    // Check if this flow is already deployed — deployed snapshots are frozen
    const resolvedId = flowId || crypto.randomUUID();
    const existing = flowId
      ? await prisma.flow.findUnique({ where: { id: flowId }, select: { isDeployed: true } })
      : null;
    const isAlreadyDeployed = existing?.isDeployed ?? false;

    // WHITE-LIST PAYLOAD: Only send columns verified to exist
    // Never overwrite nodes/edges of a deployed flow via auto-save — use deployToStore to update the snapshot
    const dataToSave = isAlreadyDeployed
      ? { name: flowName, userId: user.id, projectId: activeProjectId }
      : { name: flowName, nodes: parsedNodes, edges: parsedEdges, userId: user.id, projectId: activeProjectId };

    const flow = await prisma.flow.upsert({
      where: { id: resolvedId },
      update: dataToSave,
      create: {
        id: resolvedId,
        name: flowName,
        nodes: parsedNodes,
        edges: parsedEdges,
        userId: user.id,
        projectId: activeProjectId,
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
      where: { userId: user.id, isDeployed: { not: true } },
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
 * Update only the group label on a flow.
 */
export async function updateFlowGroup(flowId: string, groupName: string | null) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    await prisma.flow.update({
      where: { id: flowId, userId: user.id },
      data: { groupName: groupName || null },
    });
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update flow group:', error);
    return { success: false, error: error.message };
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
      select: { userId: true, isDeployed: true },
    });

    if (!flow) return { success: false, error: 'Flow not found' };
    if (flow.userId !== user.id) return { success: false, error: 'Unauthorized' };

    const updated = await prisma.flow.update({
      where: { id: flowId },
      data: { isDeployed: !flow.isDeployed, isPublic: true },
    });

    return { success: true, isDeployed: updated.isDeployed ?? true };
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
    const flows = await prisma.flow.findMany({
      where: { isDeployed: true, isPublic: true },
      select: {
        id: true, name: true, description: true, thumbnail: true,
        userId: true, creatorName: true, updated_at: true, created_at: true,
        nodes: true, edges: true, viewCount: true, cloneCount: true,
        sandboxRunCount: true, changelog: true,
        tags: true, isFeatured: true,
        _count: { select: { comments: true, stars: true } },
      },
      orderBy: { updated_at: 'desc' },
    });
    return { success: true, flows };
  } catch (error: any) {
    console.error('Failed to fetch deployed flows:', error);
    return { success: false, flows: [], error: error.message };
  }
}

export async function getFlowComments(flowId: string) {
  try {
    const comments = await prisma.flowComment.findMany({
      where: { flowId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, authorName: true, body: true, createdAt: true, userId: true },
    });
    return { success: true, comments };
  } catch (error: any) {
    return { success: false, comments: [], error: error.message };
  }
}

export async function postFlowComment(flowId: string, body: string) {
  "use server";
  const trimmed = body.trim().slice(0, 1000);
  if (!trimmed) return { success: false, error: "Comment is empty" };

  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();

  const authorName = (() => {
    if (!user) return "Anonymous";
    const m = user.user_metadata;
    const name = m?.full_name || m?.name || m?.preferred_username;
    if (name?.trim()) return name.trim();
    return user.email?.split("@")[0] || "Anonymous";
  })();

  try {
    const comment = await prisma.flowComment.create({
      data: { flowId, userId: user?.id ?? null, authorName, body: trimmed },
      select: { id: true, authorName: true, body: true, createdAt: true, userId: true },
    });
    return { success: true, comment };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteFlowComment(commentId: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const comment = await prisma.flowComment.findUnique({
      where: { id: commentId },
      select: { userId: true, flow: { select: { userId: true } } },
    });
    if (!comment) return { success: false, error: "Not found" };

    const isAuthor = comment.userId === user.id;
    const isFlowOwner = comment.flow?.userId === user.id;
    if (!isAuthor && !isFlowOwner) return { success: false, error: "Unauthorized" };

    await prisma.flowComment.delete({ where: { id: commentId } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleStar(flowId: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized", starred: false };
  try {
    const existing = await prisma.flowStar.findUnique({
      where: { flowId_userId: { flowId, userId: user.id } },
    });
    if (existing) {
      await prisma.flowStar.delete({ where: { id: existing.id } });
      return { success: true, starred: false };
    } else {
      await prisma.flowStar.create({ data: { flowId, userId: user.id } });
      return { success: true, starred: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message, starred: false };
  }
}

export async function getUserStarredFlows(userId: string): Promise<string[]> {
  try {
    const stars = await prisma.flowStar.findMany({
      where: { userId },
      select: { flowId: true },
    });
    return stars.map(s => s.flowId);
  } catch {
    return [];
  }
}

export async function reportFlow(flowId: string, reason: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  try {
    await prisma.flowReport.create({
      data: { flowId, userId: user?.id ?? null, reason: reason.slice(0, 500) },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getStoreFlowDetail(flowId: string) {
  try {
    const flow = await prisma.flow.findUnique({
      where: { id: flowId, isDeployed: true, isPublic: true },
      select: {
        id: true, name: true, description: true, thumbnail: true,
        userId: true, creatorName: true, updated_at: true, created_at: true,
        nodes: true, edges: true, viewCount: true, cloneCount: true,
        sandboxRunCount: true, changelog: true,
        tags: true, isFeatured: true,
        _count: { select: { comments: true, stars: true } },
      },
    });
    if (!flow) return { success: false, flow: null };
    return { success: true, flow };
  } catch (error: any) {
    return { success: false, flow: null, error: error.message };
  }
}

export async function getCreatorFlows(userId: string) {
  try {
    const flows = await prisma.flow.findMany({
      where: { userId, isDeployed: true, isPublic: true },
      select: {
        id: true, name: true, description: true, thumbnail: true,
        userId: true, creatorName: true, updated_at: true, created_at: true,
        nodes: true, edges: true, viewCount: true, cloneCount: true,
        sandboxRunCount: true, changelog: true,
        tags: true, isFeatured: true,
        _count: { select: { comments: true, stars: true } },
      },
      orderBy: { viewCount: 'desc' },
    });
    return { success: true, flows };
  } catch (error: any) {
    return { success: false, flows: [], error: error.message };
  }
}

export async function getRelatedFlows(excludeId: string, limit = 3) {
  try {
    const flows = await prisma.flow.findMany({
      where: { isDeployed: true, isPublic: true, id: { not: excludeId } },
      select: {
        id: true, name: true, description: true, thumbnail: true,
        userId: true, creatorName: true, updated_at: true, created_at: true,
        nodes: true, edges: true, viewCount: true, cloneCount: true,
        sandboxRunCount: true, changelog: true,
        tags: true, isFeatured: true,
        _count: { select: { comments: true, stars: true } },
      },
      orderBy: { viewCount: 'desc' },
      take: limit,
    });
    return { success: true, flows };
  } catch {
    return { success: false, flows: [] };
  }
}

export async function incrementViewCount(flowId: string) {
  try {
    await prisma.flow.update({
      where: { id: flowId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Non-critical — silently ignore failures
  }
}

/**
 * Deploy a flow to the Agent Store with metadata.
 * Creates or upserts the flow, sets isDeployed + isPublic.
 */
export async function deployToStore(
  name: string,
  description: string,
  nodes: object,
  edges: object,
  existingFlowId?: string,
  thumbnail?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const flowId = existingFlowId || crypto.randomUUID();

    const meta = user.user_metadata || {};
    const creatorName =
      meta.full_name || meta.name || user.email?.split('@')[0] || 'Anonymous';

    const flow = await prisma.flow.upsert({
      where: { id: flowId },
      update: { name, description, nodes, edges, isDeployed: true, isPublic: true, creatorName, ...(thumbnail ? { thumbnail } : {}) } as any,
      create: {
        id: flowId,
        name,
        description,
        nodes,
        edges,
        userId: user.id,
        isDeployed: true,
        isPublic: true,
        creatorName,
        ...(thumbnail ? { thumbnail } : {}),
      } as any,
    });

    // Snapshot a version on each deploy (keep last 20)
    await prisma.flowVersion.create({
      data: { flowId: flow.id, nodes: nodes as any, edges: edges as any, note: "Deployed" },
    }).catch(() => {});
    // Trim to 20 versions
    const allV = await prisma.flowVersion.findMany({
      where: { flowId: flow.id }, orderBy: { createdAt: 'desc' }, select: { id: true },
    }).catch(() => []);
    if (allV.length > 20) {
      await prisma.flowVersion.deleteMany({ where: { id: { in: allV.slice(20).map((v: any) => v.id) } } }).catch(() => {});
    }

    return { success: true, flowId: flow.id };
  } catch (error: any) {
    console.error('Failed to deploy to store:', error);
    return { success: false, error: error.message || 'Failed to deploy' };
  }
}

/**
 * Unpublish a flow from the Agent Store (owner-only).
 */
export async function unpublishFlow(flowId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { userId: true } });
    if (!flow) return { success: false, error: 'Flow not found' };
    if (flow.userId !== user.id) return { success: false, error: 'Unauthorized' };

    await prisma.flow.update({ where: { id: flowId }, data: { isDeployed: false } as any });
    return { success: true };
  } catch (error: any) {
    console.error('Failed to unpublish flow:', error);
    return { success: false, error: error.message || 'Failed to unpublish' };
  }
}

/**
 * Update the name/description of a deployed flow (owner-only).
 */
export async function updateDeployedFlowMeta(
  flowId: string,
  meta: { name: string; description?: string; tags?: string[]; isFeatured?: boolean; changelog?: string; thumbnail?: string | null }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { userId: true } });
    if (!flow) return { success: false, error: 'Flow not found' };
    if (flow.userId !== user.id) return { success: false, error: 'Unauthorized' };

    await prisma.flow.update({
      where: { id: flowId },
      data: {
        name: meta.name,
        ...(meta.description !== undefined ? { description: meta.description } : {}),
        ...(meta.tags !== undefined ? { tags: meta.tags } : {}),
        ...(meta.isFeatured !== undefined ? { isFeatured: meta.isFeatured } : {}),
        ...(meta.changelog !== undefined ? { changelog: meta.changelog.slice(0, 2000) } : {}),
        ...(meta.thumbnail !== undefined ? { thumbnail: meta.thumbnail ?? null } : {}),
      } as any,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Failed to update flow meta:', error);
    return { success: false, error: error.message || 'Failed to update' };
  }
}

/**
 * Clone a public/deployed flow into the current user's workspace.
 */
export async function cloneFlow(flowId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const source = await prisma.flow.findUnique({
      where: { id: flowId },
      select: { name: true, nodes: true, edges: true, isPublic: true, isDeployed: true },
    });

    if (!source) return { success: false, error: 'Flow not found' };
    if (!source.isPublic && !source.isDeployed) return { success: false, error: 'Flow is not public' };

    const cloned = await prisma.flow.create({
      data: {
        id: crypto.randomUUID(),
        name: `[Cloned] ${source.name || 'Untitled Agent'}`,
        nodes: source.nodes ?? [],
        edges: source.edges ?? [],
        userId: user.id,
      },
    });

    await prisma.flow.update({ where: { id: flowId }, data: { cloneCount: { increment: 1 } } }).catch(() => {});

    return { success: true, flow: cloned };
  } catch (error: any) {
    console.error('Failed to clone flow:', error);
    return { success: false, error: error.message || 'Failed to clone flow' };
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

export async function incrementSandboxRunCount(flowId: string) {
  try {
    await prisma.flow.update({
      where: { id: flowId },
      data: { sandboxRunCount: { increment: 1 } },
    });
  } catch {
    // Non-critical
  }
}

export async function toggleFollow(targetUserId: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized", following: false };
  if (user.id === targetUserId) return { success: false, error: "Cannot follow yourself", following: false };

  try {
    const existing = await prisma.flowFollow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
    });
    if (existing) {
      await prisma.flowFollow.delete({ where: { id: existing.id } });
      return { success: true, following: false };
    } else {
      await prisma.flowFollow.create({ data: { followerId: user.id, followingId: targetUserId } });
      return { success: true, following: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message, following: false };
  }
}

export async function getFollowStatus(targetUserId: string): Promise<boolean> {
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  try {
    const existing = await prisma.flowFollow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } },
    });
    return !!existing;
  } catch {
    return false;
  }
}

export async function getFollowerCount(targetUserId: string): Promise<number> {
  try {
    return await prisma.flowFollow.count({ where: { followingId: targetUserId } });
  } catch {
    return 0;
  }
}

export async function createFlowVersion(flowId: string, nodes: object, edges: object, note?: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { userId: true } });
    if (!flow || flow.userId !== user.id) return { success: false, error: "Unauthorized" };

    const version = await prisma.flowVersion.create({
      data: { flowId, nodes, edges, note: note?.slice(0, 500) ?? null },
    });

    // Keep at most 20 versions per flow
    const allVersions = await prisma.flowVersion.findMany({
      where: { flowId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (allVersions.length > 20) {
      const toDelete = allVersions.slice(20).map(v => v.id);
      await prisma.flowVersion.deleteMany({ where: { id: { in: toDelete } } });
    }

    return { success: true, version };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFlowVersions(flowId: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, versions: [] };

  try {
    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { userId: true } });
    if (!flow || flow.userId !== user.id) return { success: false, versions: [] };

    const versions = await prisma.flowVersion.findMany({
      where: { flowId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, note: true, createdAt: true },
      take: 20,
    });
    return { success: true, versions };
  } catch (error: any) {
    return { success: false, versions: [], error: error.message };
  }
}

export async function rollbackToVersion(versionId: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const version = await prisma.flowVersion.findUnique({
      where: { id: versionId },
      include: { flow: { select: { userId: true } } },
    });
    if (!version) return { success: false, error: "Version not found" };
    if (version.flow.userId !== user.id) return { success: false, error: "Unauthorized" };

    await prisma.flow.update({
      where: { id: version.flowId },
      data: { nodes: version.nodes as any, edges: version.edges as any },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function toggleWishlist(flowId: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized", wishlisted: false };
  try {
    const existing = await prisma.flowWishlist.findUnique({
      where: { flowId_userId: { flowId, userId: user.id } },
    });
    if (existing) {
      await prisma.flowWishlist.delete({ where: { id: existing.id } });
      return { success: true, wishlisted: false };
    } else {
      await prisma.flowWishlist.create({ data: { flowId, userId: user.id } });
      return { success: true, wishlisted: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message, wishlisted: false };
  }
}

export async function getUserWishlist(userId: string) {
  try {
    const items = await prisma.flowWishlist.findMany({
      where: { userId },
      select: { flowId: true },
    });
    return items.map(i => i.flowId);
  } catch {
    return [];
  }
}

export async function updateDeployedFlowChangelog(flowId: string, changelog: string) {
  "use server";
  const supabase = await import("@/lib/supabase/server").then(m => m.createClient());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { userId: true } });
    if (!flow || flow.userId !== user.id) return { success: false, error: "Unauthorized" };
    await prisma.flow.update({ where: { id: flowId }, data: { changelog: changelog.slice(0, 2000) } as any });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
