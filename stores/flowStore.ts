"use client";

import { create } from "zustand";
import { 
  Node, 
  Edge, 
  applyNodeChanges, 
  applyEdgeChanges, 
  NodeChange, 
  EdgeChange 
} from "reactflow";

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

// Helper for visual execution feedback
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  theme: "dark", 
  selectedNodeId: null,
  running: false,
  highlightedNodeId: null,
  currentContext: null,
  executionLogs: [],
  finalResult: null,
  activeEdgeId: null,
  executedNodeIds: [],
  showMinimap: true,
  showExecutionLogPanel: false,
  showVariablesPanel: false,

  // --- STANDARD ACTIONS ---
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setRunning: (running) => set({ running }),
  
  // NEW ACTION: Clear all nodes for a fresh start
  clearCanvas: () => {
    if (confirm("Are you sure you want to clear the entire canvas? This cannot be undone.")) {
      set({ 
        nodes: [], 
        edges: [], 
        selectedNodeId: null, 
        finalResult: null,
        executionLogs: [],
        executedNodeIds: [],
        highlightedNodeId: null,
        activeEdgeId: null
      });
    }
  },

  // FIXED: Implementation of setFinalResult for blocking banner dismissal
  setFinalResult: (result) => set({ finalResult: result }),

  // FIXED: Implementation of setTheme for global UI synchronization
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  },

  setHighlightedNodeId: (id) => set({ highlightedNodeId: id }),
  setShowMinimap: (value) => set({ showMinimap: value }),
  setShowExecutionLogPanel: (value) => set({ showExecutionLogPanel: value }),
  setShowVariablesPanel: (value) => set({ showVariablesPanel: value }),

  // --- FLOW EXECUTION LOGIC ---
  simulateFlow: async (startNodeId: string) => {
    const { nodes, edges } = get();
    if (!startNodeId) return;

    // Reset UI State for fresh run
    set({
      running: true,
      currentContext: null,
      executionLogs: [],
      highlightedNodeId: null,
      activeEdgeId: null,
      finalResult: null,
      executedNodeIds: [],
    });

    const initialContext: ExecutionContext = {
      variables: {},
      nodes: {},
    };

    /**
     * Node Executors: The "Brains" for each node type.
     * Aligned with 'action' and 'router' naming conventions
     */
    const executors: Record<string, NodeExecutor> = {
      input: async (node, context) => {
        const data = node.data as NodeData;
        const mode = data.inputMode || "text";
        let output: unknown = null;
        let error: string | undefined;

        if (mode === "json") {
          try {
            output = data.rawJson ? JSON.parse(data.rawJson) : null;
          } catch (e) {
            error = e instanceof Error ? e.message : "Invalid JSON";
          }
        } else {
          output = data.inputText ? { text: data.inputText } : null;
        }

        const nextContext = {
          ...context,
          variables: { ...context.variables, input: output },
          nodes: { ...context.nodes, [node.id]: output },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: "input",
            status: error ? "error" : "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: data.inputText || data.rawJson,
            outputSnapshot: output,
            error,
          },
        };
      },

      action: async (node, context) => {
        const data = node.data as NodeData;
        const url = resolveTemplates(data.apiUrl || data.url || "", context);
        const mockResponse = { status: 200, data: { ok: true, url, timestamp: new Date().toISOString() } };

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: mockResponse } },
          logEntry: {
            nodeId: node.id,
            nodeType: "action",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: url,
            outputSnapshot: mockResponse,
          },
        };
      },
      fetch: async (node, context) => executors.action(node, context), // Fallback for legacy data

      ai: async (node, context) => {
        const data = node.data as NodeData;
        const prompt = resolveTemplates(data.prompt || "", context);
        const output = data.jsonMode 
          ? { summary: `Generated insights for: ${prompt}`, score: 0.88 }
          : `AI Model says: ${prompt}`;

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: output } },
          logEntry: {
            nodeId: node.id,
            nodeType: "ai",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: prompt,
            outputSnapshot: output,
          },
        };
      },

      router: async (node, context) => {
        const data = node.data as NodeData;
        return {
          context: context, // Logic branching handled by the engine
          logEntry: {
            nodeId: node.id,
            nodeType: "router",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: data.conditions,
            outputSnapshot: "Routed based on conditions",
          },
        };
      },
      decision: async (node, context) => executors.router(node, context), // Fallback for legacy data

      output: async (node, context) => {
        const data = node.data as NodeData;
        const resolved = resolveTemplates(data.template || "", context);
        
        return {
          context: {
            ...context,
            variables: { ...context.variables, output: resolved },
            nodes: { ...context.nodes, [node.id]: resolved },
          },
          logEntry: {
            nodeId: node.id,
            nodeType: "output",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: data.template,
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
          onNodeStart: async (nodeId) => {
            set((s) => ({
              highlightedNodeId: nodeId,
              executedNodeIds: s.executedNodeIds.includes(nodeId) 
                ? s.executedNodeIds 
                : [...s.executedNodeIds, nodeId],
            }));
            await sleep(350); // Visual pulse timing
          },
          onEdgeTraverse: async (edgeId) => {
            set({ activeEdgeId: edgeId });
            await sleep(200); // Visual traversal timing
          },
        }
      );

      set({
        currentContext: context,
        executionLogs: logs,
        finalResult: typeof context.variables?.output === "string" 
          ? context.variables.output 
          : "Workflow completed successfully.",
      });
    } catch (error) {
       console.error("Execution Engine Crash:", error);
    } finally {
      await sleep(500); 
      set({ running: false, highlightedNodeId: null, activeEdgeId: null });
    }
  },
}));