"use client";

import React, { useRef, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Play, Upload, FileText, X, Type } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";
import { FlowPacket } from "@/types/flowStoreTypes";

export default function InputNode({ id, data }: NodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { nodes, setNodes, theme } = useFlowStore();

  const updatePacket = (packet: FlowPacket) => {
    const updatedNodes = nodes.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, packet } };
      }
      return node;
    });
    setNodes(updatedNodes);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      updatePacket({
        type: "file",
        payload: content,
        meta: {
          name: file.name,
          size: file.size,
          mimeType: file.type
        }
      });
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <NodeCard nodeId={id} className="min-w-[240px]">
      <div className="flex items-center gap-2 font-bold text-blue-500 uppercase tracking-tighter mb-3">
        <Play size={14} fill="currentColor" />
        <span>Starting Point</span>
      </div>
      
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "w-full rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center gap-3",
          isDragOver 
            ? "border-blue-500 bg-blue-500/10" 
            : theme === "dark" ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50"
        )}
      >
        {!data.packet || (data.packet.type === 'text' && !data.packet.payload) ? (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <Upload size={20} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-500 uppercase">Drop file or type below</p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between w-full bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 overflow-hidden">
              {data.packet.type === 'file' ? <FileText size={14} className="text-blue-500" /> : <Type size={14} className="text-indigo-500" />}
              <span className="text-[10px] font-bold truncate">
                {data.packet.type === 'file' ? data.packet.meta?.name : 'Typed Text'}
              </span>
            </div>
            <button onClick={() => updatePacket({ type: "text", payload: "" })} className="text-slate-400 hover:text-rose-500">
              <X size={14} />
            </button>
          </div>
        )}

        <textarea
          data-nodrag
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "w-full h-20 p-2 text-[11px] rounded-lg border resize-none focus:ring-2 focus:ring-blue-500/20 outline-none transition-all",
            theme === "dark" 
              ? "bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-700" 
              : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-300"
          )}
          placeholder="What information are we starting with?"
          value={data.packet?.type === 'text' ? data.packet.payload : ''}
          onChange={(e) => updatePacket({ type: "text", payload: e.target.value })}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-[9px] font-bold text-blue-500 hover:underline uppercase tracking-widest"
        >
          Browse Files
        </button>
      </div>

      <input 
        ref={fileInputRef}
        type="file" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* UNIVERSAL CENTERED HANDLE */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]" 
      />
    </NodeCard>
  );
}