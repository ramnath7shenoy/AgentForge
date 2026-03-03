"use client";

import React from "react";
import ReactFlow, {
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

const FlowCanvas: React.FC<FlowCanvasProps> = ({ setSelectedNodeId }) => {
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const setNodes = useFlowStore((state) => state.setNodes);
  const setEdges = useFlowStore((state) => state.setEdges);
  const highlightedNodeId = useFlowStore((state) => state.highlightedNodeId);

  const nodeStyle = (node: Node) => ({
    border:
      node.id === highlightedNodeId ? "2px solid #4F46E5" : "1px solid #ccc",
    padding: "8px",
    borderRadius: "6px",
    background: "#fff",
  });

  React.useEffect(() => {
    if (nodes.length === 0) {
      setNodes([
        {
          id: "1",
          type: "input",
          data: {
            label: "Input",
            inputText: "User 123 requests a credit limit increase.",
            inputMode: "text",
          },
          position: { x: 0, y: 0 },
        },
        {
          id: "2",
          type: "ai",
          data: {
            label: "AI Scorer",
            prompt: "Score user {{input.userId}} for risk.",
            value: 75,
            jsonMode: true,
          },
          position: { x: 200, y: 0 },
        },
        {
          id: "3",
          type: "fetch",
          data: {
            label: "Mock API (true)",
            url: "https://api.example.com/users/{{input.userId}}",
          },
          position: { x: 400, y: -50 },
        },
        {
          id: "4",
          type: "output",
          data: {
            label: "Result",
            template:
              "User {{input.userId}} has score {{ai.score}} and status OK.",
          },
          position: { x: 400, y: 50 },
        },
      ]);
    }
  }, [nodes, setNodes]);

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes(applyNodeChanges(changes, nodes));
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edges));
  };

  const onConnect: OnConnect = (connection) => {
    setEdges(addEdge(connection, edges));
  };

  // When a node is clicked → show editor
  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  };

  // Handle drag-drop nodes from sidebar
  const onDropNode = (event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    const id = (nodes.length + 1).toString();

    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        apiUrl: "",
        prompt: "",
        condition: false,
      },
    };

    setNodes([...nodes, newNode]);
  };

  return (
    <div
      className="w-full h-full bg-slate-50 dark:bg-slate-900"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropNode}
    >
      <div className="mb-2">
        <button
          className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-slate-600 text-xs bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
          onClick={() => {
            const rootNodeId = nodes[0]?.id;
            if (rootNodeId) {
              useFlowStore.getState().simulateFlow(rootNodeId);
            }
          }}
        >
          Run Flow
        </button>
      </div>

      <ReactFlow
        nodes={nodes.map((node) =>
          node.type === "default" ? { ...node, style: nodeStyle(node) } : node
        )}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background gap={16} size={1} color="#e5e7eb" />
      </ReactFlow>
    </div>
  );
};

export default FlowCanvas;
