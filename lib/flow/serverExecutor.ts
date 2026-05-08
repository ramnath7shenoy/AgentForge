// Server-safe execution engine — no "use client", no browser/ReactFlow deps.
// Used by /api/sandbox/execute for hosted sandbox flow testing.

import { runBrowserActionInE2B, runCodeInE2B } from "@/lib/sandbox/e2bRunner";

// ── Local type aliases (mirrors ReactFlow Node/Edge shape from Prisma JSON) ─
export interface SandboxNode {
  id: string;
  type?: string | null;
  data?: Record<string, any>;
}

export interface SandboxEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
}

export interface SandboxApiKey {
  key: string;   // e.g. "OPENAI_API_KEY" or any label
  value: string; // the actual key value
}

export interface SandboxFlowPacket {
  type: "text" | "file" | "data";
  payload: any;
  error?: string;
  attachments?: Array<{ data: string; mimeType: string; name?: string }>;
  fileContext?: string;
  meta?: Record<string, any>;
}

export interface SandboxExecutionContext {
  variables: Record<string, SandboxFlowPacket>;
  nodes: Record<string, SandboxFlowPacket>;
}

export type SandboxNodeStatus = "idle" | "running" | "success" | "error" | "skipped";
export type SandboxLogType = "INFO" | "SUCCESS" | "ERROR" | "WARN";

export interface SandboxWalkerOptions {
  onNodeStatusChange?: (nodeId: string, status: SandboxNodeStatus) => void;
  onNodeComplete?: (nodeId: string, packet: SandboxFlowPacket) => void;
}

type LogFn = (msg: string, type?: SandboxLogType, nodeId?: string) => void;

// ── Provider detection ────────────────────────────────────────────────
const detectProvider = (key: string): string => {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-")) return "openai";
  if (key.startsWith("AIza")) return "gemini";
  if (key.startsWith("sk-ant-")) return "anthropic";
  return "gemini";
};

import { MODEL_DEFAULTS, resolveModelChain } from "@/lib/flow/modelRegistry";
import { calculateExecutionCost } from "@/lib/utils/tokenCost";

// ── API key resolver (from injected keys, not vaultStore) ─────────────
function resolveApiKeyFromList(
  requestedProvider: string | undefined,
  nodeApiKey: string | undefined,
  apiKeys: SandboxApiKey[],
  onLog: LogFn,
  nodeId: string
): { key: string; provider: string } {
  if (nodeApiKey?.trim()) {
    const p = detectProvider(nodeApiKey.trim());
    onLog(`🔑 Auth: Node-Level Key → ${p.toUpperCase()}`, "INFO", nodeId);
    return { key: nodeApiKey.trim(), provider: p };
  }

  const available = apiKeys.filter(k => k.value?.trim());
  if (available.length === 0) {
    throw new Error(
      "No API key provided. Add an API key in the Environment Config panel."
    );
  }

  const effectiveProvider =
    !requestedProvider || requestedProvider === "auto" ? null : requestedProvider;

  if (effectiveProvider) {
    const match = available.find(k => detectProvider(k.value) === effectiveProvider);
    if (match) {
      onLog(`🔑 Auth: Key "${match.key}" → ${effectiveProvider.toUpperCase()}`, "INFO", nodeId);
      return { key: match.value, provider: effectiveProvider };
    }
    onLog(`⚠️ No ${effectiveProvider.toUpperCase()} key — auto-selecting`, "WARN", nodeId);
  }

  const best = available[0];
  const autoProvider = detectProvider(best.value);
  onLog(`🔑 Auth: Auto-selected "${best.key}" → ${autoProvider.toUpperCase()}`, "INFO", nodeId);
  return { key: best.value, provider: autoProvider };
}

interface Attachment { data: string; mimeType: string; name?: string }

