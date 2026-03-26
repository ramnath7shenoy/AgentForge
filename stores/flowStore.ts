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

// If FlowState in types doesn't have projects, we'll patch it here:
export interface ExtendedFlowState extends FlowState {
  projects: any[];
  setProjects: (projects: any[]) => void;
  executionResult: Record<string, any> | null;
  isRunning: boolean;
  runClientFlow: (initialInput: string) => Promise<void>;
  updateNodeData: (nodeId: string, newData: Partial<NodeData>) => void;
  addNode: (node: Node<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  unwrapSubagent: (nodeId: string) => void;
  wrapSubagent: (groupId: string) => void;
  onNodeDragStop: (event: React.MouseEvent, node: Node) => void;
}

import {
  executeFlow,
  NodeExecutor,
} from "@/lib/executionEngine";

import { executeGraph } from "@/lib/flow/clientExecutor";

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

export const useFlowStore = create<ExtendedFlowState>((set, get) => ({
  nodes: [],
  edges: [],
  theme: "dark", 
  selectedNodeId: null,
  running: false,
  isRunning: false,
  highlightedNodeId: null,
  currentContext: null,
  executionLogs: [],
  finalResult: null,
  activeEdgeId: null,
  executedNodeIds: [],
  showMinimap: false,
  showExecutionLogPanel: false,
  showVariablesPanel: false,
  tutorialStep: 0,
  activeProject: null,
  projects: [],
  executionResult: {},

  // --- HISTORY STATE ---
  past: [],
  future: [],
  lastAction: 0,
  takeSnapshot: () => {
    const { nodes, edges } = get();
    set((state) => ({
      past: [...state.past.slice(-50), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      future: []
    }));
  },

  undo: () => {
    const { past, nodes, edges } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: newPast,
      future: [{ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }, ...get().future]
    });
  },

  // --- STANDARD ACTIONS ---
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setRunning: (running) => set({ running }),
  setActiveProject: (project) => {
    // Ensure we are setting the project with its actual database ID
    set({ activeProject: project ? { id: project.id, name: project.name } : null });
  },

  clearActiveProject: () => set({ activeProject: null }),
  setProjects: (projects) => set({ projects }),
  
  // NEW ACTION: Clear all nodes for a fresh start
  clearCanvas: () => {
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
  },

  // FIXED: Implementation of setFinalResult for blocking banner dismissal
  setFinalResult: (result) => set({ finalResult: result }),

  // FIXED: Implementation of setTheme for global UI synchronization
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
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

  updateNodeData: (nodeId: string, newData: Partial<NodeData>) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      ),
    }));
  },

  addNode: (newNode: Node<NodeData>) => {
    const { nodes } = get();
    
    // Check if drop is inside a Group node
    const groupNode = nodes.find(n => 
      n.type === 'group' && 
      newNode.position.x >= n.position.x &&
      newNode.position.x <= n.position.x + (n.style?.width as number || 400) &&
      newNode.position.y >= n.position.y &&
      newNode.position.y <= n.position.y + (n.style?.height as number || 300)
    );

    let nodeToAdd = { ...newNode };
    if (groupNode) {
      nodeToAdd = {
        ...nodeToAdd,
        parentId: groupNode.id,
        extent: 'parent' as const,
        // Relative position inside group
        position: {
          x: newNode.position.x - groupNode.position.x,
          y: newNode.position.y - groupNode.position.y
        },
        data: {
          ...nodeToAdd.data,
          parent_node_id: groupNode.id
        }
      };
    }

    set({ nodes: [...nodes, nodeToAdd] });
  },

  deleteNode: (nodeId: string) => {
    const { nodes, edges } = get();
    set({
      nodes: nodes.filter(n => n.id !== nodeId),
      edges: edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    });
  },

  runClientFlow: async (initialInput: string) => {
    set({ running: true, isRunning: true, executionResult: {} });
    
    // Fresh snapshot inside the function
    const { nodes, edges } = get();
    console.log("🚀 Starting Flow with Nodes:", nodes);
    
    const addLog = useLogStore.getState().addLog;
    
    const result = await executeGraph(nodes, edges, initialInput, (message, type, nodeId) => {
      addLog(type || "INFO", message, nodeId);
      
      // Also highlight nodes in real-time if nodeId is provided
      if (nodeId) {
        set((s) => ({
          highlightedNodeId: nodeId,
          executedNodeIds: s.executedNodeIds.includes(nodeId) 
            ? s.executedNodeIds 
            : [...s.executedNodeIds, nodeId],
        }));
      }
    });

    set({ 
      executionResult: result.context.nodes as any, 
      running: false,
      isRunning: false,
      highlightedNodeId: null,
      finalResult: result.context.variables.output || Object.values(result.context.nodes).pop() || null
    });
  },

  // --- FLOW EXECUTION LOGIC ---
  simulateFlow: async (startNodeId: string, userId?: string) => {
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
        const addLog = useLogStore.getState().addLog;
        
        addLog("INFO", "Executing AI simulation...", node.id);
        await sleep(1000);

        const packet: FlowPacket = { 
          type: "text", 
          payload: `Simulated AI output for: ${instructions.slice(0, 30)}...`
        };

        return {
          context: { ...context, nodes: { ...context.nodes, [node.id]: packet } },
          logEntry: {
            nodeId: node.id,
            nodeType: "ai",
            status: "success",
            startedAt: Date.now(),
            endedAt: Date.now(),
            durationMs: 1000,
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

  unwrapSubagent: (nodeId: string) => {
    const { nodes, edges } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || (node.type !== 'subflow' && node.type !== 'subagent')) return;

    // 1. Get subagent data (Prioritize workflowOverride)
    let subData = node.data.workflowOverride || node.data.localOverride;
    
    if (!subData) {
      const subflowId = node.data.subflowId;
      const project = get().projects.find(p => p.id === subflowId);
      if (project) {
        subData = { nodes: project.nodes, edges: project.edges };
      } else {
        const savedAgents = getSavedAgents();
        const agent = savedAgents.find(a => a.id === subflowId);
        if (agent) {
          subData = { nodes: agent.nodes, edges: agent.edges };
        }
      }
    }

    if (!subData) {
      console.warn("Could not find subagent data for expansion");
      return;
    }

    // 2. Convert SubflowNode to GroupNode
    // Calculate bounding box if nodes exist
    const subNodesList = subData.nodes;
    let minX = 0, minY = 0, maxX = 400, maxY = 300;
    if (subNodesList.length > 0) {
      minX = Math.min(...subNodesList.map(n => n.position.x));
      minY = Math.min(...subNodesList.map(n => n.position.y));
      maxX = Math.max(...subNodesList.map(n => n.position.x + 200));
      maxY = Math.max(...subNodesList.map(n => n.position.y + 100));
    }

    const padding = 60;
    const groupWidth = (maxX - minX) + padding * 2;
    const groupHeight = (maxY - minY) + padding * 2;

    const groupNode: Node = {
      ...node,
      type: 'group',
      style: { 
        ...node.style, 
        width: groupWidth, 
        height: groupHeight, 
        background: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.4)', // CLEAN WHITE BORDER for subagents
        borderRadius: '24px',
      },
      className: "bg-white/5 border-white/20",
      data: { ...node.data, label: node.data.subflowName || node.data.label }
    };

    // 3. Offset and prepare sub-nodes
    const subNodes = subNodesList.map(sn => ({
      ...sn,
      id: `${nodeId}-${sn.id}`,
      parentId: nodeId,
      extent: 'parent' as const,
      position: { x: sn.position.x - minX + padding, y: sn.position.y - minY + padding },
      data: { ...sn.data, parent_node_id: nodeId }
    }));

    const subEdges = (subData.edges || []).map(se => ({
      ...se,
      id: `${nodeId}-${se.id}`,
      source: `${nodeId}-${se.source}`,
      target: `${nodeId}-${se.target}`,
      parentId: nodeId
    }));

    set({
      nodes: nodes.map(n => n.id === nodeId ? groupNode : n).concat(subNodes),
      edges: edges.concat(subEdges as any),
      lastAction: Date.now()
    });
  },

  wrapSubagent: (groupId: string) => {
    const { nodes, edges } = get();
    const groupNode = nodes.find(n => n.id === groupId);
    if (!groupNode || groupNode.type !== 'group') return;

    const children = nodes.filter(n => n.parentId === groupId);
    const childEdges = edges.filter(e => (e as any).parentId === groupId);

    // Calculate offsets used during unwrap to reverse them
    const subNodesList = children;
    let minX = 0, minY = 0;
    // We don't easily know the original minX/minY, but we know padding was added.
    // Actually, when wrapping, we just save the current relative positions.
    
    // Save state back to localOverride
    const localNodes = children.map(cn => ({
      ...cn,
      id: cn.id.replace(`${groupId}-`, ''),
      parentId: undefined,
      extent: undefined,
      // Position is already relative to parent in ReactFlow when parentId is set
      // So we just keep it as is, or adjust if we want to normalize it
    }));

    const localEdges = childEdges.map(ce => ({
      ...ce,
      id: ce.id.replace(`${groupId}-`, ''),
      source: ce.source.replace(`${groupId}-`, ''),
      target: ce.target.replace(`${groupId}-`, ''),
      parentId: undefined
    }));

    const subflowNode: Node = {
      ...groupNode,
      type: 'subflow',
      style: { ...groupNode.style, width: undefined, height: undefined, background: undefined },
      data: { 
        ...groupNode.data, 
        workflowOverride: { nodes: localNodes, edges: localEdges } 
      }
    };

    set({
      nodes: nodes.filter(n => n.parentId !== groupId).map(n => n.id === groupId ? subflowNode : n),
      edges: edges.filter(e => (e as any).parentId !== groupId),
      lastAction: Date.now()
    });
  },

  onNodeDragStop: (event, draggedNode) => {
    const { nodes } = get();
    if (draggedNode.type === 'group') return; // Groups can't be parented to others here

    // Find if node dropped inside a Group
    const groupNode = nodes.find(n => 
      n.type === 'group' && 
      n.id !== draggedNode.id &&
      draggedNode.position.x >= n.position.x &&
      draggedNode.position.x <= n.position.x + (n.style?.width as number || 400) &&
      draggedNode.position.y >= n.position.y &&
      draggedNode.position.y <= n.position.y + (n.style?.height as number || 300)
    );

    if (groupNode && draggedNode.parentId !== groupNode.id) {
      // Move into group
      set({
        nodes: nodes.map(n => n.id === draggedNode.id ? {
          ...n,
          parentId: groupNode.id,
          extent: 'parent' as const,
          position: {
            x: draggedNode.position.x - groupNode.position.x,
            y: draggedNode.position.y - groupNode.position.y
          },
          data: { ...n.data, parent_node_id: groupNode.id }
        } : n)
      });
    } else if (!groupNode && draggedNode.parentId) {
      // Move out of group
      const parentNode = nodes.find(n => n.id === draggedNode.parentId);
      if (parentNode) {
        set({
          nodes: nodes.map(n => n.id === draggedNode.id ? {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: {
              x: draggedNode.position.x + parentNode.position.x,
              y: draggedNode.position.y + parentNode.position.y
            },
            data: { ...n.data, parent_node_id: undefined }
          } : n)
        });
      }
    }
  },
}));