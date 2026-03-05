"use client";

import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Split, Plus } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";

export default function RouterNode({ id, data }: NodeProps) {
  const routes = data.routes || ["Path A", "Path B"];
  const { setNodes, nodes } = useFlowStore();

  const addPath = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the node when clicking button
    const newPathName = `Path ${String.fromCharCode(65 + routes.length)}`; // A, B, C...
    
    // Update the node's data in the global store
    setNodes(nodes.map((node) => {
      if (node.id === id) {
        return {
          ...node,
          data: { ...node.data, routes: [...routes, newPathName] }
        };
      }
      return node;
    }));
  };

  return (
    <NodeCard nodeId={id}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-semibold text-orange-400">
          <Split size={14} />
          <span>Router</span>
        </div>
        {/* The Magic Button: Adds a new path and handle instantly */}
        <button 
          onClick={addPath}
          className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
        >
          <Plus size={14} />
        </button>
      </div>
      
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 !bg-slate-400 border-2 border-slate-900 !top-[-6px] left-1/2 -translate-x-1/2" 
      />

      <div className="flex flex-col gap-5 mt-2">
        {routes.map((route: string, index: number) => (
          <div key={index} className="relative flex justify-end items-center h-5">
            <span className="text-[10px] text-slate-400 mr-3">{route}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={route.toLowerCase()}
              className="w-3 h-3 !bg-orange-500 border-2 border-slate-900 !right-[-22px] top-1/2 -translate-y-1/2"
            />
          </div>
        ))}
      </div>
    </NodeCard>
  );
}