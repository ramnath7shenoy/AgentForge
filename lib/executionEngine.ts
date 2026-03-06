import { Node, Edge } from "reactflow";
import {
  ExecutionContext,
  ExecutionLogEntry,
  ExecutionStatus,
  NodeData,
} from "@/types/flowStoreTypes";
import { resolveTemplates } from "./template";
import { evaluateBooleanExpression } from "./expressionEvaluator";

export interface NodeExecutionResult {
  context: ExecutionContext;
  logEntry: ExecutionLogEntry;
}

export type NodeExecutor = (
  node: Node<NodeData>,
  context: ExecutionContext,
) => Promise<NodeExecutionResult>;

export interface ExecutionEngineOptions {
  onNodeStart?: (nodeId: string) => Promise<void> | void;
  onNodeEnd?: (nodeId: string, status: ExecutionStatus) => Promise<void> | void;
  onEdgeTraverse?: (edgeId: string) => Promise<void> | void;
}

/**
 * FIXED: Maps Router conditions to specific outgoing handles
 */
async function getNextNodeId(
  node: Node<NodeData>,
  edges: Edge[],
  context: ExecutionContext,
  options?: ExecutionEngineOptions,
): Promise<string | undefined> {
  
  // 1. Handle Multi-Path Routing (Router/Decision)
  if (node.type === "router" || node.type === "decision") {
    const routes = node.data.routes || [];
    const conditions = node.data.conditions || {};

    for (const route of routes) {
      const expression = conditions[route];
      if (!expression) continue; 

      try {
        const resolved = resolveTemplates(expression, context);
        
        // Pass the entire context to help evaluate English conditions
        // Priority: Use the last executed node's output as the "current data" to evaluate against
        const lastNodeOutput = context.nodes[node.id]; 
        const isMatch = evaluateBooleanExpression(resolved, lastNodeOutput);

        if (isMatch) {
          // Identify the edge specifically connected to this route handle (e.g. "path a")
          const targetEdge = edges.find(
            (e) => e.source === node.id && e.sourceHandle === route.toLowerCase()
          );

          if (targetEdge) {
            await options?.onEdgeTraverse?.(targetEdge.id);
            return targetEdge.target;
          }
        }
      } catch (err) {
        console.error(`Execution error on path ${route}:`, err);
      }
    }
    return undefined; // Stop if no paths match
  }

  // 2. Standard Logic: Follow the first available outgoing connection
  const nextEdge = edges.find((e) => e.source === node.id);
  if (nextEdge) {
    await options?.onEdgeTraverse?.(nextEdge.id);
    return nextEdge.target;
  }

  return undefined;
}

/**
 * Main Flow Execution Loop
 */
export async function executeFlow(
  startNodeId: string,
  nodes: Node<NodeData>[],
  edges: Edge[],
  executors: Record<string, NodeExecutor>,
  initialContext: ExecutionContext,
  options: ExecutionEngineOptions = {},
): Promise<{ context: ExecutionContext; logs: ExecutionLogEntry[] }> {
  const logs: ExecutionLogEntry[] = [];
  let context = initialContext;
  let currentNodeId: string | undefined = startNodeId;
  const visited = new Set<string>();

  while (currentNodeId) {
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node || visited.has(node.id)) break; 

    const executor = executors[node.type || ""];
    if (!executor) break;

    await options.onNodeStart?.(node.id);

    const startTime = Date.now();
    try {
      const result = await executor(node, context);
      const endTime = Date.now();

      const finalLog: ExecutionLogEntry = {
        ...result.logEntry,
        durationMs: endTime - startTime,
      };

      context = result.context;
      logs.push(finalLog);

      await options.onNodeEnd?.(node.id, finalLog.status);
      
      // Navigate using the fixed getNextNodeId function
      currentNodeId = await getNextNodeId(node, edges, context, options);
    } catch (err) {
      console.error(`Execution failed at ${node.id}:`, err);
      break;
    }
  }

  return { context, logs };
}