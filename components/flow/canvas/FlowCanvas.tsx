"use client";

import React, { useCallback, useMemo, useEffect, useRef } from "react";

import ReactFlow, {
  Controls,
  ControlButton,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  OnConnect,
} from "reactflow";
import "reactflow/dist/style.css";
import { useFlowStore } from "@/stores/flowStore";
import { detectCycle } from "@/lib/flow/validators";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from "lucide-react";

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
import SubflowNode from "../nodes/SubflowNode";
import ApprovalNode from "../nodes/ApprovalNode";
import GroupNode from "../nodes/GroupNode";
import AppActionNode from "../nodes/AppActionNode";
import MLModelNode from "../nodes/MLModelNode";
import ImageGenNode from "../nodes/ImageGenNode";
import RAGNode from "../nodes/RAGNode";
import SpeechNode from "../nodes/SpeechNode";
import DataAnalysisNode from "../nodes/DataAnalysisNode";

// Module-level map stores each node's position at drag-start for position-change detection.
const preDragPositions = new Map<string, { x: number; y: number }>();

function getOtherUser(other: any) {
  return other?.info || other?.presence?.collaborationUser || { name: "Guest", color: "#64748b" };
}

interface FlowCanvasProps {
  setSelectedNodeId: (id: string | null) => void;
  editable?: boolean;
  collaborationEnabled?: boolean;
}

