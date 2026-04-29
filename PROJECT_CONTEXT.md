# PROJECT_CONTEXT.md

## Overview
**FlowForge AI (AgentForge)** — Visual AI workflow builder. Users compose node graphs in a React Flow canvas; the Walker Engine executes them as BFS waves, calling LLMs and routing data between nodes. Built on Next.js 15 App Router + Zustand + Supabase + Prisma.

---

## Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind 4, shadcn/ui, Framer Motion |
| Graph | ReactFlow 11 |
| State | Zustand 5 |
| Auth/DB | Supabase (auth + realtime), Prisma 7 (ORM) |
| AI Providers | Google Gemini, Groq, OpenAI, Anthropic |
| Language | TypeScript 5 (strict) |

---

## Directory Map
```
app/
  actions/
    ai-architect.ts     # Server action: NL prompt → validated flow JSON (11-node schema)
    auth, flow, project # Auth, CRUD
  api/execute/          # POST endpoint for server-side flow execution
  editor/               # Main canvas page (FlowCanvas + all panels)
  dashboard/            # Project management
  view/[id]/            # Public read-only flow viewer
components/
  flow/
    nodes/              # One file per node type (see Node Types table below)
    canvas/             # FlowCanvas (editable), ReadOnlyCanvas
    chat/               # ChatHub — floating chat panel + approval routing
    sidebar/            # NodeSettingsSidebar, NodeSidebar
    AIArchitectModal.tsx # AI workflow generator modal (key persists for session)
    ResponseGallery.tsx  # Terminal tab + Workflow Report (Final Result tab)
    ExecutionLogPanel.tsx
    FinalResultPanel.tsx
    ApprovalBanner.tsx
lib/
  flow/
    clientExecutor.ts   # Walker Engine v2 — BFS wave-parallel executor (main path)
  approvalGate.ts       # Promise-based pause/resume (avoids flowStore circular dep)
  executionEngine.ts    # Node-level executor (legacy / server path)
  savedAgents.ts        # Reusable agent definitions
  supabase/             # Server + client Supabase instances
stores/
  flowStore.ts          # Primary store — nodes, edges, execution, chat, nodeOutputs
  useLogStore.ts        # Execution log entries (timestamp, type, message, nodeId)
  vaultStore.ts         # API key store + architectKey session persistence
  themeStore.ts         # Dark/light theme
types/
  flowStoreTypes.ts     # NodeData, FlowPacket, FlowState, ExecutionContext
```

---

## Core Data Types
```ts
FlowPacket        { type: "text"|"file"|"data", payload, meta? }

NodeData          { label, instructions, provider, modelName, apiKey,
                    routes, conditions, resultFormat, packet,
                    connectionType, url, method,           // action node
                    gatekeeperMessage, timeoutMinutes,     // approval node
                    verification,                          // gatekeeper node
                    batchLogic,                            // processor node
                    subflowId, workflowOverride }

ExecutionContext   { variables: Record<string,FlowPacket>,
                    nodes: Record<string,FlowPacket> }

ExtendedFlowState { nodes[], edges[], running, isRunning,
                    chatHistory[], nodeStatuses{}, nodeOutputs{},
                    finalResult, executionResult, projects[],
                    activeProject, isChatOpen, past[], future[] }

WalkerOptions     { onNodeStatusChange?, onNodeComplete? }
```

---

## Data Flow

```
User sends message (ChatHub)
  → ChatHub.handleSend()
      if isApprovalPending()  → resolveApproval(approved)       [gate resumes]
      else                    → flowStore.runClientFlow(text)    [new execution]

runClientFlow()
  → guard: if isApprovalPending() → route to resolveApproval, return early
  → set nodeOutputs: {}, nodeStatuses: {}, isRunning: true
  → executeGraph(nodes, edges, input, onLog, chatHistory, { onNodeStatusChange, onNodeComplete })

executeGraph() — Walker Engine v2
  → build adj + inDegree map from edges
  → seed wave: nodes where inDegree === 0
  → loop waves:
      assertTemplateDeps(instructions, context)   ← fails fast if {{ref}} not in context
      executeNode(node, context, edges, ...)
        "input"      → returns packet from node.data or initialInput
        "trigger"    → returns triggered payload
        "ai"         → SeqAttn prune → resolve {{vars}} → resolveApiKey() JIT → dispatchLLM()
        "output"     → resolve resultFormat → addMessage("assistant") → setIsChatOpen(true)
        "approval"   → post chat message → 80ms yield → waitForApproval() [suspends wave]
        "gatekeeper" → Human: waitForApproval() / Critic AI: auto-pass
        "action"     → validate url exists → fetch(url) → throw on non-2xx
        "vault"      → resolve query template → return [Vault] payload
        "processor"  → resolve batchLogic → return processed packet
        "router"     → evaluate conditions → route branches
      onNodeComplete(nodeId, packet) → store.nodeOutputs updated reactively
      short-circuit: on failure → mark all descendants SKIPPED
  → finalResult stored, isRunning: false
```

---

## Key Patterns