// ── Multi-LLM Dispatcher (multimodal) ────────────────────────────────
async function dispatchLLM(
  providerKey: string,
  modelName: string,
  apiKey: string,
  userMessage: string,
  onLog: (msg: string, type: any) => void,
  attachments?: Attachment[],
  onCost?: (amount: number) => void,
  systemPrompt?: string
): Promise<string> {
  const provider = providerKey || detectProvider(apiKey);
  onLog(`📡 Dispatching to ${provider.toUpperCase()} via ${modelName || "default"}...`, "INFO");

  const SYSTEM_PROMPT =
    systemPrompt?.trim() ||
    "You are a helpful AI assistant running inside the AgentForge platform.";

  let url: string;
  let headers: Record<string, string>;
  let body: any;

  const imageAtts = attachments?.filter((a) => a.mimeType.startsWith("image/")) ?? [];

  if (provider === "groq" || provider === "openai") {
    url = provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey}` };

    // Both OpenAI and Groq use the image_url content-array format.
    // For Groq, switch to a vision-capable model when images are present.
    let resolvedModel = modelName || (provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o");
    let userContent: any;

    if (imageAtts.length > 0) {
      if (provider === "groq") {
        resolvedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
        onLog(`🖼️ Groq vision: routing to ${resolvedModel}`, "INFO");
      }
      const parts: any[] = [{ type: "text", text: userMessage }];
      for (const att of imageAtts) {
        parts.push({ type: "image_url", image_url: { url: `data:${att.mimeType};base64,${att.data}` } });
      }
      userContent = parts;
    } else {
      userContent = userMessage;
    }

    body = {
      model: resolvedModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    };
  } else if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName || "gemini-2.0-flash"}:generateContent?key=${apiKey}`;
    headers = {};

    // Images listed first — Gemini attends better when visual context precedes text
    const userParts: any[] = [];
    for (const att of (attachments ?? [])) {
      userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    }
    userParts.push({ text: userMessage });

    body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: userParts }],
    };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };

    // Always use the array format — Anthropic accepts it for plain text too,
    // and the ternary fallback silently dropped images when length === 1.
    const userContent: any[] = [];
    for (const att of imageAtts) {
      userContent.push({ type: "image", source: { type: "base64", media_type: att.mimeType as any, data: att.data } });
    }
    userContent.push({ type: "text", text: userMessage });

    body = {
      model: modelName || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    };
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // ── Model resilience: compute fallback chain, retry on 404/410 ──────────
  const initialModel = provider === "gemini"
    ? (modelName || "gemini-2.0-flash")
    : (body.model as string);
  const modelChain = resolveModelChain(provider, initialModel, imageAtts.length > 0);

  const truncateBase64 = (obj: any): any => {
    if (typeof obj === "string" && obj.length > 80) return obj.slice(0, 60) + `…[+${obj.length - 60}chars]`;
    if (Array.isArray(obj)) return obj.map(truncateBase64);
    if (obj && typeof obj === "object")
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, truncateBase64(v)]));
    return obj;
  };

  // 404/410 = model gone; 413 = payload too large; 429 = rate limit — cascade in all cases
  const STALE = new Set([404, 410, 413, 429]);
  let lastError: Error | null = null;

  for (const candidate of modelChain) {
    if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`;
    } else {
      body.model = candidate;
    }

    try {
      console.log(
        `[dispatchLLM] ${provider.toUpperCase()} /${candidate}  attachments=${imageAtts.length}`,
        JSON.stringify(truncateBase64(JSON.parse(JSON.stringify(body))), null, 2)
      );
    } catch { /* serialisation error — skip log */ }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = (
        data.error?.message || data.error?.code || data.error?.type || ""
      ).toLowerCase();
      const isStaleByMessage =
        errMsg.includes("model_not_found") ||
        errMsg.includes("decommissioned") ||
        errMsg.includes("deprecated") ||
        errMsg.includes("does not exist") ||
        errMsg.includes("not supported") ||
        errMsg.includes("too large") ||
        errMsg.includes("payload too large") ||
        errMsg.includes("context_length") ||
        errMsg.includes("max_tokens");

      if (STALE.has(response.status) || isStaleByMessage) {
        onLog(
          `⚠️ "${candidate}" unavailable (${response.status})${isStaleByMessage ? ` — ${errMsg.slice(0, 60)}` : ""}, trying next fallback…`,
          "WARN"
        );
        lastError = new Error(
          data.error?.message || `Model ${candidate} returned ${response.status}`
        );
        continue;
      }
      if (response.status >= 500)
        throw new Error(`${provider.toUpperCase()} server error (${response.status}).`);
      throw new Error(data.error?.message || `${provider.toUpperCase()} API Error ${response.status}`);
    }

    // Extract response text
    let resultText: string;
    if (provider === "gemini") resultText = data.candidates[0].content.parts[0].text;
    else if (provider === "anthropic") resultText = data.content[0].text;
    else resultText = data.choices[0].message.content;

    // Token cost tracking
    let inputTokens = 0, outputTokens = 0;
    if (provider === "gemini") {
      inputTokens  = data.usageMetadata?.promptTokenCount      ?? 0;
      outputTokens = data.usageMetadata?.candidatesTokenCount  ?? 0;
    } else if (provider === "anthropic") {
      inputTokens  = data.usage?.input_tokens  ?? 0;
      outputTokens = data.usage?.output_tokens ?? 0;
    } else {
      inputTokens  = data.usage?.prompt_tokens     ?? 0;
      outputTokens = data.usage?.completion_tokens ?? 0;
    }
    const cost = calculateExecutionCost(candidate, inputTokens, outputTokens);
    if (cost > 0) onCost?.(cost);

    return resultText;
  }

  throw lastError || new Error(`All fallback models exhausted for ${provider.toUpperCase()}`);
}

// ── Template helpers ──────────────────────────────────────────────────
const getRawValue = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const inner = val.payload ?? val.text ?? val.message ?? val.status ?? val.value;
    if (inner !== undefined) return getRawValue(inner);
    return JSON.stringify(val, null, 2);
  }
  return String(val);
};

function resolveTemplatePath(path: string, ctx: SandboxExecutionContext): any {
  const parts = path.trim().split(".");
  let val: any = ctx.nodes[parts[0]] ?? ctx.variables[parts[0]];
  if (val === undefined) return undefined;
  if (parts.length === 1) return val;
  for (let i = 1; i < parts.length; i++) {
    if (val == null) return undefined;
    const prop = parts[i] === "output" ? "payload" : parts[i];
    if (prop in Object(val)) {
      val = (val as any)[prop];
    } else if (typeof val?.payload === "string") {
      try {
        const parsed = JSON.parse(val.payload);
        val = parsed != null && typeof parsed === "object" ? (parsed as any)[prop] : undefined;
      } catch {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  return val;
}

function applySeqAttn(
  context: SandboxExecutionContext,
  targetPrompt: string
): SandboxExecutionContext {
  const referencedKeys = new Set<string>();
  const regex = /\{\{(.*?)\}\}/g;
  let match;
  while ((match = regex.exec(targetPrompt)) !== null) {
    referencedKeys.add(match[1].trim().split(".")[0]);
  }
  if (referencedKeys.size === 0) return context;

  const prunedNodes: Record<string, SandboxFlowPacket> = {};
  const prunedVariables: Record<string, SandboxFlowPacket> = {};
  referencedKeys.forEach((key) => {
    if (context.nodes[key]) prunedNodes[key] = context.nodes[key];
    if (context.variables[key]) prunedVariables[key] = context.variables[key];
  });
  return { nodes: prunedNodes, variables: prunedVariables };
}

function assertTemplateDeps(
  template: string | undefined,
  context: SandboxExecutionContext,
  nodeLabel: string
): void {
  if (!template) return;
  const refs = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(template)) !== null) {
    refs.add(m[1].trim().split(".")[0]);
  }
  const ALWAYS_AVAILABLE = new Set(["input"]);
  const missing: string[] = [];
  for (const ref of refs) {
    if (ALWAYS_AVAILABLE.has(ref)) continue;
    if (!context.nodes[ref] && !context.variables[ref]) missing.push(ref);
  }
  if (missing.length > 0) {
    throw new Error(
      `"${nodeLabel}" references [${missing.join(", ")}] but those nodes haven't completed yet.`
    );
  }
}

