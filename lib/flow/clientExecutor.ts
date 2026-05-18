"use client";

import { Node, Edge } from "reactflow";
import { NodeData, FlowPacket, ExecutionContext, NodeExecutionStatus } from "@/types/flowStoreTypes";
import { getSavedAgents } from "../savedAgents";

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WalkerOptions {
  onNodeStatusChange?: (nodeId: string, status: NodeExecutionStatus) => void;
  onNodeComplete?: (nodeId: string, packet: FlowPacket) => void;
  isDryRun?: boolean;
  abortSignal?: AbortSignal;
}

type LogFn = (
  message: string,
  type?: "INFO" | "SUCCESS" | "ERROR" | "WARN",
  nodeId?: string
) => void;

// ─────────────────────────────────────────────────────────────────────
// JIT Key Resolver — Universal Provider-Agnostic Vault Scanner
//
// Resolution order:
//   1. Node-level apiKey  (explicit override on the AI Brain node)
//   2. Vault entry whose key VALUE prefix matches the requested provider
//      (e.g. "gsk_…" → groq, "sk-…" → openai, anything else → gemini)
//   3. "auto" or no provider specified → first non-empty vault entry wins;
//      provider is inferred from the key value via detectProvider().
//
// The resolved key is held in a local variable and nullified in the
// finally block immediately after dispatchLLM returns/throws — it is
// never stored, logged, or returned.
// ─────────────────────────────────────────────────────────────────────
// ── Priority-ordered LLM key scanner (vault) ─────────────────────────
const LLM_KEY_PRIORITY: Array<{ name: string; provider: string }> = [
  { name: "GROQ_API_KEY",      provider: "groq"      },
  { name: "OPENAI_API_KEY",    provider: "openai"    },
  { name: "ANTHROPIC_API_KEY", provider: "anthropic" },
  { name: "GEMINI_API_KEY",    provider: "gemini"    },
];

function findAvailableLlmKey(
  entries: Array<{ key: string; value: string }>,
  onLog: (msg: string, type: "INFO" | "WARN" | "ERROR", nodeId: string) => void,
  nodeId: string
): { key: string; provider: string } {
  for (const { name, provider } of LLM_KEY_PRIORITY) {
    const match = entries.find((e) => e.key.toUpperCase() === name);
    if (match) {
      onLog(`🔑 Auth: "${match.key}" found → auto-switching provider to ${provider.toUpperCase()}`, "INFO", nodeId);
      return { key: match.value, provider };
    }
  }
  throw new Error(
    "No LLM API key found in Vault. Add at least one of: GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
  );
}

async function resolveApiKey(
  requestedProvider: string | undefined,
  nodeApiKey: string | undefined,
  onLog: (msg: string, type: "INFO" | "WARN" | "ERROR", nodeId: string) => void,
  nodeId: string
): Promise<{ key: string; provider: string }> {
  // 1. Node-level key — highest priority, short-circuit immediately
  if (nodeApiKey?.trim()) {
    const p = detectProvider(nodeApiKey.trim());
    onLog(`🔑 Auth: Node-Level Key → ${p.toUpperCase()}`, "INFO", nodeId);
    return { key: nodeApiKey.trim(), provider: p };
  }

  // 2. Load vault entries
  const { useVaultStore } = await import("@/stores/vaultStore");
  const allEntries = useVaultStore.getState().entries.filter((e) => e.value?.trim());

  if (allEntries.length === 0) {
    throw new Error(
      "No API key found in Vault. Open the Vault panel and add a Groq, OpenAI, Anthropic, or Gemini key."
    );
  }

  const effectiveProvider =
    !requestedProvider || requestedProvider === "auto" ? null : requestedProvider;

  if (effectiveProvider) {
    const expectedKeyName = PROVIDER_KEY_NAMES[effectiveProvider];
    if (!expectedKeyName) {
      throw new Error(`Unknown provider "${effectiveProvider}". Supported: openai, anthropic, gemini, groq.`);
    }

    // Exact name match for the requested provider
    const match = allEntries.find((e) => e.key.toUpperCase() === expectedKeyName);
    if (match) {
      onLog(`🔑 Auth: "${match.key}" → ${effectiveProvider.toUpperCase()}`, "INFO", nodeId);
      return { key: match.value, provider: effectiveProvider };
    }

    // Requested key not found — scan for any available LLM key in priority order
    onLog(`⚠️ ${expectedKeyName} not found — scanning for any available LLM key...`, "WARN", nodeId);
    return findAvailableLlmKey(allEntries, onLog, nodeId);
  }

  // No provider specified — check vault preferred provider, then priority scan
  const preferred = useVaultStore.getState().preferredProvider;
  if (preferred && preferred !== "auto") {
    const preferredKeyName = PROVIDER_KEY_NAMES[preferred];
    if (preferredKeyName) {
      const preferredMatch = allEntries.find((e) => e.key.toUpperCase() === preferredKeyName);
      if (preferredMatch) {
        onLog(`🔑 Auth: Vault preferred provider "${preferred.toUpperCase()}" → ${preferredMatch.key}`, "INFO", nodeId);
        return { key: preferredMatch.value, provider: preferred };
      }
    }
  }

  return findAvailableLlmKey(allEntries, onLog, nodeId);
}

// ─────────────────────────────────────────────────────────────────────
// SeqAttn: Sequential Attention Pruning
// Retains only context keys referenced by {{key}} in the target prompt.
// ─────────────────────────────────────────────────────────────────────
const applySeqAttn = (
  context: ExecutionContext,
  targetPrompt: string
): ExecutionContext => {
  const referencedKeys = new Set<string>();
  const regex = /\{\{(.*?)\}\}/g;
  let match;
  while ((match = regex.exec(targetPrompt)) !== null) {
    referencedKeys.add(match[1].trim().split(".")[0]);
  }
  if (referencedKeys.size === 0) return context;

  const prunedNodes: Record<string, FlowPacket> = {};
  const prunedVariables: Record<string, FlowPacket> = {};
  referencedKeys.forEach((key) => {
    if (context.nodes[key]) prunedNodes[key] = context.nodes[key];
    if (context.variables[key]) prunedVariables[key] = context.variables[key];
  });
  return { nodes: prunedNodes, variables: prunedVariables };
};

// ─────────────────────────────────────────────────────────────────────
// Model Registry & Provider Detection
// ─────────────────────────────────────────────────────────────────────
import { MODEL_DEFAULTS, resolveModelChain } from "@/lib/flow/modelRegistry";
// MODEL_DEFAULTS: { gemini: [...], groq: [...], openai: [...], anthropic: [...] }
// resolveModelChain: builds ordered fallback list for a provider + capability
import { calculateExecutionCost } from "@/lib/utils/tokenCost";
import { toastBus } from "@/lib/utils/toastEvents";

// Returns the provider string for a known key prefix, or "unknown" for
// anything that does not match — intentionally never defaults to "gemini"
// so that non-LLM keys (Tavily, etc.) are excluded from AI auto-selection.
const detectProvider = (key: string): string => {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-")) return "openai";
  if (key.startsWith("AIza")) return "gemini";
  return "unknown";
};

const PROVIDER_KEY_NAMES: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
};

// ─────────────────────────────────────────────────────────────────────
// Multi-LLM Dispatcher — Native Multi-Turn Message Arrays + Multimodal
//
// Sends the full conversation history as the provider's native format:
//   OpenAI / Groq  → messages[]  with system + alternating user/assistant
//   Gemini         → contents[]  with user/model roles + systemInstruction
//   Anthropic      → messages[]  with system field + user/assistant turns
//
// Attachments (base64 files) are injected into the user turn as native
// multimodal content:
//   Gemini   → inlineData parts alongside text
//   OpenAI   → image_url content blocks (images only)
//   Anthropic → image content blocks with base64 source
//   Groq     → text-only (vision not universally available; attachments skipped)
//
// This is the only place the API key is in scope; it is purged by the
// JIT pattern in the calling code immediately after this returns.
// ─────────────────────────────────────────────────────────────────────

interface Attachment { data: string; mimeType: string; name?: string }

