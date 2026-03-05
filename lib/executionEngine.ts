import { Node, Edge } from "reactflow";
import {
  ExecutionContext,
  ExecutionLogEntry,
  ExecutionStatus,
  NodeData,
} from "@/types/flowStoreTypes";

export interface NodeExecutionResult {
  context: ExecutionContext;
  logEntry: ExecutionLogEntry;
}

export type NodeExecutor = (
  node: Node<NodeData>,
  context: ExecutionContext,
) => Promise<NodeExecutionResult>;

export interface ExecutionEngineOptions {
  onNodeStart?: (nodeId: string) => void;
  onNodeEnd?: (nodeId: string, status: ExecutionStatus) => void;
  onEdgeTraverse?: (edgeId: string) => void;
}

function getNextNodeId(
  node: Node<NodeData>,
  edges: Edge[],
  context: ExecutionContext,
  options?: ExecutionEngineOptions,
): string | undefined {
  if (node.type === "decision") {
    const condition = node.data.condition || "";
    let result = false;

    try {
      const value = (node.data as NodeData).value ?? 0;
      // eslint-disable-next-line no-eval
      result = eval(condition.replace("value", String(value)));
    } catch {
      console.warn("Invalid decision condition:", condition);
    }

    const labeledEdge = edges.find(
      (e) => e.source === node.id && e.label === (result ? "true" : "false"),
    );

    if (labeledEdge) {
      options?.onEdgeTraverse?.(labeledEdge.id as string);
      return labeledEdge.target as string | undefined;
    }

    return undefined;
  }

  const nextEdge = edges.find((e) => e.source === node.id);
  if (nextEdge) {
    options?.onEdgeTraverse?.(nextEdge.id as string);
    return nextEdge.target as string | undefined;
  }

  return undefined;
}

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

  while (currentNodeId) {
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    const executor = executors[node.type];

    if (!executor) {
      const now = Date.now();

      const logEntry: ExecutionLogEntry = {
        nodeId: node.id,
        nodeType: node.type ?? "unknown",
        status: "error",
        startedAt: now,
        endedAt: now,
        durationMs: 0,
        inputSnapshot: null,
        outputSnapshot: null,
        error: `No executor registered for node type "${node.type}"`,
      };

      logs.push(logEntry);
      break;
    }

    options.onNodeStart?.(node.id);

    const startedAt = Date.now();

    try {
      const result = await executor(node, context);
      const endedAt = Date.now();

      const logEntry: ExecutionLogEntry = {
        ...result.logEntry,
        nodeId: node.id,
        nodeType: node.type ?? "unknown",
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
      };

      context = result.context;

      /**
       * NEW: capture final result when Output node executes
       */
      if (node.type === "output") {
        const output =
          result.logEntry.outputSnapshot ??
          result.context.nodes?.[node.id] ??
          null;

        if (!context.variables) context.variables = {};

        context.variables.finalResult = output;
      }

      logs.push(logEntry);

      options.onNodeEnd?.(node.id, logEntry.status);
    } catch (error) {
      const endedAt = Date.now();

      const logEntry: ExecutionLogEntry = {
        nodeId: node.id,
        nodeType: node.type ?? "unknown",
        status: "error",
        startedAt,
        endedAt,
        durationMs: endedAt - startedAt,
        inputSnapshot: null,
        outputSnapshot: null,
        error:
          error instanceof Error ? error.message : "Unknown execution error",
      };

      logs.push(logEntry);

      options.onNodeEnd?.(node.id, "error");

      break;
    }

    currentNodeId = getNextNodeId(node, edges, context, options);
  }

  /**
   * If execution ended without hitting an output node
   */
  if (!context.variables?.finalResult) {
    context.variables = {
      ...context.variables,
      finalResult: "Workflow finished without producing an output.",
    };
  }

  return { context, logs };
}