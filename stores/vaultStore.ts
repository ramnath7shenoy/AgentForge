"use client";

import { create } from "zustand";

export interface VaultEntry {
  key: string;
  value: string;
}

// Lightweight provider detection — mirrors clientExecutor.detectProvider
// without creating a cross-module dependency.
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
  // Universal key fallback — returns best matching key + resolved provider.
  // Resolution order: exact provider match → first available (auto-detect).
  // Returns null when the vault is empty.
  resolveSmartKey: (requestedProvider?: string) => { key: string; provider: string } | null;
  // Session key for AI Architect — persists in memory until page reload.
  // Lets users build multiple workflows without re-pasting their key each time.
  architectKey: string;
  setArchitectKey: (key: string) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  entries: [],
  architectKey: "",

  addEntry: (key, value) => {
    set((s) => ({
      entries: [...s.entries.filter(e => e.key !== key), { key, value }],
    }));
  },

  removeEntry: (key) => {
    set((s) => ({
      entries: s.entries.filter(e => e.key !== key),
    }));
  },

  getKeys: () => get().entries.map(e => e.key),

  resolveSmartKey: (requestedProvider?: string) => {
    const available = get().entries.filter(e => e.value?.trim());
    if (available.length === 0) return null;

    // 1. Exact provider match by key value prefix
    if (requestedProvider && requestedProvider !== "auto") {
      const match = available.find(
        (e) => detectProviderFromKey(e.value) === requestedProvider
      );
      if (match) return { key: match.value, provider: requestedProvider };
    }

    // 2. Auto-select: first available entry, infer provider from value
    const best = available[0];
    return { key: best.value, provider: detectProviderFromKey(best.value) };
  },

  setArchitectKey: (key) => set({ architectKey: key }),
}));