export default function FlowCanvas({ setSelectedNodeId, editable = true, collaborationEnabled = false }: FlowCanvasProps) {
  const nodesFromStore = useFlowStore((state) => state.nodes);
  const nodes = useMemo(() => nodesFromStore || [], [nodesFromStore]);
  const edgesFromStore = useFlowStore((state) => state.edges);
  const edges = useMemo(() => edgesFromStore || [], [edgesFromStore]);
  const theme = useFlowStore((state) => state.theme);
  const { setNodes, setEdges, addNode, activeEdgeId, showMinimap, tutorialStep, setTutorialStep, takeSnapshot, discardLastSnapshot, onNodeDragStop: storeDragStop, applyAutoLayout, layoutDirection } = useFlowStore();
  const nodeStatuses = useFlowStore((state) => state.nodeStatuses);
  const lastAction = useFlowStore((state) => state.lastAction);
  const others = useFlowStore((state) => (state as any).liveblocks?.others ?? []);
  const setCollaborationCursor = useFlowStore((state) => state.setCollaborationCursor);
  const setHoveredNodeId = useFlowStore((state) => state.setHoveredNodeId);
  const { project, fitView } = useReactFlow();
  const viewport = useViewport();
  const canvasRef = useRef<HTMLDivElement>(null);
  // Keep a stable ref to project so the event listener doesn't need to re-attach on every pan/zoom
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  // Auto-fit view when subagents are wrapped/unwrapped
  useEffect(() => {
    if (lastAction > 0) {
      setTimeout(() => {
        fitView({ duration: 800, padding: 0.2 });
      }, 50);
    }
  }, [lastAction, fitView]);

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
    group: GroupNode,
    appaction: AppActionNode,
    mlmodel: MLModelNode,
    imagegen: ImageGenNode,
    rag: RAGNode,
    speech: SpeechNode,
    dataanalysis: DataAnalysisNode,
  }), []);

  const onNodesChange = useCallback((c: NodeChange[]) => {
    const isSignificant = c.some(change => change.type === 'remove');
    if (isSignificant) takeSnapshot();
    setNodes(applyNodeChanges(c, nodes));
  }, [nodes, setNodes, takeSnapshot]);
  
  const onEdgesChange = useCallback((c: EdgeChange[]) => {
    const isSignificant = c.some(change => change.type === 'remove');
    if (isSignificant) takeSnapshot();
    setEdges(applyEdgeChanges(c, edges));
  }, [edges, setEdges, takeSnapshot]);
  
  const onConnect: OnConnect = useCallback((conn) => {
    const proposedEdges = addEdge(conn, edges);
    if (detectCycle(nodes, proposedEdges)) {
      toast.error("Loop detected! Circular flows are not allowed.");
      return;
    }
    takeSnapshot();
    setEdges(proposedEdges);
    // Tutorial Step 5 (Connect) -> 6 (Run Flow)
    if (tutorialStep === 5 && conn.source && conn.target) {
      const sourceNode = nodes.find(n => n.id === conn.source);
      const targetNode = nodes.find(n => n.id === conn.target);
      if (sourceNode?.type === 'trigger' && targetNode?.type === 'ai') {
        setTutorialStep(6);
      }
    }
  }, [edges, nodes, setEdges, tutorialStep, setTutorialStep, takeSnapshot]);

  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    // Capture pre-drag position and take snapshot of current state.
    // If the node doesn't actually move, discardLastSnapshot is called in onNodeDragStop.
    preDragPositions.set(node.id, { x: node.position.x, y: node.position.y });
    takeSnapshot();
  }, [takeSnapshot]);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    const prev = preDragPositions.get(node.id);
    preDragPositions.delete(node.id);

    // If the node didn't actually move, throw away the snapshot we just took.
    if (prev && prev.x === node.position.x && prev.y === node.position.y) {
      discardLastSnapshot();
    }

    // Delegate group-parenting logic to the store action.
    storeDragStop(event, node);
  }, [discardLastSnapshot, storeDragStop]);

  const onNodesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onEdgesDelete = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type) return;

    takeSnapshot();

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position,
      data: { 
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        routes: type === 'router' ? ["Path A", "Path B"] : undefined,
        // AI defaults
        ...(type === 'ai' ? {
          provider: 'gemini',
          model: 'gemini-1.5-flash',
        } : {}),
        // Subflow metadata from drag data
        ...(type === 'subflow' ? {
          subflowId: event.dataTransfer.getData("application/subflowId") || undefined,
          subflowName: event.dataTransfer.getData("application/subflowName") || "Sub-Agent",
        } : {})
      },
      style: {
        background: "transparent",
        border: "none",
      },
    };
    
    addNode(newNode);
    
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

  // Use native capture-phase mousemove so ReactFlow's pointer capture (used during pan/drag)
  // cannot intercept or stop propagation of cursor position updates.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !collaborationEnabled) return;

    const onMove = (e: MouseEvent) => {
      const bounds = el.getBoundingClientRect();
      const pos = projectRef.current({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
      setCollaborationCursor({ x: pos.x, y: pos.y });
    };

    const onLeave = (e: MouseEvent) => {
      if (!el.contains(e.relatedTarget as Element)) {
        setCollaborationCursor(null);
        setHoveredNodeId(null);
      }
    };

    el.addEventListener("mousemove", onMove, true);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove, true);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [collaborationEnabled, setCollaborationCursor, setHoveredNodeId]);

  return (
    <div
      ref={canvasRef}
      className={cn(
        "w-full h-full transition-colors duration-300",
        "bg-background"
      )}
      style={{ position: "relative" }}
      onDragOver={editable ? (e) => e.preventDefault() : undefined}
      onDrop={editable ? onDrop : undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges.map((e) => {
          const sourceRunning = nodeStatuses[e.source] === "running";
          const sourceSkipped = nodeStatuses[e.source] === "skipped" || nodeStatuses[e.source] === "error";
          const isActive = e.id === activeEdgeId || sourceRunning;
          return {
            ...e,
            type: "smoothstep",
            animated: isActive,
            style: isActive
              ? { stroke: "#6366f1", strokeWidth: 3, filter: "drop-shadow(0 0 6px #6366f1aa)" }
              : sourceSkipped
              ? { stroke: "#6366f1", strokeWidth: 1.5, opacity: 0.25 }
              : { stroke: "#6366f1", strokeWidth: 2 },
          };
        })}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#6366f1", strokeWidth: 2 },
        }}
        nodeTypes={nodeTypes}
        onNodesChange={editable ? onNodesChange : undefined}
        onEdgesChange={editable ? onEdgesChange : undefined}
        onNodesDelete={editable ? onNodesDelete : undefined}
        onEdgesDelete={editable ? onEdgesDelete : undefined}
        onConnect={editable ? onConnect : undefined}
        onNodeDragStart={editable ? onNodeDragStart : undefined}
        onNodeDragStop={editable ? onNodeDragStop : undefined}
        onNodeClick={(_, n) => setSelectedNodeId(n.id)}
        onNodeMouseEnter={collaborationEnabled ? (_, n) => setHoveredNodeId(n.id) : undefined}
        onNodeMouseLeave={collaborationEnabled ? () => setHoveredNodeId(null) : undefined}
        onPaneClick={() => fitView({ duration: 800, padding: 0.15 })}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        minZoom={0.05}
        maxZoom={2}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={theme === "dark" ? "#334155" : "#cbd5e1"}
        />
        <Controls
          style={{ bottom: 20, left: 20 }}
          className={cn(
            "!z-[60] transition-colors",
            theme === "dark" ? "dark:bg-slate-900 dark:border-slate-800" : "bg-white border-slate-200"
          )}
        >
          {/* Vertical layout (TB) */}
          <ControlButton
            onClick={() => {
              applyAutoLayout("TB");
              setTimeout(() => fitView({ duration: 500, padding: 0.15 }), 50);
            }}
            title="Auto-layout: Top → Bottom"
            className={cn(layoutDirection === "TB" && "!text-indigo-400 !bg-indigo-500/10")}
          >
            <AlignVerticalDistributeCenter size={12} />
          </ControlButton>

          {/* Horizontal layout (LR) */}
          <ControlButton
            onClick={() => {
              applyAutoLayout("LR");
              setTimeout(() => fitView({ duration: 500, padding: 0.15 }), 50);
            }}
            title="Auto-layout: Left → Right"
            className={cn(layoutDirection === "LR" && "!text-indigo-400 !bg-indigo-500/10")}
          >
            <AlignHorizontalDistributeCenter size={12} />
          </ControlButton>
        </Controls>
        {showMinimap && (
          <MiniMap 
            className="!bg-popover !border-border rounded-xl shadow-lg"
            maskColor={theme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)"}
            nodeColor={(n) => {
              if (n.type === 'group') return 'transparent'; // Remove the solid block
              return '#71717a'; // Default neutral gray for other nodes
            }}
            nodeStrokeColor={(n) => {
              if (n.type === 'group') return '#ffffff'; // CLEAN WHITE BORDER for subagents
              return 'transparent';
            }}
            nodeStrokeWidth={4} // Slightly thicker for better visibility
            zoomable
            pannable
          />
        )}
      </ReactFlow>

      {collaborationEnabled && (
        <div className="pointer-events-none absolute inset-0 z-[1000] overflow-hidden">
          {others.map((other: any) => {
            const cursor = other?.presence?.collaborationCursor;
            if (!cursor) return null;
            const user = getOtherUser(other);
            const hoveredNodeId = other?.presence?.hoveredNodeId;
            const hoveredNode = hoveredNodeId ? nodes.find((n) => n.id === hoveredNodeId) : null;
            const hoveredLabel = hoveredNode?.data?.label || hoveredNode?.type;
            const cursorX = cursor.x * viewport.zoom + viewport.x;
            const cursorY = cursor.y * viewport.zoom + viewport.y;
            return (
              <div
                key={other.connectionId ?? user.name}
                className="absolute left-0 top-0 flex items-start gap-1 pointer-events-none"
                style={{
                  transform: `translate3d(${cursorX}px, ${cursorY}px, 0)`,
                  transition: "transform 80ms linear",
                  willChange: "transform",
                }}
              >
                <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M0 0L0 16L4.5 11.5L7.5 19L9.5 18L6.5 10.5L12 10.5L0 0Z"
                    fill={user.color}
                    stroke="white"
                    strokeWidth="1.2"
                  />
                </svg>
                <span
                  className="ml-0.5 mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg whitespace-nowrap"
                  style={{ backgroundColor: user.color }}
                >
                  {hoveredLabel ? `${user.name} · ${hoveredLabel}` : user.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}