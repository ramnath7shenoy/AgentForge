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

// Custom node components that must use the centered-handle logic
import InputNode from "../nodes/InputNode";
import OutputNode from "../nodes/OutputNode";
import ActionNode from "../nodes/ActionNode"; 
import AINode from "../nodes/AINode";
import RouterNode from "../nodes/RouterNode";

interface FlowCanvasProps {
  setSelectedNodeId: (id: string | null) => void;
}

function FlowCanvasInner({ setSelectedNodeId }: FlowCanvasProps) {
  const nodes = useFlowStore((state) => state.nodes) || [];
  const edges = useFlowStore((state) => state.edges) || [];
  const theme = useFlowStore((state) => state.theme);
  const { setNodes, setEdges, activeEdgeId, showMinimap } = useFlowStore();
  const { project } = useReactFlow();

  // Mapping string types to custom components to prevent default white box rendering
  const nodeTypes = useMemo(() => ({
    input: InputNode,
    output: OutputNode,
    ai: AINode,
    action: ActionNode, 
    fetch: ActionNode,    
    router: RouterNode,
    decision: RouterNode, 
  }), []);

  const onNodesChange = (c: NodeChange[]) => setNodes(applyNodeChanges(c, nodes));
  const onEdgesChange = (c: EdgeChange[]) => setEdges(applyEdgeChanges(c, edges));
  const onConnect: OnConnect = (conn) => setEdges(addEdge(conn, edges));

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
        // Label defaults updated to simple strings
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        routes: type === 'router' ? ["Path A", "Path B"] : undefined 
      },
      // Forcing transparency on the library's default container
      style: {
        background: "transparent",
        border: "none",
      },
    };
    setNodes([...nodes, newNode]);
  }, [project, nodes, setNodes]);

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
        // Active edges use a glow effect for visibility
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
        {/* Background dots removed to clean the workspace */}
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

export default function FlowCanvas(props: FlowCanvasProps) {
  return <ReactFlowProvider><FlowCanvasInner {...props} /></ReactFlowProvider>;
}