### Walker Engine v2 (BFS Wave-Parallel)
`lib/flow/clientExecutor.ts` — all client-side execution goes through here.
- Nodes run in topological waves; nodes in the same wave run via `Promise.allSettled`.
- In-degree map decremented synchronously after each wave (race-free, JS single-threaded).
- `assertTemplateDeps()`: before any AI/output/vault node executes, validates that every `{{nodeId}}` ref is in context. Throws a descriptive error if a referenced node hasn't run yet (catches wrong-edge bugs from the architect).

### JIT Key Resolution (`resolveApiKey`)
Priority: node-level `apiKey` → vault entry matching requested provider (by key-value prefix) → any vault entry (auto-detect via `detectProvider`). `provider: "auto"` on a node means "pick whatever is in the vault." Key held in a local variable, nullified in `finally` after `dispatchLLM` returns.

### Approval Gate (`lib/approvalGate.ts`)
Module-level Promise resolver: `waitForApproval()` suspends the walker mid-wave; `resolveApproval(bool)` resumes it. Extracted from flowStore to break the `flowStore ↔ clientExecutor` circular dependency. ChatHub polls `isApprovalPending()` every 150ms and unlocks the input box while paused.

### SeqAttn (Sequential Attention Pruning)
Before each AI node call, `applySeqAttn()` strips context down to only the keys referenced by `{{...}}` in the node's prompt. Reduces token usage and avoids leaking unrelated node outputs into the LLM context.

### `nodeOutputs` (Reactive Canvas State)
`store.nodeOutputs: Record<string, FlowPacket>` is updated via `onNodeComplete` callback as each node finishes. `ApprovalNode.tsx` reads `nodeOutputs[parentEdge.source]` to preview upstream content live on the canvas while the flow is paused.

### Session Key Persistence (`vaultStore.architectKey`)
`AIArchitectModal` reads/writes `vaultStore.architectKey` so the API key persists in memory across multiple architect calls within the same session. Key is NOT cleared on modal close.

### `.output` alias
In all template resolvers, `parts[i] === "output"` maps to `"payload"` — so `{{researcher-1.output}}` correctly reads `context.nodes["researcher-1"].payload`. Both `{{id}}` and `{{id.output}}` work.

---

## Node Types (11 canonical types)
| Sidebar Name | nodeType | Purpose |
|---|---|---|
| Starting Point | `input` | User message entry — default root for all chat flows |
| Smart Trigger | `trigger` | Scheduled/automated entry (no user input) |
| Webhook | `webhook` | Incoming HTTP trigger only — NOT for outgoing calls |
| AI Brain | `ai` | LLM call; set `provider:"auto"` to pick best vault key |
| Knowledge Vault | `vault` | RAG / document lookup |
| Decision | `router` | N-way conditional branching |
| Safety Gatekeeper | `gatekeeper` | AI critic or human content review |
| Approval Gate | `approval` | Human-in-the-loop pause; resumes on "go"/"approve" in chat |
| Logic Processor | `processor` | Data transform / batch loop |
| Integration | `action` | Outgoing HTTP call; requires `url` field or throws at runtime |
| Final Result | `output` | Terminal node; feeds result into ChatHub via `addMessage` |

---

## AI Architect (`app/actions/ai-architect.ts`)
- Provider-agnostic server action: takes `{ prompt, provider, model, decryptedKey }`.
- Strict 11-type schema enforced in the system prompt; illegal types filtered server-side before returning.
- **MANDATORY RULE**: root must be `input` for user-facing flows; `trigger` only for scheduled.
- **MANDATORY RULE**: every `ai` node must include `provider: "auto"`.
- **MANDATORY RULE**: if Node B's instructions reference `{{node-a}}`, the ONLY incoming edge to Node B must be from `node-a` — no shortcut edges.
- Research assistant template uses concrete JSON with explicit `edges` array (3 edges, linear chain: `input-1 → researcher-1 → summarizer-1 → result-1`). No edge from `input-1` to `summarizer-1`.
- `summarizer-1` instructions: `"Read the findings from the previous node: {{researcher-1.output}} and then summarize them."`.

---

## Integration Node (`action`)
- Executor validates `connectionType` and `url` fields before running.
- Missing `url` throws: `"Missing API Endpoint. Please configure the node."`.
- Makes a real `fetch()` to the configured URL; throws on non-2xx responses.
- CORS failures surfaced with a suggestion to route through a server-side proxy.
- `ActionNode.tsx` shows a red `AlertTriangle` badge on the canvas when `url` is unset.
- Settings sidebar shows a required URL field (with Slack-specific label for `Send to Slack`).

---

## Auth & Persistence
- Supabase handles auth (OAuth callback at `app/auth/callback/`).
- Flows saved via Prisma → Postgres (Supabase).
- Projects scoped to user; public flows at `/view/[id]` (read-only canvas).

---

## ResponseGallery — Workflow Report
`components/flow/ResponseGallery.tsx` — Final Result tab now shows a structured **Workflow Report**:
- ✅ Workflow: project name (from `store.activeProject?.name`)
- ⏱️ Execution Time: computed from `logs[last].timestamp − logs[0].timestamp`
- 🤖 Agents Involved: count of `type === "ai"` nodes
- 📊 Status: Complete / Partial (based on ERROR log presence)
- **Copy Summary** button: copies structured report + raw output to clipboard
- Raw LLM output rendered below the report card
