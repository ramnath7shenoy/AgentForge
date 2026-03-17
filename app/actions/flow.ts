'use server'

import prisma from '@/lib/prisma'

export async function saveFlow(userId: string, name: string, nodes: any, edges: any, flowId?: string) {
  try {
    // Parse if strings were passed to bypass Server Action serialization limits
    const parsedNodes = typeof nodes === "string" ? JSON.parse(nodes) : nodes;
    const parsedEdges = typeof edges === "string" ? JSON.parse(edges) : edges;

    // Ensure the user exists first (for MVP auth mockup) to satisfy foreign key constraints
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@mock.agentforge.com`,
      }
    });

    console.log("PAYLOAD_TO_DB:", { nodes: parsedNodes, edges: parsedEdges });

    const flow = await prisma.flow.upsert({
      where: {
        id: flowId || 'new-flow-placeholder', // In a real app we need a valid ID or find another way to handle upsert if ID is unknown.
      },
      update: {
        name,
        nodes: parsedNodes,
        edges: parsedEdges,
      },
      create: {
        id: flowId,
        userId,
        name,
        nodes: parsedNodes,
        edges: parsedEdges,
      }
    })
    return { success: true, flow }
  } catch (error) {
    console.error('Failed to save flow to database:', error)
    return { success: false, error: 'Failed to save flow' }
  }
}

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

export async function getLatestFlow() {
  try {
    const flow = await prisma.flow.findFirst({
      orderBy: { updated_at: 'desc' }
    })
    return { success: true, flow }
  } catch (error) {
    console.error('Failed to fetch latest flow:', error)
    return { success: false, error: 'Failed to fetch latest flow' }
  }
}
