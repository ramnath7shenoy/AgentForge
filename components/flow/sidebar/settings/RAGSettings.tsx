"use client";

import React, { useState } from "react";
import { Database, Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { executeRAG } from "@/app/actions/ml";

interface Props {
  nodeId: string;
  data: Record<string, any>;
  updateData: (updates: Record<string, any>) => void;
}

const MODELS = [
  { label: "text-embedding-3-small (fast, recommended)", value: "text-embedding-3-small" },
  { label: "text-embedding-3-large (higher quality)", value: "text-embedding-3-large" },
  { label: "text-embedding-ada-002 (legacy)", value: "text-embedding-ada-002" },
];

type IngestStatus = "idle" | "loading" | "success" | "error";

export function RAGSettings({ nodeId: _, data, updateData }: Props) {
  const [ingestText, setIngestText] = useState("");
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>("idle");
  const [ingestMsg, setIngestMsg] = useState("");

  const kbId = (data.ragKbId || "").trim();
  const apiKey = (data.apiKey || "").trim();

  async function handleIngest() {
    if (!kbId) { setIngestMsg("Set a Knowledge Base name first."); setIngestStatus("error"); return; }
    if (!ingestText.trim()) { setIngestMsg("Paste some text to ingest."); setIngestStatus("error"); return; }
    setIngestStatus("loading");
    setIngestMsg("");
    try {
      const result = await executeRAG(
        { ...data, ragMode: "ingest" },
        ingestText.trim(),
        apiKey
      );
      setIngestMsg(result.payload as string);
      setIngestStatus("success");
      setIngestText("");
    } catch (e: any) {
      setIngestMsg(e?.message || "Ingest failed.");
      setIngestStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-teal-400">
        <Database size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">RAG · Query</h3>
      </div>

      <div className="rounded-md bg-teal-500/5 border border-teal-500/20 px-3 py-2 text-[10px] text-teal-300 leading-relaxed">
        Paste your documents below and click <strong>Ingest</strong> to store them. At runtime the node receives an upstream question and returns the most relevant chunks.
      </div>

      {/* Knowledge Base Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Knowledge Base Name</label>
        <input
          type="text"
          value={data.ragKbId || ""}
          onChange={(e) => updateData({ ragKbId: e.target.value })}
          placeholder="e.g. product-docs"
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
        />
        <p className="text-[9px] text-slate-600">Multiple RAG nodes with the same name share the same knowledge base.</p>
      </div>

      {/* Embedding Model */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Embedding Model</label>
        <select
          value={data.ragModel || "text-embedding-3-small"}
          onChange={(e) => updateData({ ragModel: e.target.value })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Top-K */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Top-K Results</label>
        <input
          type="number"
          min={1}
          max={20}
          value={data.ragTopK || 3}
          onChange={(e) => updateData({ ragTopK: parseInt(e.target.value) || 3 })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
        />
      </div>

      {/* Chunk Size */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Chunk Size (chars)</label>
        <input
          type="number"
          min={100}
          max={2000}
          step={50}
          value={data.ragChunkSize || 500}
          onChange={(e) => updateData({ ragChunkSize: parseInt(e.target.value) || 500 })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500"
        />
      </div>

      {/* Ingest Panel */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border">
        <label className="text-[10px] font-bold uppercase text-slate-500">Ingest Documents</label>
        <textarea
          value={ingestText}
          onChange={(e) => setIngestText(e.target.value)}
          placeholder="Paste text, docs, or knowledge here..."
          rows={5}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 resize-y font-mono leading-relaxed"
        />
        <button
          onClick={handleIngest}
          disabled={ingestStatus === "loading"}
          className="flex items-center justify-center gap-2 rounded-md bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-bold text-white transition-colors"
        >
          {ingestStatus === "loading"
            ? <><Loader2 size={12} className="animate-spin" /> Ingesting…</>
            : <><Upload size={12} /> Ingest Now</>}
        </button>
        {ingestStatus === "success" && (
          <div className="flex items-center gap-1.5 text-[10px] text-teal-400">
            <CheckCircle size={11} /> {ingestMsg}
          </div>
        )}
        {ingestStatus === "error" && (
          <div className="flex items-center gap-1.5 text-[10px] text-rose-400">
            <XCircle size={11} /> {ingestMsg}
          </div>
        )}
      </div>

      {/* API Key Override */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">API Key Override</label>
        <input
          type="password"
          value={data.apiKey || ""}
          onChange={(e) => updateData({ apiKey: e.target.value })}
          placeholder="Vault: OPENAI_API_KEY"
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-teal-500/40 focus:border-teal-500 font-mono"
        />
        <p className="text-[9px] text-slate-600">Leave blank to use OPENAI_API_KEY from vault.</p>
      </div>
    </div>
  );
}
