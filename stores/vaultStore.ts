"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { saveVaultKeys, loadVaultKeys } from "@/app/actions/vault";

export interface VaultEntry {
  key: string;
  value: string;
}

function detectProviderFromKey(key: string): string {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-")) return "openai";
  return "gemini";
}

interface VaultState {
  entries: VaultEntry[];
  addEntry: (key: string, value: string) => void;
  removeEntry: (key: string) => void;
  getKeys: () => string[];
  resolveSmartKey: (requestedProvider?: string) => { key: string; provider: string } | null;
  syncToDb: () => void;
  loadFromDb: () => Promise<void>;
  architectKey: string;
  setArchitectKey: (key: string) => void;
  preferredProvider: string | null;
  setPreferredProvider: (provider: string | null) => void;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      entries: [],
      architectKey: "",
      preferredProvider: null,

      addEntry: (key, value) => {
        set((s) => ({
          entries: [...s.entries.filter(e => e.key !== key), { key, value }],
        }));
        get().syncToDb();
      },

      removeEntry: (key) => {
        set((s) => ({
          entries: s.entries.filter(e => e.key !== key),
        }));
        get().syncToDb();
      },

      getKeys: () => get().entries.map(e => e.key),

      syncToDb: () => {
        const entries = get().entries;
        saveVaultKeys(entries).catch(() => {});
      },

      loadFromDb: async () => {
        try {
          const dbEntries = await loadVaultKeys();
          if (dbEntries.length === 0) return;
          set((s) => {
            // DB is source of truth — overwrite any local entry with the same key
            const merged = [...s.entries];
            for (const dbEntry of dbEntries) {
              const idx = merged.findIndex(e => e.key === dbEntry.key);
              if (idx >= 0) {
                merged[idx] = dbEntry;
              } else {
                merged.push(dbEntry);
              }
            }
            return { entries: merged };
          });
        } catch {
          // Network error — localStorage backup already loaded via persist
        }
      },

      resolveSmartKey: (requestedProvider?: string) => {
        const available = get().entries.filter(e => e.value?.trim());
        if (available.length === 0) return null;

        if (requestedProvider && requestedProvider !== "auto") {
          const match = available.find(
            (e) => detectProviderFromKey(e.value) === requestedProvider
          );
          if (match) return { key: match.value, provider: requestedProvider };
        }

        const best = available[0];
        return { key: best.value, provider: detectProviderFromKey(best.value) };
      },

      setArchitectKey: (key) => set({ architectKey: key }),

      setPreferredProvider: (provider) => set({ preferredProvider: provider }),
    }),
    {
      name: "vault-store",
      storage: createJSONStorage(() => localStorage),
      // architectKey is session-only; everything else persists
      partialize: (state) => ({ entries: state.entries, preferredProvider: state.preferredProvider }),
    }
  )
);
