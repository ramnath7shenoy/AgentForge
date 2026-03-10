"use client";

import React, { useCallback, useMemo } from "react";
import ReactFlow, { 
  ReactFlowProvider, 
  Controls, 
  MiniMap, 
  useReactFlow, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge, 
  Node, 
  Edge, 
  NodeChange, 
  EdgeChange, 
  OnConnect 
} from "reactflow";
import "reactflow/dist/style.css";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

// Custom node components
import InputNode from "../nodes/InputNode";
import OutputNode from "../nodes/OutputNode";
import ActionNode from "../nodes/ActionNode"; 
import AINode from "../nodes/AINode";
import RouterNode from "../nodes/RouterNode";
import TriggerNode from "../nodes/TriggerNode";
import VaultNode from "../nodes/VaultNode";
import GatekeeperNode from "../nodes/GatekeeperNode";
import ProcessorNode from "../nodes/ProcessorNode";
import WebhookNode from "../nodes/WebhookNode";

interface FlowCanvasProps {
  setSelectedNodeId: (id: string | null) => void;
}

export default function FlowCanvas({ setSelectedNodeId }: FlowCanvasProps) {
  const nodes = useFlowStore((state) => state.nodes) || [];
  const edges = useFlowStore((state) => state.edges) || [];
  const theme = useFlowStore((state) => state.theme);
  const { setNodes, setEdges, activeEdgeId, showMinimap, tutorialStep, setTutorialStep } = useFlowStore();
  const { project } = useReactFlow();

  const nodeTypes = useMemo(() => ({
    input: InputNode,
    output: OutputNode,
    ai: AINode,
    action: ActionNode, 
    fetch: ActionNode,    
    router: RouterNode,
    decision: RouterNode,
    trigger: TriggerNode,
    webhook: WebhookNode,
    vault: VaultNode,
    gatekeeper: GatekeeperNode,
    processor: ProcessorNode,
  }), []);

  const onNodesChange = useCallback((c: NodeChange[]) => {
    setNodes(applyNodeChanges(c, nodes));
  }, [nodes, setNodes]);
  
  const onEdgesChange = useCallback((c: EdgeChange[]) => setEdges(applyEdgeChanges(c, edges)), [edges, setEdges]);
  
  const onConnect: OnConnect = useCallback((conn) => {
    setEdges(addEdge(conn, edges));
    // Tutorial Step 5 (Connect) -> 6 (Run Flow)
    if (tutorialStep === 5 && conn.source && conn.target) {
      const sourceNode = nodes.find(n => n.id === conn.source);
      const targetNode = nodes.find(n => n.id === conn.target);
      if (sourceNode?.type === 'trigger' && targetNode?.type === 'ai') {
        setTutorialStep(6);
      }
    }
  }, [edges, setEdges, tutorialStep, nodes, setTutorialStep]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position,
      data: { 
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        routes: type === 'router' ? ["Path A", "Path B"] : undefined 
      },
      style: {
        background: "transparent",
        border: "none",
      },
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    
    // Tutorial Step 2 -> 3: Trigger dropped, advance to Configure
    if (tutorialStep === 2 && type === 'trigger') {
      setTimeout(() => {
        const currentNodes = useFlowStore.getState().nodes;
        setNodes(currentNodes.map(n => ({ ...n, selected: false })));
      }, 50);
      setTutorialStep(3);
    }

    // Tutorial Step 4 -> 5: Agent Brain dropped, advance to Connect
    if (tutorialStep === 4 && type === 'ai') {
      setTimeout(() => {
        const currentNodes = useFlowStore.getState().nodes;
        setNodes(currentNodes.map(n => ({ ...n, selected: false })));
      }, 50);
      setTutorialStep(5);
    }
  }, [project, nodes, setNodes, tutorialStep, setTutorialStep]);

  return (
    <div 
      className={cn(
        "w-full h-full transition-colors duration-300",
        theme === "dark" ? "bg-[#0b0e14]" : "bg-slate-50"
      )} 
      onDragOver={(e) => e.preventDefault()} 
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => e.id === activeEdgeId 
          ? { ...e, animated: true, style: { stroke: "#6366f1", strokeWidth: 3 } } 
          : e
        )}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => setSelectedNodeId(n.id)}
        fitView
      >
        <Controls className={cn(
          "transition-colors",
          theme === "dark" ? "dark:bg-slate-900 dark:border-slate-800" : "bg-white border-slate-200"
        )} />
        {showMinimap && (
          <MiniMap 
            style={{ 
                background: theme === "dark" ? '#0b0e14' : '#ffffff',
                border: 'none'
            }} 
            maskColor={theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"}
          />
        )}
      </ReactFlow>
    </div>
  );
}