'use server'

// ML node server actions — mlmodel / imagegen / rag / speech / dataanalysis.
// Called dynamically from both clientExecutor and serverExecutor.

export interface MLResult {
  type: "text" | "file" | "data";
  payload: any;
}

// ── HuggingFace Inference ─────────────────────────────────────────────

async function hfInfer(model: string, input: string, apiKey: string): Promise<string> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.error || `HuggingFace error ${res.status}`);
  }
  const data = await res.json() as any;
  if (Array.isArray(data)) {
    const f = data[0];
    if (!f) return "";
    if (typeof f === "string") return f;
    if (f.generated_text) return f.generated_text;
    if (f.summary_text) return f.summary_text;
    if (f.translation_text) return f.translation_text;
    if (f.label) return `${f.label} (${(f.score * 100).toFixed(1)}%)`;
    return JSON.stringify(f, null, 2);
  }
  if (data?.generated_text) return data.generated_text;
  return JSON.stringify(data, null, 2);
}

// ── Replicate polling ─────────────────────────────────────────────────

async function replicateRun(
  modelVersion: string,
  input: Record<string, any>,
  apiKey: string
): Promise<string> {
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ version: modelVersion, input }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({})) as any;
    throw new Error(err.detail || `Replicate error ${createRes.status}`);
  }
  const pred = await createRes.json() as any;

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!poll.ok) throw new Error(`Replicate poll error ${poll.status}`);
    const p = await poll.json() as any;
    if (p.status === "succeeded") {
      const out = p.output;
      if (Array.isArray(out)) return out.join("\n");
      return String(out ?? "");
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate prediction ${p.status}: ${p.error || "unknown"}`);
    }
  }
  throw new Error("Replicate: timed out waiting for prediction (120s)");
}

// ── ML Model ─────────────────────────────────────────────────────────

export async function executeMLModel(
  data: Record<string, any>,
  inputText: string,
  apiKey: string
): Promise<MLResult> {
  const provider = data.mlProvider || "huggingface";
  const model = (data.mlModel || "").trim();
  if (!model) throw new Error("ML Model: no model specified. Enter a model ID in the node settings.");

  if (provider === "huggingface") {
    const result = await hfInfer(model, inputText, apiKey);
    return { type: "text", payload: result };
  }
  if (provider === "replicate") {
    const result = await replicateRun(model, { prompt: inputText }, apiKey);
    return { type: "text", payload: result };
  }
  throw new Error(`ML Model: unsupported provider "${provider}"`);
}

// ── Image Generation ─────────────────────────────────────────────────

export async function executeImageGen(
  data: Record<string, any>,
  prompt: string,
  apiKey: string
): Promise<MLResult> {
  const provider = data.imageProvider || "openai";
  const model = data.imageModel || "dall-e-3";
  const effectivePrompt = (data.customPrompt || "").trim() || prompt;
  if (!effectivePrompt) throw new Error("Image Gen: no prompt. Connect an upstream node or set a custom prompt.");

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: effectivePrompt,
        n: 1,
        size: data.imageSize || "1024x1024",
        quality: data.imageQuality || "standard",
        response_format: "b64_json",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err.error?.message || `OpenAI Images error ${res.status}`);
    }
    const json = await res.json() as any;
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI Images: no image returned");
    return { type: "file", payload: `data:image/png;base64,${b64}` };
  }

  if (provider === "replicate") {
    const rawUrl = await replicateRun(model, { prompt: effectivePrompt }, apiKey);
    const imgUrl = rawUrl.trim().split("\n")[0];
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error("Failed to fetch generated image from Replicate");
    const buf = await imgRes.arrayBuffer();
    const mime = imgRes.headers.get("content-type") || "image/webp";
    const b64 = Buffer.from(buf).toString("base64");
    return { type: "file", payload: `data:${mime};base64,${b64}` };
  }

  throw new Error(`Image Gen: unsupported provider "${provider}"`);
}

// ── RAG (Retrieval-Augmented Generation) ─────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

async function openaiEmbed(text: string, model: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.error?.message || `OpenAI Embeddings error ${res.status}`);
  }
  const json = await res.json() as any;
  return json.data?.[0]?.embedding ?? [];
}

function chunkText(text: string, chunkSize: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && (current + " " + s).length > chunkSize) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = current ? current + " " + s : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
}

export async function executeRAG(
  data: Record<string, any>,
  inputText: string,
  apiKey: string
): Promise<MLResult> {
  const mode = data.ragMode || "query";
  const kbId = (data.ragKbId || "default").trim();
  const model = data.ragModel || "text-embedding-3-small";
  const topK = Number(data.ragTopK) || 3;
  const chunkSize = Number(data.ragChunkSize) || 500;

  const { createClient } = await import("@/lib/supabase/server");
  const { default: prisma } = await import("@/lib/prisma");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("RAG: not authenticated.");

  if (mode === "ingest") {
    const chunks = chunkText(inputText, chunkSize);
    await prisma.knowledgeChunk.deleteMany({ where: { userId: user.id, kbId } });
    const rows = await Promise.all(
      chunks.map(async (chunk) => {
        const embedding = await openaiEmbed(chunk, model, apiKey);
        return { userId: user.id, kbId, text: chunk, embedding };
      })
    );
    await prisma.knowledgeChunk.createMany({ data: rows });
    return { type: "text", payload: `Ingested ${chunks.length} chunk${chunks.length !== 1 ? "s" : ""} into knowledge base "${kbId}".` };
  }

  // Query mode
  const queryEmb = await openaiEmbed(inputText, model, apiKey);
  const stored = await prisma.knowledgeChunk.findMany({ where: { userId: user.id, kbId } });
  if (stored.length === 0) {
    return { type: "text", payload: `Knowledge base "${kbId}" is empty — run a RAG node in Ingest mode first.` };
  }
  const ranked = stored
    .map((c) => ({ text: c.text, score: cosineSim(queryEmb, c.embedding as number[]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => r.text);
  return { type: "text", payload: ranked.join("\n\n---\n\n") };
}

// ── Data Analysis (E2B + matplotlib) ─────────────────────────────────

function buildDataAnalysisScript(dataB64: string, instrB64: string): string {
  return `
import subprocess, sys
subprocess.check_call([sys.executable,"-m","pip","install","pandas","matplotlib","numpy","-q"])

import base64, io, json
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

DATA = base64.b64decode('${dataB64}').decode('utf-8', errors='replace')
INSTRUCTIONS = base64.b64decode('${instrB64}').decode('utf-8', errors='replace')

# ── Parse input ─────────────────────────────────────────────────────────
df = None
try:
    parsed = json.loads(DATA)
    if isinstance(parsed, list) and parsed:
        df = pd.DataFrame(parsed)
    elif isinstance(parsed, dict):
        df = pd.DataFrame(list(parsed.items()), columns=['Label','Value']) if not all(isinstance(v,list) for v in parsed.values()) else pd.DataFrame(parsed)
    print(f"✅ Parsed JSON: {df.shape}", flush=True)
except Exception:
    pass

if df is None:
    try:
        df = pd.read_csv(io.StringIO(DATA))
        print(f"✅ Parsed CSV: {df.shape}", flush=True)
    except Exception:
        pass

if df is None:
    try:
        pairs = {}
        for line in DATA.strip().splitlines():
            if ':' in line:
                k,v = line.split(':',1)
                try: pairs[k.strip()] = float(v.strip().replace(',',''))
                except: pairs[k.strip()] = v.strip()
        if pairs:
            df = pd.DataFrame(list(pairs.items()), columns=['Label','Value'])
            print(f"✅ Parsed key:value: {len(df)} rows", flush=True)
    except Exception:
        pass

if df is None:
    raise ValueError("Cannot parse input as JSON, CSV, or key:value pairs.")

for col in df.columns:
    df[col] = pd.to_numeric(df[col].astype(str).str.replace(',',''), errors='ignore')

num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
print(f"Cols — numeric: {num_cols}, categorical: {cat_cols}", flush=True)

# ── Style ───────────────────────────────────────────────────────────────
COLORS = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444','#64748b']
plt.rcParams.update({
    'figure.facecolor':'#0f1117','axes.facecolor':'#1a1d27','axes.edgecolor':'#334155',
    'axes.labelcolor':'#94a3b8','xtick.color':'#64748b','ytick.color':'#64748b',
    'text.color':'#e2e8f0','grid.color':'#1e293b','grid.linestyle':'--','grid.alpha':0.6,
})
fig, ax = plt.subplots(figsize=(10,6))
instr = INSTRUCTIONS.lower()

# ── Plot ────────────────────────────────────────────────────────────────
plotted = False
if any(k in instr for k in ('bar','column')):
    if cat_cols and num_cols:
        g = df.groupby(cat_cols[0])[num_cols[0]].sum().reset_index()
        ax.bar(g[cat_cols[0]].astype(str), g[num_cols[0]], color=COLORS[0], edgecolor='#4f46e5', linewidth=0.8)
        ax.set_xlabel(cat_cols[0]); ax.set_ylabel(num_cols[0]); ax.tick_params(axis='x',rotation=30)
    elif num_cols:
        df[num_cols[:6]].sum().plot(kind='bar',ax=ax,color=COLORS[:len(num_cols[:6])])
    ax.yaxis.grid(True); ax.set_axisbelow(True); plotted=True
elif 'pie' in instr:
    data_s = df.groupby(cat_cols[0])[num_cols[0]].sum() if (cat_cols and num_cols) else (df[num_cols[0]] if num_cols else df.iloc[:,0].value_counts())
    data_s.plot(kind='pie',ax=ax,autopct='%1.1f%%',colors=COLORS[:len(data_s)],textprops={'color':'#e2e8f0','fontsize':10},startangle=90)
    ax.set_ylabel(''); plotted=True
elif 'scatter' in instr and len(num_cols)>=2:
    ax.scatter(df[num_cols[0]],df[num_cols[1]],c=COLORS[0],alpha=0.75,s=60,edgecolors='white',linewidths=0.4)
    ax.set_xlabel(num_cols[0]); ax.set_ylabel(num_cols[1]); ax.grid(True); ax.set_axisbelow(True); plotted=True
elif any(k in instr for k in ('line','trend','time')):
    if cat_cols and num_cols:
        ax.plot(df[cat_cols[0]].astype(str),df[num_cols[0]],marker='o',color=COLORS[0],linewidth=2,markersize=5)
        ax.set_xlabel(cat_cols[0]); ax.set_ylabel(num_cols[0]); ax.tick_params(axis='x',rotation=30)
    elif num_cols:
        for i,col in enumerate(num_cols[:4]):
            ax.plot(df.index,df[col],marker='o',label=col,color=COLORS[i%len(COLORS)],linewidth=2)
        ax.legend(facecolor='#1a1d27',edgecolor='#334155',labelcolor='#e2e8f0')
    ax.grid(True); ax.set_axisbelow(True); plotted=True
elif any(k in instr for k in ('hist','distribut')):
    if num_cols:
        ax.hist(df[num_cols[0]].dropna(),bins=20,color=COLORS[0],edgecolor='#4f46e5',linewidth=0.6,alpha=0.85)
        ax.set_xlabel(num_cols[0]); ax.set_ylabel('Frequency'); ax.grid(axis='y'); ax.set_axisbelow(True); plotted=True
elif any(k in instr for k in ('heat','corr')) and len(num_cols)>=2:
    corr = df[num_cols].corr()
    im = ax.imshow(corr.values,cmap='RdBu_r',vmin=-1,vmax=1,aspect='auto')
    plt.colorbar(im,ax=ax,shrink=0.8)
    ax.set_xticks(range(len(num_cols))); ax.set_yticks(range(len(num_cols)))
    ax.set_xticklabels(num_cols,rotation=45,ha='right',fontsize=9); ax.set_yticklabels(num_cols,fontsize=9)
    for i in range(len(num_cols)):
        for j in range(len(num_cols)):
            ax.text(j,i,f'{corr.values[i,j]:.2f}',ha='center',va='center',fontsize=8,color='white')
    plotted=True

if not plotted:
    if cat_cols and num_cols:
        g = df.groupby(cat_cols[0])[num_cols[0]].sum().reset_index()
        ax.bar(g[cat_cols[0]].astype(str),g[num_cols[0]],color=COLORS[0],edgecolor='#4f46e5',linewidth=0.8)
        ax.set_xlabel(cat_cols[0]); ax.set_ylabel(num_cols[0]); ax.tick_params(axis='x',rotation=30)
    elif num_cols:
        for i,col in enumerate(num_cols[:4]):
            ax.plot(df.index,df[col],marker='o',label=col,color=COLORS[i%len(COLORS)],linewidth=2)
        if len(num_cols)>1: ax.legend(facecolor='#1a1d27',edgecolor='#334155',labelcolor='#e2e8f0')
    ax.yaxis.grid(True); ax.set_axisbelow(True)

title = INSTRUCTIONS if INSTRUCTIONS.strip() else 'Data Analysis'
ax.set_title(title,color='#e2e8f0',fontsize=13,pad=14,fontweight='bold')
plt.tight_layout(pad=1.5)

buf = io.BytesIO()
plt.savefig(buf,format='png',dpi=150,bbox_inches='tight',facecolor='#0f1117')
plt.close()
buf.seek(0)
b64 = base64.b64encode(buf.read()).decode()
print(f"✅ Chart ready ({len(b64):,} chars)", flush=True)
print("---RESULT_START---data:image/png;base64," + b64 + "---RESULT_END---", flush=True)
`.trim();
}

export async function executeDataAnalysis(
  data: Record<string, any>,
  inputText: string
): Promise<MLResult> {
  if (!inputText?.trim()) throw new Error("Data Analysis: no data received. Connect an upstream node with data.");
  const { runCodeInE2B } = await import("@/lib/sandbox/e2bRunner");
  const RESULT_RE = /---RESULT_START---([\s\S]*?)---RESULT_END---/;
  const dataB64 = Buffer.from(inputText, "utf-8").toString("base64");
  const instrB64 = Buffer.from(data.daInstructions || "", "utf-8").toString("base64");
  const script = buildDataAnalysisScript(dataB64, instrB64);
  const collected: string[] = [];
  const result = await runCodeInE2B(script, "python", (msg) => collected.push(msg));
  const fullOutput = [...collected, result.output].join("\n");
  const match = RESULT_RE.exec(fullOutput);
  if (!match) throw new Error(`Data Analysis: chart generation failed.\n${result.output.slice(0, 400)}`);
  return { type: "file", payload: match[1].trim().replace(/\s+/g, "") };
}

// ── Speech ───────────────────────────────────────────────────────────

export async function executeSpeech(
  data: Record<string, any>,
  inputText: string,
  apiKey: string,
  audioBase64?: string,
  audioMimeType?: string
): Promise<MLResult> {
  const mode = data.speechMode || "tts";
  const provider = data.speechProvider || "openai";

  if (mode === "stt") {
    if (!audioBase64) throw new Error("Speech STT: no audio file attached. Add an audio file to the Input node.");
    if (provider === "openai") {
      const audioBuf = Buffer.from(audioBase64, "base64");
      const formData = new FormData();
      const blob = new Blob([audioBuf], { type: audioMimeType || "audio/mp3" });
      formData.append("file", blob, "audio.mp3");
      formData.append("model", data.speechModel || "whisper-1");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new Error(err.error?.message || `Whisper error ${res.status}`);
      }
      const json = await res.json() as any;
      return { type: "text", payload: json.text || "" };
    }
    throw new Error(`Speech STT: provider "${provider}" not supported`);
  }

  // TTS
  if (!inputText) throw new Error("Speech TTS: no text to speak. Connect an upstream node.");

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: data.speechModel || "tts-1",
        input: inputText,
        voice: data.speechVoice || "alloy",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err.error?.message || `OpenAI TTS error ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return { type: "file", payload: `data:audio/mp3;base64,${b64}` };
  }

  if (provider === "elevenlabs") {
    const voiceId = data.speechVoice || "21m00Tcm4TlvDq8ikWAM"; // Rachel (default)
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: inputText,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.5 },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err.detail || `ElevenLabs error ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    return { type: "file", payload: `data:audio/mp3;base64,${b64}` };
  }

  throw new Error(`Speech TTS: provider "${provider}" not supported`);
}


// ── Mobile Agent Step Executor ────────────────────────────────────────────────
// Runs a single migration step in an E2B sandbox.
// Called from clientExecutor to avoid bundling e2bRunner into the client.
export async function executeMobileAgentStep(
  script: string,
  language: "python" | "javascript"
): Promise<{ output: string }> {
  const { runCodeInE2B } = await import("@/lib/sandbox/e2bRunner");
  const logs: string[] = [];
  const result = await runCodeInE2B(script, language, (msg) => logs.push(msg));
  return { output: result.output };
}
