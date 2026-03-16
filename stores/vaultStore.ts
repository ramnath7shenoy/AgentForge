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
}

export const useVaultStore = create<VaultState>((set, get) => ({
  entries: [],

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
}));
