import dagre from "dagre";
import { Node, Edge, Position } from "reactflow";

export type LayoutDirection = "TB" | "LR";

const NODE_W = 208;
const NODE_H = 92;

/**
 * Re-positions nodes using Dagre's topological ranking.
 * Also stamps targetPosition / sourcePosition on each node so ReactFlow
 * internal edges know which side to connect to.
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Node[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: direction === "LR" ? 120 : 90,
    nodesep: direction === "LR" ? 60 : 50,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    if (node.type === "group") continue; // skip group containers
    const w = typeof node.style?.width === "number" ? node.style.width : NODE_W;
    const h = typeof node.style?.height === "number" ? node.style.height : NODE_H;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target, {}, edge.id);
    }
  }

  dagre.layout(g);

  const isLR = direction === "LR";

  return nodes.map((node) => {
    if (node.type === "group") return node;
    const pos = g.node(node.id);
    if (!pos) return node; // orphan — no incoming/outgoing edges

    const w = typeof node.style?.width === "number" ? node.style.width : NODE_W;
    const h = typeof node.style?.height === "number" ? node.style.height : NODE_H;

    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
      // Stamp handle orientation so edge routing is correct
      targetPosition: isLR ? Position.Left : Position.Top,
      sourcePosition: isLR ? Position.Right : Position.Bottom,
    };
  });
}
