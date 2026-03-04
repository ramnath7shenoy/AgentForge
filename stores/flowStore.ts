import { create } from "zustand";
import {
  ExecutionContext,
  FlowState,
  NodeData,
} from "@/types/flowStoreTypes";
import {
  executeFlow,
  NodeExecutor,
} from "@/lib/executionEngine";
import { resolveTemplates } from "@/lib/template";
import { evaluateBooleanExpression } from "@/lib/expressionEvaluator";

export const useFlowStore = create<FlowState>((set, get) => ({
  // ======================
  // State
  // ======================
  nodes: [],
  edges: [],
  selectedNodeId: null,
  running: false,
  highlightedNodeId: null,
  currentContext: null,
  executionLogs: [],
  finalResult: null,
  activeEdgeId: null,
  executedNodeIds: [],
  showMinimap: false,
  showExecutionLogPanel: false,
  showVariablesPanel: false,

  // ======================
  // Basic setters
  // ======================
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setRunning: (running) => set({ running }),
  setHighlightedNodeId: (id) => set({ highlightedNodeId: id }),
  setShowMinimap: (value) => set({ showMinimap: value }),
  setShowExecutionLogPanel: (value) => set({ showExecutionLogPanel: value }),
  setShowVariablesPanel: (value) => set({ showVariablesPanel: value }),

  // ======================
  // Flow Execution Engine
  // ======================
  simulateFlow: async (startNodeId: string) => {
    const { nodes, edges } = get();

    if (!startNodeId) {
      return;
    }

    // Reset run-related state before starting a new execution
    set((state) => ({
      running: true,
      currentContext: null,
      executionLogs: [],
      highlightedNodeId: null,
      activeEdgeId: null,
      finalResult: null,
      executedNodeIds: [],
    }));

    const initialContext: ExecutionContext = {
      variables: {},
      nodes: {},
    };

    const executors: Record<string, NodeExecutor> = {
      input: async (node, context) => {
        const data = node.data as NodeData;
        const mode = data.inputMode || "text";

        let output: unknown = null;
        let inputSnapshot: unknown = null;
        let error: string | undefined;

        if (mode === "json") {
          const raw = data.rawJson || "";
          inputSnapshot = raw;
          try {
            output = raw ? JSON.parse(raw) : null;
          } catch (e) {
            error =
              e instanceof Error ? e.message : "Failed to parse input JSON.";
          }
        } else {
          const text = data.inputText || "";
          inputSnapshot = text;
          output = text ? { text } : null;
        }

        const nextContext: ExecutionContext = {
          ...context,
          variables: {
            ...context.variables,
            input: output,
          },
          nodes: {
            ...context.nodes,
            [node.id]: output,
          },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: node.type ?? "input",
            status: error ? "error" : "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot,
            outputSnapshot: output,
            error,
          },
        };
      },
      fetch: async (node, context) => {
        const data = node.data as NodeData;
        const resolvedUrl = resolveTemplates(
          data.url || data.apiUrl || "",
          context,
        );
        const resolvedHeaders = resolveTemplates(data.headers || {}, context);
        const resolvedBody = resolveTemplates(data.body ?? null, context);

        const mockResponse = {
          status: 200,
          data: {
            ok: true,
            url: resolvedUrl,
          },
          request: {
            url: resolvedUrl,
            method: data.method || "GET",
            headers: resolvedHeaders,
            body: resolvedBody,
          },
        };

        const nextContext: ExecutionContext = {
          ...context,
          nodes: {
            ...context.nodes,
            [node.id]: mockResponse,
          },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: node.type ?? "fetch",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: {
              url: resolvedUrl,
              headers: resolvedHeaders,
              body: resolvedBody,
            },
            outputSnapshot: mockResponse,
          },
        };
      },
      ai: async (node, context) => {
        const data = node.data as NodeData;
        const resolvedPrompt = resolveTemplates(data.prompt || "", context);
        const temperature =
          data.temperature !== undefined ? data.temperature : 0.7;

        let output: unknown;
        if (data.jsonMode) {
          output = {
            summary: `Mock summary for: ${resolvedPrompt}`,
            score: 82,
          };
        } else {
          output = `Mock response for: ${resolvedPrompt}`;
        }

        const nextContext: ExecutionContext = {
          ...context,
          nodes: {
            ...context.nodes,
            [node.id]: output,
          },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: node.type ?? "ai",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: { prompt: resolvedPrompt, temperature },
            outputSnapshot: output,
          },
        };
      },
      decision: async (node, context) => {
        const data = node.data as NodeData;
        const rawExpression = data.expression || "";
        const resolvedExpression = resolveTemplates(rawExpression, context);

        let result = false;
        let error: string | undefined;

        try {
          result = evaluateBooleanExpression(resolvedExpression);
        } catch (e) {
          error =
            e instanceof Error
              ? e.message
              : "Failed to evaluate decision expression.";
        }

        const nextContext: ExecutionContext = {
          ...context,
          nodes: {
            ...context.nodes,
            [node.id]: { result, expression: resolvedExpression },
          },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: node.type ?? "decision",
            status: error ? "error" : "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: rawExpression,
            outputSnapshot: { result, expression: resolvedExpression },
            error,
          },
        };
      },
      output: async (node, context) => {
        const data = node.data as NodeData;
        const template = data.template || "";
        const resolved = resolveTemplates(template, context);

        const nextContext: ExecutionContext = {
          ...context,
          variables: {
            ...context.variables,
            output: resolved,
          },
          nodes: {
            ...context.nodes,
            [node.id]: resolved,
          },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: node.type ?? "output",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: template,
            outputSnapshot: resolved,
          },
        };
      },
    };

    try {
      const { context, logs } = await executeFlow(
        startNodeId,
        nodes,
        edges,
        executors,
        initialContext,
        {
          onNodeStart: (nodeId) => {
            set((state) => ({
              highlightedNodeId: nodeId,
              executedNodeIds: state.executedNodeIds.includes(nodeId)
                ? state.executedNodeIds
                : [...state.executedNodeIds, nodeId],
            }));
          },
          onNodeEnd: () => {
            // keep highlight until the next node starts or execution finishes
          },
          onEdgeTraverse: (edgeId) => {
            set({ activeEdgeId: edgeId });
          },
        },
      );

      // Derive the final result from the last successful output node, if any.
      const lastOutputLog = [...logs]
        .reverse()
        .find(
          (log) =>
            log.nodeType === "output" &&
            log.status === "success" &&
            log.outputSnapshot !== undefined,
        );

      let finalResult: string | null = null;
      if (lastOutputLog) {
        const value = lastOutputLog.outputSnapshot;
        if (typeof value === "string") {
          finalResult = value;
        } else if (value != null) {
          try {
            finalResult = JSON.stringify(value, null, 2);
          } catch {
            finalResult = String(value);
          }
        }
      }

      set({
        currentContext: context,
        executionLogs: logs,
        finalResult,
      });
    } finally {
      set({
        highlightedNodeId: null,
        running: false,
        activeEdgeId: null,
      });
    }
  },
}));