function evaluateRouterCondition(condition: string, inputText: string): boolean {
  const cond = condition.trim().toLowerCase();
  if (!cond || ["true", "always", "otherwise", "else", "default"].includes(cond)) return true;
  const input = inputText.toLowerCase();
  const containsM = cond.match(/^contains\s+['"]?(.+?)['"]?$/);
  if (containsM) return input.includes(containsM[1].trim());
  const equalsM = cond.match(/^(?:==?|equals?)\s+['"]?(.+?)['"]?$/);
  if (equalsM) return input === equalsM[1].trim();
  const gtM = cond.match(/^>\s*(\d+(?:\.\d+)?)$/);
  if (gtM) return parseFloat(inputText) > parseFloat(gtM[1]);
  const ltM = cond.match(/^<\s*(\d+(?:\.\d+)?)$/);
  if (ltM) return parseFloat(inputText) < parseFloat(ltM[1]);
  return input.includes(cond);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s — ${label}`)), ms)
    ),
  ]);
}

// ── Single-node executor ──────────────────────────────────────────────
async function executeNode(
  current: SandboxNode,
  context: SandboxExecutionContext,
  edges: SandboxEdge[],
  initialInput: string,
  apiKeys: SandboxApiKey[],
  sendLog: LogFn,
  onCost?: (amount: number) => void
): Promise<SandboxFlowPacket> {
  const type = current.type;

  switch (type) {
    case "trigger": {
      return { type: "text", payload: initialInput || "Triggered" };
    }

    case "webhook": {
      const sampleText = current.data?.sampleData?.trim() || initialInput;
      sendLog(`🌐 Webhook: using sample input`, "INFO", current.id);
      const packet: SandboxFlowPacket = { type: "text", payload: sampleText };
      context.variables.input = packet;
      return packet;
    }

    case "input": {
      const base: SandboxFlowPacket = current.data?.packet || { type: "text", payload: initialInput };
      const packet: SandboxFlowPacket = { ...base };
      if (packet.fileContext) {
        packet.payload = packet.payload
          ? `${packet.payload}\n\n${packet.fileContext}`
          : packet.fileContext;
      }
      context.variables.input = packet;
      return packet;
    }

    case "ai_agent":
    case "agent-brain":
    case "llm":
    case "ai": {
      const rawPrompt = current.data?.instructions || "";
      const hasTemplateRefs = /\{\{.*?\}\}/.test(rawPrompt);

      // Always: instructions → system prompt, predecessor output → user message.
      // This prevents node instructions from leaking into the user query.
      const incomingEdge = edges.find((e) => e.target === current.id);
      const predecessorPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
      const resolvedUserMessage = predecessorPacket
        ? getRawValue(predecessorPacket)
        : (context.variables.input ? getRawValue(context.variables.input) : initialInput);

      // Resolve any {{refs}} in instructions so multi-node context reaches the system prompt.
      let systemPromptOverride: string | undefined;
      if (rawPrompt.trim()) {
        if (hasTemplateRefs) {
          assertTemplateDeps(rawPrompt, context, current.data?.label || current.id);
          const prunedContext = applySeqAttn(context, rawPrompt);
          const prunedKeyCount = Object.keys(prunedContext.nodes).length + Object.keys(prunedContext.variables).length;
          const totalKeyCount = Object.keys(context.nodes).length + Object.keys(context.variables).length;
          sendLog(`🧠 SeqAttn: ${totalKeyCount} → ${prunedKeyCount} context keys`, "INFO", current.id);
          systemPromptOverride = rawPrompt.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
            const val = resolveTemplatePath(path, prunedContext);
            return val != null ? getRawValue(val) : "";
          });
        } else {
          systemPromptOverride = rawPrompt.trim();
          sendLog(`🎯 Context: system-prompt mode (instructions → system, predecessor → user)`, "INFO", current.id);
        }
      }

      sendLog("🔍 Resolving API key...", "INFO", current.id);

      const inputAttachments = (context.variables.input as any)?.attachments as Attachment[] | undefined;
      if (inputAttachments?.length) {
        sendLog(`📎 ${inputAttachments.length} attachment(s) forwarded to LLM`, "INFO", current.id);
      }

      let responseText = "";
      let success = false;
      let jitKey: string | null = null;

      try {
        const { key, provider: resolvedProvider } = resolveApiKeyFromList(
          current.data?.provider,
          current.data?.apiKey,
          apiKeys,
          sendLog,
          current.id
        );
        jitKey = key;

        const models = MODEL_DEFAULTS[resolvedProvider] || [
          current.data?.modelName || "gemini-2.0-flash",
        ];

        for (const model of models) {
          try {
            sendLog(`📡 Probing ${resolvedProvider.toUpperCase()} via ${model}...`, "INFO", current.id);
            responseText = await withTimeout(
              dispatchLLM(resolvedProvider, model, jitKey, resolvedUserMessage, (msg, t) => sendLog(msg, t, current.id), inputAttachments, onCost, systemPromptOverride),
              30_000,
              `${resolvedProvider.toUpperCase()}/${model}`
            );
            if (responseText) {
              success = true;
              sendLog(`✅ ${resolvedProvider.toUpperCase()} responded via ${model}`, "SUCCESS", current.id);
              break;
            }
          } catch (err: any) {
            if (err.message.toLowerCase().includes("404") || err.message.toLowerCase().includes("not found")) {
              sendLog(`⚠️ ${model} not available, trying failover...`, "WARN", current.id);
              continue;
            }
            throw err;
          }
        }
      } finally {
        jitKey = null;
      }

      if (!success) throw new Error("All models failed.");

      // URL Safety: if instructions mention URL/link goals, ensure output is browser-safe
      const instructionsLower = rawPrompt.toLowerCase();
      const isUrlGoal = /\b(url|link|website|navigate|href|browse to|open the)\b/.test(instructionsLower);
      if (isUrlGoal) {
        const trimmed = responseText.trim();
        const SEARCH_BASE = "https://www.google.com/search?q=";
        if (!trimmed || trimmed === SEARCH_BASE || /[?&]q=\s*$/.test(trimmed)) {
          // Empty or incomplete search URL — use the user's query as the search term
          const query = encodeURIComponent(resolvedUserMessage.slice(0, 200));
          responseText = `${SEARCH_BASE}${query}`;
          sendLog(`🔗 URL Safety: missing query — rebuilt from user message`, "WARN", current.id);
        } else if (!trimmed.startsWith("http")) {
          // LLM returned plain text instead of a URL — wrap as search
          responseText = `${SEARCH_BASE}${encodeURIComponent(trimmed)}`;
          sendLog(`🔗 URL Safety: output wrapped as search query`, "INFO", current.id);
        }
      }

      if (/^\s*(EXIT|STOP)\s*$/i.test(responseText.trim())) {
        sendLog("🛑 Exit keyword detected. Terminating.", "WARN", current.id);
        context.variables.__exit__ = { type: "text", payload: "exit" };
      }

      return { type: "text", payload: responseText };
    }

    case "output": {
      const outputFormat = current.data?.resultFormat || "";
      const resolvedOutput = outputFormat.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
        const val = resolveTemplatePath(path, context);
        return val != null ? getRawValue(val) : "";
      });

      let finalOutput = resolvedOutput;
      if (!finalOutput.trim()) {
        const realOutputs = Object.values(context.nodes).filter(
          (v) => v?.payload != null && String(v.payload).trim() !== ""
        );
        if (realOutputs.length > 0) {
          finalOutput = getRawValue(realOutputs[realOutputs.length - 1]);
        }
      }

      const packet: SandboxFlowPacket = { type: "text", payload: finalOutput };
      context.variables.output = packet;
      sendLog("📤 Flow complete.", "SUCCESS", current.id);
      return packet;
    }

    case "decision":
    case "router": {
      const routes: string[] = current.data?.routes || ["Path A", "Path B"];
      const conditions: Record<string, string> = current.data?.conditions || {};
      const incomingEdge = edges.find((e) => e.target === current.id);
      const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
      const inputText = upstreamPacket ? getRawValue(upstreamPacket) : initialInput;

      let selectedRoute = routes[routes.length - 1];
      for (const route of routes) {
        if (evaluateRouterCondition(conditions[route] || "otherwise", inputText)) {
          selectedRoute = route;
          break;
        }
      }

      sendLog(`🔀 Router: "${selectedRoute}" selected`, "INFO", current.id);
      return { type: "text", payload: inputText, meta: { selectedRoute: selectedRoute.toLowerCase() } };
    }

    case "processor": {
      const batchLogic = current.data?.batchLogic?.trim() || "";
      const incomingEdge = edges.find((e) => e.target === current.id);
      const inputData = incomingEdge ? context.nodes[incomingEdge.source] : null;
      const rawInput = inputData ? getRawValue(inputData) : initialInput;

      if (batchLogic) {
        const resolvedLogic = batchLogic.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
          const val = resolveTemplatePath(path, context);
          return val != null ? getRawValue(val) : "";
        });
        return { type: "text", payload: resolvedLogic };
      }

      return { type: "text", payload: rawInput };
    }

    case "action": {
      const connectionType = current.data?.connectionType || "";
      const endpointUrl = current.data?.url?.trim() || "";

      if (!endpointUrl) {
        throw new Error(`Missing API Endpoint on "${current.data?.label || "Integration"}" node.`);
      }

      const rawTemplate = current.data?.bodyMapping || current.data?.instructions || "";
      const incomingEdge = edges.find((e) => e.target === current.id);
      const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;

      const resolvedPayload = rawTemplate
        ? rawTemplate.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
            const val = resolveTemplatePath(path, context);
            return val != null ? getRawValue(val) : "";
          })
        : upstreamPacket
        ? getRawValue(upstreamPacket)
        : "";

      const isGetLike = connectionType === "Get from Website" || connectionType === "Fetch Data";
      const method = (current.data?.method || (isGetLike ? "GET" : "POST")).toUpperCase();
      const isBodyless = method === "GET" || method === "HEAD" || method === "OPTIONS";

      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
      (current.data?.headers || []).forEach((h: { key: string; value: string }) => {
        if (h.key?.trim()) fetchHeaders[h.key.trim()] = h.value || "";
      });

      const authType = current.data?.authType || "none";
      const authValue = (current.data?.authValue || "").trim();
      if (authValue) {
        if (authType === "bearer") fetchHeaders["Authorization"] = `Bearer ${authValue}`;
        else if (authType === "basic") {
          const encoded = Buffer.from(authValue).toString("base64");
          fetchHeaders["Authorization"] = `Basic ${encoded}`;
        }
      }

      sendLog(`🔗 Integration [${connectionType || method}] → ${endpointUrl}`, "INFO", current.id);

      const fetchOptions: RequestInit = { method, headers: fetchHeaders };
      if (!isBodyless && resolvedPayload) fetchOptions.body = resolvedPayload;

      const res = await fetch(endpointUrl, fetchOptions);
      if (!res.ok) {
        throw new Error(`Integration request failed: ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get("content-type") || "";
      const responseText = contentType.includes("application/json")
        ? JSON.stringify(await res.json())
        : await res.text();

      sendLog(`✅ Integration: ${res.status} OK`, "SUCCESS", current.id);
      return { type: "text", payload: responseText };
    }

    case "appaction": {
      const appProvider = current.data?.appProvider?.trim();
      const appAction = current.data?.appAction?.trim();
      const appInputs = current.data?.appInputs || {};

      if (!appProvider || !appAction) {
        throw new Error(`App Action node "${current.data?.label || current.id}" is not configured.`);
      }

      const resolvedInputs: Record<string, string> = {};
      for (const [fieldKey, rawTemplate] of Object.entries(appInputs)) {
        resolvedInputs[fieldKey] = (rawTemplate as string).replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
          const val = resolveTemplatePath(path, context);
          return val != null ? getRawValue(val) : "";
        });
      }

      // Browser: URL is always the immediate parent node's output — no fallback to initial input.
      if (appProvider === "browser") {
        const incomingEdge = edges.find((e) => e.target === current.id);
        const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
        if (!upstreamPacket) throw new Error(`Browser Agent requires a connected upstream node.`);
        const urlToVisit = getRawValue(upstreamPacket).trim();
        if (!urlToVisit) throw new Error(`Browser Agent [${appAction}]: upstream node produced no output.`);
        resolvedInputs.url = urlToVisit;
        sendLog(`🔗 Browser URL: "${urlToVisit.slice(0, 80)}"`, "INFO", current.id);
      }

      // E2B-backed browser / code execution actions
      if (appProvider === "browser") {
        const e2bLog = (msg: string, type?: "INFO" | "SUCCESS" | "ERROR" | "WARN") =>
          sendLog(msg, type ?? "INFO", current.id);

        sendLog(`🌐 Browser Agent [${appAction}] → E2B sandbox`, "INFO", current.id);

        let result: string;
        if (appAction === "run_python") {
          const { output } = await runCodeInE2B(resolvedInputs.prompt || "", "python", e2bLog);
          result = output;
        } else if (appAction === "run_javascript") {
          const { output } = await runCodeInE2B(resolvedInputs.prompt || "", "javascript", e2bLog);
          result = output;
        } else {
          const url = resolvedInputs.url || "";
          const prompt = resolvedInputs.prompt || resolvedInputs.instructions || "";
          if (!url) throw new Error(`Browser Agent [${appAction}] requires a URL.`);
          const { output } = await runBrowserActionInE2B(appAction, url, prompt, e2bLog);
          result = output;
        }

        sendLog(`✅ Browser Agent [${appAction}] complete.`, "SUCCESS", current.id);
        return { type: "text", payload: result };
      }

      // Standard OAuth-backed app actions (unchanged path)
      sendLog(`🔌 App Action [${appProvider}/${appAction}] — dispatching...`, "INFO", current.id);

      const { executeAppAction } = await import("@/app/actions/integration");
      const { result } = await executeAppAction(appProvider, appAction, resolvedInputs);

      sendLog(`✅ App Action [${appProvider}/${appAction}]: ${result}`, "SUCCESS", current.id);
      return { type: "text", payload: result };
    }

    case "approval":
    case "gatekeeper": {
      sendLog(
        `⏭ ${type === "approval" ? "Approval gate" : "Gatekeeper"} skipped in sandbox mode.`,
        "WARN",
        current.id
      );
      const incomingEdge = edges.find((e) => e.target === current.id);
      return incomingEdge
        ? context.nodes[incomingEdge.source] || { type: "text", payload: "Approved (sandbox)" }
        : { type: "text", payload: "Approved (sandbox)" };
    }

    case "vault": {
      sendLog(`📚 Vault node: returning query template (no RAG in sandbox)`, "INFO", current.id);
      const query = (current.data?.instructions || "").replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
        const val = resolveTemplatePath(path, context);
        return val != null ? getRawValue(val) : "";
      });
      return { type: "text", payload: `[Vault] ${query || "No query"}` };
    }

    default: {
      sendLog(`ℹ️ Node type "${type}" executed`, "INFO", current.id);
      return { type: "text", payload: `Executed: ${current.data?.label || type}` };
    }
  }
}

