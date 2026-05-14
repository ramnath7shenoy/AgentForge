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
  Terminal,
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

  // Keyed by flowId so each project has independent persisted state
  const FORGE_STATE_KEY = `FORGE_PUBLISH_STATE_${activeProject?.id ?? "default"}`;

  // Effect 1 — Rehydrate state on mount.
  // If the Liveblocks leaveRoom reset nodes/edges to [], restore from the sessionStorage
  // snapshot saved by FlowCollaboration before calling leaveRoom.
  // compiledCode is only restored as a last-resort fallback for hard page refreshes where
  // no snapshot exists; the compile effect always overwrites it once nodes are available.
  useEffect(() => {
    sandboxExec.clearResult();

    // Restore nodes/edges if leaveRoom wiped them
    if (nodes.length === 0) {
      try {
        const snap = sessionStorage.getItem("agentforge_flow_snapshot");
        if (snap) {
          const { nodes: n, edges: e } = JSON.parse(snap);
          if (Array.isArray(n) && n.length > 0) {
            useFlowStore.getState().setNodes(n);
            useFlowStore.getState().setEdges(e || []);
          }
        }
      } catch {}
    }

    // Restore user config + compiledCode (fallback for hard page refresh only)
    try {
      const raw = localStorage.getItem(FORGE_STATE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as any;
      if (s.inputValue) setInputValue(s.inputValue);
      if (Array.isArray(s.envKeys) && s.envKeys.length) setEnvKeys(s.envKeys);
      if (Array.isArray(s.attachments) && s.attachments.length) setSandboxAttachments(s.attachments);
      if (s.fileContext) setSandboxTextContext(s.fileContext);
      // Only use cached compiledCode on hard page refresh (no sessionStorage snapshot = no live nodes)
      if (s.compiledCode && nodes.length === 0) {
        try {
          const hasSnapshot = !!sessionStorage.getItem("agentforge_flow_snapshot");
          if (!hasSnapshot) setCompiledCode(s.compiledCode);
        } catch { setCompiledCode(s.compiledCode); }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear execution state on unmount so Back-navigation never leaks results
  useEffect(() => {
    return () => { sandboxExec.clearResult(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2 — Persist user config + compiled code on change
  useEffect(() => {
    try {
      localStorage.setItem(FORGE_STATE_KEY, JSON.stringify({
        inputValue,
        envKeys,
        attachments: sandboxAttachments,
        fileContext: sandboxTextContext,
        compiledCode,
      }));
    } catch {}
  }, [inputValue, envKeys, sandboxAttachments, sandboxTextContext, compiledCode]);

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

  // Dual-trigger execution status
  type ExecStatus = "idle" | "loading" | "success" | "error";
  const [workflowStatus, setWorkflowStatus] = useState<ExecStatus>("idle");
  const [codeStatusMap, setCodeStatusMap] = useState<Record<Tab, ExecStatus>>({
    python: "idle",
    javascript: "idle",
    typescript: "idle",
  });
  const [codeLogsMap, setCodeLogsMap] = useState<Record<Tab, string[]>>({
    python: [],
    javascript: [],
    typescript: [],
  });
  const [codeTerminalOpen, setCodeTerminalOpen] = useState(false);
  const codeTerminalBottomRef = useRef<HTMLDivElement>(null);
  const rightPanelScrollRef = useRef<HTMLDivElement>(null);
  const prevRunningRef = useRef(false);

  const codeStatus = codeStatusMap[activeTab];
  const codeLogs = codeLogsMap[activeTab];

  // Flatten codeLogs: subprocess stdout arrives as one multi-line string per SSE event.
  // Split every entry by \n so each logical line is processed independently.
  const flatLogs = React.useMemo(
    () => codeLogs.flatMap((e) => e.split("\n")),
    [codeLogs]
  );

  // Re-derive sandboxResult from flat lines for accurate block detection.
  const sandboxResult = React.useMemo<Record<string, unknown> | null>(() => {
    const blocks: string[][] = [];
    let cur: string[] | null = null;
    let depth = 0;
    for (const line of flatLogs) {
      if (!cur && line.trim() === "{") { cur = [line]; depth = 1; continue; }
      if (cur) {
        cur.push(line);
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth <= 0) { blocks.push([...cur]); cur = null; depth = 0; }
      }
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      try {
        const p = JSON.parse(blocks[i].join("\n"));
        if (p?.input?.type) return p;
      } catch {}
    }
    return null;
  }, [flatLogs]);

  // Parse DRAFT PAYLOAD blocks from flat lines.
  const draftPayloads = React.useMemo<{ method: string; url: string }[]>(() => {
    const results: { method: string; url: string }[] = [];
    let method = "", url = "";
    for (const line of flatLogs) {
      const t = line.trim();
      if (t.startsWith("╯══ DRAFT PAYLOAD")) { method = ""; url = ""; }
      else if (t.startsWith("║  Method")) method = t.replace("║  Method  :", "").trim();
      else if (t.startsWith("║  URL")) url = t.replace("║  URL     :", "").trim();
      else if (t.startsWith("╚═══") && method) results.push({ method, url });
    }
    return results;
  }, [flatLogs]);

  // Strip ctx JSON dump and "=== Final Result ===" from the display.
  const terminalLines = React.useMemo(() => {
    const lines: string[] = [];
    let inBlock = false;
    let depth = 0;
    for (const line of flatLogs) {
      const t = line.trim();
      if (t.includes("=== Final Result ===")) continue;
      if (t === "{}") continue;
      if (!inBlock && t === "{") { inBlock = true; depth = 1; continue; }
      if (inBlock) {
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth <= 0) inBlock = false;
        continue;
      }
      if (t) lines.push(line); // skip blank lines from subprocess output
    }
    return lines;
  }, [flatLogs]);

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
    if (nodes.length === 0) return;
    setCompiledCode(compileFlow(nodes, edges, activeTab, activeLibrary));
  }, [nodes, edges, activeTab, activeLibrary]);

  // Track workflow completion after sandboxExec.running flips back to false
  useEffect(() => {
    if (prevRunningRef.current && !sandboxExec.running && workflowStatus === "loading") {
      const hasErrors = sandboxExec.logs.some((l) => l.type === "ERROR");
      setWorkflowStatus(sandboxExec.finalResult !== null && !hasErrors ? "success" : "error");
    }
    prevRunningRef.current = sandboxExec.running;
  }, [sandboxExec.running]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll code terminal
  useEffect(() => {
    if (codeTerminalOpen) {
      codeTerminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [codeLogs, codeTerminalOpen]);

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

  const executeWorkflow = async () => {
    const validKeys = envKeys.filter((k) => k.key.trim() && k.value.trim());
    const effectiveInput = inputValue || "Hello";
    const hasExtras = sandboxAttachments.length > 0 || sandboxTextContext;
    let nodesForRun: any[] = nodes as any;
    if (hasExtras) {
      nodesForRun = (nodes as any[]).map((n: any) =>
        n.type === "input"
          ? { ...n, data: { ...n.data, packet: { type: "text", payload: effectiveInput, ...(sandboxAttachments.length > 0 && { attachments: sandboxAttachments }), ...(sandboxTextContext && { fileContext: sandboxTextContext }) } } }
          : n
      );
    }
    await sandboxExec.run(nodesForRun, edges as any, effectiveInput, validKeys);
  };

  const NODE_ICON: Record<string, string> = {
    input: "📥", output: "📤", ai: "🤖", appaction: "⚡",
    action: "🌐", router: "🔀", approval: "🛡️", gatekeeper: "🔒",
    processor: "⚙️", trigger: "⏱️", webhook: "🪝", subflow: "🔗", subagent: "🤝",
  };

  const executeCode = async (lang: Tab) => {
    // ── Step 1: static analysis (shown immediately, no waiting)
    // Comments are indented inside the async function, so allow leading whitespace
    const stepPattern = /[ \t]*(?:#|\/\/)\s+──\s+\[(\w+)\]\s+(.+)/g;
    const steps: { type: string; label: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = stepPattern.exec(compiledCode)) !== null) {
      steps.push({ type: m[1], label: m[2].trim() });
    }

    const initLogs: string[] = [];
    // Node/edge counts: prefer live store; fall back to step count parsed from compiled code.
    const executableNodes = nodes.filter((n) => !["group", "text"].includes(n.type ?? ""));
    const nodeCount = executableNodes.length || steps.length;
    const edgeCount = edges.length || Math.max(0, steps.length - 1);
    initLogs.push(`📋 ${nodeCount} node${nodeCount !== 1 ? "s" : ""} · ${edgeCount} connection${edgeCount !== 1 ? "s" : ""} · ${lang}/${activeLibrary}`);

    if (steps.length > 0) {
      initLogs.push("⚡ Execution Plan:");
      steps.forEach((s, i) => {
        initLogs.push(`   ${i + 1}. ${NODE_ICON[s.type] ?? "▶"} [${s.label}]`);
      });
    } else {
      initLogs.push("⚠️  No nodes detected in compiled code — add nodes to the canvas.");
    }
    initLogs.push("");

    setCodeLogsMap((prev) => ({ ...prev, [lang]: initLogs }));
    setCodeStatusMap((prev) => ({ ...prev, [lang]: "loading" }));
    setCodeTerminalOpen(true);
    setTimeout(() => {
      rightPanelScrollRef.current?.scrollTo({ top: rightPanelScrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);

    // ── Step 2: E2B execution — Mirror Mode (AGENTFORGE_MODE=PREVIEW)
    // GET requests are allowed (live token/ID validation).
    // POST/PUT/DELETE/PATCH are intercepted: a DRAFT PAYLOAD block is printed
    // to stdout instead of sending data. No API keys are injected.
    const envVarsMap = { AGENTFORGE_INPUT: inputValue || "Hello", AGENTFORGE_MODE: "PREVIEW" };

    const pythonShim = `\
import os as _os_sb
if _os_sb.environ.get('AGENTFORGE_MODE') == 'PREVIEW':
    import json as _jsb
    class _SBR:
        status_code=200;ok=True;text='{}';headers={};content=b'{}'
        def json(self):return {}
        def raise_for_status(self):pass
    def _draft(m,url,**kw):
        b=kw.get('json',kw.get('data',{}));h=kw.get('headers',{})
        print(f'\\n╯══ DRAFT PAYLOAD ═══════════════════════════════════')
        print(f'║  Method  : {m.upper()}')
        print(f'║  URL     : {url}')
        print(f'║  Headers : {_jsb.dumps(dict(h),indent=2)}')
        print(f'║  Body    : {_jsb.dumps(b,indent=2) if b else "{}"}')
        print(f'╚═══════════════════════════════════════════════\\n')
        return _SBR()
    import requests as _rs
    for _m2 in ('post','put','delete','patch'):
        setattr(_rs,_m2,(lambda _mx:lambda url,**kw:_draft(_mx,url,**kw))(_m2))
    try:
        import httpx as _hx
        for _m2 in ('post','put','delete','patch'):
            setattr(_hx,_m2,(lambda _mx:lambda url,**kw:_draft(_mx,url,**kw))(_m2))
    except ImportError:pass
    try:
        import aiohttp as _aio
        class _AR:
            status=200
            async def json(self):return {}
            async def text(self):return '{}'
            def raise_for_status(self):pass
            async def __aenter__(self):return self
            async def __aexit__(self,*a):pass
        class _AS:
            def get(self,url,**kw):return _AR()
            def post(self,url,**kw):_draft('POST',url,**kw);return _AR()
            def put(self,url,**kw):_draft('PUT',url,**kw);return _AR()
            def delete(self,url,**kw):_draft('DELETE',url,**kw);return _AR()
            def patch(self,url,**kw):_draft('PATCH',url,**kw);return _AR()
            async def __aenter__(self):return self
            async def __aexit__(self,*a):pass
        _aio.ClientSession=_AS
    except ImportError:pass

`;

    const jsShim = `\
if (process.env.AGENTFORGE_MODE === 'PREVIEW') {
  const _draft = (method, url, headers, body) => {
    console.log('\\n╯══ DRAFT PAYLOAD ═══════════════════════════════════');
    console.log('║  Method  : ' + method);
    console.log('║  URL     : ' + url);
    console.log('║  Headers : ' + JSON.stringify(headers || {}, null, 2));
    console.log('║  Body    : ' + JSON.stringify(body || {}, null, 2));
    console.log('╚═══════════════════════════════════════════════\\n');
  };
  const _mock = () => Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });
  const _origFetch = (global as any).fetch;
  (global as any).fetch = async (url: string, init: any = {}) => {
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET') return _origFetch ? _origFetch(url, init) : _mock();
    let body = {};
    try { body = JSON.parse(init?.body || '{}'); } catch {}
    _draft(method, url, init?.headers || {}, body);
    return _mock();
  };
  try {
    const ax = require('axios');
    const _origAdapter = ax.defaults.adapter;
    ax.defaults.adapter = async (config: any) => {
      const method = (config.method || 'GET').toUpperCase();
      if (method === 'GET') return _origAdapter ? _origAdapter(config) : { data: {}, status: 200, statusText: 'OK', headers: {}, config };
      _draft(method, config.url, config.headers, config.data || {});
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
  } catch {}
  try {
    const got = require('got');
    const _mockGot = async () => ({ body: {}, statusCode: 200 });
    for (const _m of ['post','put','delete','patch']) (got as any)[_m] = _mockGot;
  } catch {}
}

`;

    const sandboxShim = lang === "python" ? pythonShim : jsShim;
    const codeToRun = sandboxShim + compiledCode;

    try {
      const res = await fetch("/api/sandbox/execute-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToRun, language: lang, envVars: envVarsMap }),
      });
      if (!res.ok || !res.body) {
        setCodeStatusMap((prev) => ({ ...prev, [lang]: "error" }));
        setCodeLogsMap((prev) => ({ ...prev, [lang]: [...prev[lang], `Server error: ${res.status}`] }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let didSucceed = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(t.slice(6));
            const append = (txt: string) =>
              setCodeLogsMap((prev) => ({ ...prev, [lang]: [...prev[lang], txt] }));
            if (ev.t === "log") append(ev.text);
            else if (ev.t === "stdout") append(ev.line);
            else if (ev.t === "stderr") {
              const l: string = ev.line ?? "";
              // Route already filters tracebacks — add belt-and-suspenders for any slip-through
              if (!l.match(/^\s+File "|^Traceback \(most/)) append(`⚠️  ${l}`);
            }
            else if (ev.t === "error") append(`❌ ${ev.message}`);
            else if (ev.t === "done") didSucceed = ev.success as boolean;
          } catch { /* skip malformed */ }
        }
      }
      setCodeStatusMap((prev) => ({ ...prev, [lang]: didSucceed ? "success" : "error" }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setCodeStatusMap((prev) => ({ ...prev, [lang]: "error" }));
      setCodeLogsMap((prev) => ({ ...prev, [lang]: [...prev[lang], `Network error: ${message}`] }));
    }
  };

  const handleRunWorkflow = async () => {
    setWorkflowStatus("loading");
    await executeWorkflow();
  };

  const handleExecuteCode = () => {
    executeCode(activeTab);
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

  const canDeploy = workflowStatus === "success";

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
                  title={
                    !canDeploy
                      ? "Workflow verification required — run sandbox first."
                      : undefined
                  }
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                    isDeployed
                      ? "bg-violet-600/20 text-violet-400 border-violet-500/30"
                      : canDeploy
                        ? "bg-violet-600 hover:bg-violet-700 text-white border-violet-500/30 shadow-lg shadow-violet-500/20"
                        : "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-50"
                  )}
                >
                  {deployLoading ? <Loader2 size={13} className="animate-spin" /> : <Store size={13} />}
                  {isDeployed ? "Deployed" : "Deploy to Store"}
                </button>
                {!canDeploy && (
                  <span className="text-[9px] text-slate-600 font-medium pr-0.5">
                    Verification Required
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
                onClick={handleRunWorkflow}
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
                      "flex items-center gap-1 text-[9px] font-bold transition-all px-2 py-1 rounded-lg border",
                      vaultSynced
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                    )}
                  >
                    {vaultSynced ? <CheckCircle size={9} /> : <RefreshCw size={9} className={vaultSynced ? "" : "animate-spin-once"} />}
                    {vaultSynced ? "Synced!" : "Sync from Vault"}
                  </button>
                  <button
                    onClick={handleClearAllKeys}
                    className="flex items-center gap-1 text-[9px] font-bold transition-all px-1.5 py-0.5 rounded border text-slate-600 border-slate-700/50 hover:text-rose-400 hover:border-rose-500/30"
                  >
                    <Trash2 size={9} />
                    Clear All
                  </button>
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
        <div className="w-1/2 flex flex-col h-full bg-background overflow-hidden relative">
          {/* Unified Source Disclaimer — Sticky at the top */}
          <div className="flex-shrink-0 bg-slate-900/50 border-b border-slate-800/60 px-6 py-2.5 z-20 sticky top-0 backdrop-blur-md">
            <p className="text-[10px] md:text-[11px] font-medium text-amber-500/90 flex items-center gap-2 leading-relaxed">
              <span className="text-sm">🛠️</span>
              <span>
                <strong className="text-amber-500 uppercase tracking-tight">Developer Sandbox:</strong> This is a standalone execution of the compiled source code. Use this to verify dependencies and logic before exporting and manually review before local use.
              </span>
            </p>
          </div>

          <div 
            ref={rightPanelScrollRef}
            className="flex-1 overflow-y-auto scrollbar-hide flex flex-col"
            onClick={() => setLibDropdownOpen(false)}
          >
            {/* Language tabs */}
            <header className="p-6 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Code2 size={18} className="text-indigo-500" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white uppercase tracking-wider">Export Source</h1>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Compiled Production Script</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Language tabs */}
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
              </div>
            </header>

            {/* Library Config section */}
            <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-2 text-slate-400">
                <Package size={13} />
                <span className="text-[10px] font-black uppercase tracking-widest">Library</span>
              </div>

              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setLibDropdownOpen((v) => !v); }}
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

            {/* Code + Terminal wrapper */}
            <div className="p-6 flex flex-col gap-4">
              {/* Toolbar row: Verify + Download + Copy */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleExecuteCode}
                  disabled={codeStatus === "loading"}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg border",
                    codeStatus === "loading"
                      ? "bg-emerald-600/30 text-emerald-400/50 border-emerald-500/20 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/30 shadow-emerald-500/20"
                  )}
                >
                  {codeStatus === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                  Verify Flow
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl border border-slate-600"
                  >
                    <Download size={13} />
                    Download
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 border border-indigo-400/20"
                  >
                    {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Editable code panel */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-2xl min-h-[450px]">
                <div className="flex items-center gap-2 px-6 pt-4 pb-3 opacity-40 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-[9px] font-mono text-slate-500">
                    agentforge_{activeTab}_{activeLibrary}.{activeTab === "python" ? "py" : activeTab === "javascript" ? "js" : "ts"}
                  </span>
                </div>
                <textarea
                  className="flex-1 w-full text-[11px] font-mono text-slate-300 bg-transparent resize-none focus:outline-none scrollbar-hide selection:bg-indigo-500/30 px-6 pb-4 min-h-[400px]"
                  value={compiledCode}
                  onChange={(e) => setCompiledCode(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </div>

              {/* Code Terminal - Now inside the scroll stack */}
              <div className={cn(
                "border border-border bg-[#0b0e14] rounded-2xl flex flex-col transition-all duration-200 overflow-hidden",
                codeTerminalOpen ? "min-h-[200px]" : "h-11"
              )}>
                <button
                  onClick={() => setCodeTerminalOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 h-11 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 w-full"
                >
                  <Terminal size={10} />
                  <span>Code Output</span>
                  {codeStatus === "loading" && <Loader2 size={9} className="animate-spin text-indigo-400 ml-1" />}
                  {codeStatus === "success" && <CheckCircle size={9} className="text-emerald-400 ml-1" />}
                  {codeStatus === "error" && <X size={9} className="text-rose-400 ml-1" />}
                  {codeLogs.length > 0 && (
                    <span className="text-[8px] font-mono text-slate-600 ml-1">{codeLogs.length} lines</span>
                  )}
                  <ChevronRight size={10} className={cn("ml-auto transition-transform", codeTerminalOpen && "rotate-90")} />
                </button>
                {codeTerminalOpen && (
                  <div className="flex-1 px-4 pb-4 font-mono text-[10px] leading-relaxed space-y-0.5 overflow-hidden">
                    {codeLogs.length === 0 ? (
                      <span className="text-slate-600 italic">Awaiting execution...</span>
                    ) : (<>
                      {terminalLines.map((line, i) => {
                        const isDraft = line.startsWith("╯══ DRAFT") || line.startsWith("║") || line.startsWith("╚═══");
                        return (
                          <div
                            key={i}
                            className={cn(
                              "whitespace-pre-wrap break-all font-mono",
                              isDraft ? "text-amber-400/80" :
                              line.startsWith("❌") ? "text-rose-400" :
                              line.startsWith("⚠️") ? "text-amber-400" :
                              line.startsWith("🐳") || line.startsWith("✅") || line.startsWith("📋") || line.startsWith("⚡") ? "text-indigo-400" :
                              line.startsWith("   ") ? "text-slate-400" :
                              "text-slate-300"
                            )}
                          >
                            {line}
                          </div>
                        );
                      })}
                      {sandboxResult && (
                        <div className="mt-3 border border-slate-700/60 rounded-lg overflow-hidden">
                          <div className="bg-slate-800/60 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-700/60">
                            Flow Result
                          </div>
                          <div className="divide-y divide-slate-800/60">
                            {Object.entries(sandboxResult)
                              .filter(([k]) => k !== "input")
                              .map(([key, val], idx) => {
                                const packet = val as any;
                                const raw = packet?.payload;
                                const nodeLabel = nodes.find(
                                  (n) => (n.data.label || "").toLowerCase().replace(/\s+/g, "_") === key
                                )?.data.label || key.replace(/_/g, " ");
                                const isIntercepted = typeof raw === "object" && raw !== null && Object.keys(raw).length === 0;
                                const matchedDraft = isIntercepted ? draftPayloads[idx] : undefined;
                                const display = raw === null || raw === undefined ? "—"
                                  : typeof raw === "object" ? JSON.stringify(raw) : String(raw);
                                return (
                                  <div key={key} className="px-3 py-2 flex flex-col gap-0.5">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide min-w-[120px] truncate" title={nodeLabel}>{nodeLabel}</span>
                                      {isIntercepted ? (
                                        <span className="text-[10px] text-amber-400 font-mono">
                                          🔍 PREVIEW: {nodeLabel} → Payload Generated (No data sent)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-emerald-300 font-mono break-all">{display}</span>
                                      )}
                                    </div>
                                    {matchedDraft && (
                                      <div className="ml-[132px] text-[9px] font-mono text-slate-500 leading-relaxed">
                                        <span className="text-amber-500/60">{matchedDraft.method}</span>
                                        {" → "}
                                        <span className="text-slate-400 break-all">{matchedDraft.url}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      {(codeStatus === "success" || codeStatus === "error") && (
                        <div className={cn(
                          "mt-3 text-[9px] font-mono border-t border-slate-700/40 pt-2",
                          codeStatus === "error" ? "text-rose-400" : "text-emerald-400/70"
                        )}>
                          {codeStatus === "error" ? "✗ Execution failed" : "✓ Code executed"}
                        </div>
                      )}
                    </>)}
                    <div ref={codeTerminalBottomRef} />
                  </div>
                )}
              </div>
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
