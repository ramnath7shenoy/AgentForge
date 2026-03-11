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
  FlowPacket,
  ExecutionStatus,
} from "@/types/flowStoreTypes";

import {
  executeFlow,
  NodeExecutor,
} from "@/lib/executionEngine";

import { resolveTemplates } from "@/lib/template";
import { getSavedAgents } from "@/lib/savedAgents";
import { useLogStore } from "@/stores/useLogStore";

// Helper for visual execution feedback
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Global approval signal for the Safety Gatekeeper
let approvalResolve: ((approved: boolean) => void) | null = null;
export function sendApprovalSignal(approved: boolean) {
  if (approvalResolve) {
    approvalResolve(approved);
    approvalResolve = null;
  }
}
export function isAwaitingApproval() { return approvalResolve !== null; }

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
  tutorialStep: 0,

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
  setTutorialStep: (step) => set({ tutorialStep: step }),
  completeTutorial: () => {
    localStorage.setItem('agentforge_onboarding_complete', 'true');
    set({ tutorialStep: 0 });
  },

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
      trigger: async (node, context) => {
        const data = node.data as NodeData;
        const schedule = data.schedule || "Manual";
        let packet: FlowPacket = { type: "text", payload: `Triggered by ${schedule} Action` };
        
        const status: ExecutionStatus = "success";

        if (schedule === "Webhook") {
          // Simulate the engine setting status to "listening" and waiting for a POST request
          packet = { type: "data", payload: { webhookReceived: true, endpoint: `/api/webhook/${node.id}`, timestamp: Date.now() } };
          await sleep(2000); // Highlight listening state visually longer for demo purposes
        } else if (schedule === "Schedule") {
          // Simulate the engine reading the cron frequency and wrapping this flow in an interval
          const frequency = data.cron || "Every Minute";
          packet = { type: "text", payload: `Automated Execution: ${frequency}` };
          await sleep(1000); // Simulate schedule initializing delay
        } else {
          // Manual Execution (fires exactly once)
          packet = { type: "text", payload: `Manual Execution Triggered` };
        }

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "trigger",
            status,
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: schedule,
            outputSnapshot: packet,
          },
        };
      },

      webhook: async (node, context) => {
        const packet: FlowPacket = { type: "data", payload: { webhookObtained: true } };
        await sleep(1000); // Simulate waiting
        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "webhook",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: "Waiting for payload...",
            outputSnapshot: packet,
          },
        };
      },

      vault: async (node, context) => {
        const data = node.data as NodeData;
        const instruction = resolveTemplates(data.instructions || "Search documents", context);
        
        const packet: FlowPacket = {
          type: "data",
          payload: {
            matches: [
              { id: 1, text: `Match 1 for: ${instruction}`, score: 0.95 },
              { id: 2, text: `Match 2 for: ${instruction}`, score: 0.82 },
              { id: 3, text: `Match 3 for: ${instruction}`, score: 0.74 }
            ]
          }
        };

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "vault",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: instruction,
            outputSnapshot: packet,
          },
        };
      },

      gatekeeper: async (node, context) => {
        const data = node.data as NodeData;
        const verification = data.verification || "Critic AI";
        
        const status = "success";
        const packet: FlowPacket = {
          type: "text",
          payload: `Gatekeeper checked via: ${verification}`
        };

        if (verification === "Human") {
            packet.payload = "Waiting for human approval...";
            await sleep(1500); // Simulate waiting for user approval
            packet.payload = "Human approved.";
        }

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "gatekeeper",
            status: status as any,
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: verification,
            outputSnapshot: packet,
          },
        };
      },

      processor: async (node, context) => {
        const data = node.data as NodeData;
        const batchLogic = data.batchLogic || "Loop";
        
        // Find previous node output if possible, simulated here by looking at last node
        const nodeKeys = Object.keys(context.nodes);
        const lastOutput = nodeKeys.length > 0 ? context.nodes[nodeKeys[nodeKeys.length - 1]] : null;

        const packet: FlowPacket = {
          type: "data",
          payload: {
            processed: true,
            method: batchLogic,
            itemsProcessed: lastOutput ? 1 : 0
          }
        };

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "processor",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: batchLogic,
            outputSnapshot: packet,
          },
        };
      },

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

      subflow: async (node, context) => {
        const data = node.data as NodeData;
        const agents = getSavedAgents();
        const agent = agents.find(a => a.id === data.subflowId);

        if (!agent || agent.nodes.length === 0) {
          return {
            context: { ...context, nodes: { ...context.nodes, [node.id]: { type: "text", payload: "Sub-agent not found" } } },
            logEntry: {
              nodeId: node.id,
              nodeType: "subflow",
              status: "error",
              startedAt: Date.now(),
              endedAt: Date.now(),
              durationMs: 0,
              inputSnapshot: data.subflowId,
              outputSnapshot: "Sub-agent not found",
              error: `No saved agent found with ID: ${data.subflowId}`,
            },
          };
        }

        // Execute the sub-flow with the current context as input
        const subStartNodeId = agent.nodes[0].id;
        const { context: subContext, logs: subLogs } = await executeFlow(
          subStartNodeId,
          agent.nodes,
          agent.edges,
          executors,
          context,
        );

        // Extract the sub-flow's final output
        const subOutput = subContext.variables.output 
          || subContext.nodes[subLogs[subLogs.length - 1]?.nodeId]
          || { type: "text" as const, payload: "Sub-agent completed (no output)" };

        return {
          context: { ...subContext, nodes: { ...subContext.nodes, [node.id]: subOutput } },
          logEntry: {
            nodeId: node.id,
            nodeType: "subflow",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: data.subflowName || data.subflowId,
            outputSnapshot: subOutput,
          },
        };
      },

      approval: async (node, context) => {
        const addLog = useLogStore.getState().addLog;
        addLog("WARN", `⏸ Paused at Safety Gate: ${node.data.label || "Approval"}`, node.id);

        // Wait for global approval signal
        const approved = await new Promise<boolean>((resolve) => {
          approvalResolve = resolve;
        });

        if (!approved) {
          addLog("ERROR", `✗ Flow aborted by user at: ${node.data.label || "Approval"}`, node.id);
          throw new Error("Flow aborted by user");
        }

        addLog("SUCCESS", `✓ Approved: ${node.data.label || "Approval Gate"}`, node.id);
        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: { type: "text", payload: "Approved" } } },
          logEntry: {
            nodeId: node.id,
            nodeType: "approval",
            status: "success" as const,
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 0,
            inputSnapshot: "Awaiting approval",
            outputSnapshot: "Approved",
          },
        };
      },
    };

    try {
      const addLog = useLogStore.getState().addLog;
      addLog("INFO", `▶ Flow execution started (${nodes.length} nodes)`);

      const { context, logs } = await executeFlow(
        startNodeId,
        nodes,
        edges,
        executors,
        initialContext,
        {
          onNodeStart: async (nodeId) => {
            const node = nodes.find(n => n.id === nodeId);
            const label = node?.data?.label || node?.type || nodeId;
            addLog("INFO", `⚡ Executing: ${label}`, nodeId);
            set((s) => ({
              highlightedNodeId: nodeId,
              executedNodeIds: s.executedNodeIds.includes(nodeId) 
                ? s.executedNodeIds 
                : [...s.executedNodeIds, nodeId],
            }));
            await sleep(350);
          },
          onNodeEnd: async (nodeId, status) => {
            const node = nodes.find(n => n.id === nodeId);
            const label = node?.data?.label || node?.type || nodeId;
            if (status === "success") {
              addLog("SUCCESS", `✓ Completed: ${label}`, nodeId);
            } else {
              addLog("ERROR", `✗ Failed: ${label}`, nodeId);
            }
          },
          onEdgeTraverse: async (edgeId) => {
            set({ activeEdgeId: edgeId });
            addLog("INFO", `→ Traversing edge ${edgeId.slice(0, 8)}...`);
            await sleep(200);
          },
        }
      );

      // Find the last output packet to display in the gallery
      const outputPacket = context.variables.output || context.nodes[logs[logs.length-1]?.nodeId];

      addLog("SUCCESS", `✦ Flow complete — ${logs.length} nodes executed`);

      set({
        currentContext: context,
        executionLogs: logs,
        finalResult: outputPacket || null,
      });
    } catch (error) {
      const addLog = useLogStore.getState().addLog;
      addLog("ERROR", `Flow execution failed: ${error}`);
      console.error("Flow execution failed:", error);
    } finally {
      set({ running: false, highlightedNodeId: null, activeEdgeId: null });
    }
  },
}));