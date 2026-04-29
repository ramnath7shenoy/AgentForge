"use client";

import { create } from "zustand";

export interface VaultEntry {
  key: string;
  value: string;
}

interface VaultState {
  entries: VaultEntry[];
  addEntry: (key: string, value: string) => void;
  removeEntry: (key: string) => void;
  getKeys: () => string[];
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

  setArchitectKey: (key) => set({ architectKey: key }),
}));
