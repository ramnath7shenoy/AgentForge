"use client";

import React, { useCallback } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  OnConnect,
  useReactFlow,
} from "reactflow";

import "reactflow/dist/style.css";

import { useFlowStore } from "@/stores/flowStore";

import FetchNode from "@/components/flow/nodes/FetchNode";
import AINode from "@/components/flow/nodes/AINode";
import DecisionNode from "@/components/flow/nodes/DecisionNode";
import InputNode from "@/components/flow/nodes/InputNode";
import OutputNode from "@/components/flow/nodes/OutputNode";

const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  fetch: FetchNode,
  ai: AINode,
  decision: DecisionNode,
};

interface FlowCanvasProps {
  setSelectedNodeId: (id: string | null) => void;
}

function FlowCanvasInner({ setSelectedNodeId }: FlowCanvasProps) {
  const nodesState = useFlowStore((state) => state.nodes);
  const edgesState = useFlowStore((state) => state.edges);

  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);

  const activeEdgeId = useFlowStore((state) => state.activeEdgeId);
  const showMinimap = useFlowStore((state) => state.showMinimap);

  const { project } = useReactFlow();

  // Ensure arrays
  const nodes = Array.isArray(nodesState) ? nodesState : [];
  const edges = Array.isArray(edgesState) ? edgesState : [];

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes(applyNodeChanges(changes, nodes));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edges));
  };

  const onConnect: OnConnect = (connection) => {
    setEdges(addEdge(connection, edges));
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const onDropNode = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const bounds = event.currentTarget.getBoundingClientRect();

      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        },
        style: {
          background: "transparent",
          border: "none",
        },
      };

      setNodes([...nodes, newNode]);
    },
    [project, nodes, setNodes]
  );

  return (
    <div
      className="w-full h-full bg-background"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropNode}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges.map((edge) =>
          edge.id === activeEdgeId
            ? {
                ...edge,
                animated: true,
                style: { stroke: "#4F46E5", strokeWidth: 2 },
              }
            : edge
        )}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        {showMinimap && <MiniMap />}
        <Controls />
        <Background gap={16} size={1} color="#1f2937" />
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}