"use client";

import React, { useMemo, useEffect, useCallback } from "react";
import ReactFlow, { Controls, Node, Edge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";

// Custom node components
import InputNode from "@/components/flow/nodes/InputNode";
import OutputNode from "@/components/flow/nodes/OutputNode";
import ActionNode from "@/components/flow/nodes/ActionNode";
import AINode from "@/components/flow/nodes/AINode";
import RouterNode from "@/components/flow/nodes/RouterNode";
import TriggerNode from "@/components/flow/nodes/TriggerNode";
import VaultNode from "@/components/flow/nodes/VaultNode";
import GatekeeperNode from "@/components/flow/nodes/GatekeeperNode";
import ProcessorNode from "@/components/flow/nodes/ProcessorNode";
import WebhookNode from "@/components/flow/nodes/WebhookNode";
import SubflowNode from "@/components/flow/nodes/SubflowNode";
import ApprovalNode from "@/components/flow/nodes/ApprovalNode";
import { ReactFlowProvider } from "reactflow";
import { saveSharedFlow } from "@/app/actions/flow";

interface ReadOnlyCanvasProps {
  nodes: Node[];
  edges: Edge[];
  /** When true, nodes are draggable and changes are auto-saved back to the shared flow. */
  editable?: boolean;
  /** The flow ID — required when editable=true so auto-save knows which row to update. */
  flowId?: string;
}

function Canvas({ nodes: initialNodes, edges: initialEdges, editable = false, flowId }: ReadOnlyCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

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
    subflow: SubflowNode,
    approval: ApprovalNode,
  }), []);

  // Debounced auto-save for editable shared views
  const autoSave = useCallback(() => {
    if (!editable || !flowId) return;
    const timer = setTimeout(async () => {
      await saveSharedFlow(flowId, nodes, edges);
    }, 2000);
    return () => clearTimeout(timer);
  }, [editable, flowId, nodes, edges]);

  useEffect(() => {
    const cleanup = autoSave();
    return cleanup;
  }, [autoSave]);

  return (
    <div className="w-full h-full bg-[#0b0e14]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={editable ? onNodesChange : undefined}
        onEdgesChange={editable ? onEdgesChange : undefined}
        fitView
        // Read-only: disable interactions unless editable
        nodesConnectable={editable}
        nodesDraggable={editable}
        elementsSelectable={editable}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Controls showInteractive={false} className="dark:bg-slate-900 dark:border-slate-800" />
      </ReactFlow>
    </div>
  );
}

export default function ReadOnlyCanvas(props: ReadOnlyCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
