"use client";

import React from "react";
import { Mic, Volume2 } from "lucide-react";

interface Props {
  nodeId: string;
  data: Record<string, any>;
  updateData: (updates: Record<string, any>) => void;
}

const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export function SpeechSettings({ nodeId: _, data, updateData }: Props) {
  const mode = data.speechMode || "tts";
  const provider = data.speechProvider || "openai";
  const isTTS = mode === "tts";
  const keyName = provider === "openai" ? "OPENAI_API_KEY" : "ELEVENLABS_API_KEY";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-rose-400">
        {isTTS ? <Volume2 size={16} /> : <Mic size={16} />}
        <h3 className="text-sm font-bold uppercase tracking-tight">Speech</h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Mode</label>
        <select
          value={mode}
          onChange={(e) => updateData({ speechMode: e.target.value, speechProvider: "openai" })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500"
        >
          <option value="tts">Text-to-Speech (generate audio)</option>
          <option value="stt">Speech-to-Text (transcribe audio)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">Provider</label>
        <select
          value={provider}
          onChange={(e) => updateData({ speechProvider: e.target.value })}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500"
        >
          <option value="openai">OpenAI {isTTS ? "(TTS-1 / Whisper)" : "(Whisper)"}</option>
          {isTTS && <option value="elevenlabs">ElevenLabs</option>}
        </select>
      </div>

      {isTTS && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-500">Model</label>
            <select
              value={data.speechModel || "tts-1"}
              onChange={(e) => updateData({ speechModel: e.target.value })}
              className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500"
              disabled={provider === "elevenlabs"}
            >
              <option value="tts-1">tts-1 (fast)</option>
              <option value="tts-1-hd">tts-1-hd (higher quality)</option>
            </select>
          </div>

          {provider === "openai" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Voice</label>
              <select
                value={data.speechVoice || "alloy"}
                onChange={(e) => updateData({ speechVoice: e.target.value })}
                className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500"
              >
                {OPENAI_VOICES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {provider === "elevenlabs" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-500">Voice ID</label>
              <input
                type="text"
                value={data.speechVoice || ""}
                onChange={(e) => updateData({ speechVoice: e.target.value })}
                placeholder="e.g. 21m00Tcm4TlvDq8ikWAM (Rachel)"
                className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500 font-mono"
              />
              <p className="text-[9px] text-slate-600">Find voice IDs in your ElevenLabs dashboard</p>
            </div>
          )}
        </>
      )}

      {!isTTS && (
        <div className="px-2 py-2 rounded-md bg-slate-800/50 border border-slate-700/50">
          <p className="text-[10px] text-slate-400">
            Connect an Input node with an audio file attachment. The audio will be transcribed and the transcript passed downstream.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase text-slate-500">API Key Override</label>
        <input
          type="password"
          value={data.apiKey || ""}
          onChange={(e) => updateData({ apiKey: e.target.value })}
          placeholder={`Vault: ${keyName}`}
          className="w-full rounded-md px-2 py-1.5 text-xs border bg-background border-border text-foreground outline-none focus:ring-1 focus:ring-rose-500/40 focus:border-rose-500 font-mono"
        />
        <p className="text-[9px] text-slate-600">Leave blank to use vault key ({keyName})</p>
      </div>
    </div>
  );
}
