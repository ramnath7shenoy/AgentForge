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
     * UNIVERSAL PACKET EXECUTORS
     */
    const executors: Record<string, NodeExecutor> = {
      input: async (node, context) => {
        const data = node.data as NodeData;
        const packet = data.packet || { type: "text", payload: "" };

        const nextContext = {
          ...context,
          variables: { ...context.variables, input: packet },
          nodes: { ...context.nodes, [node.id]: packet },
        };

        return {
          context: nextContext,
          logEntry: {
            nodeId: node.id,
            nodeType: "input",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: packet,
            outputSnapshot: packet,
          },
        };
      },

      action: async (node, context) => {
        const data = node.data as NodeData;
        const packet: FlowPacket = { 
          type: "data", 
          payload: { 
            ok: true, 
            connection: data.connectionType || "Integration",
            timestamp: new Date().toISOString() 
          } 
        };

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "action",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: data.connectionType,
            outputSnapshot: packet,
          },
        };
      },

      ai: async (node, context) => {
        const data = node.data as NodeData;
        const instructions = resolveTemplates(data.instructions || "", context);
        
        const packet: FlowPacket = { 
          type: "text", 
          payload: `Brain result for: "${instructions.substring(0, 30)}..."` 
        };

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "ai",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: instructions,
            outputSnapshot: packet,
          },
        };
      },

      router: async (node, context) => {
        return {
          context,
          logEntry: {
            nodeId: node.id,
            nodeType: "router",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: node.data.conditions,
            outputSnapshot: "Routed packet based on N-way logic",
          },
        };
      },

      output: async (node, context) => {
        const data = node.data as NodeData;
        // Output can template the text or just pass the previous packet
        const resolvedText = resolveTemplates(data.resultFormat || "", context);
        
        // If it's a simple string template, wrap it in a text packet
        const packet: FlowPacket = { 
          type: "text", 
          payload: resolvedText 
        };
        
        return {
          context: {
            ...context,
            variables: { ...context.variables, output: packet },
            nodes: { ...context.nodes, [node.id]: packet },
          },
          logEntry: {
            nodeId: node.id,
            nodeType: "output",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: data.resultFormat,
            outputSnapshot: packet,
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
            await sleep(350);
          },
          onEdgeTraverse: async (edgeId) => {
            set({ activeEdgeId: edgeId });
            await sleep(200);
          },
        }
      );

      // Find the last output packet to display in the gallery
      const outputPacket = context.variables.output || context.nodes[logs[logs.length-1]?.nodeId];

      set({
        currentContext: context,
        executionLogs: logs,
        finalResult: outputPacket || null,
      });
    } catch (error) {
       console.error("Execution Engine Crash:", error);
    } finally {
      await sleep(500); 
      set({ running: false, highlightedNodeId: null, activeEdgeId: null });
    }
  },
}));