async function dispatchLLM(
  providerKey: string,
  modelName: string,
  apiKey: string,
  userMessage: string,
  conversationHistory: ChatMessage[],
  onLog: (msg: string, type: any) => void,
  attachments?: Attachment[],
  onCost?: (amount: number) => void,
  systemPrompt?: string,
  abortSignal?: AbortSignal
): Promise<string> {
  const provider = providerKey || detectProvider(apiKey);

  // Keep the most recent 20 turns to avoid overflowing context windows on long sessions
  const MAX_HISTORY = 20;
  const trimmedHistory = conversationHistory.length > MAX_HISTORY
    ? conversationHistory.slice(-MAX_HISTORY)
    : conversationHistory;

  const turnCount = trimmedHistory.length + 1;
  onLog(
    `📡 Dispatching to ${provider.toUpperCase()} — ${turnCount} message(s) in context...`,
    "INFO"
  );

  const SYSTEM_PROMPT =
    systemPrompt?.trim() ||
    "You are a helpful AI assistant running inside the AgentForge platform. " +
    "Maintain context across the entire conversation.";

  let url: string;
  let headers: Record<string, string>;
  let body: any;

  const imageAtts = attachments?.filter((a) => a.mimeType.startsWith("image/")) ?? [];

  if (provider === "groq" || provider === "openai") {
    url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey}` };

    // Both OpenAI and Groq accept the image_url content-array format.
    // Groq vision requires a vision-capable model — switch automatically.
    let resolvedModel = modelName || (provider === "groq" ? "llama-4-scout-17b" : "gpt-5.5-pro");
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
        ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ],
    };
  } else if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${
      modelName || "gemini-3.1-pro"
    }:generateContent?key=${apiKey}`;
    headers = {};

    // Images listed first — Gemini attends better when visual context precedes text
    const userParts: any[] = [];
    for (const att of (attachments ?? [])) {
      userParts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
    }
    userParts.push({ text: userMessage });

    body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...trimmedHistory.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: userParts },
      ],
    };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerously-allow-browser": "true",
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
      messages: [
        ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ],
    };
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // ── Model resilience: compute fallback chain, retry on 404/410 ──────────
  const initialModel = provider === "gemini"
    ? (modelName || "gemini-3.1-pro")
    : (body.model as string);
  const modelChain = resolveModelChain(provider, initialModel, imageAtts.length > 0);

  const truncateBase64 = (obj: any): any => {
    if (typeof obj === "string" && obj.length > 80) return obj.slice(0, 60) + `…[+${obj.length - 60}chars]`;
    if (Array.isArray(obj)) return obj.map(truncateBase64);
    if (obj && typeof obj === "object")
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, truncateBase64(v)]));
    return obj;
  };

  // 404/410 = model gone; 429 = rate limit — cascade to next model in all cases
  const STALE = new Set([404, 410, 429]);
  let lastError: Error | null = null;

  for (const candidate of modelChain) {
    if (provider === "gemini") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`;
    } else {
      body.model = candidate;
    }

    // Pre-flight debug log
    try {
      console.log(
        `[dispatchLLM] ${provider.toUpperCase()} /${candidate}  attachments=${imageAtts.length}`,
        JSON.stringify(truncateBase64(JSON.parse(JSON.stringify(body))), null, 2)
      );
    } catch { /* serialisation error — skip log */ }

    if (abortSignal?.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: abortSignal,
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
        errMsg.includes("not supported");

      if (STALE.has(response.status) || isStaleByMessage) {
        const toastMsg =
          response.status === 429
            ? "Rate limit — switching to next model…"
            : "Switching to fallback model…";
        onLog(
          `⚠️ "${candidate}" unavailable (${response.status})${isStaleByMessage ? ` — ${errMsg.slice(0, 60)}` : ""}, trying next fallback…`,
          "WARN"
        );
        toastBus.emit({ message: toastMsg, level: "warn" });
        lastError = new Error(
          data.error?.message || `Model ${candidate} returned ${response.status}`
        );
        continue;
      }
      if (response.status >= 500)
        throw new Error(`${provider.toUpperCase()} server error (${response.status}). Try again later.`);
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

// ─────────────────────────────────────────────────────────────────────
// Deep-Text Resolver
// Recursively unwraps FlowPacket wrappers. If the inner .payload is
// itself an object (e.g. a dry-run simulated result), it recurses
// rather than returning the raw object — preventing "[object Object]".
// ─────────────────────────────────────────────────────────────────────
const getRawValue = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    // Synthetic payload → convert to readable text so AI nodes receive clean content
    if (val.includes('"__synthetic__"')) {
      try {
        const p = JSON.parse(val);
        if (p?.__synthetic__ === true && Array.isArray(p.posts)) {
          const lines = [`Source: ${p.source_url}`, `Platform: ${p.platform}`, ``];
          (p.posts as any[]).slice(0, 5).forEach((post: any, i: number) => {
            lines.push(`${i + 1}. ${post.title}${post.subreddit ? ` (r/${post.subreddit})` : ""}`);
            if (post.snippet) lines.push(`   ${String(post.snippet).slice(0, 300)}`);
            lines.push(``);
          });
          return lines.join("\n").trim();
        }
      } catch { /* not synthetic, fall through */ }
    }
    return val;
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    // Prefer human-readable fields; recurse so nested objects are unwrapped
    const inner = val.payload ?? val.text ?? val.message ?? val.status ?? val.value;
    if (inner !== undefined) return getRawValue(inner);
    return JSON.stringify(val, null, 2);
  }
  return String(val);
};

// ─────────────────────────────────────────────────────────────────────
// Template Path Resolver
// Resolves a dotted path like "node-id.x" against the execution context.
// Falls back to JSON-parsing the node's .payload string when a sub-key
// (e.g. ".x", ".linkedin") is not a direct property of the FlowPacket.
// This enables structured outputs like {"x":"…","linkedin":"…"} to be
// accessed as {{content-gen.x}} in downstream node templates.
// ─────────────────────────────────────────────────────────────────────
function resolveTemplatePath(path: string, ctx: ExecutionContext): any {
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
      // Try to extract a key from a JSON-string payload
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

// ─────────────────────────────────────────────────────────────────────
// Template Dependency Validator
//
// Extracts every {{nodeId}} base reference from a template string and
// checks that each one is already present in context.nodes or
// context.variables before the node executes.
//
// Why: the BFS wave guarantees ordering IF edges are correct. This is
// a defence-in-depth check that catches cases where the architect
// forgot to add a sequential edge (e.g. researcher and summarizer both
// get in-degree 0 and run in the same wave before either has output).
//
// On failure: throws immediately so the error surfaces in the execution
// log with a clear remediation message rather than the node making an
// API call with blank/empty context placeholders.
// ─────────────────────────────────────────────────────────────────────
function assertTemplateDeps(
  template: string | undefined,
  context: ExecutionContext,
  nodeLabel: string
): void {
  if (!template) return;

  const refs = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(template)) !== null) {
    refs.add(m[1].trim().split(".")[0]);
  }

  // "input" is always seeded into context.variables before wave 1 starts
  const ALWAYS_AVAILABLE = new Set(["input"]);
  const missing: string[] = [];

  for (const ref of refs) {
    if (ALWAYS_AVAILABLE.has(ref)) continue;
    if (!context.nodes[ref] && !context.variables[ref]) {
      missing.push(ref);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `"${nodeLabel}" references [${missing.join(", ")}] but those nodes have not produced output yet. ` +
      `Add a sequential edge from each referenced node directly to this one so the walker ` +
      `waits for them to complete before executing this node.`
    );
  }
}

function resolveNodeLabel(node: { type?: string | null; data?: any; id: string }): string {
  return node.type || node.id;
}

// ─────────────────────────────────────────────────────────────────────
// Timeout Utility — races a promise against a deadline
// ─────────────────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s — ${label}`)), ms)
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────
// Router Condition Evaluator
// Supports: contains X | = X | > N | < N | true/always/otherwise/else
// Falls through to substring match for unrecognised patterns.
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// Short-Circuit Helper: Transitive descendant finder (DFS)
// Returns every node reachable from startId, used to propagate SKIPPED.
// ─────────────────────────────────────────────────────────────────────
export function getSubgraphNodeIds(startId: string, edges: Edge[]): Set<string> {
  const adj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });
  const result = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const childId of adj.get(id) || []) {
      if (!result.has(childId)) {
        result.add(childId);
        stack.push(childId);
      }
    }
  }
  return result;
}

function getDescendants(
  startId: string,
  adj: Map<string, string[]>
): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(adj.get(startId) || [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (!descendants.has(id)) {
      descendants.add(id);
      (adj.get(id) || []).forEach((child) => stack.push(child));
    }
  }
  return descendants;
}

