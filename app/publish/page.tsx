/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFlowStore } from "@/stores/flowStore";
import { compileFlow } from "@/lib/flowCompiler";
import {
  Library,
  getLibrariesForTab,
  getDefaultLibrary,
  getLibraryMeta,
} from "@/lib/codegen/templates";
import {
  Copy,
  CheckCircle,
  Play,
  FileText,
  Download,
  Code2,
  ArrowLeft,
  Package,
  ChevronDown,
  ChevronRight,
  Link2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  Store,
  ShoppingBag,
  Paperclip,
  FolderOpen,
  ImageIcon,
  X,
  AlertTriangle,
} from "lucide-react";
import { packFiles } from "@/lib/utils/contextPacker";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import SandboxGallery from "@/components/flow/SandboxGallery";
import { useSandboxExecution } from "@/hooks/useSandboxExecution";
import { saveFlow, publishFlow, deployToStore } from "@/app/actions/flow";
import DeployModal from "./DeployModal";
import { useVaultStore } from "@/stores/vaultStore";
import type { SandboxApiKey } from "@/lib/flow/serverExecutor";

type Tab = "python" | "javascript" | "typescript";

export default function PublishPage() {
  const router = useRouter();
  const { nodes, edges, activeProject, theme } = useFlowStore();
  const sandboxExec = useSandboxExecution();

  const [activeTab, setActiveTab] = useState<Tab>("python");
  const [activeLibrary, setActiveLibrary] = useState<Library>(getDefaultLibrary("python"));
  const [copied, setCopied] = useState(false);
  const [compiledCode, setCompiledCode] = useState("");
  const [libDropdownOpen, setLibDropdownOpen] = useState(false);

  // Input & env config — persisted in sessionStorage so Back navigation restores state
  const [inputValue, setInputValue] = useState("");
  const [envKeys, setEnvKeys] = useState<SandboxApiKey[]>([{ key: "", value: "" }]);
  const [envOpen, setEnvOpen] = useState(false);
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});

  // Sandbox attachments (declared early so backup effects can reference them)
  type SandboxAttachment = { data: string; mimeType: string; name: string };
  const attachFileRef = useRef<HTMLInputElement>(null);
  const attachFolderRef = useRef<HTMLInputElement>(null);
  const [sandboxAttachments, setSandboxAttachments] = useState<SandboxAttachment[]>([]);
  const [sandboxTextContext, setSandboxTextContext] = useState<string>("");
  const [attachWarnings, setAttachWarnings] = useState<string[]>([]);

  const FORGE_STATE_KEY = "FORGE_PUBLISH_STATE";

  // Effect 1 — Rehydrate user config from localStorage (input, keys, attachments only).
  // Execution results (logs, finalResult) are intentionally NOT restored so opening
  // the page for a new flow never shows a stale screenshot from a previous run.
  useEffect(() => {
    sandboxExec.clearResult(); // nuke any sessionStorage remnant from prior session
    try {
      const raw = localStorage.getItem(FORGE_STATE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as any;
      if (s.inputValue) setInputValue(s.inputValue);
      if (Array.isArray(s.envKeys) && s.envKeys.length) setEnvKeys(s.envKeys);
      if (Array.isArray(s.attachments) && s.attachments.length) setSandboxAttachments(s.attachments);
      if (s.fileContext) setSandboxTextContext(s.fileContext);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear execution state on unmount so Back-navigation never leaks results
  useEffect(() => {
    return () => { sandboxExec.clearResult(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2 — Persist user config on change (results excluded — don't want stale ghosts)
  useEffect(() => {
    try {
      localStorage.setItem(FORGE_STATE_KEY, JSON.stringify({
        inputValue,
        envKeys,
        attachments: sandboxAttachments,
        fileContext: sandboxTextContext,
      }));
    } catch {}
  }, [inputValue, envKeys, sandboxAttachments, sandboxTextContext]);

  // Vault sync
  const [vaultSynced, setVaultSynced] = useState(false);
  const handleSyncFromVault = () => {
    const entries = useVaultStore.getState().entries.filter((e) => e.value.trim());
    if (entries.length === 0) return;
    setEnvKeys(entries.map((e) => ({ key: e.key, value: e.value })));
    setEnvOpen(true);
    setVaultSynced(true);
    setTimeout(() => setVaultSynced(false), 1500);
  };

  const handleClearAllKeys = () => {
    setEnvKeys([{ key: "", value: "" }]);
  };

  const handleResetSandbox = () => {
    setInputValue("");
    setEnvKeys([{ key: "", value: "" }]);
    setSandboxAttachments([]);
    setSandboxTextContext("");
    setAttachWarnings([]);
    localStorage.removeItem(FORGE_STATE_KEY);
    sandboxExec.clearResult();
  };

  // Share state
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Deploy to Store state
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployedFlowId, setDeployedFlowId] = useState<string | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  const addSandboxFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const fileArr = Array.from(files);
    const { textBlock, attachments: newImgAtts, warnings } = await packFiles(fileArr);
    setAttachWarnings(warnings);
    if (newImgAtts.length > 0)
      setSandboxAttachments((prev) => [...prev, ...newImgAtts]);
    if (textBlock)
      setSandboxTextContext((prev) => prev ? `${prev}\n${textBlock}` : textBlock);
  };

  // Keep library in sync when switching tabs
  useEffect(() => {
    setActiveLibrary(getDefaultLibrary(activeTab));
  }, [activeTab]);

  useEffect(() => {
    setCompiledCode(compileFlow(nodes, edges, activeTab, activeLibrary));
  }, [nodes, edges, activeTab, activeLibrary]);

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = activeTab === "python" ? "py" : activeTab === "javascript" ? "js" : "ts";
    const filename = `agentforge_${activeTab}_${activeLibrary}.${ext}`;
    const blob = new Blob([compiledCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunSandbox = async () => {
    const validKeys = envKeys.filter((k) => k.key.trim() && k.value.trim());
    const effectiveInput = inputValue || "Hello";

    // Inject staged attachments + packed file context into the InputNode's packet.
    const hasExtras = sandboxAttachments.length > 0 || sandboxTextContext;
    let nodesForRun: any[] = nodes as any;
    if (hasExtras) {
      nodesForRun = (nodes as any[]).map((n: any) => {
        if (n.type === "input") {
          return {
            ...n,
            data: {
              ...n.data,
              packet: {
                type: "text",
                payload: effectiveInput,
                ...(sandboxAttachments.length > 0 && { attachments: sandboxAttachments }),
                ...(sandboxTextContext && { fileContext: sandboxTextContext }),
              },
            },
          };
        }
        return n;
      });
    }

    await sandboxExec.run(nodesForRun, edges as any, effectiveInput, validKeys);
  };

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const name = activeProject?.name || "Untitled Agent";
      const saveResult = await saveFlow(null, name, nodes, edges, undefined, true);
      if (!saveResult.success || !saveResult.flow) {
        throw new Error(saveResult.error || "Failed to save flow");
      }
      const flowId = saveResult.flow.id;
      await publishFlow(flowId);
      const url = `${window.location.origin}/sandbox/${flowId}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch (err: any) {
      console.error("Share failed:", err);
    } finally {
      setShareLoading(false);
    }
  };

  const handleDeployConfirm = async (name: string, description: string) => {
    setDeployLoading(true);
    try {
      const thumbnail =
        typeof sandboxExec.finalResult?.payload === "string" &&
        sandboxExec.finalResult.payload.startsWith("data:image/")
          ? sandboxExec.finalResult.payload
          : undefined;
      const result = await deployToStore(name, description, nodes as object, edges as object, deployedFlowId ?? undefined, thumbnail);
      if (result.success && result.flowId) {
        setDeployedFlowId(result.flowId);
        setIsDeployed(true);
        setDeployModalOpen(false);
        router.push("/store");
      }
    } catch (err: any) {
      console.error("Deploy failed:", err);
    } finally {
      setDeployLoading(false);
    }
  };

  const canDeploy = sandboxExec.finalResult !== null && !sandboxExec.running;

  const libMeta = getLibraryMeta(activeLibrary);
  const availableLibs = getLibrariesForTab(activeTab);

  return (
    <>
    <div
      className={cn(
        "flex flex-col h-screen w-full transition-colors duration-300",
        theme === "dark" ? "dark bg-background text-foreground" : "bg-background text-foreground"
      )}
    >
      <Navbar />
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT COLUMN: Sandbox */}
        <div className="w-1/2 border-r border-border flex flex-col h-full bg-card">
          <header className="p-6 border-b border-border flex items-center justify-between bg-card">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white border border-border"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white uppercase tracking-wider">Universal Preview</h1>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Environment Sandbox</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Deploy to Store */}
              <div className="flex flex-col items-end gap-0.5">
                <button
                  onClick={() => canDeploy && setDeployModalOpen(true)}
                  disabled={deployLoading || !canDeploy}
                  title={!canDeploy ? "Run a successful sandbox to unlock deployment." : undefined}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                    isDeployed
                      ? "bg-violet-600/20 text-violet-400 border-violet-500/30"
                      : canDeploy
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                        : "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-50"
                  )}
                >
                  {deployLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Store size={13} />
                  )}
                  {isDeployed ? "Deployed" : "Deploy to Store"}
                </button>
                {!canDeploy && (
                  <span className="text-[9px] text-slate-600 font-medium pr-0.5">
                    Run a successful sandbox to unlock.
                  </span>
                )}
              </div>

              {/* Share Sandbox */}
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                  shareCopied
                    ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                )}
              >
                {shareLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : shareCopied ? (
                  <CheckCircle size={13} />
                ) : (
                  <Link2 size={13} />
                )}
                {shareCopied ? "Link Copied!" : "Share Sandbox"}
              </button>

              {/* Run Sandbox */}
              <button
                onClick={handleRunSandbox}
                disabled={sandboxExec.running}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg",
                  sandboxExec.running
                    ? "bg-indigo-600/50 text-white/50 cursor-not-allowed shadow-none"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                )}
              >
                {sandboxExec.running ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} className="fill-current" />
                )}
                {sandboxExec.running ? "Running..." : "Run Sandbox"}
              </button>
            </div>
          </header>

          <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6 scrollbar-hide">

            {/* Shared sandbox URL banner */}
            {shareUrl && (
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Link2 size={13} className="text-emerald-400 shrink-0" />
                <span className="text-[10px] font-mono text-emerald-300 truncate flex-1">{shareUrl}</span>
                <button
                  onClick={() => router.push(`/sandbox/${shareUrl.split("/").pop()}`)}
                  className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 shrink-0 flex items-center gap-1"
                >
                  Open <ChevronRight size={10} />
                </button>
              </div>
            )}

            {/* ENV CONFIG */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEnvOpen((v) => !v)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ChevronRight
                    size={12}
                    className={cn("transition-transform", envOpen && "rotate-90")}
                  />
                  Environment Config
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleSyncFromVault}
                    className={cn(
                      "flex items-center gap-1 text-[9px] font-bold transition-all px-1.5 py-0.5 rounded border",
                      vaultSynced
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-slate-600 border-slate-700/50 hover:text-indigo-400 hover:border-indigo-500/30"
                    )}
                  >
                    <RefreshCw size={9} className={vaultSynced ? "text-emerald-400" : ""} />
                    {vaultSynced ? "Synced!" : "Sync from Vault"}
                  </button>
                  <button
                    onClick={handleClearAllKeys}
                    className="flex items-center gap-1 text-[9px] font-bold transition-all px-1.5 py-0.5 rounded border text-slate-600 border-slate-700/50 hover:text-rose-400 hover:border-rose-500/30"
                  >
                    <Trash2 size={9} />
                    Clear All
                  </button>
                  <span className="text-[9px] text-slate-600 font-normal">
                    {envKeys.filter((k) => k.value.trim()).length} key{envKeys.filter((k) => k.value.trim()).length !== 1 ? "s" : ""} set
                  </span>
                </div>
              </div>

              {envOpen && (
                <div className="flex flex-col gap-2 pl-4 border-l border-slate-800">
                  {envKeys.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="KEY_NAME"
                        value={entry.key}
                        onChange={(e) => {
                          const next = [...envKeys];
                          next[i] = { ...next[i], key: e.target.value };
                          setEnvKeys(next);
                        }}
                        className="w-32 bg-background border border-border rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500/50"
                      />
                      <div className="relative flex-1">
                        <input
                          type={showValues[i] ? "text" : "password"}
                          placeholder="sk-... / AIza... / gsk_..."
                          value={entry.value}
                          onChange={(e) => {
                            const next = [...envKeys];
                            next[i] = { ...next[i], value: e.target.value };
                            setEnvKeys(next);
                          }}
                          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 pr-8 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500/50"
                        />
                        <button
                          onClick={() => setShowValues((v) => ({ ...v, [i]: !v[i] }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                        >
                          {showValues[i] ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                      <button
                        onClick={() => setEnvKeys(envKeys.filter((_, j) => j !== i))}
                        className="text-slate-700 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
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

            {/* UNIVERSAL INPUT */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Universal Input</h2>
                <button
                  onClick={handleResetSandbox}
                  className="ml-auto flex items-center gap-1 text-[9px] font-bold text-slate-600 hover:text-rose-400 transition-colors px-1.5 py-0.5 rounded border border-slate-800 hover:border-rose-500/30"
                  title="Reset all inputs and results"
                >
                  <RotateCcw size={9} /> Reset
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  {/* Attach files button */}
                  <button
                    onClick={() => attachFileRef.current?.click()}
                    className="flex items-center gap-1 text-[9px] font-bold transition-all px-2 py-1 rounded-lg border text-slate-500 border-slate-700/50 hover:text-sky-400 hover:border-sky-500/30"
                  >
                    <Paperclip size={9} />
                    Files
                  </button>
                  {/* Folder upload */}
                  <button
                    onClick={() => attachFolderRef.current?.click()}
                    className="flex items-center gap-1 text-[9px] font-bold transition-all px-2 py-1 rounded-lg border text-slate-500 border-slate-700/50 hover:text-indigo-400 hover:border-indigo-500/30"
                  >
                    <FolderOpen size={9} />
                    Folder
                  </button>
                  <input
                    ref={attachFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { addSandboxFiles(e.target.files); e.target.value = ""; }}
                  />
                  <input
                    ref={(el) => {
                      (attachFolderRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                      if (el) el.setAttribute("webkitdirectory", "");
                    }}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { addSandboxFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "w-full rounded-xl border-2 border-dashed p-5 flex flex-col gap-3 transition-all",
                  "border-slate-800 bg-slate-900/30 hover:border-indigo-500/50 hover:bg-indigo-500/5"
                )}
              >
                <textarea
                  data-nodrag
                  className="w-full h-24 bg-background border border-border rounded-xl p-3 text-xs text-muted-foreground resize-none focus:outline-none focus:border-indigo-500/50 transition-colors shadow-inner"
                  placeholder="Enter test data or a prompt..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    // Sync text to the canvas InputNode for code export.
                    // Preserve any attachments already on the node packet.
                    const startNode = nodes.find((n) => n.type === "input") || nodes[0];
                    if (startNode) {
                      const existingPacket = (startNode.data as any)?.packet || {};
                      useFlowStore.setState({
                        nodes: nodes.map((n) =>
                          n.id === startNode.id
                            ? { ...n, data: { ...n.data, packet: { ...existingPacket, type: "text" as const, payload: e.target.value } } }
                            : n
                        ),
                      });
                    }
                  }}
                />

                {/* Attachment previews + text context + warnings */}
                {(sandboxAttachments.length > 0 || sandboxTextContext || attachWarnings.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {sandboxAttachments.map((att, i) => (
                      <div
                        key={i}
                        className="relative group flex items-center gap-1.5 bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden"
                      >
                        {att.mimeType.startsWith("image/") ? (
                          <img
                            src={`data:${att.mimeType};base64,${att.data}`}
                            alt={att.name}
                            className="w-12 h-12 object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-slate-700/50">
                            <ImageIcon size={16} className="text-slate-500" />
                          </div>
                        )}
                        <div className="pr-6 py-1 min-w-0 max-w-[80px]">
                          <p className="text-[8px] font-bold text-slate-300 truncate leading-tight">{att.name}</p>
                          <p className="text-[7px] text-slate-600 uppercase">{att.mimeType.split("/")[1]}</p>
                        </div>
                        <button
                          onClick={() => setSandboxAttachments((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 p-0.5 bg-slate-900/80 rounded-full text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <X size={9} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center px-2 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg">
                      <span className="text-[8px] font-black text-sky-400 uppercase tracking-widest">
                        {sandboxAttachments.filter((a) => a.mimeType.startsWith("image/")).length > 0
                          ? "Image Attached"
                          : "File Attached"}
                      </span>
                    </div>
                    {/* packed text context chip */}
                    {sandboxTextContext && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <FolderOpen size={9} className="text-emerald-400" />
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                          {(sandboxTextContext.match(/^--- File:/gm) || []).length} file(s) packed
                        </span>
                        <button
                          onClick={() => { setSandboxTextContext(""); setAttachWarnings([]); }}
                          className="text-emerald-300 hover:text-rose-400 ml-0.5"
                        >
                          <X size={9} />
                        </button>
                      </div>
                    )}
                    {/* Warnings */}
                    {attachWarnings.map((w, i) => (
                      <div key={i} className="flex items-center gap-1 w-full text-[8px] text-amber-400">
                        <AlertTriangle size={9} className="shrink-0" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SANDBOX GALLERY */}
            <div className="flex flex-col gap-3 flex-1 min-h-[400px]">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Response Gallery</h2>
              <div className="flex-1">
                <SandboxGallery
                  {...sandboxExec}
                  nodes={nodes.map((n) => ({ id: n.id, type: n.type, data: { label: (n.data as any)?.label } }))}
                  onClearLogs={sandboxExec.clearResult}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Code Export */}
        <div className="w-1/2 flex flex-col h-full bg-background">
          {/* Language tabs */}
          <header className="p-6 border-b border-border flex items-center justify-between bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Code2 size={18} className="text-indigo-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white uppercase tracking-wider">Export Source</h1>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Compiled Production Script</p>
              </div>
            </div>
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-inner">
              {(["python", "javascript", "typescript"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    activeTab === tab ? "bg-slate-800 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {tab === "javascript" ? "Node.js" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </header>

          {/* Library Config section */}
          <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Package size={13} />
              <span className="text-[10px] font-black uppercase tracking-widest">Library</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setLibDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-[11px] font-bold text-white hover:border-indigo-500/50 transition-all"
              >
                <span>{libMeta.label}</span>
                <ChevronDown size={11} className={cn("transition-transform", libDropdownOpen && "rotate-180")} />
              </button>
              {libDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  {availableLibs.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => { setActiveLibrary(l.id); setLibDropdownOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-3 transition-colors hover:bg-slate-800 border-b border-slate-800 last:border-0",
                        activeLibrary === l.id && "bg-indigo-600/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-bold", activeLibrary === l.id ? "text-indigo-400" : "text-white")}>
                          {l.label}
                        </span>
                        {l.isAsync && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-bold">async</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{l.description}</p>
                      <p className="text-[9px] text-slate-600 mt-1 font-mono">{l.installCmd}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 border border-slate-700 rounded-lg">
              <span className="text-[9px] font-mono text-slate-400">{libMeta.installCmd}</span>
            </div>
          </div>

          {/* Code panel */}
          <div className="flex-1 p-8 relative flex flex-col overflow-hidden" onClick={() => setLibDropdownOpen(false)}>
            <div className="absolute top-12 right-12 flex items-center gap-2 z-10">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl border border-slate-600"
              >
                <Download size={14} />
                Download
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 border border-indigo-400/20"
              >
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy Source"}
              </button>
            </div>

            <div className="flex-1 bg-card border border-border rounded-2xl p-8 overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center gap-2 mb-6 opacity-40">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 text-[9px] font-mono text-slate-500">
                  agentforge_{activeTab}_{activeLibrary}.{activeTab === "python" ? "py" : activeTab === "javascript" ? "js" : "ts"}
                </span>
              </div>
              <pre className="flex-1 overflow-y-auto w-full text-[11px] font-mono text-slate-300 scrollbar-hide selection:bg-indigo-500/30">
                <code>{compiledCode}</code>
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>

    <DeployModal
      open={deployModalOpen}
      onClose={() => setDeployModalOpen(false)}
      defaultName={activeProject?.name || "Untitled Agent"}
      onConfirm={handleDeployConfirm}
      loading={deployLoading}
    />
    </>
  );
}
