"use client";

import { create } from "zustand";
import { formatCost } from "@/lib/utils/tokenCost";

const SESSION_KEY = "ff_session_cost_usd";

function loadSaved(): number {
  if (typeof window === "undefined") return 0;
  return parseFloat(sessionStorage.getItem(SESSION_KEY) || "0") || 0;
}

interface CostState {
  sessionCost: number;
  addCost: (amount: number) => void;
  reset: () => void;
  formatted: string;
}

export const useCostStore = create<CostState>((set, get) => ({
  sessionCost: 0,

  addCost: (amount) =>
    set((s) => {
      const next = s.sessionCost + amount;
      if (typeof window !== "undefined")
        sessionStorage.setItem(SESSION_KEY, String(next));
      return { sessionCost: next, formatted: formatCost(next) };
    }),

  reset: () => {
    if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
    set({ sessionCost: 0, formatted: "$0.00" });
  },

  formatted: "$0.00",
}));

// Hydrate from sessionStorage on first client import
if (typeof window !== "undefined") {
  const saved = loadSaved();
  if (saved > 0) {
    useCostStore.setState({ sessionCost: saved, formatted: formatCost(saved) });
  }
}
