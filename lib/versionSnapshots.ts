import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";

export interface FlowSnapshot {
  id: string;
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  timestamp: number;
}

const SNAPSHOT_KEY = "agentforge_snapshots";
const MAX_SNAPSHOTS = 10;

export function getSnapshots(): FlowSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSnapshot(name: string, nodes: Node<NodeData>[], edges: Edge[]): FlowSnapshot {
  const snapshots = getSnapshots();
  const snapshot: FlowSnapshot = {
    id: crypto.randomUUID(),
    name,
    nodes,
    edges,
    timestamp: Date.now(),
  };
  // Prepend and keep only last MAX_SNAPSHOTS
  const updated = [snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(updated));
  return snapshot;
}

export function deleteSnapshot(id: string): void {
  const snapshots = getSnapshots().filter(s => s.id !== id);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
}
