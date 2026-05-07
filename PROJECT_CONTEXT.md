# PROJECT_CONTEXT.md

## Overview
**FlowForge AI (AgentForge)** — Visual AI workflow builder. Users compose node graphs in a React Flow canvas; the Reactive Engine executes them as a topological event-driven choreography, calling LLMs and routing data between nodes. Built on Next.js 15 App Router + Zustand + Supabase + Prisma.

---

## Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind 4, shadcn/ui, Framer Motion 12 |
| Graph | ReactFlow 11 |
| State | Zustand 5 |
| Auth/DB | Supabase (auth + realtime), Prisma 7 (ORM) |
| AI Providers | Google Gemini, Groq, OpenAI, Anthropic |
| Canvas Export | html-to-image 1.11, jsPDF 4.2 |
| Language | TypeScript 5 (strict) |

---

## Directory Map
```
app/
  actions/
    ai-architect.ts     # Server action: NL prompt → validated flow JSON (12-node schema)
    integration.ts      # OAuth integration actions: getIntegrations, upsertIntegration, deleteIntegration, executeAppAction
    auth.ts             # Sign out (Supabase)
    flow.ts             # Core flow CRUD: saveFlow, getFlow, getLatestFlow, getUserFlows, publishFlow, toggleStoreDeployment, getDeployedFlows, deleteFlow, createFolder, getCustomTemplates, deleteCustomTemplate
    project.ts          # Project CRUD: createProject, getProjects, deleteProject, saveAsTemplate, getCustomTemplates, deleteCustomTemplate
  api/
    execute/route.ts    # Legacy vault-aware mock endpoint (resolves {{vault.KEY}} refs) — superseded by sandbox/execute
    sandbox/
      execute/route.ts  # POST endpoint: accepts {nodes, edges, input, apiKeys[]} → SSE stream of log/status/output/result/done events; runs serverExecutor server-side
    vector-search/      # BM25 lexical search endpoint — ranks doc chunks by relevance (no external dep)
  editor/page.tsx       # Main canvas page (1700+ lines): FlowCanvas, sidebars, toolbar, AI Architect, template modal, approval banner, chat hub, terminal, dry-run/live split button, cloud auto-save with sync indicator, guest mode
  publish/page.tsx      # Publish & Export (1000+ lines): sandbox env config, file/folder attachments, Run Sandbox (SSE), Share Sandbox, Deploy to Store, code export (polyglot TS/JS/Python), Refine input via Groq
  sandbox/
    [id]/page.tsx       # Server component: loads flow by ID, access-controls by isPublic + ownership, renders SandboxClient
    [id]/SandboxClient.tsx  # Client component: API key config, prompt input, SandboxGallery; calls /api/sandbox/execute
  dashboard/
    page.tsx            # Mission Control: workspace sidebar (Recent flows, Projects CRUD, Templates), recent flows grid, event stream, vault access panel, system health, stats
    integrations/page.tsx  # OAuth integration management UI — 8 providers with official brand SVGs
  store/page.tsx        # Agent Store: browse and run community-deployed public flows (grid with thumbnails)
  view/[id]/page.tsx    # Public read-only (or editable) flow viewer based on publicEditable flag
  login/page.tsx        # Supabase Auth UI: magic link + OAuth (Google, GitHub, Apple)
  auth/callback/route.tsx  # OAuth callback handler

components/
  flow/
    nodes/              # One file per node type (see Node Types table below) + NodeCard.tsx (shared UI wrapper)
    canvas/             # FlowCanvas (editable), ReadOnlyCanvas
    chat/               # ChatHub — floating chat panel + approval routing
    sidebar/            # NodeSettingsSidebar (includes appaction settings panel), NodeSidebar
    AIArchitectModal.tsx        # AI workflow generator modal
    ResponseGallery.tsx         # Terminal | Final Result tabs with prettified JSON output (reads useFlowStore + useLogStore)
    SandboxGallery.tsx          # Prop-driven Terminal | Final Result tabs — reads from useSandboxExecution hook props, NOT from useFlowStore; used on publish page and /sandbox/[id]
    ExecutionLogPanel.tsx
    FinalResultPanel.tsx
    ApprovalBanner.tsx
    VariableInspectorPanel.tsx  # Live variable inspection during execution
    SharedViewContent.tsx       # Shared read-only view wrapper

hooks/
  useSandboxExecution.ts  # Client hook: POSTs to /api/sandbox/execute, reads SSE stream line-by-line, maintains isolated state (logs, nodeStatuses, nodeOutputs, finalResult, running) — does NOT write to useFlowStore

lib/
  flow/
    clientExecutor.ts   # Reactive Engine — topological event-driven executor (main path); includes appaction handler; "use client", cannot be imported in API routes
    serverExecutor.ts   # Server-safe reactive engine — no "use client", no ReactFlow/vaultStore deps; accepts apiKeys[] parameter; handles input/ai/output/router/processor/action/appaction; approval+gatekeeper skipped with warning; used by /api/sandbox/execute
    layoutEngine.ts     # Dagre-based auto-layout (TB/LR); skips group containers
    validators.ts       # Kahn's algorithm cycle detection — call before adding edges
    modelRegistry.ts    # Node type registry and metadata
  providers/
    index.ts            # APP_REGISTRY definition + getApp/getAction lookups (8 providers)
    xService.ts         # X (Twitter): tweet posting
    slackService.ts     # Slack: message sending
    discordService.ts   # Discord: message/DM sending
    githubService.ts    # GitHub: issue creation
    notionService.ts    # Notion: page creation
    instagramService.ts # Instagram: media post (2-step container/publish)
    linkedinService.ts  # LinkedIn: UGC post (2-step /me + ugcPosts)
    mediumService.ts    # Medium: article creation (2-step /me + /users/{id}/posts)
  codegen/
    templates.ts        # Polyglot codegen helpers (library metadata, HTTP blocks, template lifting, helper injection)
  constants/
    templates.ts        # Flow template definitions (4 built-in templates)
  utils/
    export.ts           # Canvas export: exportAsPng, exportAsJpeg, exportAsPdf
    contextPacker.ts    # Pack uploaded files (images, code) into text context for LLM prompts
  approvalGate.ts       # Promise-based pause/resume (avoids flowStore circular dep)
  flowCompiler.ts       # Compile flow graphs → Python / TypeScript / JavaScript (8 app providers, 7 HTTP libraries)
  executionEngine.ts    # Legacy node executor (server path / simulation)
  expressionEvaluator.ts  # Boolean/English expression parser for routing conditions
  flowPersistence.ts    # Save/load flow state helpers
  savedAgents.ts        # Reusable agent definitions
  template.ts           # {{key}} template resolver
  versionSnapshots.ts   # Flow version snapshot storage
  prisma.ts             # Prisma client singleton
  utils.ts              # General helpers (cn, date formatting, etc.)
  supabase/             # Server + client Supabase instances

stores/
  flowStore.ts          # Primary store — nodes, edges, execution, chat, nodeOutputs, projects, undo/redo, layoutDirection, isDryRun, showTerminal
  useLogStore.ts        # Execution log entries (timestamp, type, message, nodeId)
  vaultStore.ts         # API key store + architectKey session persistence
  registryStore.ts      # Published agent registry (localStorage-backed)
  simulationStore.ts    # Legacy simulation state
  themeStore.ts         # Dark/light theme

types/
  flowStoreTypes.ts     # NodeData, FlowPacket, FlowState, ExecutionContext, NodeExecutionStatus, ExecutionLogEntry
  agent.ts              # AI Agent types
  dataTypes.ts          # Data packet types (text, JSON, file, etc.)

prisma/
  schema.prisma         # Models: Flow, Project, Folder, Vault, Integration; Supabase auth models
```

