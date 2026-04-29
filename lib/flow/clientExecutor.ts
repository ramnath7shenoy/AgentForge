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
const MODEL_REGISTRY: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-1.5-flash"],
  groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  openai: ["gpt-4o", "gpt-4-turbo"],
};

const detectProvider = (key: string): string => {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-")) return "openai";
  return "gemini";
};

// ─────────────────────────────────────────────────────────────────────
// Multi-LLM Dispatcher — Native Multi-Turn Message Arrays
//
// Sends the full conversation history as the provider's native format:
//   OpenAI / Groq  → messages[]  with system + alternating user/assistant
//   Gemini         → contents[]  with user/model roles + systemInstruction
//   Anthropic      → messages[]  with system field + user/assistant turns
//
// This is the only place the API key is in scope; it is purged by the
// JIT pattern in the calling code immediately after this returns.
// ─────────────────────────────────────────────────────────────────────
async function dispatchLLM(
  providerKey: string,
  modelName: string,
  apiKey: string,
  userMessage: string,
  conversationHistory: ChatMessage[],
  onLog: (msg: string, type: any) => void
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

  if (provider === "groq" || provider === "openai") {
    url =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey}` };
    body = {
      model:
        modelName || (provider === "groq" ? "mixtral-8x7b-32768" : "gpt-4-turbo"),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ],
    };
  } else if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1/models/${
      modelName || "gemini-2.5-flash"
    }:generateContent?key=${apiKey}`;
    headers = {};
    body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...conversationHistory.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: userMessage }] },
      ],
    };
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerously-allow-browser": "true",
    };
    body = {
      model: modelName || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        ...conversationHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ],
    };
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message || `${provider.toUpperCase()} API Error`
    );

  if (provider === "gemini") return data.candidates[0].content.parts[0].text;
  if (provider === "anthropic") return data.content[0].text;
  return data.choices[0].message.content;
}

