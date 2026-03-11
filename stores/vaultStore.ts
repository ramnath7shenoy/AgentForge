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
  entries: [
    { key: "OPENAI_API_KEY", value: "sk-***" },
    { key: "SLACK_TOKEN", value: "xoxb-***" },
    { key: "WEBHOOK_SECRET", value: "whsec_***" },
  ],

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
