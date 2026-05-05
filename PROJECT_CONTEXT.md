# PROJECT_CONTEXT.md

## Overview
**FlowForge AI (AgentForge)** — Visual AI workflow builder. Users compose node graphs in a React Flow canvas; the Reactive Engine executes them as a topological event-driven choreography, calling LLMs and routing data between nodes. Built on Next.js 15 App Router + Zustand + Supabase + Prisma.

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
    ai-architect.ts     # Server action: NL prompt → validated flow JSON (12-node schema)
    integration.ts      # OAuth integration actions: getIntegrations, upsertIntegration, deleteIntegration, executeAppAction
    auth.ts, flow.ts, project.ts
  api/
    execute/route.ts    # POST endpoint for server-side flow execution
    vector-search/      # BM25 lexical search endpoint — ranks doc chunks by relevance (no external dep)
  editor/page.tsx       # Main canvas page (FlowCanvas + all panels)
  publish/page.tsx      # Code export page (polyglot compile to TS/JS/Python)
  dashboard/
    page.tsx            # Project management
    integrations/page.tsx  # OAuth integration management UI (X, Slack, Discord, GitHub, Notion)
  view/[id]/page.tsx    # Public read-only flow viewer

components/
  flow/
    nodes/              # One file per node type (see Node Types table below)
    canvas/             # FlowCanvas (editable), ReadOnlyCanvas
    chat/               # ChatHub — floating chat panel + approval routing
    sidebar/            # NodeSettingsSidebar (includes appaction settings panel), NodeSidebar
    AIArchitectModal.tsx        # AI workflow generator modal
    ResponseGallery.tsx         # Terminal | Result | State tabs
    ExecutionLogPanel.tsx
    FinalResultPanel.tsx
    ApprovalBanner.tsx
    VariableInspectorPanel.tsx  # Live variable inspection during execution
    SharedViewContent.tsx       # Shared read-only view wrapper

lib/
  flow/
    clientExecutor.ts   # Reactive Engine — topological event-driven executor (main path); includes appaction handler
    layoutEngine.ts     # Dagre-based auto-layout (TB/LR); skips group containers
    validators.ts       # Kahn's algorithm cycle detection — call before adding edges
  providers/
    index.ts            # APP_REGISTRY definition + getApp/getAction lookups
    xService.ts         # X (Twitter): tweet posting
    slackService.ts     # Slack: message sending
    discordService.ts   # Discord: message/DM sending
    githubService.ts    # GitHub: issue creation
    notionService.ts    # Notion: page creation
  codegen/
    templates.ts        # Polyglot codegen helpers (library metadata, HTTP blocks, template lifting)
  constants/
    templates.ts        # Flow template definitions
  approvalGate.ts       # Promise-based pause/resume (avoids flowStore circular dep)
  flowCompiler.ts       # Compile flow graphs → Python / TypeScript / JavaScript
  executionEngine.ts    # Legacy node executor (server path / simulation)
  expressionEvaluator.ts
  flowPersistence.ts    # Save/load flow state helpers
  savedAgents.ts        # Reusable agent definitions
  template.ts           # {{key}} template resolver
  versionSnapshots.ts   # Flow version snapshot storage
  supabase/             # Server + client Supabase instances

stores/
  flowStore.ts          # Primary store — nodes, edges, execution, chat, nodeOutputs
  useLogStore.ts        # Execution log entries (timestamp, type, message, nodeId)
  vaultStore.ts         # API key store + architectKey session persistence
  registryStore.ts      # Published agent registry
  simulationStore.ts    # Legacy simulation state
  themeStore.ts         # Dark/light theme

types/
  flowStoreTypes.ts     # NodeData, FlowPacket, FlowState, ExecutionContext
  dataTypes.ts

prisma/
  schema.prisma         # Includes Integration model: { id, userId, provider, accessToken, refreshToken, metadata }
```

---

## Core Data Types
```ts
FlowPacket        { type: "text"|"file"|"data", payload: any, meta? }

