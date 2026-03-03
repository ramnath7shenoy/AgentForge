import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";

export interface SerializedFlow {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export function serializeFlow(
  nodes: Node<NodeData>[],
  edges: Edge[],
): SerializedFlow {
  return { nodes, edges };
}

export function downloadFlowJson(flow: SerializedFlow, filename = "flow.json") {
  const blob = new Blob([JSON.stringify(flow, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseFlowJson(contents: string): SerializedFlow {
  const parsed = JSON.parse(contents);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid flow JSON");
  }
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error("Flow JSON must contain nodes and edges arrays");
  }
  return parsed as SerializedFlow;
}

