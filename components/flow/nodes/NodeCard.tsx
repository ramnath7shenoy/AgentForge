"use client";

import React, { useCallback, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { useReactFlow } from "reactflow";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";

// Tracks which node is currently zoomed-into so direct glides skip the zoom-out step.
let zoomedNodeId: string | null = null;

export const NodeCard: React.FC<{
  nodeId: string;
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
}> = ({
  nodeId,
  children,
  className,
  selected
}) => {
  const highlightedNodeId = useFlowStore((state) => state.highlightedNodeId);
  const theme = useFlowStore((state) => state.theme);
  const nodeStatus = useFlowStore((state) => state.nodeStatuses[nodeId]);
  const triggerNode = useFlowStore((state) => state.triggerNode);
  const isActive = highlightedNodeId === nodeId;
  const isSkipped = nodeStatus === "skipped";
  const isRunning = nodeStatus === "running";
  const isError   = nodeStatus === "error";
  const isSuccess = nodeStatus === "success";

  const { setCenter, getNode, project, getZoom } = useReactFlow();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleFocus = useCallback(() => {
    if (zoomedNodeId === nodeId) return;

    const node = getNode(nodeId);
    if (!node) return;

    const w = node.width ?? 240;
    const h = node.height ?? 120;
    const nodeCenterX = node.position.x + w / 2;
    const nodeCenterY = node.position.y + h / 2;

    // Only pan if the node center is outside the comfortable viewport zone.
    const margin = 100;
    const vpW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vpH = typeof window !== "undefined" ? window.innerHeight : 800;
    const topLeft = project({ x: margin, y: margin });
    const bottomRight = project({ x: vpW - margin, y: vpH - margin });

    const isComfortablyVisible =
      nodeCenterX >= topLeft.x && nodeCenterX <= bottomRight.x &&
      nodeCenterY >= topLeft.y && nodeCenterY <= bottomRight.y;

    if (isComfortablyVisible) return;

    zoomedNodeId = nodeId;
    setCenter(nodeCenterX, nodeCenterY, { zoom: getZoom(), duration: 600 });
  }, [nodeId, getNode, setCenter, getZoom, project]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // Camera zoom-out is handled exclusively by onPaneClick in FlowCanvas.
    // Blur only resets the zoomedNodeId tracker — no fitView.
    const next = e.relatedTarget as HTMLElement | null;
    if (!cardRef.current?.contains(next)) {
      zoomedNodeId = null;
    }
  }, []);

  return (
    <div
      ref={cardRef}
      data-nodeid={nodeId}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn("bg-transparent !border-0 transition-opacity duration-300", isSkipped && "opacity-40")}
    >
      <div
        className={cn(
          "relative min-w-[180px] rounded-xl border px-5 py-4 shadow-2xl transition-all duration-300",
          theme === "dark"
            ? "bg-[#0b0e14] border-slate-800 text-white"
            : "bg-white border-slate-200 text-slate-900",
          selected && "border-indigo-500 ring-4 ring-indigo-500/20 scale-[1.02] z-50 shadow-[0_0_20px_rgba(99,102,241,0.3)]",
          isActive && "border-emerald-500 ring-4 ring-emerald-500/20 scale-105 z-50",
          isError   && "border-red-500 ring-2 ring-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)]",
          isSkipped && "grayscale",
          className
        )}
      >
        {/* Status indicator — top-right corner */}
        {nodeStatus && nodeStatus !== "idle" && nodeStatus !== "skipped" && (
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
            {isError ? (
              <button
                title="Retry this node"
                onClick={(e) => { e.stopPropagation(); triggerNode(nodeId); }}
                className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/40 px-1.5 py-0.5 text-red-400 hover:bg-red-500/25 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <RotateCcw size={9} strokeWidth={2.5} />
              </button>
            ) : (
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  isSuccess && "bg-emerald-500",
                  isRunning && "bg-yellow-400 animate-pulse"
                )}
              />
            )}
          </div>
        )}

        {/* Centering Wrapper: forces text to wrap vertically rather than push the node wider */}
        <div className="flex flex-col items-center text-center w-full overflow-hidden [overflow-wrap:anywhere] [word-break:break-word]">
          {children}
        </div>
      </div>
    </div>
  );
};