NodeData          { label, instructions, provider, modelName, apiKey,
                    routes, conditions, resultFormat, packet,
                    connectionType, url, method,           // action node
                    gatekeeperMessage, timeoutMinutes,     // approval node
                    verification,                          // gatekeeper node
                    batchLogic,                            // processor node
                    subflowId, workflowOverride,           // subflow node
                    appProvider, appAction, appInputs }    // appaction node (provider: "x"|"slack"|"discord"|"github"|"notion"; appInputs supports {{node-id}} refs)

ExecutionContext   { variables: Record<string,FlowPacket>,
                    nodes: Record<string,FlowPacket>,
                    __exit__?: boolean }                   // exit signal for early termination

ExtendedFlowState {
  // Canvas
  nodes[], edges[],
  selectedNodeId, highlightedNodeId, activeEdgeId,

  // Execution
  running, isRunning,
  currentContext, executionResult, executionState,
  finalResult, executedNodeIds,
  executionLogs,               // legacy — prefer useLogStore
  nodeStatuses: Record<string, NodeExecutionStatus>,   // "idle"|"running"|"success"|"error"|"skipped"
  nodeOutputs:  Record<string, FlowPacket>,            // reactive per-node results
  dependencyMap: Record<string, string[]>,             // nodeId → [parent IDs]

  // Chat
  isChatOpen, chatHistory[],

  // UI
  theme, showMinimap, showExecutionLogPanel, showVariablesPanel,
  tutorialStep, activeProject, projects[],

  // Undo/Redo
  past[], future[], lastAction
}

WalkerOptions     { onNodeStatusChange?, onNodeComplete? }
ChatMessage       { role: "user"|"assistant", content: string }
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
  → snapshot chatHistory (stale by design — output node will append during run)
  → set nodeOutputs: {}, nodeStatuses: {}, isRunning: true
  → build dependencyMap via buildDependencyMap(edges)
  → executeGraph(nodes, edges, input, onLog, chatHistorySnapshot, { onNodeStatusChange, onNodeComplete })
  → after execution: read LIVE state.chatHistory to capture output node's addMessage calls

executeGraph() — Reactive Engine (topological event-driven)
  → build adjacency + dependency maps from edges
  → dispatch all in-degree-0 nodes immediately (roots)
  → each node fires when ALL its incoming-edge sources complete:
      check context.__exit__ → if set, mark node SKIPPED
      assertTemplateDeps(instructions, context)   ← fails fast on missing {{ref}}
      executeNode(node, context, edges, ...)
        "input"      → returns packet from node.data or initialInput
        "trigger"    → returns triggered payload (manual/webhook/schedule)
        "ai"         → SeqAttn prune → resolve {{vars}} → resolveApiKey() JIT → dispatchLLM()
                        if response === "EXIT"|"STOP" → sets context.__exit__
        "output"     → resolve resultFormat → addMessage("assistant") → setIsChatOpen(true)
        "approval"   → post chat message → 80ms yield → waitForApproval() [suspends wave]
        "gatekeeper" → Human: waitForApproval() / Critic AI: auto-pass
        "action"     → validate url exists → fetch(url) → throw on non-2xx
        "vault"      → resolve query template → return [Vault] payload
        "processor"  → resolve batchLogic → return processed packet
        "router"     → evaluate conditions → route branches
        "subflow"    → expand workflowOverride or resolve subflowId → recursive executeGraph
      onNodeComplete(nodeId, packet) → store.nodeOutputs updated reactively
      short-circuit: on failure → mark all transitive descendants SKIPPED
  → resolves when inflight set empty AND no pending nodes remain
  → finalResult stored, isRunning: false