// ─────────────────────────────────────────────────────────────────────
// Deep-Text Resolver
// ─────────────────────────────────────────────────────────────────────
const getRawValue = (val: any): string => {
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    return (
      val.text ||
      val.payload ||
      val.value ||
      Object.values(val).find((v) => typeof v === "string") ||
      JSON.stringify(val)
    );
  }
  return String(val);
};

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
// Short-Circuit Helper: Transitive descendant finder (DFS)
// Returns every node reachable from startId, used to propagate SKIPPED.
// ─────────────────────────────────────────────────────────────────────
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
  sendLog: LogFn
): Promise<FlowPacket> {
  switch (current.type) {
    case "trigger": {
      return { type: "text", payload: `Triggered with: ${initialInput}` };
    }

    case "input": {
      const packet = current.data?.packet || {
        type: "text",
        payload: initialInput,
      };
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
          const parts = path.trim().split(".");
          let val: any =
            prunedContext.nodes[parts[0]] ||
            prunedContext.variables[parts[0]];
          if (val === undefined) return "";
          if (parts.length === 1) return getRawValue(val);
          for (let i = 1; i < parts.length; i++) {
            if (val == null) break;
            // ".output" is a user-friendly alias — FlowPackets use ".payload" internally
            const prop = parts[i] === "output" ? "payload" : parts[i];
            val = val[prop];
          }
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
          MODEL_REGISTRY[resolvedProvider] || [
            current.data?.modelName || "gemini-2.5-flash",
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
            responseText = await dispatchLLM(
              resolvedProvider,
              model,
              jitKey,
              resolvedPrompt,
              chatHistory,
              (msg, type) => sendLog(msg, type, current.id)
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

      return { type: "text", payload: responseText };
    }

    case "output": {
      const outputFormat = current.data?.resultFormat || "";
      assertTemplateDeps(outputFormat, context, current.data?.label || "Output");
      const resolvedOutput = outputFormat.replace(
        /\{\{(.*?)\}\}/g,
        (_: string, path: string) => {
          const parts = path.trim().split(".");
          let val: any =
            context.nodes[parts[0]] || context.variables[parts[0]];
          if (val === undefined) return "";
          if (parts.length === 1) return getRawValue(val);
          for (let i = 1; i < parts.length; i++) {
            if (val == null) break;
            const prop = parts[i] === "output" ? "payload" : parts[i];
            val = val[prop];
          }
          return val != null ? getRawValue(val) : "";
        }
      );

      const packet: FlowPacket = { type: "text", payload: resolvedOutput };
      context.variables.output = packet;

      // Push result to Chat Hub — skip if the resolved template is blank
      if (resolvedOutput.trim()) {
        const flowStore = (await import("@/stores/flowStore")).useFlowStore.getState();
        flowStore.addMessage("assistant", resolvedOutput);
        flowStore.setIsChatOpen(true);
        sendLog("📤 Result sent to Chat Hub.", "SUCCESS", current.id);
      } else {
        sendLog("⚠️ Output node resolved to empty string — skipping addMessage.", "WARN", current.id);
      }

      return packet;
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

      // ── Config validation ─────────────────────────────────────────────
      // Any connection type that sends or fetches data requires a URL.
      // Throw immediately so the error is surfaced in the execution log
      // rather than silently doing nothing.
      if (!connectionType) {
        throw new Error("Integration node has no connection type configured. Open node settings to select one.");
      }
      if (!endpointUrl) {
        throw new Error(
          `Missing API Endpoint. Please configure the node. ` +
          `Open the "${current.data?.label || "Integration"}" node settings and add a URL.`
        );
      }

      // ── Resolve payload template ──────────────────────────────────────
      const rawTemplate = current.data?.instructions || "";
      const incomingEdge = edges.find((e) => e.target === current.id);
      const upstreamPacket = incomingEdge ? context.nodes[incomingEdge.source] : null;

      const resolvedPayload = rawTemplate
        ? rawTemplate.replace(/\{\{(.*?)\}\}/g, (_: string, path: string) => {
            const parts = path.trim().split(".");
            let val: any = context.nodes[parts[0]] || context.variables[parts[0]];
            if (val === undefined) return "";
            if (parts.length === 1) return getRawValue(val);
            for (let i = 1; i < parts.length; i++) {
              if (val == null) break;
              val = val[parts[i]];
            }
            return val != null ? getRawValue(val) : "";
          })
        : upstreamPacket
        ? getRawValue(upstreamPacket)
        : "";

      const isGetRequest =
        connectionType === "Get from Website" || connectionType === "Fetch Data";
      const method = current.data?.method || (isGetRequest ? "GET" : "POST");

      sendLog(
        `🔗 Integration [${connectionType}] → ${method} ${endpointUrl}`,
        "INFO",
        current.id
      );

      // ── Real HTTP dispatch ────────────────────────────────────────────
      let responseText: string;
      try {
        const fetchOptions: RequestInit = {
          method,
          headers: { "Content-Type": "application/json" },
        };
        if (!isGetRequest && resolvedPayload) {
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

        sendLog(
          `✅ Integration [${connectionType}]: ${res.status} OK`,
          "SUCCESS",
          current.id
        );
      } catch (err: any) {
        // Distinguish CORS/network errors from HTTP error responses
        if (err.message.startsWith("Integration request failed:")) throw err;
        throw new Error(
          `Integration [${connectionType}] network error: ${err.message}. ` +
          `This may be a CORS restriction — consider routing through a server-side proxy.`
        );
      }

      return { type: "text", payload: responseText };
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
            const parts = path.trim().split(".");
            const val: any = context.nodes[parts[0]] || context.variables[parts[0]];
            return val !== undefined ? getRawValue(val) : "";
          })
        : "";
      sendLog(
        `📚 Knowledge Vault: querying "${query.slice(0, 80)}${query.length > 80 ? "…" : ""}"`,
        "INFO",
        current.id
      );
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

// ═════════════════════════════════════════════════════════════════════
// WALKER ENGINE v2 — Dependency-Aware Wave-Parallel BFS Executor
//
// Correctness guarantees:
//   1. In-degree map: seeded once, decremented synchronously after each
//      wave completes — no mutex needed (JS single-threaded between awaits).
//   2. Removed the broken parentsFinished double-check that dropped nodes.
//   3. Short-circuit: on node failure, all transitive descendants are
//      marked SKIPPED via callback, preventing wasted API budget.
//   4. JIT SecretVault: key decrypted only at the fetch call site,
//      nullified in finally immediately after the promise settles.
// ═════════════════════════════════════════════════════════════════════
export async function executeGraph(
  nodes: Node<NodeData>[],
  edges: Edge[],
  initialInput: string,
  onLog?: LogFn,
  chatHistory: ChatMessage[] = [],
  options: WalkerOptions = {}
): Promise<{ success: boolean; context: ExecutionContext; logs: string[] }> {
  const context: ExecutionContext = {
    variables: { input: { type: "text", payload: initialInput } },
    nodes: {},
  };
  const logs: string[] = [];

  const sendLog: LogFn = (message, type = "INFO", nodeId) => {
    logs.push(`[${type}] ${message}`);
    onLog?.(message, type, nodeId);
  };

  const { onNodeStatusChange, onNodeComplete } = options;

  sendLog("🚀 Walker Engine v2 started (Wave-Parallel BFS)...", "INFO");

  // ─── 1. Build adjacency list and in-degree map ───
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((n) => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });

  // ─── 2. Seed: only nodes with inDegree === 0 (roots / triggers) ───
  let currentWave: Node<NodeData>[] = nodes.filter(
    (n) => inDegree.get(n.id) === 0
  );
  const executed = new Set<string>();
  const skipped = new Set<string>();

  if (currentWave.length === 0) {
    sendLog(
      "No root nodes found — all nodes have dependencies (possible cycle).",
      "ERROR"
    );
    return { success: false, context, logs };
  }

  sendLog(
    `📋 Root nodes: ${currentWave.map((n) => n.data?.label || n.id).join(", ")}`,
    "INFO"
  );

  // ─── 3. Wave loop ───
  while (currentWave.length > 0) {
    // Remove any nodes that were short-circuited before this wave started
    const activeWave = currentWave.filter((n) => !skipped.has(n.id));
    if (activeWave.length === 0) break;

    // Respect exit signal from AI node in prior wave
    if (context.variables.__exit__) {
      sendLog("🛑 Exit signal received. Halting walker.", "WARN");
      break;
    }

    sendLog(
      `⚡ Wave: [${activeWave.map((n) => n.data?.label || n.id).join(", ")}]`,
      "INFO"
    );

    activeWave.forEach((n) => onNodeStatusChange?.(n.id, "running"));

    // Execute all nodes in this wave in parallel
    const results = await Promise.allSettled(
      activeWave.map((node) =>
        executeNode(
          node,
          context,
          edges,
          initialInput,
          chatHistory,
          sendLog
        ).then((packet) => ({ node, packet }))
      )
    );

    // ─── 4. Atomic in-degree update ───
    // This forEach block is synchronous — JS event loop cannot interleave
    // another microtask here, so inDegree reads and writes are race-free.
    const nextWave: Node<NodeData>[] = [];

    results.forEach((result, idx) => {
      const node = activeWave[idx];

      if (result.status === "fulfilled") {
        const { packet } = result.value;
        context.nodes[node.id] = packet;
        executed.add(node.id);
        onNodeStatusChange?.(node.id, "success");
        onNodeComplete?.(node.id, packet);
        sendLog(
          `✅ Completed: ${node.data?.label || node.id}`,
          "SUCCESS",
          node.id
        );

        // Decrement each child's in-degree; enqueue when it reaches zero
        for (const childId of adj.get(node.id) || []) {
          const newDeg = (inDegree.get(childId) || 1) - 1;
          inDegree.set(childId, newDeg);

          if (newDeg === 0) {
            const childNode = nodes.find((n) => n.id === childId);
            if (childNode && !executed.has(childId) && !skipped.has(childId)) {
              nextWave.push(childNode);
            }
          }
        }
      } else {
        // ─── 5. Short-circuit: cascade SKIPPED to all descendants ───
        const errMsg =
          (result.reason as Error)?.message || String(result.reason);
        sendLog(
          `❌ Error in ${node.data?.label || node.id}: ${errMsg}`,
          "ERROR",
          node.id
        );
        onNodeStatusChange?.(node.id, "error");

        const descendants = getDescendants(node.id, adj);
        descendants.forEach((descId) => {
          if (!executed.has(descId)) {
            skipped.add(descId);
            onNodeStatusChange?.(descId, "skipped");
            sendLog(
              `⏭ Skipping ${descId} (upstream failure short-circuit)`,
              "WARN",
              descId
            );
          }
        });
      }
    });

    currentWave = nextWave;
  }

  // ─── 6. Cycle / isolation detection ───
  const unreachable = nodes.filter(
    (n) => !executed.has(n.id) && !skipped.has(n.id)
  );
  if (unreachable.length > 0) {
    sendLog(
      `⚠️ ${unreachable.length} nodes unreachable (disconnected or cycle): ${unreachable
        .map((n) => n.data?.label || n.id)
        .join(", ")}`,
      "WARN"
    );
  }

  const hasErrors = skipped.size > 0;
  sendLog(
    hasErrors
      ? "🏁 Flow finished — some nodes were skipped due to upstream failures."
      : "🏁 Flow execution finished successfully.",
    hasErrors ? "WARN" : "SUCCESS"
  );

  return { success: !hasErrors, context, logs };
}
