"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Play,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  Bot,
  Share2,
  Paperclip,
  FolderOpen,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SandboxGallery from "@/components/flow/SandboxGallery";
import { useSandboxExecution } from "@/hooks/useSandboxExecution";
import type { SandboxApiKey } from "@/lib/flow/serverExecutor";
import { packFiles } from "@/lib/utils/contextPacker";

interface SandboxClientProps {
  flowId: string;
  flowName: string;
  description: string;
  nodes: any[];
  edges: any[];
}

export default function SandboxClient({
  flowId,
  flowName,
  description,
  nodes,
  edges,
}: SandboxClientProps) {
  const sandboxExec = useSandboxExecution();

  // Always start as a clean slate — never inherit editor sessionStorage state
  useEffect(() => { sandboxExec.clearResult(); }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState("");
  const [envKeys, setEnvKeys] = useState<SandboxApiKey[]>([{ key: "", value: "" }]);
  const [envOpen, setEnvOpen] = useState(true);
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});
  const [linkCopied, setLinkCopied] = useState(false);

  // Multimodal attachments
  const [attachments, setAttachments] = useState<{ data: string; mimeType: string; name: string }[]>([]);
  const [textContext, setTextContext] = useState("");
  const [attachWarnings, setAttachWarnings] = useState<string[]>([]);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    const { textBlock, attachments: newImgs, warnings } = await packFiles(arr);
    setAttachWarnings(warnings);
    if (newImgs.length > 0) setAttachments((prev) => [...prev, ...newImgs]);
    if (textBlock) setTextContext((prev) => prev ? `${prev}\n${textBlock}` : textBlock);
  };

  const handleRun = async () => {
    const validKeys = envKeys.filter((k) => k.key.trim() && k.value.trim());
    const effectiveInput = inputValue || "Hello";

    const hasExtras = attachments.length > 0 || textContext;
    const nodesForRun = hasExtras
      ? nodes.map((n: any) =>
          n.type === "input"
            ? {
                ...n,
                data: {
                  ...n.data,
                  packet: {
                    type: "text",
                    payload: effectiveInput,
                    ...(attachments.length > 0 && { attachments }),
                    ...(textContext && { fileContext: textContext }),
                  },
                },
              }
            : n
        )
      : nodes;

    await sandboxExec.run(nodesForRun, edges, effectiveInput, validKeys);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const galleryNodes = nodes.map((n: any) => ({
    id: n.id,
    type: n.type,
    data: { label: n.data?.label },
  }));

  const packedFileCount = textContext
    ? (textContext.match(/^--- File:/gm) || []).length
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
            <Bot size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">{flowName}</h1>
            {description && (
              <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
            Public Sandbox
          </span>
        </div>
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 transition-all"
        >
          <Share2 size={12} />
          {linkCopied ? "Copied!" : "Share"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-5xl mx-auto w-full px-8 py-8 gap-8">

        {/* LEFT: Config + Input */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-6">

          {/* Environment Config */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setEnvOpen((v) => !v)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronRight
                size={12}
                className={cn("transition-transform", envOpen && "rotate-90")}
              />
              API Keys
            </button>

            {envOpen && (
              <div className="flex flex-col gap-2 pl-4 border-l border-slate-800">
                <p className="text-[9px] text-slate-600">
                  Your keys are sent securely to our server for this session only.
                </p>
                {envKeys.map((entry, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <input
                      type="text"
                      placeholder="KEY_NAME (e.g. OPENAI)"
                      value={entry.key}
                      onChange={(e) => {
                        const next = [...envKeys];
                        next[i] = { ...next[i], key: e.target.value };
                        setEnvKeys(next);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500/50"
                    />
                    <div className="relative">
                      <input
                        type={showValues[i] ? "text" : "password"}
                        placeholder="sk-... or AIza... or gsk_..."
                        value={entry.value}
                        onChange={(e) => {
                          const next = [...envKeys];
                          next[i] = { ...next[i], value: e.target.value };
                          setEnvKeys(next);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 pr-8 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500/50"
                      />
                      <button
                        onClick={() => setShowValues((v) => ({ ...v, [i]: !v[i] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                      >
                        {showValues[i] ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </div>
                    {envKeys.length > 1 && (
                      <button
                        onClick={() => setEnvKeys(envKeys.filter((_, j) => j !== i))}
                        className="text-[9px] text-slate-700 hover:text-rose-400 transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={9} /> Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setEnvKeys([...envKeys, { key: "", value: "" }])}
                  className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors mt-1"
                >
                  <Plus size={10} /> Add Key
                </button>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Prompt / Input
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-sky-400 transition-all px-2 py-1 rounded-lg border border-slate-700/50 hover:border-sky-500/30"
                >
                  <Paperclip size={9} />
                  Files
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-400 transition-all px-2 py-1 rounded-lg border border-slate-700/50 hover:border-indigo-500/30"
                >
                  <FolderOpen size={9} />
                  Folder
                </button>
              </div>
            </div>

            <textarea
              className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
              placeholder="Type a message or test prompt..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleRun();
                }
              }}
            />

            {/* Attachment chips */}
            {(attachments.length > 0 || textContext) && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[8px] font-bold text-indigo-400 max-w-[120px]"
                  >
                    <FileText size={9} className="shrink-0" />
                    <span className="truncate">{att.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="text-indigo-300 hover:text-rose-400 ml-0.5 shrink-0"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
                {textContext && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <FolderOpen size={9} className="text-emerald-400 shrink-0" />
                    <span className="text-[8px] font-bold text-emerald-400">
                      {packedFileCount} file{packedFileCount !== 1 ? "s" : ""} packed
                    </span>
                    <button
                      onClick={() => { setTextContext(""); setAttachWarnings([]); }}
                      className="text-emerald-300 hover:text-rose-400 ml-0.5 shrink-0"
                    >
                      <X size={9} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {attachWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1 text-[8px] text-amber-400">
                <AlertTriangle size={9} className="shrink-0 mt-0.5" />
                {w}
              </div>
            ))}

            <p className="text-[9px] text-slate-600">⌘ Enter to run</p>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={sandboxExec.running}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              sandboxExec.running
                ? "bg-indigo-600/40 text-white/50 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
            )}
          >
            {sandboxExec.running ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} className="fill-current" />
            )}
            {sandboxExec.running ? "Running agent..." : "Run Agent"}
          </button>
        </div>

        {/* RIGHT: Gallery */}
        <div className="flex-1 min-h-[600px]">
          <SandboxGallery
            {...sandboxExec}
            nodes={galleryNodes}
            onClearLogs={sandboxExec.clearResult}
          />
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={(el) => {
          (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          if (el) el.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
      />
    </div>
  );
}
