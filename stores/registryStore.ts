"use client";

import { create } from "zustand";
import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";

export interface PublishedAgent {
  id: string;
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  publishedAt: number;
  totalRuns: number;
  successRuns: number;
}

interface RegistryState {
  agents: PublishedAgent[];
  loadAgents: () => void;
  publishAgent: (name: string, nodes: Node<NodeData>[], edges: Edge[]) => void;
  deleteAgent: (id: string) => void;
  incrementRun: (id: string, success: boolean) => void;
}

const REGISTRY_KEY = "agentforge_registry";

function loadFromStorage(): PublishedAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToStorage(agents: PublishedAgent[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(agents));
}

export const useRegistryStore = create<RegistryState>((set, get) => ({
  agents: [],

  loadAgents: () => {
    set({ agents: loadFromStorage() });
  },

  publishAgent: (name, nodes, edges) => {
    const agent: PublishedAgent = {
      id: crypto.randomUUID(),
      name,
      nodes,
      edges,
      publishedAt: Date.now(),
      totalRuns: 0,
      successRuns: 0,
    };
    const updated = [agent, ...get().agents];
    saveToStorage(updated);
    set({ agents: updated });
  },

  deleteAgent: (id) => {
    const updated = get().agents.filter(a => a.id !== id);
    saveToStorage(updated);
    set({ agents: updated });
  },

  incrementRun: (id, success) => {
    const updated = get().agents.map(a => {
      if (a.id !== id) return a;
      return { ...a, totalRuns: a.totalRuns + 1, successRuns: a.successRuns + (success ? 1 : 0) };
    });
    saveToStorage(updated);
    set({ agents: updated });
  },
}));
