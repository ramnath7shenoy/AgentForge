"use client";

import React, { useRef, useState, useCallback } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Play, FileText, X, Paperclip, FolderOpen, AlertTriangle } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";
import { FlowPacket, FlowAttachment } from "@/types/flowStoreTypes";
import { packFiles } from "@/lib/utils/contextPacker";

export default function InputNode({ id, data, selected }: NodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { nodes, setNodes, theme } = useFlowStore();

  const currentPacket: FlowPacket = data.packet || { type: "text", payload: "" };

  const patchPacket = (patch: Partial<FlowPacket>) => {
    const next: FlowPacket = { ...currentPacket, ...patch };
    setNodes(nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, packet: next } } : n));
  };

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const { textBlock, attachments: newImgAtts, warnings: w } = await packFiles(files);
    setWarnings(w);

    const patch: Partial<FlowPacket> = {};

    if (newImgAtts.length > 0) {
      const existing: FlowAttachment[] = currentPacket.attachments || [];
      patch.attachments = [...existing, ...newImgAtts];
    }

    if (textBlock) {
      const prev = currentPacket.fileContext || "";
      patch.fileContext = prev ? `${prev}\n${textBlock}` : textBlock;
    }

    if (Object.keys(patch).length > 0) patchPacket(patch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPacket, nodes, id]);

  const removeAttachment = (idx: number) => {
    const next = (currentPacket.attachments || []).filter((_, i) => i !== idx);
    patchPacket({ attachments: next.length ? next : undefined });
  };

  const clearFileContext = () => {
    patchPacket({ fileContext: undefined });
    setWarnings([]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  const textValue = currentPacket.type === "text" ? (currentPacket.payload || "") : "";
  const attachments = currentPacket.attachments || [];
  const fileContext = currentPacket.fileContext || "";

  // Count packed text files (estimate from header markers)
  const packedFileCount = fileContext ? (fileContext.match(/^--- File:/gm) || []).length : 0;

  return (
    <NodeCard nodeId={id} selected={selected} className="min-w-[240px]">
      <div className="flex items-center gap-2 font-bold text-blue-500 uppercase tracking-tighter mb-3">
        <Play size={14} fill="currentColor" />
        <span>Starting Point</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "w-full rounded-xl border-2 border-dashed transition-all p-4 flex flex-col gap-3",
          isDragOver
            ? "border-blue-500 bg-blue-500/10"
            : theme === "dark" ? "border-slate-800 bg-slate-900/30" : "border-slate-200 bg-slate-50"
        )}
      >
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
          value={textValue}
          onChange={(e) => patchPacket({ type: "text", payload: e.target.value })}
        />

        {/* Image attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[9px] font-bold text-blue-400 max-w-[130px]"
              >
                <FileText size={10} className="shrink-0" />
                <span className="truncate">{att.name || "image"}</span>
                <button onClick={() => removeAttachment(i)} className="text-blue-300 hover:text-rose-400 ml-0.5 shrink-0">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Packed file context indicator */}
        {fileContext && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <FolderOpen size={10} className="text-emerald-400 shrink-0" />
            <span className="text-[9px] font-bold text-emerald-400 flex-1">
              {packedFileCount} file{packedFileCount !== 1 ? "s" : ""} packed as context
            </span>
            <button onClick={clearFileContext} className="text-emerald-300 hover:text-rose-400 shrink-0">
              <X size={10} />
            </button>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="flex flex-col gap-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1 text-[9px] text-amber-400">
                <AlertTriangle size={9} className="shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 text-[9px] font-bold text-blue-500 hover:underline uppercase tracking-widest"
            >
              <Paperclip size={10} />
              Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 hover:underline uppercase tracking-widest"
            >
              <FolderOpen size={10} />
              Folder
            </button>
          </div>
          {(textValue || attachments.length > 0 || fileContext) && (
            <button
              onClick={() => { patchPacket({ type: "text", payload: "", attachments: undefined, fileContext: undefined }); setWarnings([]); }}
              className="text-[9px] text-slate-500 hover:text-rose-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />

      {/* Folder input */}
      <input
        ref={(el) => {
          (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          if (el) el.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-[#0b0e14] !opacity-100 !left-1/2 !-translate-x-1/2 !bottom-[-6px]"
      />
    </NodeCard>
  );
}
