'use server'

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Creates a project securely via Prisma.
 */
export async function createProject(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  try {
    const project = await prisma.project.create({
      data: {
        name,
        userId: user.id
      }
    });

    revalidatePath('/editor');
    revalidatePath('/dashboard');
    return { project };
  } catch (error: any) {
    console.error('Project creation failed:', error);
    return { error: error.message };
  }
}

/**
 * Gets all projects for the current user.
 */
export async function getProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized', projects: [] };

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return { projects };
  } catch (error: any) {
    console.error('Failed to fetch projects:', error);
    return { error: error.message, projects: [] };
  }
}

/**
 * Deletes a project and all its flows securely via Prisma.
 */
export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Unauthorized' };

  try {
    // Delete flows associated with this project first
    await prisma.flow.deleteMany({
      where: {
        projectId: projectId,
        userId: user.id
      }
    });

    // Delete the project itself
    await prisma.project.delete({
      where: {
        id: projectId,
        userId: user.id // Safety check
      }
    });

    revalidatePath('/editor');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Project deletion failed:', error);
    return { error: error.message };
  }
}
