import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";

export interface SavedAgent {
  id: string;
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  createdAt: number;
}

const STORAGE_KEY = "agentforge_saved_agents";

export function getSavedAgents(): SavedAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAgent(name: string, nodes: Node<NodeData>[], edges: Edge[]): SavedAgent {
  const agents = getSavedAgents();
  const newAgent: SavedAgent = {
    id: crypto.randomUUID(),
    name,
    nodes,
    edges,
    createdAt: Date.now(),
  };
  agents.push(newAgent);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  return newAgent;
}

export function deleteSavedAgent(id: string): void {
  const agents = getSavedAgents().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}