---

## Core Data Types
```ts
FlowPacket        { type: "text"|"file"|"data", payload: any, error?, meta?, attachments?, fileContext? }

NodeData          { label, instructions, provider, modelName, model, apiKey,
                    routes, conditions, resultFormat, packet,
                    connectionType, url, method, headers, authType, authValue, bodyMapping,
                    gatekeeperMessage, timeoutMinutes, timeoutAction,
                    verification,
                    batchLogic,
                    schedule, cron, time, days, timezone,
                    subflowId, subflowName, workflowOverride, localOverride,
                    appProvider, appAction, appInputs,           // appaction node
                    webhookID, persistence }

ExecutionContext   { variables: Record<string,FlowPacket>,
                    nodes: Record<string,FlowPacket>,
                    __exit__?: boolean }                   // exit signal for early termination

ExtendedFlowState {
  // Canvas
  nodes[], edges[],
  selectedNodeId, highlightedNodeId, activeEdgeId,

  // Execution
  running, isRunning, isDryRun,
  currentContext, executionResult, executionState,
  finalResult, executedNodeIds,
  executionLogs,               // legacy — prefer useLogStore
  nodeStatuses: Record<string, NodeExecutionStatus>,   // "idle"|"running"|"success"|"error"|"skipped"
  nodeOutputs:  Record<string, FlowPacket>,            // reactive per-node results
  dependencyMap: Record<string, string[]>,             // nodeId → [parent IDs]

  // Chat
  isChatOpen, chatHistory[],

  // UI
  theme, showMinimap, showExecutionLogPanel, showVariablesPanel, showTerminal,
  tutorialStep, activeProject, projects[],
  layoutDirection,             // "TB" | "LR" for auto-layout

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
        "appaction"  → executeAppAction(provider, action, resolvedInputs)
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

### `getRawValue` (clientExecutor)
Recursively unwraps FlowPacket objects and nested value containers to produce a clean string. Priority chain: `string` passthrough → `number/boolean` stringify → `object.payload/text/message/status/value` recurse → `JSON.stringify` fallback. Prevents `[object Object]` in output rendering.

### `resolveTemplatePath` (clientExecutor)
Resolves dot-notation paths like `{{ai-node.x}}` against execution context. Splits on `.`, accesses `ctx.nodes[id]` then walks each property. If a direct property lookup fails on a FlowPacket, falls back to `JSON.parse(val.payload)[prop]` — enabling sub-key extraction from AI-generated JSON payloads (e.g., `{{content-gen.linkedin}}`).

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

### Prettified Output (ResponseGallery / SandboxGallery)
`ExecutionManifest` component runs a `useMemo` on `rawOutput`. If the trimmed output starts with `{` and parses as a non-array JSON object, renders key-value cards (one bordered row per entry). Otherwise renders as `<pre>`. Prevents raw `{"x":"...", "linkedin":"..."}` blobs from appearing as opaque text.

### File/Folder Attachments (`lib/utils/contextPacker.ts`)
`contextPacker.ts` packs uploaded files (images, source code, documents) into a structured text context block injected into LLM prompts. Used by the publish page to support file attachments in sandbox runs.

### Guest Mode + Auto-Migration
Editor supports unauthenticated (guest) users who work entirely in localStorage. On login, the guest flow is auto-migrated to the database. Cloud sync status indicator in the toolbar shows save state.

---

## Environment Sandbox

### Architecture
```
Browser                               Server (Vercel Node.js)
────────────────────────              ──────────────────────────────────
/publish  or  /sandbox/[id]           /api/sandbox/execute
┌──────────────────────────┐          ┌────────────────────────────────┐
│ Env Config Panel         │          │ serverExecutor.executeGraphServer│
│  [KEY] [value] [eye]     │─ POST ──►│  apiKeys[] injected             │
│  [Sync from Vault]       │          │  topological reactive dispatch  │
│ [Run Sandbox ▶]          │◄─ SSE ──│  SSE events:                   │
│ SandboxGallery           │          │    {t:"log"|"status"|"output"  │
│  · Terminal (live logs)  │          │      |"result"|"done"|"error"} │
│  · Final Result          │          └────────────────────────────────┘
│ [Share Sandbox 🔗]       │
└──────────────────────────┘
```

### `lib/flow/serverExecutor.ts`
Server-safe reimplementation of the reactive engine. Key differences from `clientExecutor.ts`:
- No `"use client"` directive — importable in API routes
- No ReactFlow types (uses plain `SandboxNode` / `SandboxEdge` interfaces)
- No `vaultStore` — accepts `apiKeys: SandboxApiKey[]` parameter; `resolveApiKeyFromList` replaces `resolveApiKey`
- `approval` / `gatekeeper` nodes: auto-pass with a WARN log (no browser UI to suspend on)
- `vault` nodes: returns the resolved query string, no vector-search HTTP call
- Same topological reactive dispatch as clientExecutor: `inflight` set + `Promise.all(roots)` + polling `while(inflight.size > 0)`

### `hooks/useSandboxExecution.ts`
Isolated client-side hook. Maintains its own `logs`, `nodeStatuses`, `nodeOutputs`, `executedNodeIds`, `finalResult`, `running` state — completely independent of `useFlowStore` / `useLogStore`. This prevents sandbox runs from opening the chat panel, polluting the editor's execution history, or affecting `nodeStatuses` on the canvas.

### `/api/sandbox/execute` SSE Protocol
```ts
// Events streamed as: data: <JSON>\n\n
{ t: "log",    type: "INFO"|"SUCCESS"|"ERROR"|"WARN", message: string, nodeId?: string }
{ t: "status", nodeId: string, status: "idle"|"running"|"success"|"error"|"skipped" }
{ t: "output", nodeId: string, packet: SandboxFlowPacket }
{ t: "result", packet: SandboxFlowPacket }   // context.variables.output after execution
{ t: "done" }
{ t: "error",  message: string }
```

### Publish Page Sandbox Flow
1. User fills "Environment Config" (key/value API keys) — or clicks **Sync from Vault** to 1-click populate from `useVaultStore` entries (one-way, vault → sandbox only; keys never written back or included in shared URL)
2. User types a test prompt in "Universal Input" (supports file/folder attachments packed via `contextPacker`)
3. **Run Sandbox**: `useSandboxExecution.run(nodes, edges, input, envKeys)` → POST to `/api/sandbox/execute` → SSE stream decoded → `SandboxGallery` updates live
4. **Share Sandbox**: calls `saveFlow(..., isPublic: true)` then `publishFlow(flowId)` → saves flow to Prisma, marks `isPublic: true`, copies `/sandbox/{flowId}` URL to clipboard — API keys are NOT saved
5. **Deploy to Store**: `toggleStoreDeployment(flowId, true)` → marks `isDeployed: true` → flow appears in `/store` page

### Shareable Sandbox Page (`/sandbox/[id]`)
- Server component loads flow from Prisma via `getFlow(id)`; 404 if `!isPublic && !isOwner`
- `SandboxClient.tsx` (client component): tester provides their own API keys + prompt, runs the flow via the same SSE endpoint
- No canvas, no code export — clean input/output interface

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
| App Action | `appaction` | OAuth-connected app action (8 providers); auth sourced from user integrations automatically |
| Final Result | `output` | Terminal node; feeds result into ChatHub via `addMessage` |

### Additional Implementation Types (not in architect schema)
| nodeType | File | Purpose |
|---|---|---|
| `subflow` / `subagent` | SubflowNode.tsx | Nested workflow execution — resolves `subflowId` or `workflowOverride` |
| `group` | GroupNode.tsx | Container that wraps/unwraps sub-agent node groups |
| `text` | TextNode.tsx | Static annotation/label node (canvas only, not executed) |

`AppActionNode.tsx` — canvas node for `appaction` type; shows app icon + action label; live connectivity status dot; alert badge if app/action not configured.

`NodeCard.tsx` — shared UI wrapper for all node types (header, body, handles, selected state styling).

Legacy aliases handled in executor: `ai_agent`, `agent-brain`, `llm` all route to the `ai` handler.

---

## AI Architect (`app/actions/ai-architect.ts`)
- Provider-agnostic server action: takes `{ prompt, provider, model, decryptedKey }`.
- Strict 12-type schema enforced in the system prompt; illegal types (including old aliases) silently filtered server-side before returning.
- **MANDATORY RULE**: root must be `input` for user-facing flows; `trigger` only for scheduled.
- **MANDATORY RULE**: every `ai` node must include `provider: "auto"` — no explicit provider/model/apiKey.
- **MANDATORY RULE**: if Node B's instructions reference `{{node-a}}`, the ONLY incoming edge to Node B must be from `node-a` — no shortcut edges.
- **MANDATORY RULE**: Approval gate MUST precede any action node that posts/sends data.
- **MANDATORY RULE**: use `appaction` (not `action`) for social/productivity apps (X, Slack, Discord, GitHub, Notion, Instagram, LinkedIn, Medium); `appaction` nodes auto-source auth from user integrations — no explicit token.
- Output contract: raw JSON object — no markdown fences, no extra keys.
- Default models: Gemini `gemini-2.5-flash`, Groq `llama-3.3-70b-versatile`, OpenAI `gpt-4o`.

---

## Graph Utilities

### Auto-Layout (`lib/flow/layoutEngine.ts`)
Dagre-based layout engine. Call with nodes/edges + direction (`"TB"` or `"LR"`). Returns repositioned nodes with `targetPosition`/`sourcePosition` set for ReactFlow handles. Group containers are skipped during layout. Direction stored in `flowStore.layoutDirection`.

### Cycle Detection (`lib/flow/validators.ts`)
Kahn's algorithm on the edge list. Returns `true` if cycles exist. Call before committing a new edge to the canvas to prevent invalid DAGs.

### Vector Search (`app/api/vector-search/route.ts`)
POST `{ query, chunks, topK }` → ranked matches. BM25 scoring (TF-IDF variant) with no external dependencies. Used by the Vault node for local document retrieval.

### Expression Evaluator (`lib/expressionEvaluator.ts`)
Boolean/English expression parser for router node conditions. Evaluates expressions like `"output > 100"`, `"tags includes 'urgent'"`, `"is greater than"`. Used by the router node to resolve branching paths.

---

## App Integrations (`lib/providers/` + `app/actions/integration.ts`)

OAuth-connected external app actions. Token management is entirely server-side; nodes reference integrations by `appProvider` + `appAction` name.

**Supported apps** (via `lib/providers/` + `APP_REGISTRY` in `lib/providers/index.ts`):
| Provider | Actions | Notes |
|---|---|---|
| X (Twitter) | `create_tweet`, `send_dm` | Bearer Token auth |
| Slack | `send_message`, `send_dm` | Bot OAuth Token |
| Discord | `send_channel_message`, `send_dm` | Bot Token, "Bot" auth prefix |
| GitHub | `create_issue`, `create_comment` | Personal Access Token |
| Notion | `create_page` | Integration Token, Notion-Version header |
| Instagram | `create_post` | Access Token; 2-step: create container → publish |
| LinkedIn | `create_post` | Access Token; 2-step: GET /me → POST ugcPosts |
| Medium | `create_post` | Integration Token; 2-step: GET /me → POST /users/{id}/posts |

**Brand Icons** (`app/dashboard/integrations/page.tsx`): All 8 providers have official SVG brand icons at exact brand colors (X: #000000, Slack: #4A154B, Discord: #5865F2, GitHub: #24292e, Notion: #ffffff, Instagram: #E1306C, LinkedIn: #0077B5, Medium: #000000). Rendered in the integrations management UI.

**`app/actions/integration.ts`** — server actions:
- `getIntegrations()` — fetch user's connected providers
- `upsertIntegration(provider, accessToken, refreshToken?)` — store/update token
- `deleteIntegration(provider)` — revoke connection
- `executeAppAction(provider, action, inputs)` — dispatch to the appropriate service adapter

**Prisma model**: `Integration { id, userId, provider, accessToken, refreshToken, metadata }` with unique constraint `(userId, provider)`.

**Management UI**: `app/dashboard/integrations/page.tsx` — official brand icons, token input forms, live connection status, connect/disconnect actions.

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

## Canvas Export (`lib/utils/export.ts`)

Three async functions for exporting the React Flow canvas:
- **`exportAsPng()`** — html-to-image `toPng()`, pixelRatio 2, theme-aware background, downloads `workflow.png`
- **`exportAsJpeg()`** — html-to-image `toJpeg()`, pixelRatio 2, quality 0.92, downloads `workflow.jpg`
- **`exportAsPdf()`** — captures PNG first, auto-detects landscape/portrait, constructs jsPDF at pixel dimensions, saves `workflow.pdf`

Background color is dark-mode aware: `#0f172a` (dark) / `#f8fafc` (light), detected via `.dark` class presence on `document.documentElement`. Triggered from the Download dropdown in the editor toolbar.

---

## Flow Templates (`lib/constants/templates.ts`)

Four pre-built templates selectable from the editor toolbar:

| ID | Name | Nodes | Description |
|---|---|---|---|
| `basic-chatbot` | Basic Chatbot | 3 | input → ai → output |
| `research-assistant` | Research Assistant | 4 | input → ai researcher → ai summarizer → output |
| `omnichannel-content` | Omnichannel Content Generator | 7 | input → ai (JSON) → approval → appaction×3 (X/LinkedIn/Medium) → output |
| `webhook-processor` | Webhook Processor | 4 | trigger → processor → ai → output |

The Omnichannel template demonstrates: AI generating structured `{x, linkedin, medium}` JSON → parallel publish with human approval gate → per-platform `{{ai-node.x}}` / `{{ai-node.linkedin}}` / `{{ai-node.medium}}` sub-key extraction.

---

## Code Export / Publish (`app/publish/page.tsx` + `lib/flowCompiler.ts`)

### Publish Page
- Left panel: universal input textarea (with file/folder attachments), response gallery (final result + sandbox run), Deploy to Store
- Right panel: language tab selector, library dropdown, compiled code viewer (read-only), Copy + Download buttons
- Library dropdown shows install command + description per library
- Refine input: uses Groq Llama 3 8B to improve prompt quality before sandbox run

### Flow Compiler (`lib/flowCompiler.ts`)
Polyglot compilation using Kahn's topological sort:
1. Sort nodes by dependency order (`topoSort`)
2. Convert labels to `snake_case` identifiers (`getSemanticNames`)
3. Detect LLM providers + ENV keys (`collectFlowMeta`)
4. Emit per-library code blocks with `genInstallComment` + `genHelperCode` at file header

**Supported languages & libraries**:
| Language | Libraries |
|---|---|
| TypeScript | fetch (built-in), axios, node-fetch |
| JavaScript | fetch (built-in), got, axios |
| Python | requests, httpx, aiohttp (async) |

**`lib/codegen/templates.ts`** provides:
- `LibraryMeta` — install cmd, async flag, language tag per library
- `liftTemplate(template, names, lib)` — converts `{{key}}` / `{{key.prop}}` to `_get(ctx['key'], 'prop')` calls (TS/JS) or `_get(ctx.get('key'), 'prop')` (Python)
- `genHelperCode(lib, isTS)` — emits `_s()` (safe stringify), `_get()` (FlowPacket unwrap + JSON sub-key fallback), `vaultLookup()` stub at top of every compiled file
- `genInstallComment(lib, providers, hasSchedule)` — emits `pip install` / `npm install` comment listing all required packages (library + LLM SDK + schedule if needed)
- `genHttpBlock(lib, opts)` — full HTTP request boilerplate across all 7 libraries
- `genLLMBlock(lib, provider, model, varName, promptExpr, ind)` — real LLM API calls (Groq/OpenAI/Gemini/Anthropic) for all 7 libraries
- `genApprovalPause(lib, label, varName, ind)` — CLI `input()` / `readline` pause for approval gates
- `getLibrariesForTab(tab)` / `getDefaultLibrary(tab)` — language → library list
- `APP_PROVIDER_ENV_KEYS` — env var name map for all 8 app providers
- `buildRouterCond(condRaw, inputVar, lang)` — converts free-text conditions ("urgent, critical") to keyword-based boolean expressions (`inputVar.includes('urgent') || inputVar.includes('critical')`)

**App Action compilation** (`genAppActionBlock`): All 8 providers compiled with real API calls. Instagram, LinkedIn, and Medium use multi-step sequences:
- **Instagram**: Step 1 create media container → Step 2 publish (params: `image_url`, `caption`, `access_token`)
- **LinkedIn**: Step 1 GET `/v2/me` for member ID → Step 2 POST `/v2/ugcPosts` with UGC structure
- **Medium**: Step 1 GET `/v1/me` for user ID → Step 2 POST `/v1/users/{id}/posts`

**Schedule compilation** (`buildCronBlock`): JS uses `node-cron` expressions; Python uses `schedule` library with `.every()` chains.

---

## ResponseGallery (`components/flow/ResponseGallery.tsx`)
Two tabs:
- **Terminal** — real-time execution logs (INFO/SUCCESS/ERROR/WARN with color coding, auto-scroll, auto-focus on run). Dry Run mode shows "SIM" badge. Clear + log-count controls.
- **Final Result** — `ExecutionManifest` component: per-node status list (✓/✗/⏭), execution time, agent count; Final Output section renders JSON payloads as labelled key-value cards (one row per key) or plain `<pre>` for plain text. Copy Manifest + Export buttons.

Auto-switches to Terminal on run start, Final Result on completion.

**Prettified Output logic**: `useMemo` on `rawOutput` — if trimmed string starts with `{` and `JSON.parse` succeeds with a non-array object, emits `{ type: "json", entries: [key, value][] }` for card rendering; otherwise `{ type: "text", value: string }` for `<pre>`.

---

## Agent Store (`app/store/page.tsx`)
Public marketplace for deployed flows:
- Browse all flows where `isDeployed: true` via `getDeployedFlows()`
- Grid layout with flow thumbnails and metadata
- Users can run deployed agents directly via the sandbox interface
- Owners deploy/undeploy via `toggleStoreDeployment(flowId, bool)` from the publish page

---

## Auth & Persistence
- Supabase handles auth (OAuth callback at `app/auth/callback/`). Providers: Google, GitHub, Apple, magic link.
- Flows saved via Prisma → Postgres (Supabase).
- Projects scoped to user; public flows at `/view/[id]` (read-only or editable via `publicEditable` flag).
- Guest mode: unauthenticated users work in localStorage; auto-migrated to DB on login.
- `lib/flowPersistence.ts` — save/load helpers.
- `lib/versionSnapshots.ts` — flow version history (localStorage).
- Auto-save: debounced 2s with cloud sync status indicator in editor toolbar.

---

## Prisma Models
| Model | Key Fields | Purpose |
|---|---|---|
| Flow | id, userId, projectId, nodes (JSON), edges (JSON), isPublic, publicEditable, isDeployed | Core workflow definition |
| Project | id, userId, name | Groups of flows |
| Folder | id, userId, name | Legacy flow organization |
| Vault | id, userId, key, value (encrypted) | Per-user API key storage |
| Integration | id, userId, provider, accessToken, refreshToken, metadata | OAuth app tokens |

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
| `setIsDryRun(value)` | Toggle dry-run / simulation mode |
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

### `registryStore.ts` — Published Agent Registry
- `agents: PublishedAgent[]` — localStorage-backed list of deployed agents
- `loadAgents()`, `publishAgent()`, `deleteAgent()`, `incrementRun()`
