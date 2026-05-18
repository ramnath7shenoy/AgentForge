'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// ─── Collections ─────────────────────────────────────────────────────────────

export async function createCollection(
  name: string,
  description?: string
): Promise<{ collection?: any; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  try {
    const collection = await prisma.collection.create({
      data: { userId: user.id, name: name.trim(), description: description?.trim() ?? null },
    })
    return { collection }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function getUserCollections(): Promise<{ collections: any[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { collections: [] }

  try {
    const collections = await prisma.collection.findMany({
      where: { userId: user.id },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { collections }
  } catch {
    return { collections: [] }
  }
}

export async function getPublicCollections(): Promise<{ collections: any[] }> {
  try {
    const collections = await prisma.collection.findMany({
      where: { isPublic: true },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 4,
          include: {
            flow: { select: { id: true, name: true, thumbnail: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return { collections }
  } catch {
    return { collections: [] }
  }
}

export async function addToCollection(
  collectionId: string,
  flowId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  try {
    const col = await prisma.collection.findUnique({ where: { id: collectionId }, select: { userId: true } })
    if (!col || col.userId !== user.id) return { ok: false, error: 'Unauthorized' }

    await prisma.collectionFlow.upsert({
      where: { collectionId_flowId: { collectionId, flowId } },
      update: {},
      create: { collectionId, flowId },
    })
    return { ok: true }
  } catch (error: any) {
    return { ok: false, error: error.message }
  }
}

export async function removeFromCollection(
  collectionId: string,
  flowId: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  try {
    const col = await prisma.collection.findUnique({ where: { id: collectionId }, select: { userId: true } })
    if (!col || col.userId !== user.id) return { ok: false }

    await prisma.collectionFlow.deleteMany({ where: { collectionId, flowId } })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function getCollectionDetail(id: string): Promise<{ collection?: any; error?: string }> {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
        items: {
          include: {
            flow: {
              select: {
                id: true,
                name: true,
                description: true,
                thumbnail: true,
                viewCount: true,
                cloneCount: true,
                _count: { select: { stars: true } },
                tags: true,
                isFeatured: true,
              },
            },
          },
        },
      },
    })
    if (!collection) return { error: 'Not found' }
    return { collection }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteCollection(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  try {
    const col = await prisma.collection.findUnique({ where: { id }, select: { userId: true } })
    if (!col || col.userId !== user.id) return { ok: false }
    await prisma.collection.delete({ where: { id } })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// ─── Creator Following ────────────────────────────────────────────────────────

export async function toggleFollowCreator(creatorId: string): Promise<{ following: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { following: false }

  try {
    const existing = await prisma.creatorFollow.findUnique({
      where: { followerId_followeeId: { followerId: user.id, followeeId: creatorId } },
    })
    if (existing) {
      await prisma.creatorFollow.delete({ where: { id: existing.id } })
      return { following: false }
    } else {
      await prisma.creatorFollow.create({ data: { followerId: user.id, followeeId: creatorId } })
      return { following: true }
    }
  } catch {
    return { following: false }
  }
}

export async function getFollowStatus(
  creatorId: string
): Promise<{ following: boolean; followerCount: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    const followerCount = await prisma.creatorFollow.count({ where: { followeeId: creatorId } })

    if (!user) return { following: false, followerCount }

    const existing = await prisma.creatorFollow.findUnique({
      where: { followerId_followeeId: { followerId: user.id, followeeId: creatorId } },
    })
    return { following: !!existing, followerCount }
  } catch {
    return { following: false, followerCount: 0 }
  }
}

// ─── Agent Requests ───────────────────────────────────────────────────────────

export async function createRequest(
  title: string,
  description: string,
  tags: string[]
): Promise<{ request?: any; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const meta = user.user_metadata || {}
  const authorName = (meta.full_name || meta.name || user.email?.split('@')[0] || 'Anonymous') as string

  try {
    const request = await prisma.agentRequest.create({
      data: {
        userId: user.id,
        authorName,
        title: title.trim().slice(0, 200),
        description: description.trim().slice(0, 2000),
        tags: tags.map(t => t.trim()).filter(Boolean),
      },
    })
    return { request }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function getRequests(
  sort: 'recent' | 'top' = 'top'
): Promise<{ requests: any[] }> {
  try {
    const requests = await prisma.agentRequest.findMany({
      include: { _count: { select: { upvoteRecords: true } } },
      orderBy: sort === 'top' ? { upvotes: 'desc' } : { createdAt: 'desc' },
      take: 50,
    })
    return { requests }
  } catch {
    return { requests: [] }
  }
}

export async function upvoteRequest(
  requestId: string
): Promise<{ ok: boolean; upvotes: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, upvotes: 0 }

  try {
    await prisma.requestUpvote.upsert({
      where: { requestId_userId: { requestId, userId: user.id } },
      update: {},
      create: { requestId, userId: user.id },
    })
    const count = await prisma.requestUpvote.count({ where: { requestId } })
    await prisma.agentRequest.update({ where: { id: requestId }, data: { upvotes: count } })
    return { ok: true, upvotes: count }
  } catch {
    return { ok: false, upvotes: 0 }
  }
}

export async function fulfillRequest(
  requestId: string,
  flowId: string
): Promise<{ ok: boolean }> {
  try {
    await prisma.agentRequest.update({
      where: { id: requestId },
      data: { fulfilledByFlowId: flowId },
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// ─── Challenges ───────────────────────────────────────────────────────────────

export async function getActiveChallenge(): Promise<{ challenge: any | null }> {
  try {
    const challenge = await prisma.challenge.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    return { challenge }
  } catch {
    return { challenge: null }
  }
}

// ─── Tag Subscriptions ────────────────────────────────────────────────────────

export async function toggleTagSubscription(tag: string): Promise<{ subscribed: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { subscribed: false }

  try {
    const existing = await prisma.tagSubscription.findUnique({
      where: { userId_tag: { userId: user.id, tag } },
    })
    if (existing) {
      await prisma.tagSubscription.delete({ where: { id: existing.id } })
      return { subscribed: false }
    } else {
      await prisma.tagSubscription.create({ data: { userId: user.id, tag } })
      return { subscribed: true }
    }
  } catch {
    return { subscribed: false }
  }
}

export async function getUserTagSubscriptions(): Promise<{ tags: string[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tags: [] }

  try {
    const subs = await prisma.tagSubscription.findMany({
      where: { userId: user.id },
      select: { tag: true },
    })
    return { tags: subs.map(s => s.tag) }
  } catch {
    return { tags: [] }
  }
}
