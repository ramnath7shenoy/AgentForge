"use client";

import React from "react";
import { Cpu } from "lucide-react";

interface Props {
  nodeId: string;
  data: Record<string, any>;
  updateData: (updates: Record<string, any>) => void;
}

const HF_PRESETS = [
  { label: "BART Large CNN (summarization)", value: "facebook/bart-large-cnn" },
  { label: "DistilBERT SST-2 (classification)", value: "distilbert/distilbert-base-uncased-finetuned-sst-2-english" },
  { label: "Helsinki NLP EN→FR (translation)", value: "Helsinki-NLP/opus-mt-en-fr" },
  { label: "GPT-2 (text generation)", value: "gpt2" },
  { label: "mDeBERTa Zero-shot (classification)", value: "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli" },
];

const REPLICATE_PRESETS = [
  { label: "Llama 3 8B (meta)", value: "meta/meta-llama-3-8b-instruct" },
  { label: "Mistral 7B (mistralai)", value: "mistralai/mistral-7b-instruct-v0.2" },
];

export function MLModelSettings({ nodeId: _, data, updateData }: Props) {
  const provider = data.mlProvider || "huggingface";
  const presets = provider === "huggingface" ? HF_PRESETS : REPLICATE_PRESETS;
  const keyName = provider === "huggingface" ? "HUGGINGFACE_API_KEY" : "REPLICATE_API_TOKEN";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sky-400">
        <Cpu size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">ML Model</h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Provider</label>
        <select
          value={provider}
          onChange={(e) => updateData({ mlProvider: e.target.value, mlModel: "" })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-sky-500/40 focus:border-sky-500"
        >
          <option value="huggingface">HuggingFace Inference</option>
          <option value="replicate">Replicate</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Model ID</label>
        <input
          type="text"
          value={data.mlModel || ""}
          onChange={(e) => updateData({ mlModel: e.target.value })}
          placeholder={provider === "huggingface" ? "e.g. facebook/bart-large-cnn" : "e.g. owner/model:version-hash"}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-sky-500/40 focus:border-sky-500"
        />
        {presets.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-[9px] uppercase text-slate-600 font-bold">Presets</span>
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => updateData({ mlModel: p.value })}
                className="text-left text-[10px] text-sky-400 hover:text-sky-300 truncate transition-colors"
              >
                → {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">API Key Override</label>
        <input
          type="password"
          value={data.apiKey || ""}
          onChange={(e) => updateData({ apiKey: e.target.value })}
          placeholder={`Vault: ${keyName}`}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-sky-500/40 focus:border-sky-500 font-mono"
        />
        <p className="text-[9px] text-slate-600">Leave blank to use vault key ({keyName})</p>
      </div>
    </div>
  );
}