// ── Reactive Engine (server-safe) ─────────────────────────────────────
export async function executeGraphServer(
  nodes: SandboxNode[],
  edges: SandboxEdge[],
  initialInput: string,
  apiKeys: SandboxApiKey[],
  onLog?: LogFn,
  options: SandboxWalkerOptions = {}
): Promise<{ success: boolean; context: SandboxExecutionContext; totalCostUsd: number }> {
  const context: SandboxExecutionContext = {
    variables: { input: { type: "text", payload: initialInput } },
    nodes: {},
  };

  const sendLog: LogFn = (message, type = "INFO", nodeId) => {
    onLog?.(message, type, nodeId);
  };

  let totalCostUsd = 0;
  const accumulateCost = (amount: number) => { totalCostUsd += amount; };

  const { onNodeStatusChange, onNodeComplete } = options;

  sendLog("🚀 Sandbox Engine started...", "INFO");

  const adj = new Map<string, string[]>();
  const remainingDeps = new Map<string, number>();
  const parentOutcomes = new Map<string, { succeeded: Set<string>; skippedOrFailed: Set<string> }>();

  nodes.forEach((n) => {
    adj.set(n.id, []);
    remainingDeps.set(n.id, 0);
    parentOutcomes.set(n.id, { succeeded: new Set(), skippedOrFailed: new Set() });
  });

  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    remainingDeps.set(e.target, (remainingDeps.get(e.target) || 0) + 1);
  });

  const inflight = new Set<string>();
  const done = new Set<string>();
  const nodeMap = new Map<string, SandboxNode>(nodes.map((n) => [n.id, n]));

  function resolveNode(nodeId: string, outcome: "success" | "skipped", routerSelectedRoute?: string) {
    const children = adj.get(nodeId) || [];
    for (const childId of children) {
      const outcomes = parentOutcomes.get(childId)!;
      if (outcome === "success") {
        outcomes.succeeded.add(nodeId);
      } else {
        outcomes.skippedOrFailed.add(nodeId);
      }
      const remaining = (remainingDeps.get(childId) || 1) - 1;
      remainingDeps.set(childId, remaining);

      if (routerSelectedRoute !== undefined) {
        const edgeLabel = edges.find((e) => e.source === nodeId && e.target === childId)?.label?.toLowerCase() || "";
        if (edgeLabel && edgeLabel !== routerSelectedRoute.toLowerCase()) {
          outcomes.skippedOrFailed.add(nodeId);
          outcomes.succeeded.delete(nodeId);
        }
      }

      if (remaining === 0 && !done.has(childId) && !inflight.has(childId)) {
        const { succeeded, skippedOrFailed } = parentOutcomes.get(childId)!;
        if (succeeded.size > 0) {
          dispatch(childId);
        } else if (skippedOrFailed.size > 0) {
          markSkipped(childId);
        }
      }
    }
  }

  function markSkipped(nodeId: string) {
    done.add(nodeId);
    onNodeStatusChange?.(nodeId, "skipped");
    sendLog(`⏭ Skipped: ${nodeMap.get(nodeId)?.data?.label || nodeId}`, "INFO", nodeId);
    context.nodes[nodeId] = { type: "text", payload: "" };
    resolveNode(nodeId, "skipped");
  }

  async function dispatch(nodeId: string) {
    if (context.variables.__exit__) {
      markSkipped(nodeId);
      return;
    }

    inflight.add(nodeId);
    onNodeStatusChange?.(nodeId, "running");
    const current = nodeMap.get(nodeId)!;
    sendLog(`▶ ${current.data?.label || nodeId} [${current.type}]`, "INFO", nodeId);

    let packet: SandboxFlowPacket;
    let routerRoute: string | undefined;

    try {
      packet = await executeNode(current, context, edges, initialInput, apiKeys, sendLog, accumulateCost);

      context.nodes[nodeId] = packet;
      onNodeComplete?.(nodeId, packet);
      onNodeStatusChange?.(nodeId, "success");
      done.add(nodeId);
      inflight.delete(nodeId);

      if ((current.type === "router" || current.type === "decision") && packet.meta?.selectedRoute) {
        routerRoute = packet.meta.selectedRoute;
      }

      resolveNode(nodeId, "success", routerRoute);
    } catch (err: any) {
      sendLog(`❌ ${current.data?.label || nodeId}: ${err.message}`, "ERROR", nodeId);
      const errPacket: SandboxFlowPacket = { type: "text", payload: "", error: err.message };
      context.nodes[nodeId] = errPacket;
      onNodeComplete?.(nodeId, errPacket);
      onNodeStatusChange?.(nodeId, "error");
      done.add(nodeId);
      inflight.delete(nodeId);
      resolveNode(nodeId, "skipped");
    }
  }

  // Dispatch root nodes (in-degree 0)
  const roots = nodes.filter((n) => (remainingDeps.get(n.id) || 0) === 0);
  if (roots.length === 0) {
    sendLog("❌ No root nodes found — flow has no entry point.", "ERROR");
    return { success: false, context, totalCostUsd: 0 };
  }

  await Promise.all(roots.map((n) => dispatch(n.id)));

  // Wait for all dispatched work to settle
  while (inflight.size > 0) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const finalResult = context.variables.output;
  sendLog(
    finalResult
      ? `✅ Sandbox execution complete.`
      : `⚠️ Sandbox complete — no output node result.`,
    finalResult ? "SUCCESS" : "WARN"
  );

  return { success: true, context, totalCostUsd };
}
