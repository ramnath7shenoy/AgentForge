"use client";

import React from "react";
import { ImageIcon } from "lucide-react";

interface Props {
  nodeId: string;
  data: Record<string, any>;
  updateData: (updates: Record<string, any>) => void;
}

const REPLICATE_PRESETS = [
  { label: "Stable Diffusion 3.5 Large", value: "stability-ai/stable-diffusion-3.5-large" },
  { label: "Flux 1.1 Pro (black-forest-labs)", value: "black-forest-labs/flux-1.1-pro" },
  { label: "Flux Dev (black-forest-labs)", value: "black-forest-labs/flux-dev" },
];

export function ImageGenSettings({ nodeId: _, data, updateData }: Props) {
  const provider = data.imageProvider || "openai";
  const keyName = provider === "openai" ? "OPENAI_API_KEY" : "REPLICATE_API_TOKEN";
  const isOpenAI = provider === "openai";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-fuchsia-400">
        <ImageIcon size={16} />
        <h3 className="text-sm font-bold uppercase tracking-tight">Image Generation</h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Provider</label>
        <select
          value={provider}
          onChange={(e) => updateData({ imageProvider: e.target.value, imageModel: e.target.value === "openai" ? "dall-e-3" : "" })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500"
        >
          <option value="openai">OpenAI DALL-E</option>
          <option value="replicate">Replicate</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Model</label>
        {isOpenAI ? (
          <select
            value={data.imageModel || "dall-e-3"}
            onChange={(e) => updateData({ imageModel: e.target.value })}
            className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500"
          >
            <option value="dall-e-3">DALL-E 3</option>
            <option value="dall-e-2">DALL-E 2</option>
          </select>
        ) : (
          <>
            <input
              type="text"
              value={data.imageModel || ""}
              onChange={(e) => updateData({ imageModel: e.target.value })}
              placeholder="e.g. stability-ai/stable-diffusion-3.5-large"
              className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500"
            />
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[9px] uppercase text-slate-600 font-bold">Presets</span>
              {REPLICATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateData({ imageModel: p.value })}
                  className="text-left text-[10px] text-fuchsia-400 hover:text-fuchsia-300 truncate transition-colors"
                >
                  → {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isOpenAI && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-500">Size</label>
            <select
              value={data.imageSize || "1024x1024"}
              onChange={(e) => updateData({ imageSize: e.target.value })}
              className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500"
            >
              <option value="1024x1024">1024 × 1024 (square)</option>
              <option value="1792x1024">1792 × 1024 (landscape)</option>
              <option value="1024x1792">1024 × 1792 (portrait)</option>
            </select>
          </div>

          {(data.imageModel || "dall-e-3") === "dall-e-3" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Quality</label>
              <select
                value={data.imageQuality || "standard"}
                onChange={(e) => updateData({ imageQuality: e.target.value })}
                className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500"
              >
                <option value="standard">Standard</option>
                <option value="hd">HD</option>
              </select>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Custom Prompt (optional)</label>
        <textarea
          value={data.customPrompt || ""}
          onChange={(e) => updateData({ customPrompt: e.target.value })}
          placeholder="Leave blank to use upstream node output as the prompt"
          rows={3}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500 resize-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">API Key Override</label>
        <input
          type="password"
          value={data.apiKey || ""}
          onChange={(e) => updateData({ apiKey: e.target.value })}
          placeholder={`Vault: ${keyName}`}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-fuchsia-500/40 focus:border-fuchsia-500 font-mono"
        />
        <p className="text-[9px] text-slate-600">Leave blank to use vault key ({keyName})</p>
      </div>
    </div>
  );
}
