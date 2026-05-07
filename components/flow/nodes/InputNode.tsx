"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { Play, FileText, X, Paperclip, FolderOpen, AlertTriangle } from "lucide-react";
import { NodeCard } from "./NodeCard";
import { useFlowStore } from "@/stores/flowStore";
import { cn } from "@/lib/utils";
import { FlowPacket, FlowAttachment } from "@/types/flowStoreTypes";
import { packFiles } from "@/lib/utils/contextPacker";

export default function InputNode({ id, data, selected, xPos, yPos }: NodeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { theme } = useFlowStore();
  const { setCenter, getViewport } = useReactFlow();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Local textarea state (prevents cursor jump) ───────────────────────
  // The textarea controls its own text via local state; the Zustand store
  // is updated only on blur (or explicit patchPacket calls from other
  // actions). External store changes (Chat Hub, Clear all) are synced back
  // via the useEffect below.
  const [localText, setLocalText] = useState<string>(() => {
    const p = data?.packet;
    return p?.type === "text" ? (p.payload ?? "") : "";
  });
  const lastSyncedText = useRef<string>(localText);

  // Sync store → local when something external changes the packet's text
  // (e.g. ChatHub seeding the value, Clear all button).
  const storeText: string = (() => {
    const p = data?.packet;
    return p?.type === "text" ? (p.payload ?? "") : "";
  })();
  useEffect(() => {
    if (storeText !== lastSyncedText.current) {
      setLocalText(storeText);
      lastSyncedText.current = storeText;
    }
  }, [storeText]);

  // ── Fresh-state patchPacket (avoids stale closure) ────────────────────
  // Reads the node's latest packet directly from Zustand at call time so
  // attachments/fileContext are never lost due to a stale closure.
  const patchPacket = useCallback((patch: Partial<FlowPacket>) => {
    const store = useFlowStore.getState();
    const freshNode = store.nodes.find((n) => n.id === id);
    const freshPacket: FlowPacket = freshNode?.data?.packet ?? { type: "text", payload: "" };
    const next: FlowPacket = { ...freshPacket, ...patch };
    store.setNodes(store.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, packet: next } } : n)));
  }, [id]);

  // ── File handling ─────────────────────────────────────────────────────
  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const { textBlock, attachments: newImgAtts, warnings: w } = await packFiles(files);
    setWarnings(w);
    const patch: Partial<FlowPacket> = {};

    if (newImgAtts.length > 0) {
      const store = useFlowStore.getState();
      const freshNode = store.nodes.find((n) => n.id === id);
      const freshPacket: FlowPacket = freshNode?.data?.packet ?? { type: "text", payload: "" };
      const existing: FlowAttachment[] = freshPacket.attachments || [];
      patch.attachments = [...existing, ...newImgAtts];
    }
    if (textBlock) {
      const store = useFlowStore.getState();
      const freshNode = store.nodes.find((n) => n.id === id);
      const freshPacket: FlowPacket = freshNode?.data?.packet ?? { type: "text", payload: "" };
      const prev = freshPacket.fileContext || "";
      patch.fileContext = prev ? `${prev}\n${textBlock}` : textBlock;
    }
    if (Object.keys(patch).length > 0) patchPacket(patch);
  }, [id, patchPacket]);

  const removeAttachment = useCallback((idx: number) => {
    const store = useFlowStore.getState();
    const freshNode = store.nodes.find((n) => n.id === id);
    const freshPacket: FlowPacket = freshNode?.data?.packet ?? { type: "text", payload: "" };
    const next = (freshPacket.attachments || []).filter((_, i) => i !== idx);
    patchPacket({ attachments: next.length ? next : undefined });
  }, [id, patchPacket]);

  const clearFileContext = useCallback(() => {
    patchPacket({ fileContext: undefined });
    setWarnings([]);
  }, [patchPacket]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  };

  // ── Textarea handlers ─────────────────────────────────────────────────
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalText(val);
    // Debounced store sync (500ms) — eliminates cursor jump on fast typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastSyncedText.current = val;
      patchPacket({ type: "text", payload: val });
    }, 500);
  };

  // Double-click: zoom to 1.4× (the only time zoom level changes)
  const handleZoomIn = useCallback(() => {
    const NODE_W = 260;
    const NODE_H = 220;
    setCenter(xPos + NODE_W / 2, yPos + NODE_H / 2, { zoom: 1.4, duration: 600 });
  }, [setCenter, xPos, yPos]);

  // Text focus / file button click: soft pan to node center at current zoom (no zoom change)
  const handleSoftPan = useCallback(() => {
    const NODE_W = 260;
    const NODE_H = 220;
    const { zoom } = getViewport();
    setCenter(xPos + NODE_W / 2, yPos + NODE_H / 2, { zoom, duration: 300 });
  }, [setCenter, getViewport, xPos, yPos]);

  const handleTextFocus = () => handleSoftPan();

  const handleTextBlur = () => {
    // Cancel any pending debounce and flush immediately to store (no fitView — only paneClick zooms out)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lastSyncedText.current = localText;
    patchPacket({ type: "text", payload: localText });
  };

  // Double-click header also zooms in at 1.4×
  const handleDoubleClick = () => handleZoomIn();

  // Derive display values from store packet (for chips/badges; text comes from localText)
  const currentPacket: FlowPacket = data.packet || { type: "text", payload: "" };
  const attachments = currentPacket.attachments || [];
  const fileContext = currentPacket.fileContext || "";
  const packedFileCount = fileContext ? (fileContext.match(/^--- File:/gm) || []).length : 0;

  return (
    <NodeCard nodeId={id} selected={selected} className="min-w-[240px]">
      <div
        onDoubleClick={handleDoubleClick}
        className="flex items-center gap-2 font-bold text-blue-500 uppercase tracking-tighter mb-3 cursor-zoom-in select-none"
      >
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
          value={localText}
          onChange={handleTextChange}
          onFocus={handleTextFocus}
          onBlur={handleTextBlur}
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
              onMouseDown={(e) => e.preventDefault()} // prevent textarea blur before click
              onClick={() => { handleSoftPan(); fileInputRef.current?.click(); }}
              className="flex items-center gap-1 text-[9px] font-bold text-blue-500 hover:underline uppercase tracking-widest"
            >
              <Paperclip size={10} />
              Files
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { handleSoftPan(); folderInputRef.current?.click(); }}
              className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 hover:underline uppercase tracking-widest"
            >
              <FolderOpen size={10} />
              Folder
            </button>
          </div>
          {(localText || attachments.length > 0 || fileContext) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setLocalText("");
                lastSyncedText.current = "";
                patchPacket({ type: "text", payload: "", attachments: undefined, fileContext: undefined });
                setWarnings([]);
              }}
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
