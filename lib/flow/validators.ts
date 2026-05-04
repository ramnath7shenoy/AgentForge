import { Node, Edge } from "reactflow";

/**
 * Kahn's algorithm — returns true if the proposed edge set contains a cycle.
 * Call this BEFORE adding a new edge to catch loops immediately.
 */
export function detectCycle(nodes: Node[], edges: Edge[]): boolean {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    processed++;
    for (const child of adj.get(id) ?? []) {
      const deg = (inDegree.get(child) ?? 0) - 1;
      inDegree.set(child, deg);
      if (deg === 0) queue.push(child);
    }
  }

  return processed < nodes.length;
}
