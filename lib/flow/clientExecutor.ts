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

  // 2. Scan the vault for any non-empty entry
  const { useVaultStore } = await import("@/stores/vaultStore");
  const allEntries = useVaultStore
    .getState()
    .entries.filter((e) => e.value?.trim());

  if (allEntries.length === 0) {
    throw new Error(
      "No API key found in Secret Vault. " +
      "Open the Vault panel and add a Gemini, OpenAI, Groq, or Anthropic key."
    );
  }

  const effectiveProvider =
    !requestedProvider || requestedProvider === "auto" ? null : requestedProvider;

  if (effectiveProvider) {
    // Try to find a vault entry whose key VALUE prefix matches the requested provider
    const match = allEntries.find(
      (e) => detectProvider(e.value) === effectiveProvider
    );
    if (match) {
      onLog(
        `🔑 Auth: Vault Key "${match.key}" → ${effectiveProvider.toUpperCase()}`,
        "INFO",
        nodeId
      );
      return { key: match.value, provider: effectiveProvider };
    }
    // Requested provider not in vault — fall through and auto-select
    onLog(
      `⚠️ No ${effectiveProvider.toUpperCase()} key in vault — auto-selecting best available`,
      "WARN",
      nodeId
    );
  }

  // 3. Auto-select: first vault entry wins; infer provider from its value
  const best = allEntries[0];
  const autoProvider = detectProvider(best.value);
  onLog(
    `🔑 Auth: Auto-selected "${best.key}" → ${autoProvider.toUpperCase()}`,
    "INFO",
    nodeId
  );
  return { key: best.value, provider: autoProvider };
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

const detectProvider = (key: string): string => {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-")) return "openai";
  if (key.startsWith("AIza")) return "gemini";
  return "gemini"; // default for any other format (e.g. older Gemini key formats)
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
  onCost?: (amount: number) => void
): Promise<string> {
  const provider = providerKey || detectProvider(apiKey);
  const turnCount = conversationHistory.length + 1;
  onLog(
    `📡 Dispatching to ${provider.toUpperCase()} — ${turnCount} message(s) in context...`,
    "INFO"
  );

  const SYSTEM_PROMPT =
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
        ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
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
        ...conversationHistory.map((m) => ({
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
        ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
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
  if (typeof val === "string") return val;
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
  isDryRun?: boolean
): Promise<FlowPacket> {
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

      // C. Variable resolution via {{key}} / {{key.property}}
      // ".output" is a semantic alias for ".payload" — architect-generated instructions
      // often write {{researcher.output}} but FlowPackets store their content in .payload.
      const resolvedPrompt = rawPrompt.replace(
        /\{\{(.*?)\}\}/g,
        (_: string, path: string) => {
          const val = resolveTemplatePath(path, prunedContext);
          return val != null ? getRawValue(val) : "";
        }
      );

      // D. Full conversation history — passed as native API message arrays by
      //    dispatchLLM; no string-concatenation, no turn cap.
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
                resolvedPrompt,
                chatHistory,
                (msg, type) => sendLog(msg, type, current.id),
                inputAttachments,
                async (cost) => {
                  const { useCostStore } = await import("@/stores/useCostStore");
                  useCostStore.getState().addCost(cost);
                }
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

      // F. Exit keyword detection — only triggers if EXIT or STOP is the entire message.
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
      const inputNodeId = edges.find((e) => e.target === current.id)?.source;
      const inputData = inputNodeId ? context.nodes[inputNodeId] : null;
      return {
        type: "text",
        payload: `Processed: ${JSON.stringify(inputData?.payload || "")}`,
      };
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

      sendLog(
        `🔌 App Action [${appProvider}/${appAction}] — dispatching via server action`,
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

      // Token lives server-side only — delegated to the server action
      const { executeAppAction } = await import("@/app/actions/integration");
      const { result } = await executeAppAction(appProvider, appAction, resolvedInputs);

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

    default: {
      return { type: "text", payload: `Executed ${current.type}` };
    }
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
  nodes: Node<NodeData>[],
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
        unreachable.map((n) => n.data?.label || n.id).join(", "),
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
        `⏭ "${child.data?.label || childId}" skipped — no active paths reached this node`,
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
      sendLog(`🛑 Exit signal — skipping ${node.data?.label || node.id}`, "WARN", node.id);
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
    sendLog(`⚡ Dispatching: ${node.data?.label || node.id}`, "INFO", node.id);

    executeNode(node, context, edges, initialInput, chatHistory, sendLog, isDryRun)
      .then((packet) => {
        context.nodes[node.id] = packet;
        executed.add(node.id);
        onNodeStatusChange?.(node.id, "success");
        onNodeComplete?.(node.id, packet);
        sendLog(`✅ Completed: ${node.data?.label || node.id}`, "SUCCESS", node.id);

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
        sendLog(`❌ Error in ${node.data?.label || node.id}: ${errMsg}`, "ERROR", node.id);
        onNodeStatusChange?.(node.id, "error");

        // Store an error packet so downstream nodes (especially sinks) can reference
        // this node's output without crashing — they'll read the error message as text.
        const errorPacket = { type: "text" as const, payload: `[Error: ${errMsg}]`, error: errMsg };
        context.nodes[node.id] = errorPacket;
        executed.add(node.id);
        onNodeComplete?.(node.id, errorPacket);

        // Contribute "success" to children so they are not pruned solely because
        // this node failed — the error packet is valid data they can act on.
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
    `📋 Root nodes: ${roots.map((n) => n.data?.label || n.id).join(", ")}`,
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
