"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Copy, CheckCircle, Code2, FileJson } from "lucide-react";
import { compileFlow } from "@/lib/flowCompiler";
import { getLibrariesForTab, getDefaultLibrary, type Library } from "@/lib/codegen/templates";
import { cn } from "@/lib/utils";

type Lang = "python" | "javascript" | "typescript";

const LANG_TABS: { key: Lang; label: string; color: string }[] = [
  { key: "python", label: "Python", color: "text-amber-400" },
  { key: "javascript", label: "JS", color: "text-yellow-400" },
  { key: "typescript", label: "TS", color: "text-sky-400" },
];

const VIEW_TABS = ["code", "json"] as const;
type ViewTab = typeof VIEW_TABS[number];

/* ── Syntax highlighter (no deps) ───────────────────────────────────── */
function highlightLine(line: string, lang: Lang | "json"): React.ReactNode {
  // Very lightweight keyword highlighting
  if (lang === "json") {
    return (
      <span
        dangerouslySetInnerHTML={{
          __html: line
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span style="color:#93c5fd">$1</span>:')
            .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span style="color:#86efac">$1</span>')
            .replace(/:\s*(true|false|null)/g, ': <span style="color:#f9a8d4">$1</span>')
            .replace(/:\s*(-?\d+(?:\.\d+)?)/g, ': <span style="color:#fcd34d">$1</span>'),
        }}
      />
    );
  }

  const pythonKw = /\b(def|class|import|from|return|if|else|elif|for|while|with|as|in|not|and|or|try|except|finally|raise|pass|True|False|None|async|await|lambda)\b/g;
  const jsKw = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|new|typeof|instanceof|true|false|null|undefined|throw|try|catch|finally)\b/g;

  const escaped = line
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html = escaped
    // Strings
    .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span style="color:#86efac">$&</span>')
    // Comments
    .replace(/(#.*$|\/\/.*$)/g, '<span style="color:#6b7280">$1</span>');

  // Apply keyword coloring (only outside strings/comments — simplified)
  const kwRe = lang === "python" ? pythonKw : jsKw;
  html = html.replace(kwRe, '<span style="color:#c4b5fd">$&</span>');

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function CodeBlock({ code, lang }: { code: string; lang: Lang | "json" }) {
  const lines = code.split("\n");
  const lineCount = lines.length;
  const gutterWidth = Math.max(2, String(lineCount).length);

  return (
    <div className="flex font-mono text-[11.5px] leading-[1.65]">
      {/* Gutter */}
      <div
        className="shrink-0 text-right pr-4 select-none border-r border-white/5"
        style={{ width: `${gutterWidth * 9 + 24}px` }}
      >
        {lines.map((_, i) => (
          <div key={i} style={{ color: "#374151" }}>{i + 1}</div>
        ))}
      </div>
      {/* Code */}
      <div className="pl-4 flex-1 overflow-x-auto">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre hover:bg-white/[0.02] transition-colors pr-4">
            {line ? highlightLine(line, lang) : <span>&nbsp;</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────── */
interface CodeModalProps {
  open: boolean;
  onClose: () => void;
  flowName: string;
  nodes: any[];
  edges: any[];
}

export default function CodeModal({ open, onClose, flowName, nodes, edges }: CodeModalProps) {
  const [viewTab, setViewTab] = useState<ViewTab>("code");
  const [lang, setLang] = useState<Lang>("python");
  const [library, setLibrary] = useState<Library>(getDefaultLibrary("python"));
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    setLibrary(getDefaultLibrary(lang));
  }, [lang]);

  if (!open) return null;

  const availableLibs = getLibrariesForTab(lang);
  const compiledCode = compileFlow(nodes as any, edges as any, lang, library);
  const jsonCode = JSON.stringify({ nodes, edges }, null, 2);
  const activeCode = viewTab === "code" ? compiledCode : jsonCode;
  const activeLang: Lang | "json" = viewTab === "json" ? "json" : lang;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-8"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="flex flex-col w-full max-w-3xl h-[78vh] bg-[#0d0d10] border border-white/10 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-[#0f0f13]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/20 flex items-center justify-center">
              <Code2 size={13} className="text-sky-400" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Generated Code</p>
              <p className="text-sm font-black text-white leading-tight mt-0.5">{flowName || "Untitled Agent"}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-[#0d0d10] shrink-0 flex-wrap">
          {/* View tabs */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() => setViewTab("code")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                viewTab === "code" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              )}
            >
              <Code2 size={9} /> Code
            </button>
            <button
              onClick={() => setViewTab("json")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                viewTab === "json" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
              )}
            >
              <FileJson size={9} /> JSON
            </button>
          </div>

          {/* Language + lib (code view only) */}
          {viewTab === "code" && (
            <>
              <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
                {LANG_TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setLang(t.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all",
                      lang === t.key ? cn("bg-white/10", t.color) : "text-white/30 hover:text-white/60"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <select
                value={library}
                onChange={e => setLibrary(e.target.value as Library)}
                className="bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold rounded-lg px-2 py-1.5 focus:outline-none hover:bg-white/10 transition-colors"
              >
                {availableLibs.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </>
          )}

          <div className="ml-auto">
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                copied
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-white/50 border-white/10 hover:text-white hover:bg-white/10"
              )}
            >
              {copied ? <CheckCircle size={10} /> : <Copy size={10} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Code area */}
        <div className="flex-1 overflow-auto p-5 bg-[#090909]">
          <CodeBlock code={activeCode} lang={activeLang} />
        </div>
      </div>
    </div>
  );
}
