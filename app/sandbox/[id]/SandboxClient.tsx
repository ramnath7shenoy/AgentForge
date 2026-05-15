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
  MessageSquare,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SandboxGallery from "@/components/flow/SandboxGallery";
import { useSandboxExecution } from "@/hooks/useSandboxExecution";
import type { SandboxApiKey } from "@/lib/flow/serverExecutor";
import { packFiles } from "@/lib/utils/contextPacker";
import { useScheduler, getSchedulerIntervalMs } from "@/hooks/useScheduler";
import { Square } from "lucide-react";

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
  const scheduler = useScheduler();

  // Derive scheduler config from the trigger node in this flow (if any).
  const triggerNode = nodes.find((n: any) => n.type === "trigger");
  const schedulerIntervalMs = triggerNode ? getSchedulerIntervalMs(triggerNode.data) : null;
  const isSchedulerFlow = schedulerIntervalMs !== null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const KEYS_STORAGE_KEY = `SANDBOX_KEYS_${flowId}`;
  const [inputValue, setInputValue] = useState("");
  const [envKeys, setEnvKeys] = useState<SandboxApiKey[]>(() => {
    try {
      const saved = localStorage.getItem(`SANDBOX_KEYS_${flowId}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ key: "", value: "" }];
  });
  const [envOpen, setEnvOpen] = useState(true);

  // Always start as a clean slate — never inherit editor sessionStorage state
  useEffect(() => { sandboxExec.clearResult(); }, []);

  // Persist env keys to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(envKeys)); } catch {}
  }, [envKeys, KEYS_STORAGE_KEY]);
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});
  const [linkCopied, setLinkCopied] = useState(false);

  // Multimodal attachments
  const [attachments, setAttachments] = useState<{ data: string; mimeType: string; name: string }[]>([]);
  const [textContext, setTextContext] = useState("");
  const [attachWarnings, setAttachWarnings] = useState<string[]>([]);

  // Multi-turn chat history
  type ChatTurn = { role: "user" | "assistant"; content: string };
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const pendingUserMsgRef = useRef("");
  const prevRunningRef = useRef(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // After a run finishes with a result, append the turn to chat history
  useEffect(() => {
    if (prevRunningRef.current && !sandboxExec.running && sandboxExec.finalResult && pendingUserMsgRef.current) {
      const assistantContent =
        typeof sandboxExec.finalResult.payload === "string"
          ? sandboxExec.finalResult.payload
          : JSON.stringify(sandboxExec.finalResult.payload, null, 2);
      setChatHistory((prev) => [
        ...prev,
        { role: "user", content: pendingUserMsgRef.current },
        { role: "assistant", content: assistantContent },
      ]);
      setInputValue("");
      pendingUserMsgRef.current = "";
    }
    prevRunningRef.current = sandboxExec.running;
  }, [sandboxExec.running, sandboxExec.finalResult]);

  // Scroll chat to bottom when history grows
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    const { textBlock, attachments: newImgs, warnings } = await packFiles(arr);
    setAttachWarnings(warnings);
    if (newImgs.length > 0) setAttachments((prev) => [...prev, ...newImgs]);
    if (textBlock) setTextContext((prev) => prev ? `${prev}\n${textBlock}` : textBlock);
  };

  // Ref so the scheduler always calls the latest version of handleRun
  // (captures current envKeys, inputValue, attachments, etc.)
  const handleRunRef = useRef<() => Promise<void>>(async () => {});

  const handleRun = async () => {
    const validKeys = envKeys.filter((k) => k.key.trim() && k.value.trim());
    const effectiveInput = inputValue || "Hello";
    pendingUserMsgRef.current = effectiveInput;

    let fullInput = effectiveInput;
    const recentHistory = chatHistory.slice(-20);
    if (recentHistory.length > 0) {
      const historyText = recentHistory
        .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
        .join("\n");
      fullInput = `[Previous conversation]\n${historyText}\n[End previous]\n\nCurrent message: ${effectiveInput}`;
    }

    const nodesForRun = nodes.map((n: any) =>
      n.type === "input"
        ? {
            ...n,
            data: {
              ...n.data,
              packet: {
                type: "text",
                payload: fullInput,
                ...(attachments.length > 0 && { attachments }),
                ...(textContext && { fileContext: textContext }),
              },
            },
          }
        : n
    );

    await sandboxExec.run(nodesForRun, edges, fullInput, validKeys, flowId);
  };

  // Keep the ref in sync every render so the scheduler always has the latest closure.
  handleRunRef.current = handleRun;

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

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-1.5">
                  <MessageSquare size={10} /> Conversation
                </span>
                <button
                  onClick={() => { setChatHistory([]); sandboxExec.clearResult(); }}
                  className="text-[9px] text-slate-600 hover:text-rose-400 transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={9} /> Clear
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1">
                {chatHistory.map((turn, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[10px] leading-relaxed",
                      turn.role === "user"
                        ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 self-end ml-4"
                        : "bg-slate-800 border border-slate-700 text-slate-300 self-start mr-4"
                    )}
                  >
                    <span className={cn("text-[8px] font-bold uppercase tracking-wider block mb-1", turn.role === "user" ? "text-indigo-400" : "text-emerald-400")}>
                      {turn.role === "user" ? "You" : "Agent"}
                    </span>
                    <span className="whitespace-pre-wrap break-words line-clamp-6">{turn.content}</span>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                {chatHistory.length > 0 ? "New Message" : "Prompt / Input"}
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

          {/* Run / Auto-Run / Stop button */}
          {scheduler.isActive ? (
            <button
              onClick={() => scheduler.stop()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20"
            >
              {sandboxExec.running ? <Loader2 size={15} className="animate-spin" /> : <Square size={15} className="fill-current" />}
              {sandboxExec.running ? "Running..." : "Stop Auto-Run"}
            </button>
          ) : sandboxExec.running ? (
            <button
              onClick={() => sandboxExec.abort()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20"
            >
              <Square size={15} className="fill-current" />
              Stop
            </button>
          ) : (
            <button
              onClick={() => isSchedulerFlow ? scheduler.start(() => handleRunRef.current(), schedulerIntervalMs!) : handleRun()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
            >
              <Play size={15} className="fill-current" />
              {isSchedulerFlow ? "Start Auto-Run" : "Run Agent"}
            </button>
          )}
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