// ─────────────────────────────────────────────────────────────────────
// Single-Node Executor (type-dispatched)
// Returns the FlowPacket produced by this node. Mutates context for
// side-effect outputs (variables.input, variables.output, __exit__).
// ─────────────────────────────────────────────────────────────────────
async function executeNode(
  current: Node<NodeData>,
  context: ExecutionContext,
  edges: Edge[],
  initialInput: string,
  chatHistory: ChatMessage[],
  sendLog: LogFn,
  isDryRun?: boolean,
  abortSignal?: AbortSignal
): Promise<FlowPacket> {
  try {
  switch (current.type) {
    case "trigger": {
      return { type: "text", payload: `Triggered with: ${initialInput}` };
    }

    case "webhook": {
      // sampleData is a plain-English string describing what the agent will receive.
      // The engine passes it directly as the input text to downstream AI Brain nodes.
      const sampleText = (current.data as any)?.sampleData?.trim();

      if (!sampleText) {
        // Guard: execution should have been blocked by the pre-run check in flowStore,
        // but if we reach here without sample data throw a clear, actionable error.
        throw new Error(
          `Please tell the agent what to work on by typing in the "${current.data?.label || "Webhook"}" node's Sample Input box.`
        );
      }

      sendLog(
        `🌐 Webhook: sample input → "${sampleText.slice(0, 60)}${sampleText.length > 60 ? "…" : ""}"`,
        "INFO",
        current.id
      );

      const packet: FlowPacket = { type: "text", payload: sampleText };
      context.variables.input = packet;
      return packet;
    }

    case "input": {
      const base = current.data?.packet || { type: "text", payload: initialInput };
      // Merge packed file context into the payload at execution time.
      // fileContext is stored separately so the textarea stays clean.
      const packet: FlowPacket = { ...base };
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
      // A. Strict dependency check — fail fast if any upstream {{ref}} is missing.
      //    Prevents the API call from running with blank context substitutions.
      const rawPrompt = current.data?.instructions || "";
      assertTemplateDeps(rawPrompt, context, current.data?.label || current.id);

      // B. SeqAttn — prune the execution context to only keys referenced in
      //    this node's prompt template. Conversation history is NOT part of
      //    the scope because it is now sent as native API message arrays.
      const prunedContext = applySeqAttn(context, rawPrompt);

      const prunedKeyCount =
        Object.keys(prunedContext.nodes).length +
        Object.keys(prunedContext.variables).length;
      const totalKeyCount =
        Object.keys(context.nodes).length +
        Object.keys(context.variables).length;
      sendLog(
        `🧠 SeqAttn: Pruned context ${totalKeyCount} → ${prunedKeyCount} keys`,
        "INFO",
        current.id
      );

      // C. Resolve {{refs}} in instructions — this becomes the system prompt.
      // ".output" is a semantic alias for ".payload" so {{node.output}} works.
      const resolvedPrompt = rawPrompt.replace(
        /\{\{(.*?)\}\}/g,
        (_: string, path: string) => {
          const val = resolveTemplatePath(path, prunedContext);
          return val != null ? getRawValue(val) : "";
        }
      );

      // D. User message = immediate predecessor output (clean data, no instructions).
      // Instructions go to system role; this prevents them from leaking into the query.
      const _incomingEdge = edges.find((e) => e.target === current.id);
      const _predecessorPacket = _incomingEdge ? context.nodes[_incomingEdge.source] : null;
      const userInputMessage = _predecessorPacket
        ? getRawValue(_predecessorPacket)
        : context.variables.input
          ? getRawValue(context.variables.input)
          : initialInput;

      sendLog(
        `💬 Memory: ${chatHistory.length} prior turn(s) in context`,
        "INFO",
        current.id
      );

      // Extract attachments from the input packet for multimodal dispatch
      const inputAttachments = (context.variables.input as any)?.attachments as Attachment[] | undefined;
      if (inputAttachments?.length) {
        sendLog(`📎 ${inputAttachments.length} attachment(s) forwarded to LLM`, "INFO", current.id);
      }

      // E. JIT Key Resolution + Smart Failover
      sendLog("🔍 Resolving provider and key from vault...", "INFO", current.id);

      let responseText = "";
      let success = false;
      let jitKey: string | null = null;

      try {
        // JIT: key resolved only here, nullified in finally below
        const { key, provider: resolvedProvider } = await resolveApiKey(
          current.data?.provider,
          current.data?.apiKey,
          sendLog,
          current.id
        );
        jitKey = key;

        const models =
          MODEL_DEFAULTS[resolvedProvider] || [
            current.data?.modelName || "gemini-2.0-flash",
          ];

        for (const model of models) {
          try {
            sendLog(
              `📡 Probing ${resolvedProvider.toUpperCase()} via ${model}...`,
              "INFO",
              current.id
            );
            // Pass the full chatHistory; dispatchLLM builds the provider-native
            // messages/contents array — no manual history string injection here.
            responseText = await withTimeout(
              dispatchLLM(
                resolvedProvider,
                model,
                jitKey,
                userInputMessage,   // user role: the clean data/query
                chatHistory,
                (msg, type) => sendLog(msg, type, current.id),
                inputAttachments,
                async (cost) => {
                  const { useCostStore } = await import("@/stores/useCostStore");
                  useCostStore.getState().addCost(cost);
                },
                resolvedPrompt,     // system role: the node instructions
                abortSignal
              ),
              30_000,
              `${resolvedProvider.toUpperCase()}/${model}`
            );
            if (responseText) {
              success = true;
              sendLog(
                `✅ ${resolvedProvider.toUpperCase()} responded via ${model}`,
                "SUCCESS",
                current.id
              );
              break;
            }
          } catch (err: any) {
            if (
              err.message.toLowerCase().includes("404") ||
              err.message.toLowerCase().includes("not found")
            ) {
              sendLog(
                `⚠️ ${model} not available, trying failover...`,
                "WARN",
                current.id
              );
              continue;
            }
            throw err;
          }
        }
      } finally {
        jitKey = null; // Purge immediately after the promise settles
      }

      if (!success) throw new Error(`All models failed. Last error logged above.`);

      // F. Strip Google Search URLs — the AI sometimes wraps a query as a Google link.
      //    Extract the real search query so the browser agent uses Tavily instead.
      if (/^https?:\/\/(?:www\.)?google\.[^/]+\/search/i.test(responseText.trim())) {
        try {
          const q = new URL(responseText.trim()).searchParams.get("q") || "";
          if (q) {
            sendLog(`🚫 Google Search URL in AI output — extracting query: "${q.slice(0, 60)}"`, "WARN", current.id);
            responseText = q;
          }
        } catch { /* leave responseText unchanged */ }
      }

      // G. Exit keyword detection — only triggers if EXIT or STOP is the entire message.
      // A substring match would kill the flow whenever the AI mentions "stop doing X" or
      // "the process is done" — far too aggressive for conversational agents.
      if (/^\s*(EXIT|STOP)\s*$/i.test(responseText.trim())) {
        sendLog("🛑 Exit keyword detected. Terminating walker.", "WARN", current.id);
        context.variables.__exit__ = { type: "text", payload: "exit" };
      }

      // G. Sync AI response to Chat Hub — every AI Brain turn is visible in real time
      const { useFlowStore: _fs } = await import("@/stores/flowStore");
      _fs.getState().addMessage("assistant", responseText);

      return { type: "text", payload: responseText };
    }

    case "output": {
      const outputFormat = current.data?.resultFormat || "";
      // Note: assertTemplateDeps intentionally omitted here — the engine pre-seeds
      // ghost packets for skipped-branch refs before this node is dispatched, so
      // the template resolves gracefully even when some parents were inactive.
      const resolvedOutput = outputFormat.replace(
        /\{\{(.*?)\}\}/g,
        (_: string, path: string) => {
          const val = resolveTemplatePath(path, context);
          return val != null ? getRawValue(val) : "";
        }
      );

      // Fallback: if the entire template resolved to empty (all refs came from
      // skipped branches), use the most recent non-empty output from any
      // successfully executed node instead of returning a blank result.
      let finalOutput = resolvedOutput;
      if (!finalOutput.trim()) {
        const realOutputs = Object.values(context.nodes).filter(
          (v) => v?.payload != null && String(v.payload).trim() !== ""
        );
        if (realOutputs.length > 0) {
          finalOutput = getRawValue(realOutputs[realOutputs.length - 1]);
          sendLog(
            `ℹ️ Output template resolved empty — using last active upstream result as fallback`,
            "INFO",
            current.id
          );
        }
      }

      const packet: FlowPacket = { type: "text", payload: finalOutput };
      context.variables.output = packet;

      // Open Chat Hub so the user sees all AI Brain messages that were synced upstream
      const flowStore = (await import("@/stores/flowStore")).useFlowStore.getState();
      flowStore.setIsChatOpen(true);
      sendLog("📤 Flow complete — Chat Hub opened.", "SUCCESS", current.id);

      return packet;
    }

    case "decision":
    case "router": {
      const routes: string[] = current.data?.routes || ["Path A", "Path B"];
      const conditions: Record<string, string> = current.data?.conditions || {};

      // Resolve upstream input text for condition matching
      const incomingEdge = edges.find((e) => e.target === current.id);
      const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
      const inputText = upstreamPacket ? getRawValue(upstreamPacket) : initialInput;

      // Pick the first route whose condition matches; last route is the fallback
      let selectedRoute = routes[routes.length - 1];
      for (const route of routes) {
        if (evaluateRouterCondition(conditions[route] || "otherwise", inputText)) {
          selectedRoute = route;
          break;
        }
      }

      sendLog(
        `🔀 Router: "${selectedRoute}" selected (${routes.length} branches)`,
        "INFO",
        current.id
      );
      return {
        type: "text",
        payload: inputText,
        meta: { selectedRoute: selectedRoute.toLowerCase() },
      };
    }

    case "processor": {
      const _pEdge = edges.find((e) => e.target === current.id);
      const _pUpstream = _pEdge ? context.nodes[_pEdge.source] : null;
      const _pRaw = _pUpstream ? getRawValue(_pUpstream) : initialInput;
      const _pMode = current.data?.processorMode || "template";

      const _pResolve = (tpl: string) =>
        tpl.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
          const val = resolveTemplatePath(path, context);
          return val != null ? getRawValue(val) : "";
        });

      if (_pMode === "template") {
        const tpl = (current.data?.template as string | undefined)?.trim() || "";
        return { type: "text", payload: tpl ? _pResolve(tpl) : _pRaw };
      }

      if (_pMode === "switch") {
        const matchType: string = current.data?.switchMatchType || "contains";
        const cases: { match: string; output: string }[] = current.data?.switchCases || [];
        const input = _pRaw.toLowerCase();
        for (const c of cases) {
          const m = c.match.toLowerCase();
          let hit = false;
          if (matchType === "equals") hit = input === m;
          else if (matchType === "startsWith") hit = input.startsWith(m);
          else if (matchType === "regex") { try { hit = new RegExp(c.match, "i").test(_pRaw); } catch { hit = false; } }
          else hit = input.includes(m);
          if (hit) return { type: "text", payload: _pResolve(c.output) };
        }
        const def = (current.data?.switchDefault as string | undefined) || "";
        return { type: "text", payload: def ? _pResolve(def) : _pRaw };
      }

      if (_pMode === "transform") {
        const op: string = current.data?.transformOp || "map";
        const expr: string = current.data?.transformExpr || "{{item}}";
        const applyExpr = (item: string) => expr.replace(/\{\{item\}\}/g, item);

        if (op === "split") {
          const rawSep = (current.data?.splitOn as string | undefined) ?? "\\n";
          const sep = rawSep === "\\n" ? "\n" : rawSep === "\\t" ? "\t" : rawSep;
          const arr = _pRaw.split(sep).map((s) => s.trim()).filter(Boolean);
          return { type: "data", payload: arr };
        }
        if (op === "join") {
          const rawJoin = (current.data?.joinWith as string | undefined) ?? "\\n";
          const join = rawJoin === "\\n" ? "\n" : rawJoin === "\\t" ? "\t" : rawJoin;
          let arr: string[] = [];
          try { arr = JSON.parse(_pRaw); } catch { arr = _pRaw.split("\n").map((s) => s.trim()).filter(Boolean); }
          return { type: "text", payload: Array.isArray(arr) ? arr.join(join) : _pRaw };
        }
        let items: string[] = [];
        try { const parsed = JSON.parse(_pRaw); items = Array.isArray(parsed) ? parsed.map(String) : [_pRaw]; }
        catch { items = _pRaw.split("\n").map((s) => s.trim()).filter(Boolean); }
        if (op === "filter") {
          const filtered = items.filter((item) => applyExpr(item).trim().length > 0);
          return { type: "data", payload: filtered };
        }
        return { type: "data", payload: items.map((item) => applyExpr(item)) };
      }

      if (_pMode === "iterate") {
        const fmt: string = current.data?.iterateInputFormat || "lines";
        const tpl: string = current.data?.iterateTemplate || "{{item}}";
        const rawJoin = (current.data?.iterateJoin as string | undefined) ?? "\\n";
        const joinStr = rawJoin === "\\n" ? "\n" : rawJoin === "\\t" ? "\t" : rawJoin;
        let items: string[] = [];
        if (fmt === "json") {
          try { const p = JSON.parse(_pRaw); items = Array.isArray(p) ? p.map(String) : [_pRaw]; } catch { items = [_pRaw]; }
        } else if (fmt === "csv") {
          items = _pRaw.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
          items = _pRaw.split("\n").map((s) => s.trim()).filter(Boolean);
        }
        const results = items.map((item, index) =>
          tpl.replace(/\{\{item\}\}/g, item).replace(/\{\{index\}\}/g, String(index))
        );
        return { type: "text", payload: results.join(joinStr) };
      }

      if (_pMode === "delay") {
        const ms = Math.min(Number(current.data?.delayMs ?? 1000), 10000);
        await new Promise((resolve) => setTimeout(resolve, ms));
        return { type: "text", payload: _pRaw };
      }

      if (_pMode === "set") {
        const assigns: { key: string; value: string }[] = current.data?.assignments || [];
        const obj: Record<string, string> = {};
        for (const a of assigns) {
          if (a.key.trim()) obj[a.key.trim()] = _pResolve(a.value);
        }
        return { type: "data", payload: obj };
      }

      return { type: "text", payload: _pRaw };
    }

    case "action": {
      const connectionType = current.data?.connectionType || "";
      const endpointUrl = current.data?.url?.trim() || "";

      if (!connectionType) {
        throw new Error("Integration node has no connection type configured. Open node settings to select one.");
      }
      if (!endpointUrl) {
        throw new Error(
          `Missing API Endpoint. Open the "${current.data?.label || "Integration"}" node settings and add a URL.`
        );
      }

      // ── Resolve body template (bodyMapping takes precedence over instructions) ──
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

      // ── Build headers: Content-Type + custom + auth ───────────────────
      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };

      // Custom header rows
      (current.data?.headers || []).forEach((h: { key: string; value: string }) => {
        if (h.key?.trim()) fetchHeaders[h.key.trim()] = h.value || "";
      });

      // Auth
      const authType = current.data?.authType || "none";
      const authValue = (current.data?.authValue || current.data?.persistence || "").trim();
      if (authValue) {
        if (authType === "bearer") {
          fetchHeaders["Authorization"] = `Bearer ${authValue}`;
        } else if (authType === "basic") {
          // authValue expected as "user:password" or a pre-encoded base64 string
          const encoded = typeof btoa !== "undefined"
            ? btoa(authValue)
            : Buffer.from(authValue).toString("base64");
          fetchHeaders["Authorization"] = `Basic ${encoded}`;
        }
      }

      sendLog(
        `🔗 Integration [${connectionType}] → ${method} ${endpointUrl}`,
        "INFO",
        current.id
      );

      if (isDryRun) {
        sendLog(`🟡 [DRY RUN] Skipped live fetch — returning simulated response`, "WARN", current.id);
        return {
          type: "data",
          payload: { status: "simulated", url: endpointUrl, method, data_to_send: resolvedPayload },
        };
      }

      // ── Real HTTP dispatch ────────────────────────────────────────────
      let responseText: string;
      try {
        const fetchOptions: RequestInit = { method, headers: fetchHeaders };
        if (!isBodyless && resolvedPayload) {
          fetchOptions.body = resolvedPayload;
        }

        const res = await fetch(endpointUrl, fetchOptions);

        if (!res.ok) {
          throw new Error(
            `Integration request failed: ${res.status} ${res.statusText} from ${endpointUrl}`
          );
        }

        const contentType = res.headers.get("content-type") || "";
        responseText = contentType.includes("application/json")
          ? JSON.stringify(await res.json())
          : await res.text();

        sendLog(`✅ Integration [${connectionType}]: ${res.status} OK`, "SUCCESS", current.id);
      } catch (err: any) {
        if (err.message.startsWith("Integration request failed:")) throw err;
        throw new Error(
          `Integration [${connectionType}] network error: ${err.message}. ` +
          `This may be a CORS restriction — consider routing through a server-side proxy.`
        );
      }

      return { type: "text", payload: responseText };
    }

    case "appaction": {
      const appProvider = current.data?.appProvider?.trim();
      const appAction = current.data?.appAction?.trim();
      const appInputs = current.data?.appInputs || {};

      if (!appProvider || !appAction) {
        throw new Error(
          `App Action node "${current.data?.label || current.id}" is not configured. ` +
          `Open its settings to select an app and action.`
        );
      }

      // Resolve {{node-id}} templates in every input field
      const resolvedInputs: Record<string, string> = {};
      for (const [fieldKey, rawTemplate] of Object.entries(appInputs)) {
        resolvedInputs[fieldKey] = (rawTemplate as string).replace(
          /\{\{(.*?)\}\}/g,
          (_: string, path: string) => {
            const val = resolveTemplatePath(path, context);
            return val != null ? getRawValue(val) : "";
          }
        );
      }

      // Strict upstream injection: if an incoming edge exists, always override the content field.
      if (appProvider !== "browser") {
        const { getAction: _getAction } = await import("@/lib/providers");
        const actionDef = _getAction(appProvider, appAction);
        const contentField = actionDef?.fields.find((f) => f.isContent);
        if (contentField) {
          const incomingEdge = edges.find((e) => e.target === current.id);
          const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
          if (upstreamPacket) {
            resolvedInputs[contentField.key] = getRawValue(upstreamPacket);
            sendLog(`📝 Content "${contentField.key}" overridden from upstream output`, "INFO", current.id);
          }
        }
      }

      // Tavily key — fetched from vault inside the browser block, used in executeAppAction for all browser actions
      let tavilyKey: string | undefined;

      // Browser: URL is always the immediate parent node's output — no fallback to initial input.
      if (appProvider === "browser") {
        const incomingEdge = edges.find((e) => e.target === current.id);
        const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
        if (!upstreamPacket) throw new Error(`Browser Agent requires a connected upstream node.`);
        const urlToVisit = getRawValue(upstreamPacket).trim();
        if (!urlToVisit) throw new Error(`Browser Agent [${appAction}]: upstream node produced no output.`);

        // Guard: upstream error messages must not be treated as navigation targets
        if (urlToVisit.toLowerCase().includes("error:")) {
          throw new Error(`Upstream node failed: ${urlToVisit}`);
        }

        // Resolve: if input is a search term (not a URL), find the top URL via Tavily
        const { useVaultStore: _vs } = await import("@/stores/vaultStore");
        tavilyKey = _vs.getState().entries.find((e) => e.key.toUpperCase() === "TAVILY_API_KEY")?.value ?? undefined;
        const { resolveTargetUrl } = await import("@/lib/utils/resolveTargetUrl");
        const resolvedUrl = await resolveTargetUrl(urlToVisit, tavilyKey ?? null, (msg) => sendLog(msg, "INFO", current.id));
        resolvedInputs.url = resolvedUrl;
        sendLog(`🔗 Browser URL: "${resolvedUrl.slice(0, 80)}"`, "INFO", current.id);
      }

      sendLog(
        `🔌 App Action [${appProvider}/${appAction}] — dispatching`,
        "INFO",
        current.id
      );

      if (isDryRun) {
        sendLog(`🟡 [DRY RUN] Skipped live app action — returning simulated response`, "WARN", current.id);
        return {
          type: "data",
          payload: { status: "simulated", provider: appProvider, action: appAction, inputs: resolvedInputs },
        };
      }

      // Browser actions go through the API route (maxDuration=60) to avoid server action timeout limits.
      if (appProvider === "browser") {
        const _brRes = await fetch("/api/browser/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: appAction, url: resolvedInputs.url, prompt: resolvedInputs.prompt ?? resolvedInputs.instructions ?? "", tavilyApiKey: tavilyKey }),
        });
        if (!_brRes.ok) {
          const _brErr = await _brRes.json().catch(() => ({})) as any;
          throw new Error(_brErr.error ?? `Browser Agent failed (${_brRes.status})`);
        }
        const _brJson = await _brRes.json().catch(() => ({} as any));
        const _brResult: string = _brJson.result ?? "";
        sendLog(`✅ Browser Agent [${appAction}] complete`, "SUCCESS", current.id);
        return _brResult.startsWith("data:image/")
          ? { type: "file", payload: _brResult }
          : { type: "text", payload: _brResult };
      }

      // All other app actions — server action (OAuth-backed, short-lived)
      const { executeAppAction } = await import("@/app/actions/integration");
      const { result } = await executeAppAction(appProvider, appAction, resolvedInputs, tavilyKey);

      sendLog(`✅ App Action [${appProvider}/${appAction}]: ${result}`, "SUCCESS", current.id);
      return { type: "text", payload: result };
    }

    case "approval": {
      const incomingEdge = edges.find((e) => e.target === current.id);
      const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
      const message = current.data?.gatekeeperMessage || "Please review and approve to continue.";

      // DATA GATE: if the upstream node hasn't produced output yet, warn and proceed
      // rather than silently approving nothing. The walker's wave guarantee means the
      // upstream node will have run before this one, but we surface a clear log if not.
      if (!upstreamPacket) {
        sendLog("⚠️ Approval gate has no upstream content yet — proceeding anyway.", "WARN", current.id);
      }

      sendLog(`⏸ Flow paused — awaiting approval: "${message}"`, "WARN", current.id);

      // Notify chat so the user knows what to do
      const { useFlowStore: _s } = await import("@/stores/flowStore");
      _s.getState().addMessage(
        "assistant",
        `⏸️ **Approval Required**\n\n${message}\n\nType **"go"** / **"approve"** in chat to continue. Type **"abort"** to cancel.`
      );

      // INVISIBLE START: yield to the event loop so React can flush the message into
      // the chat bubble before we open the approval gate. Without this, the chat panel
      // and the input unlock may race and the user sees a blank approval prompt.
      await new Promise<void>((r) => setTimeout(r, 80));

      const { waitForApproval } = await import("@/lib/approvalGate");
      const approved = await waitForApproval();

      if (!approved) {
        context.variables.__exit__ = { type: "text", payload: "abort" };
        sendLog("🚫 Approval rejected — aborting flow.", "ERROR", current.id);
        return { type: "text", payload: "Flow aborted at approval gate." };
      }

      sendLog("✅ Approved — resuming flow.", "SUCCESS", current.id);
      return upstreamPacket || { type: "text", payload: "Approved" };
    }

    case "gatekeeper": {
      const incomingEdge = edges.find((e) => e.target === current.id);
      const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;
      const mode = current.data?.verification || "Critic AI";
      const rules = current.data?.instructions || "Check for harmful content or PII.";

      if (mode === "Human") {
        sendLog(`🛡 Gatekeeper (Human): pausing for review — "${rules}"`, "WARN", current.id);
        const { useFlowStore: _s } = await import("@/stores/flowStore");
        _s.getState().addMessage(
          "assistant",
          `🛡️ **Safety Gatekeeper**\n\nRules: ${rules}\n\nType **"go"** to approve or **"abort"** to reject.`
        );
        const { waitForApproval } = await import("@/lib/approvalGate");
        const approved = await waitForApproval();
        if (!approved) {
          context.variables.__exit__ = { type: "text", payload: "abort" };
          sendLog("🚫 Gatekeeper rejected — aborting.", "ERROR", current.id);
          return { type: "text", payload: "Content rejected by safety gatekeeper." };
        }
        sendLog("✅ Gatekeeper: content approved.", "SUCCESS", current.id);
      } else {
        sendLog(`🤖 Gatekeeper (Critic AI): auto-validating — "${rules.slice(0, 80)}${rules.length > 80 ? "…" : ""}"`, "INFO", current.id);
      }

      return upstreamPacket || { type: "text", payload: "Passed gatekeeper" };
    }

    case "vault": {
      assertTemplateDeps(current.data?.instructions, context, current.data?.label || "Vault");
      const query = current.data?.instructions
        ? current.data.instructions.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
            const val = resolveTemplatePath(path, context);
            return val != null ? getRawValue(val) : "";
          })
        : "";
      sendLog(
        `📚 Knowledge Vault: querying "${query.slice(0, 80)}${query.length > 80 ? "…" : ""}"`,
        "INFO",
        current.id
      );

      // RAG: search over knowledgeBase chunks if populated (node settings can supply them)
      const knowledgeBase: string[] = (current.data as any)?.knowledgeBase ?? [];
      if (knowledgeBase.length > 0 && query) {
        try {
          const res = await fetch("/api/vector-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, chunks: knowledgeBase, topK: 3 }),
          });
          if (res.ok) {
            const { matches } = await res.json();
            if (matches?.length > 0) {
              const context_text = matches.map((m: { text: string }) => m.text).join("\n\n---\n\n");
              sendLog(`📚 Vault: ${matches.length} chunk(s) retrieved`, "SUCCESS", current.id);
              return { type: "text", payload: context_text };
            }
          }
        } catch {
          sendLog("⚠️ Vault vector-search failed — returning raw query", "WARN", current.id);
        }
      }

      return { type: "text", payload: query ? `[Vault] ${query}` : "[Vault] No query provided" };
    }

    case "subagent":
    case "subflow": {
      const executionData =
        current.data?.workflowOverride || current.data?.localOverride;
      const incomingEdge = edges.find((e) => e.target === current.id);
      const rawSubInput = incomingEdge
        ? context.nodes[incomingEdge.source]?.payload || initialInput
        : initialInput;
      const subInput =
        typeof rawSubInput === "string"
          ? rawSubInput
          : JSON.stringify(rawSubInput);

      if (executionData && executionData.nodes && executionData.nodes.length > 0) {
        sendLog(
          `🚀 Running localized override for: ${current.data?.label}`,
          "INFO",
          current.id
        );
        const subResult = await executeGraph(
          executionData.nodes,
          executionData.edges || [],
          subInput,
          undefined,
          chatHistory
        );
        return (
          subResult.context.variables.output ||
          Object.values(subResult.context.nodes).pop() || {
            type: "text",
            payload: "Sub-agent complete",
          }
        );
      }

      if (current.data?.subflowId) {
        const agents = getSavedAgents();
        const agent = agents.find((a) => a.id === current.data?.subflowId);
        if (agent && agent.nodes && agent.nodes.length > 0) {
          sendLog(
            `🚀 Running template for: ${agent.name}`,
            "INFO",
            current.id
          );
          const subResult = await executeGraph(
            agent.nodes,
            agent.edges || [],
            subInput,
            undefined,
            chatHistory
          );
          return (
            subResult.context.variables.output ||
            Object.values(subResult.context.nodes).pop() || {
              type: "text",
              payload: "Sub-agent complete",
            }
          );
        }
      }

      return { type: "text", payload: "Sub-agent: No data found" };
    }

    case "mlmodel": {
      const { useVaultStore: _mlVs } = await import("@/stores/vaultStore");
      const _mlEntries = _mlVs.getState().entries;
      const _mlProv = current.data?.mlProvider || "huggingface";
      const _mlKeyName = _mlProv === "huggingface" ? "HUGGINGFACE_API_KEY" : "REPLICATE_API_TOKEN";
      const _mlKey = current.data?.apiKey?.trim() || _mlEntries.find((e) => e.key.toUpperCase() === _mlKeyName)?.value || "";
      if (!_mlKey) throw new Error(`ML Model: add ${_mlKeyName} to vault.`);
      const _mlEdge = edges.find((e) => e.target === current.id);
      const _mlText = _mlEdge ? getRawValue(context.nodes[_mlEdge.source]) : initialInput;
      sendLog(`🤖 ML Model [${_mlProv}] — running inference...`, "INFO", current.id);
      const { executeMLModel } = await import("@/app/actions/ml");
      const _mlRes = await executeMLModel(current.data, _mlText, _mlKey);
      sendLog(`✅ ML Model complete`, "SUCCESS", current.id);
      return _mlRes as FlowPacket;
    }

    case "imagegen": {
      const { useVaultStore: _igVs } = await import("@/stores/vaultStore");
      const _igEntries = _igVs.getState().entries;
      const _igProv = current.data?.imageProvider || "openai";
      const _igKeyName = _igProv === "openai" ? "OPENAI_API_KEY" : "REPLICATE_API_TOKEN";
      const _igKey = current.data?.apiKey?.trim() || _igEntries.find((e) => e.key.toUpperCase() === _igKeyName)?.value || "";
      if (!_igKey) throw new Error(`Image Gen: add ${_igKeyName} to vault.`);
      const _igEdge = edges.find((e) => e.target === current.id);
      const _igText = _igEdge ? getRawValue(context.nodes[_igEdge.source]) : initialInput;
      sendLog(`🎨 Image Gen [${_igProv}] — generating...`, "INFO", current.id);
      const { executeImageGen } = await import("@/app/actions/ml");
      const _igRes = await executeImageGen(current.data, _igText, _igKey);
      sendLog(`✅ Image generated`, "SUCCESS", current.id);
      return _igRes as FlowPacket;
    }

    case "rag": {
      const { useVaultStore: _ragVs } = await import("@/stores/vaultStore");
      const _ragEntries = _ragVs.getState().entries;
      const _ragKey = current.data?.apiKey?.trim() || _ragEntries.find((e) => e.key.toUpperCase() === "OPENAI_API_KEY")?.value || "";
      if (!_ragKey) throw new Error("RAG: add OPENAI_API_KEY to vault.");
      const _ragEdge = edges.find((e) => e.target === current.id);
      const _ragText = _ragEdge ? getRawValue(context.nodes[_ragEdge.source]) : initialInput;
      sendLog(`🗂️ RAG — querying knowledge base...`, "INFO", current.id);
      const { executeRAG } = await import("@/app/actions/ml");
      const _ragRes = await executeRAG({ ...current.data, ragMode: "query" }, _ragText, _ragKey);
      sendLog(`✅ RAG complete`, "SUCCESS", current.id);
      return _ragRes as FlowPacket;
    }

    case "dataanalysis": {
      const _daEdge = edges.find((e) => e.target === current.id);
      const _daText = _daEdge ? getRawValue(context.nodes[_daEdge.source]) : initialInput;
      sendLog(`📊 Data Analysis — running Python in E2B sandbox...`, "INFO", current.id);
      const { executeDataAnalysis } = await import("@/app/actions/ml");
      const _daRes = await executeDataAnalysis(current.data, _daText);
      sendLog(`✅ Chart generated`, "SUCCESS", current.id);
      return _daRes as FlowPacket;
    }

    case "speech": {
      const { useVaultStore: _spVs } = await import("@/stores/vaultStore");
      const _spEntries = _spVs.getState().entries;
      const _spProv = current.data?.speechProvider || "openai";
      const _spKeyName = _spProv === "openai" ? "OPENAI_API_KEY" : "ELEVENLABS_API_KEY";
      const _spKey = current.data?.apiKey?.trim() || _spEntries.find((e) => e.key.toUpperCase() === _spKeyName)?.value || "";
      if (!_spKey) throw new Error(`Speech: add ${_spKeyName} to vault.`);
      const _spEdge = edges.find((e) => e.target === current.id);
      const _spPacket = _spEdge ? context.nodes[_spEdge.source] : (context.variables.input || null);
      const _spText = _spPacket ? getRawValue(_spPacket) : initialInput;
      const _spAudio = (_spPacket as any)?.attachments?.find((a: any) => a.mimeType?.startsWith("audio/"));
      sendLog(`🔊 Speech [${_spProv}/${current.data?.speechMode || "tts"}] — processing...`, "INFO", current.id);
      const { executeSpeech } = await import("@/app/actions/ml");
      const _spRes = await executeSpeech(current.data, _spText, _spKey, _spAudio?.data, _spAudio?.mimeType);
      sendLog(`✅ Speech complete`, "SUCCESS", current.id);
      return _spRes as FlowPacket;
    }

    case "agentloop": {
      const _alInEdge = edges.find((e) => e.target === current.id);
      const _alUpstream = _alInEdge ? context.nodes[_alInEdge.source] : null;
      const _alTask = _alUpstream ? getRawValue(_alUpstream) : initialInput;
      const _alMaxIter = Math.min(parseInt(String(current.data?.maxIterations || "10"), 10), 15);
      const _alEnableSearch = current.data?.enableWebSearch !== false;

      const _alReactSystem = `${current.data?.systemPrompt || "You are a helpful AI agent. Complete the given task step by step."}

You have these tools available:
- web_search(query): Search the web for current information (requires TAVILY_API_KEY in vault)
- http_get(url): Fetch content from any URL or REST API endpoint
- calculate(expression): Evaluate a math expression, e.g. 15 * 4 + 100 / 2
- extract_json(path): Extract a value from the previous tool result using dot notation, e.g. data.items.0.name
- think(thought): Record your reasoning step (no external call)
- get_datetime(): Get the current date and time

Respond EXACTLY in one of these two formats:

To use a tool:
ACTION: <tool_name>
INPUT: <tool_input>

When done:
FINAL_ANSWER: <your complete answer>`;

      sendLog(`🔄 Agent Loop started — task: "${_alTask.slice(0, 80)}${_alTask.length > 80 ? "…" : ""}"`, "INFO", current.id);

      let _alJitKey: string | null = null;
      let _alProvider = "";
      try {
        const _alResolved = await resolveApiKey(current.data?.provider, current.data?.apiKey, sendLog, current.id);
        _alJitKey = _alResolved.key;
        _alProvider = _alResolved.provider;
      } catch (e: any) {
        throw new Error(`Agent Loop: ${e.message}`);
      }

      try {
        const _alModel = resolveModelChain(_alProvider, current.data?.modelName, false)[0] || MODEL_DEFAULTS[_alProvider]?.[0] || "";
        const _alHistory: ChatMessage[] = [];
        let _alLastTool = "";

        for (let _i = 0; _i < _alMaxIter; _i++) {
          sendLog(`🧠 Iteration ${_i + 1}/${_alMaxIter}`, "INFO", current.id);
          const _alMsg = _i === 0 ? _alTask : `Tool result: ${_alLastTool}\n\nContinue toward the goal.`;

          const _alResp = await dispatchLLM(
            _alProvider, _alModel, _alJitKey!, _alMsg, _alHistory,
            (msg: string, t: any) => sendLog(msg, t, current.id),
            undefined, undefined, _alReactSystem, abortSignal
          );

          _alHistory.push({ role: "user", content: _alMsg });
          _alHistory.push({ role: "assistant", content: _alResp });

          if (_alResp.includes("FINAL_ANSWER:")) {
            const _alAnswer = _alResp.split("FINAL_ANSWER:").slice(1).join("").trim();
            sendLog(`✅ Agent Loop complete in ${_i + 1} iteration(s)`, "SUCCESS", current.id);
            return { type: "text", payload: _alAnswer };
          }

          const _alActionMatch = _alResp.match(/ACTION:\s*(\w+)/);
          const _alInputMatch = _alResp.match(/INPUT:\s*([\s\S]*?)(?=\nACTION:|\nFINAL_ANSWER:|$)/);
          const _alTool = _alActionMatch?.[1]?.toLowerCase().trim();
          const _alInput = _alInputMatch?.[1]?.trim() || "";

          if (!_alTool) {
            sendLog(`✅ Agent Loop: treating as final answer`, "INFO", current.id);
            return { type: "text", payload: _alResp };
          }

          sendLog(`🔧 Tool: ${_alTool}("${_alInput.slice(0, 60)}${_alInput.length > 60 ? "…" : ""}")`, "INFO", current.id);

          if (_alTool === "think") {
            _alLastTool = `Thought: ${_alInput}`;
          } else if (_alTool === "get_datetime") {
            _alLastTool = new Date().toISOString();
            sendLog(`🕐 DateTime: ${_alLastTool}`, "INFO", current.id);
          } else if (_alTool === "calculate") {
            try {
              const _alExpr = _alInput.replace(/[^0-9+\-*/()., \t%]/g, "");
              // eslint-disable-next-line no-new-func
              const _alCalcResult = Function(`"use strict"; return (${_alExpr})`)();
              _alLastTool = String(_alCalcResult);
              sendLog(`🔢 Calculate: ${_alInput} = ${_alLastTool}`, "SUCCESS", current.id);
            } catch {
              _alLastTool = "Could not evaluate expression.";
            }
          } else if (_alTool === "http_get") {
            try {
              const _alHttpRes = await fetch(_alInput.trim());
              const _alHttpText = await _alHttpRes.text();
              _alLastTool = _alHttpText.slice(0, 3000);
              sendLog(`🌐 HTTP GET: ${_alInput.trim()} (${_alHttpText.length} chars)`, "SUCCESS", current.id);
            } catch (err: any) {
              _alLastTool = `HTTP request failed: ${err?.message ?? "unknown"}`;
              sendLog(`❌ HTTP GET failed`, "ERROR", current.id);
            }
          } else if (_alTool === "extract_json") {
            const _alColIdx = _alInput.indexOf("::");
            const _alPath = (_alColIdx !== -1 ? _alInput.slice(0, _alColIdx) : _alInput).trim();
            const _alJsonStr = _alColIdx !== -1 ? _alInput.slice(_alColIdx + 2).trim() : _alLastTool;
            try {
              let _alObj: any = JSON.parse(_alJsonStr);
              for (const _alKey of _alPath.split(".")) {
                if (_alObj == null) break;
                _alObj = Array.isArray(_alObj) ? _alObj[parseInt(_alKey, 10)] : _alObj[_alKey];
              }
              _alLastTool = _alObj === undefined ? "Key not found." : typeof _alObj === "object" ? JSON.stringify(_alObj, null, 2) : String(_alObj);
              sendLog(`📦 extract_json .${_alPath} → ${String(_alLastTool).slice(0, 60)}`, "SUCCESS", current.id);
            } catch {
              _alLastTool = "Invalid JSON or path.";
            }
          } else if (_alTool === "web_search" && _alEnableSearch) {
            const { useVaultStore: _alVs } = await import("@/stores/vaultStore");
            const _alTavily = _alVs.getState().entries.find((e) => e.key.toUpperCase() === "TAVILY_API_KEY")?.value;
            if (_alTavily) {
              try {
                const _alSRes = await fetch("https://api.tavily.com/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ api_key: _alTavily, query: _alInput, max_results: 3 }),
                });
                const _alSData = await _alSRes.json();
                _alLastTool = (_alSData.results ?? []).map((r: any) => `${r.title}: ${String(r.content || "").slice(0, 200)}`).join("\n\n") || "No results.";
                sendLog(`🔍 Web search: ${_alSData.results?.length ?? 0} result(s)`, "SUCCESS", current.id);
              } catch {
                _alLastTool = "Search failed. Using available knowledge.";
              }
            } else {
              _alLastTool = "No TAVILY_API_KEY in vault — add it to enable web search.";
              sendLog("⚠️ TAVILY_API_KEY not found — web_search skipped", "WARN", current.id);
            }
          } else {
            _alLastTool = `Tool "${_alTool}" not available.`;
          }
        }

        sendLog(`⚠️ Agent Loop: max iterations (${_alMaxIter}) reached`, "WARN", current.id);
        return { type: "text", payload: `Agent reached max iterations. Last result: ${_alLastTool || "No output."}` };
      } finally {
        _alJitKey = null;
      }
    }

    case "mobileagent": {
      const _maInEdge = edges.find((e) => e.target === current.id);
      const _maUpstream = _maInEdge ? context.nodes[_maInEdge.source] : null;
      const _maTask = _maUpstream ? getRawValue(_maUpstream) : initialInput;

      const _maEnvs: Array<{ name: string; type: string; task: string }> =
        current.data?.environments?.length
          ? current.data.environments
          : [
              { name: "Stage 1", type: "e2b_python", task: "Analyze the given task and extract key insights" },
              { name: "Stage 2", type: "e2b_python", task: "Synthesize the findings into a structured report" },
            ];

      sendLog(`🚀 Mobile Agent: ${_maEnvs.length} isolated stage(s) — only output forwards between stages`, "INFO", current.id);

      let _maJitKey: string | null = null;
      let _maApiKey = "";
      try {
        const _maResolved = await resolveApiKey(current.data?.provider, current.data?.apiKey, sendLog, current.id);
        _maJitKey = _maResolved.key;
        _maApiKey = _maResolved.key;
      } catch {
        sendLog("⚠️ No API key — Mobile Agent LLM calls will fail in sandbox", "WARN", current.id);
      }

      const _maState: Record<string, string> = {};

      try {
        const { MOBILE_AGENT_INTERPRETER } = await import("@/lib/sandbox/mobileAgentInterpreter");
        const { executeMobileAgentStep } = await import("@/app/actions/ml");

        for (let _mi = 0; _mi < _maEnvs.length; _mi++) {
          const _env = _maEnvs[_mi];
          // Only forward the previous stage's output — not the full state object.
          // This is the isolation guarantee: each stage sees only what the last stage emitted.
          const _prevOutput = _mi === 0 ? _maTask : (_maState[_maEnvs[_mi - 1].name] ?? _maTask);

          sendLog(`✈️  Stage ${_mi + 1}/${_maEnvs.length}: "${_env.name}" (${_env.type}) — fresh isolated sandbox`, "INFO", current.id);
          sendLog(`📥 Input from ${_mi === 0 ? "upstream node" : `"${_maEnvs[_mi - 1].name}"`}: ${_prevOutput.slice(0, 100)}${_prevOutput.length > 100 ? "…" : ""}`, "INFO", current.id);

          const _envVars = [
            `import os`,
            `os.environ['MOBILE_AGENT_STATE'] = ${JSON.stringify(JSON.stringify({ results: { previous: _prevOutput } }))}`,
            `os.environ['MOBILE_AGENT_TASK'] = ${JSON.stringify(_env.task + "\n\nInput data:\n" + _prevOutput)}`,
            `os.environ['MOBILE_AGENT_API_KEY'] = ${JSON.stringify(_maApiKey)}`,
            `os.environ['MOBILE_AGENT_ENV_NAME'] = ${JSON.stringify(_env.name)}`,
            `os.environ['MOBILE_AGENT_FLOW'] = '{}'`,
          ].join("\n");

          const _script = _envVars + "\n\n" + MOBILE_AGENT_INTERPRETER;

          try {
            const { output: _rawOut } = await executeMobileAgentStep(_script, "python");
            const _lastLine = _rawOut.trim().split("\n").pop() || "{}";
            let _stageOutput = _rawOut.trim();
            try {
              const _parsed = JSON.parse(_lastLine);
              if (_parsed.output) _stageOutput = _parsed.output;
              else if (_parsed.state?.results?.previous) _stageOutput = _parsed.state.results.previous;
            } catch { /* use raw output */ }
            _maState[_env.name] = _stageOutput;
            sendLog(`✅ "${_env.name}" complete — output isolated, forwarding to next stage`, "SUCCESS", current.id);
          } catch (err: any) {
            sendLog(`❌ "${_env.name}" failed: ${err.message}`, "ERROR", current.id);
            _maState[_env.name] = `Error in stage "${_env.name}": ${err.message}`;
          }
        }

        const _lastStage = _maEnvs[_maEnvs.length - 1];
        const _maFinalOutput = _maState[_lastStage.name] ?? "No output produced.";
        sendLog(`🏠 Mobile Agent complete — ${_maEnvs.length} isolated stage(s) executed`, "SUCCESS", current.id);
        return { type: "text", payload: _maFinalOutput };

      } finally {
        _maJitKey = null;
      }
    }

    case "parallelmap": {
      const _pmInEdge = edges.find((e) => e.target === current.id);
      const _pmUpstream = _pmInEdge ? context.nodes[_pmInEdge.source] : null;
      const _pmRaw: string = _pmUpstream ? getRawValue(_pmUpstream) : initialInput;

      const _pmSeparator: string = current.data?.separator || "newline";
      const _pmPromptTemplate: string = current.data?.itemPrompt || "Process this item: {item}";
      const _pmConcurrency: number = Math.min(Math.max(Number(current.data?.concurrency) || 3, 1), 10);
      const _pmOutputFormat: string = current.data?.outputFormat || "numbered";

      // Split input into items
      let _pmItems: string[] = [];
      if (_pmSeparator === "newline") {
        _pmItems = _pmRaw.split("\n").map(s => s.trim()).filter(Boolean);
      } else if (_pmSeparator === "comma") {
        _pmItems = _pmRaw.split(",").map(s => s.trim()).filter(Boolean);
      } else if (_pmSeparator === "json") {
        try { _pmItems = JSON.parse(_pmRaw); } catch { _pmItems = [_pmRaw]; }
      } else if (_pmSeparator === "sentence") {
        _pmItems = _pmRaw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
      }

      if (_pmItems.length === 0) {
        sendLog("⚠️ Parallel Map: no items found in input", "WARN", current.id);
        return { type: "text", payload: "No items to process." };
      }

      sendLog(`🔀 Parallel Map: ${_pmItems.length} items, concurrency=${_pmConcurrency}`, "INFO", current.id);

      // Resolve API key once
      let _pmKey = "";
      let _pmProvider = "";
      try {
        const _pmVault = await resolveApiKey(undefined, undefined, sendLog, current.id);
        _pmKey = _pmVault.key;
        _pmProvider = _pmVault.provider;
      } catch (err: any) {
        return { type: "text", payload: `Parallel Map failed: ${err.message}` };
      }

      const _pmResults: string[] = new Array(_pmItems.length).fill("");

      // Process in batches of _pmConcurrency
      for (let _pmBatch = 0; _pmBatch < _pmItems.length; _pmBatch += _pmConcurrency) {
        const _pmSlice = _pmItems.slice(_pmBatch, _pmBatch + _pmConcurrency);
        sendLog(`⚡ Batch ${Math.floor(_pmBatch / _pmConcurrency) + 1}: processing items ${_pmBatch + 1}–${_pmBatch + _pmSlice.length}`, "INFO", current.id);
        await Promise.all(
          _pmSlice.map(async (item, offset) => {
            const idx = _pmBatch + offset;
            const prompt = _pmPromptTemplate.replace(/\{item\}/g, item);
            try {
              const result = await dispatchLLM(_pmProvider, "", _pmKey, prompt, [], (msg: string, t: any) => sendLog(msg, t, current.id));
              _pmResults[idx] = result.trim();
              sendLog(`✅ Item ${idx + 1} done`, "SUCCESS", current.id);
            } catch (err: any) {
              _pmResults[idx] = `Error: ${err.message}`;
              sendLog(`❌ Item ${idx + 1} failed: ${err.message}`, "ERROR", current.id);
            }
          })
        );
      }

      let _pmFinal: string;
      if (_pmOutputFormat === "json") {
        _pmFinal = JSON.stringify(_pmResults, null, 2);
      } else if (_pmOutputFormat === "concat") {
        _pmFinal = _pmResults.join("\n\n");
      } else {
        _pmFinal = _pmResults.map((r, i) => `${i + 1}. ${r}`).join("\n\n");
      }

      sendLog(`✅ Parallel Map complete — ${_pmItems.length} items processed`, "SUCCESS", current.id);
      return { type: "text", payload: _pmFinal };
    }

    default: {
      return { type: "text", payload: `Executed ${current.type}` };
    }
  }
  } catch (err: any) {
    const nodeLabel = (current.data as any)?.label || current.type || current.id;
    const errMsg: string = err?.message || String(err);
    sendLog(`❌ ${nodeLabel}: ${errMsg}`, "ERROR", current.id);
    return { type: "text", payload: `[Error: ${errMsg}]`, error: errMsg };
  }
}

