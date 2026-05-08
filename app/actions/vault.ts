'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export interface VaultKeyEntry { key: string; value: string }

/**
 * Upsert all vault key entries for the authenticated user.
 * Keys are stored as JSON; RLS in Supabase enforces per-user access.
 */
export async function saveVaultKeys(entries: VaultKeyEntry[]) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const encrypted_keys = JSON.stringify(entries)

    await prisma.vault.upsert({
      where: { userId: user.id },
      update: { encrypted_keys },
      create: { userId: user.id, encrypted_keys },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Failed to save vault keys:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Load vault key entries for the authenticated user from the database.
 * Returns an empty array for unauthenticated users or missing vault rows.
 */
export async function loadVaultKeys(): Promise<VaultKeyEntry[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const vault = await prisma.vault.findUnique({ where: { userId: user.id } })
    if (!vault?.encrypted_keys) return []

    const parsed = JSON.parse(vault.encrypted_keys)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e: any) => typeof e.key === 'string' && typeof e.value === 'string')
  } catch {
    return []
  }
}