```

---

## Key Patterns

### Reactive Engine (Topological Event-Driven)
`lib/flow/clientExecutor.ts` — all client-side execution goes through here.
- **Natural parallelism**: independent nodes fire concurrently as soon as their deps complete. No explicit waves.
- **Topological guarantees**: adjacency + dependency maps ensure correct ordering without explicit batching.
- **Exit signal**: if an AI node returns exactly `"EXIT"` or `"STOP"`, `context.__exit__` is set. Running nodes finish normally; newly-ready nodes are marked SKIPPED.
- **Error isolation**: failure on one branch cascades SKIPPED only to transitive descendants; other branches continue.
- **Completion**: resolves when `inflight` set is empty AND `pendingCount === 0`.

### JIT Key Resolution (`resolveApiKey`)
Three-tier priority:
1. Node-level `data.apiKey` (explicit override)
2. Vault entry matching requested provider (by key-value prefix: `gsk_` → Groq, `sk-` → OpenAI, `AIza` → Gemini)
3. Auto-select first vault entry, infer provider via `detectProvider`

Key is held in a local variable and nullified in `finally` after `dispatchLLM` returns. `provider: "auto"` on a node means "pick whatever is in the vault."

### Approval Gate (`lib/approvalGate.ts`)
Module-level Promise resolver: `waitForApproval()` suspends the reactive engine mid-execution; `resolveApproval(bool)` resumes it. Extracted from flowStore to break the `flowStore ↔ clientExecutor` circular dependency. ChatHub polls `isApprovalPending()` every 150ms and unlocks the input box while paused.

### SeqAttn (Sequential Attention Pruning)
Before each AI node call, `applySeqAttn()` strips context down to only the keys referenced by `{{...}}` in the node's prompt. Reduces token usage and avoids leaking unrelated node outputs into the LLM context.

### `assertTemplateDeps`
Before any AI/output/vault/processor node executes, validates that every `{{nodeId}}` ref is already in context. Throws a descriptive error if a referenced node hasn't run yet — catches wrong-edge bugs from the architect early.

### `nodeOutputs` (Reactive Canvas State)
`store.nodeOutputs: Record<string, FlowPacket>` is updated via `onNodeComplete` callback as each node finishes. `ApprovalNode.tsx` reads `nodeOutputs[parentEdge.source]` to preview upstream content live on the canvas while the flow is paused.

### Chat History Semantics
The snapshot passed to `executeGraph` is **stale by design** — it contains only previous turns. After execution, `runClientFlow` reads **live** `state.chatHistory` to capture any `addMessage()` calls the output node made during the run.

### Session Key Persistence (`vaultStore.architectKey`)
`AIArchitectModal` reads/writes `vaultStore.architectKey` so the API key persists in memory across multiple architect calls within the same session. Key is NOT cleared on modal close.

### `.output` alias
In all template resolvers, `parts[i] === "output"` maps to `"payload"` — so `{{researcher-1.output}}` correctly reads `context.nodes["researcher-1"].payload`. Both `{{id}}` and `{{id.output}}` work.

### LLM Dispatcher (`dispatchLLM`)
Each provider receives its native message-array format — no string concatenation:
- **OpenAI / Groq**: `messages[]` + `system` field
- **Gemini**: `contents[]` + `systemInstruction`
- **Anthropic**: `messages[]` + `system` + `max_tokens`

Full conversation history is passed as-is from `chatHistory`.

---

## Node Types

### 12 Canonical Types (AI Architect schema)
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
| Integration | `action` | Outgoing HTTP call (generic REST); requires `url` field or throws at runtime |
| App Action | `appaction` | OAuth-connected app action (X/Slack/Discord/GitHub/Notion); auth sourced from user integrations automatically |
| Final Result | `output` | Terminal node; feeds result into ChatHub via `addMessage` |

### Additional Implementation Types (not in architect schema)
| nodeType | File | Purpose |
|---|---|---|
| `subflow` / `subagent` | SubflowNode.tsx | Nested workflow execution — resolves `subflowId` or `workflowOverride` |
| `group` | GroupNode.tsx | Container that wraps/unwraps sub-agent node groups |
| `text` | TextNode.tsx | Static annotation/label node (canvas only, not executed) |

`AppActionNode.tsx` — canvas node for `appaction` type; shows app icon + action label; live connectivity status dot; alert badge if app/action not configured.

Legacy aliases handled in executor: `ai_agent`, `agent-brain`, `llm` all route to the `ai` handler.

---

## AI Architect (`app/actions/ai-architect.ts`)
- Provider-agnostic server action: takes `{ prompt, provider, model, decryptedKey }`.
- Strict 12-type schema enforced in the system prompt; illegal types (including old aliases) silently filtered server-side before returning.
- **MANDATORY RULE**: root must be `input` for user-facing flows; `trigger` only for scheduled.
- **MANDATORY RULE**: every `ai` node must include `provider: "auto"` — no explicit provider/model/apiKey.
- **MANDATORY RULE**: if Node B's instructions reference `{{node-a}}`, the ONLY incoming edge to Node B must be from `node-a` — no shortcut edges.
- **MANDATORY RULE**: Approval gate MUST precede any action node that posts/sends data.
- **MANDATORY RULE**: use `appaction` (not `action`) for social/productivity apps (X, Slack, Discord, GitHub, Notion); `appaction` nodes auto-source auth from user integrations — no explicit token.
- Output contract: raw JSON object — no markdown fences, no extra keys.
- Default models: Gemini `gemini-2.5-flash`, Groq `llama-3.3-70b-versatile`, OpenAI `gpt-4o`.

---

## Graph Utilities

### Auto-Layout (`lib/flow/layoutEngine.ts`)
Dagre-based layout engine. Call with nodes/edges + direction (`"TB"` or `"LR"`). Returns repositioned nodes with `targetPosition`/`sourcePosition` set for ReactFlow handles. Group containers are skipped during layout.

### Cycle Detection (`lib/flow/validators.ts`)
Kahn's algorithm on the edge list. Returns `true` if cycles exist. Call before committing a new edge to the canvas to prevent invalid DAGs.

### Vector Search (`app/api/vector-search/route.ts`)
POST `{ query, chunks, topK }` → ranked matches. BM25 scoring (TF-IDF variant) with no external dependencies. Used by the Vault node for local document retrieval.

---

## App Integrations (`lib/providers/` + `app/actions/integration.ts`)

OAuth-connected external app actions. Token management is entirely server-side; nodes reference integrations by `appProvider` + `appAction` name.

**Supported apps** (via `lib/providers/`):
| Provider | Actions |
|---|---|
| X (Twitter) | `create_tweet`, `send_dm` |
| Slack | `send_message`, `send_dm` |
| Discord | `send_channel_message`, `send_dm` |
| GitHub | `create_issue`, `create_comment` |
| Notion | `create_page` |

**`APP_REGISTRY`** in `lib/providers/index.ts` — source of truth for app metadata + available actions. `getApp(provider)` and `getAction(provider, action)` are the lookup helpers used by the sidebar and executor.

**`app/actions/integration.ts`** — server actions:
- `getIntegrations()` — fetch user's connected providers
- `upsertIntegration(provider, accessToken, refreshToken?)` — store/update token
- `deleteIntegration(provider)` — revoke connection
- `executeAppAction(provider, action, inputs)` — dispatch to the appropriate service adapter

**Prisma model**: `Integration { id, userId, provider, accessToken, refreshToken, metadata }` with unique constraint `(userId, provider)`.

**Management UI**: `app/dashboard/integrations/page.tsx` — token input forms, live connection status, connect/disconnect actions.

---

## Integration Node (`action`)
- Executor validates `connectionType` and `url` fields before running.
- Missing `url` throws: `"Missing API Endpoint. Please configure the node."`.
- Makes a real `fetch()` to the configured URL; throws on non-2xx responses.
- CORS failures surfaced with a suggestion to route through a server-side proxy.
- `ActionNode.tsx` shows a red `AlertTriangle` badge on the canvas when `url` is unset.
- Settings sidebar shows a required URL field (with Slack-specific label for `Send to Slack`).
- Auth: bearer/basic token with env-var fallback in compiled code.

---

## Code Export / Publish (`app/publish/page.tsx` + `lib/flowCompiler.ts`)

### Publish Page
- Left panel: preview (input dropzone, final result, per-node execution status)
- Right panel: code editor — tabbed by language (Python / JavaScript / TypeScript)
- Library selector dropdown; Copy / Download compiled code
- Run preview via `simulateFlow()`

### Flow Compiler (`lib/flowCompiler.ts`)
Polyglot compilation using Kahn's topological sort:
1. Sort nodes by dependency order
2. Convert labels to `snake_case` identifiers
3. Emit per-library code blocks

**Supported languages & libraries**:
| Language | Libraries |
|---|---|
| TypeScript | fetch, axios, got |
| JavaScript | fetch, axios, got |
| Python | requests, httpx, aiohttp (async) |

**`lib/codegen/templates.ts`** provides:
- `LibraryMeta` — install cmd, async flag, language tag per library
- `liftTemplate(template, names, lib)` — converts `{{key}}` to `ctx['key']?.payload` (TS/JS) or `ctx.get('key',{}).get('payload')` (Python)
- `genHttpBlock(lib, opts)` — full HTTP request boilerplate (auth headers, multipart/JSON body)
- `getLibrariesForTab(tab)` / `getDefaultLibrary(tab)` — language → library list

**Current limitations**: LLM calls are placeholder TODO comments; router/processor logic is simplified; no actual RAG integration in compiled output.

---

## ResponseGallery (`components/flow/ResponseGallery.tsx`)
Three tabs:
- **Terminal** — real-time execution logs (INFO/SUCCESS/ERROR/WARN with color coding, auto-scroll, auto-focus on run)
- **Result** — Workflow Report card: project name, execution time, agent count, status (Complete/Partial), Copy Summary button; raw LLM output below
- **State** — live JSON dump of execution context; searchable/filterable

Auto-switches to Terminal on run start, Result on completion.

---

## Auth & Persistence
- Supabase handles auth (OAuth callback at `app/auth/callback/`).
- Flows saved via Prisma → Postgres (Supabase).
- Projects scoped to user; public flows at `/view/[id]` (read-only canvas).
- `lib/flowPersistence.ts` — save/load helpers.
- `lib/versionSnapshots.ts` — flow version history.

---

## Store Reference

### `flowStore.ts` — Key Actions
| Action | Description |
|---|---|
| `setNodes / setEdges` | Canvas updates |
| `addNode(node)` | Group-aware drop (parentId + relative position) |
| `deleteNode(nodeId)` | Cascade edge deletion |
| `updateNodeData(nodeId, partial)` | Shallow-merge node.data |
| `setNodeStatus(nodeId, status)` | Reactive engine → UI feedback |
| `setNodeOutput(nodeId, packet)` | Per-node result tracking |
| `runClientFlow(input)` | Main executor entry point |
| `simulateFlow(startNodeId)` | Legacy BFS simulation (publish preview) |
| `addMessage(role, content)` | Chat history append |
| `clearChatHistory()` | Reset chat |
| `takeSnapshot() / undo()` | Canvas history |
| `clearCanvas()` | Full reset |
| `unwrapSubagent(nodeId)` | Extract sub-agent nodes into parent canvas |
| `wrapSubagent(groupId)` | Wrap selected group into a sub-agent |
| `applyAutoLayout(direction)` | Apply Dagre-based auto-layout (`"TB"` or `"LR"`) |
| `autoSave() / restoreAutoSave() / clearAutoSave()` | localStorage canvas persistence |
| `completeTutorial()` | Mark onboarding tutorial as complete |

### `useLogStore.ts` — Log Entry Shape
```ts
{ id, timestamp, type: "INFO"|"SUCCESS"|"ERROR"|"WARN", message, nodeId?, elapsed? }
```
- `addLog(type, message, nodeId?, elapsed?)`
- `clearLogs()`
- `appendLogMessage(nodeId, chunk)` — streaming append to last matching nodeId entry

### `vaultStore.ts` — Methods
- `addEntry(key, value)`, `removeEntry(key)`, `getKeys()`
- `resolveSmartKey(requestedProvider?)` — exact match or auto-select
- `setArchitectKey(key)` — session key for AI Architect