// ─────────────────────────────────────────────────────────────────────
// buildDependencyMap — exported utility for the store / UI
// Returns nodeId → [parentNodeIds] for every node.
// ─────────────────────────────────────────────────────────────────────
export function buildDependencyMap(edges: Edge[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  edges.forEach((e) => {
    if (!map[e.target]) map[e.target] = [];
    map[e.target].push(e.source);
  });
  return map;
}

// ═════════════════════════════════════════════════════════════════════
// REACTIVE ENGINE — Smart Merge Mode (Event-Driven Choreography)
//
// Architecture: pure event-driven dispatch. Each node fires when ALL
// predecessor edges have resolved (success OR skipped/failed).
//
// Guarantees:
//   1. A node is skipped ONLY when ALL of its parents were skipped/failed.
//      If even ONE parent succeeded, the node runs using available data.
//   2. Multi-branch merges work correctly: a node fed by a skipped branch
//      AND an active branch will wait for both, then dispatch normally.
//   3. Router/decision nodes resolve each child edge independently —
//      selected route → "success" contribution, other routes → "skipped"
//      contribution — so only true dead-ends propagate the skip.
//   4. Failed nodes act like skipped nodes for downstream merging:
//      descendants can still run if they have other live parents.
//   5. Exit signal: newly ready nodes are not started; in-flight nodes
//      complete normally.
// ═════════════════════════════════════════════════════════════════════
export async function executeGraph(
  _nodes: Node<NodeData>[],
  edges: Edge[],
  initialInput: string,
  onLog?: LogFn,
  chatHistory: ChatMessage[] = [],
  options: WalkerOptions = {},
  seedContext?: ExecutionContext
): Promise<{ success: boolean; context: ExecutionContext; logs: string[] }> {
  const context: ExecutionContext = {
    variables: {
      ...seedContext?.variables,
      input: seedContext?.variables?.input ?? { type: "text", payload: initialInput },
    },
    nodes: { ...seedContext?.nodes },
  };
  const logs: string[] = [];

  const sendLog: LogFn = (message, type = "INFO", nodeId) => {
    logs.push(`[${type}] ${message}`);
    onLog?.(message, type, nodeId);
  };

  const { onNodeStatusChange, onNodeComplete, isDryRun } = options;

  sendLog("🚀 Reactive Engine started (Smart Merge mode)...", "INFO");

  // Strip zombie nodes — nodes that have no edges at all when the graph has edges.
  // This prevents stale nodes from prior flows from being dispatched as spurious roots.
  const connectedNodeIds = edges.length > 0
    ? new Set(edges.flatMap((e) => [e.source, e.target]))
    : null;
  const nodes = (connectedNodeIds
    ? _nodes.filter((n) => connectedNodeIds.has(n.id))
    : _nodes);

  // ─── 1. Build adjacency, dep counts, and per-child parent-outcome tracking ───
  const adj = new Map<string, string[]>();          // parent → [children]
  const remainingDeps = new Map<string, number>();  // child → unresolved parent count

  // For each child: which parents resolved as success vs skipped/failed.
  // A child dispatches only when remainingDeps reaches 0 AND succeeded.size > 0.
  const parentOutcomes = new Map<string, {
    succeeded: Set<string>;
    skippedOrFailed: Set<string>;
  }>();

  nodes.forEach((n) => {
    adj.set(n.id, []);
    remainingDeps.set(n.id, 0);
  });
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    remainingDeps.set(e.target, (remainingDeps.get(e.target) || 0) + 1);
    if (!parentOutcomes.has(e.target)) {
      parentOutcomes.set(e.target, { succeeded: new Set(), skippedOrFailed: new Set() });
    }
  });

  const executed = new Set<string>();
  const skipped  = new Set<string>();
  const inflight = new Set<string>();
  const nodeById = new Map<string, Node<NodeData>>();
  nodes.forEach((n) => nodeById.set(n.id, n));

  // ─── 2. Completion gate ───
  let pendingCount = 0;
  let resolveAll!: () => void;
  const allDone = new Promise<void>((res) => { resolveAll = res; });

  function checkDone() {
    if (pendingCount !== 0 || inflight.size !== 0) return;
    const unreachable = nodes.filter(
      (n) => !executed.has(n.id) && !skipped.has(n.id)
    );
    if (unreachable.length > 0) {
      sendLog(
        `⚠️ ${unreachable.length} node(s) unreachable (disconnected or cycle): ` +
        unreachable.map((n) => resolveNodeLabel(n)).join(", "),
        "WARN"
      );
    }
    resolveAll();
  }

  // ─── 3. Smart merge resolution ───
  // Called by every node (or router edge) when it resolves.
  // Tracks per-child parent outcomes; decides dispatch vs. skip only when
  // the last unresolved parent for that child reports in.
  function resolveParentForChild(
    parentId: string,
    childId: string,
    outcome: "success" | "skipped"
  ) {
    const outcomes = parentOutcomes.get(childId);
    if (!outcomes) return; // root nodes have no parent tracking

    if (outcome === "success") {
      outcomes.succeeded.add(parentId);
    } else {
      outcomes.skippedOrFailed.add(parentId);
    }

    const newDeps = (remainingDeps.get(childId) || 1) - 1;
    remainingDeps.set(childId, newDeps);

    if (newDeps === 0) {
      decideChild(childId);
    }
  }

  // Called when a child's last parent has resolved.
  // Sink nodes (output type) always dispatch — they collect the full flow report.
  // Non-sink nodes dispatch if ≥1 parent succeeded; skip and cascade otherwise.
  function decideChild(childId: string) {
    const child = nodeById.get(childId);
    if (!child || executed.has(childId) || skipped.has(childId) || inflight.has(childId)) return;

    const isSink = child.type === "output";

    const outcomes = parentOutcomes.get(childId) || {
      succeeded: new Set<string>(),
      skippedOrFailed: new Set<string>(),
    };

    const allParentsInactive = outcomes.succeeded.size === 0;
    const shouldSkip = !isSink && (context.variables.__exit__ || allParentsInactive);

    if (shouldSkip) {
      skipped.add(childId);
      onNodeStatusChange?.(childId, "skipped");
      sendLog(
        `⏭ "${resolveNodeLabel(child)}" skipped — no active paths reached this node`,
        "WARN",
        childId
      );
      // Cascade: notify this node's children so they can make their own decision
      for (const grandchildId of adj.get(childId) || []) {
        resolveParentForChild(childId, grandchildId, "skipped");
      }
    } else {
      // Inject ghost empty packets for any refs that were on pruned branches
      // so assertTemplateDeps doesn't throw for legitimately skipped upstream nodes.
      const template =
        (child.data as any)?.instructions ||
        (child.data as any)?.resultFormat || "";
      for (const m of template.matchAll(/\{\{([^}]+)\}\}/g)) {
        const ref = (m[1] as string).trim().split(".")[0];
        if ((skipped.has(ref) || executed.has(ref)) && !context.nodes[ref] && !context.variables[ref]) {
          context.nodes[ref] = { type: "text", payload: "" };
        }
      }
      dispatchNode(child);
    }
  }

  // ─── 4. Node dispatcher ───
  function dispatchNode(node: Node<NodeData>) {
    if (executed.has(node.id) || skipped.has(node.id) || inflight.has(node.id)) return;

    const isSink = node.type === "output";

    // Sink nodes bypass the exit signal — they always run to produce the flow report.
    if (context.variables.__exit__ && !isSink) {
      sendLog(`🛑 Exit signal — skipping ${resolveNodeLabel(node)}`, "WARN", node.id);
      skipped.add(node.id);
      onNodeStatusChange?.(node.id, "skipped");
      for (const childId of adj.get(node.id) || []) {
        resolveParentForChild(node.id, childId, "skipped");
      }
      return;
    }

    inflight.add(node.id);
    pendingCount++;
    onNodeStatusChange?.(node.id, "running");
    sendLog(`⚡ Dispatching: ${resolveNodeLabel(node)}`, "INFO", node.id);

    if (options.abortSignal?.aborted) {
      skipped.add(node.id);
      onNodeStatusChange?.(node.id, "skipped");
      pendingCount--; inflight.delete(node.id);
      checkDone();
      return;
    }
    executeNode(node, context, edges, initialInput, chatHistory, sendLog, isDryRun, options.abortSignal)
      .then((packet) => {
        context.nodes[node.id] = packet;
        executed.add(node.id);
        onNodeComplete?.(node.id, packet);

        if (packet.error) {
          onNodeStatusChange?.(node.id, "error");
          for (const childId of adj.get(node.id) || []) {
            resolveParentForChild(node.id, childId, "skipped");
          }
          return;
        }

        onNodeStatusChange?.(node.id, "success");
        sendLog(`✅ Completed: ${resolveNodeLabel(node)}`, "SUCCESS", node.id);

        if (node.type === "router" || node.type === "decision") {
          // Per-edge resolution: only the selected handle contributes "success".
          // Non-selected handles contribute "skipped" — but if that child node also
          // has another active parent, it will still run (smart merge).
          const selectedHandle =
            ((packet as any).meta?.selectedRoute as string | undefined)?.toLowerCase().trim() || "";
          for (const childId of adj.get(node.id) || []) {
            const connectingEdge = edges.find(
              (e) => e.source === node.id && e.target === childId
            );
            // If an edge has no sourceHandle set, treat it as a default/passthrough edge
            // and never deactivate it — avoids "handle '' not selected" false negatives.
            const rawHandle = connectingEdge?.sourceHandle;
            const edgeHandle = rawHandle?.toLowerCase().trim() || null;
            const isSelected =
              !selectedHandle ||   // router produced no route signal → all branches active
              !edgeHandle ||       // edge has no handle → always active (default/passthrough)
              edgeHandle === selectedHandle;
            if (!isSelected) {
              sendLog(
                `✂️ Branch deactivated: "${nodeById.get(childId)?.data?.label || childId}" ` +
                `(handle "${edgeHandle}" not selected; active: "${selectedHandle}")`,
                "INFO",
                childId
              );
            }
            resolveParentForChild(node.id, childId, isSelected ? "success" : "skipped");
          }
        } else {
          // Normal node: all children receive a "success" contribution
          for (const childId of adj.get(node.id) || []) {
            resolveParentForChild(node.id, childId, "success");
          }
        }
      })
      .catch((err) => {
        const errMsg = (err as Error)?.message || String(err);
        const isAbort = (err as Error)?.name === "AbortError";
        if (isAbort) {
          sendLog(`🛑 Run stopped by user`, "WARN", node.id);
          onNodeStatusChange?.(node.id, "skipped");
        } else {
          sendLog(`❌ Error in ${resolveNodeLabel(node)}: ${errMsg}`, "ERROR", node.id);
          onNodeStatusChange?.(node.id, "error");
        }

        const errorPacket = { type: "text" as const, payload: isAbort ? "[Stopped]" : `[Error: ${errMsg}]`, error: errMsg };
        context.nodes[node.id] = errorPacket;
        executed.add(node.id);
        onNodeComplete?.(node.id, errorPacket);

        for (const childId of adj.get(node.id) || []) {
          resolveParentForChild(node.id, childId, "success");
        }
      })
      .finally(() => {
        inflight.delete(node.id);
        pendingCount--;
        checkDone();
      });
  }

  // ─── 5. Seed: dispatch all root nodes immediately ───
  const roots = nodes.filter((n) => remainingDeps.get(n.id) === 0);

  if (roots.length === 0) {
    sendLog("No root nodes found — all nodes have dependencies (possible cycle).", "ERROR");
    return { success: false, context, logs };
  }

  sendLog(
    `📋 Root nodes: ${roots.map((n) => resolveNodeLabel(n)).join(", ")}`,
    "INFO"
  );

  roots.forEach((root) => dispatchNode(root));

  // Safety: if all roots were synchronously skipped (e.g. exit signal pre-set)
  if (pendingCount === 0 && inflight.size === 0) resolveAll();

  // ─── 6. Await all async chains to settle ───
  await allDone;

  const hasSkipped = skipped.size > 0;
  sendLog(
    hasSkipped
      ? "🏁 Flow finished — some branches were inactive (expected for conditional flows)."
      : "🏁 Flow execution finished successfully.",
    hasSkipped ? "WARN" : "SUCCESS"
  );

  return { success: !hasSkipped, context, logs };
}
