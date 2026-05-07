# PROJECT_CONTEXT.md

## Overview
**FlowForge AI** — Visual AI workflow builder. Users compose node graphs on a React Flow canvas; a topological reactive engine executes them, calling LLMs and routing data between nodes. Built on Next.js 15 App Router + Zustand + Supabase + Prisma.

---

## Stack
| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19, Tailwind 4, shadcn/ui, Framer Motion 12 |
| Graph | ReactFlow 11 |
| State | Zustand 5 |
| Auth/DB | Supabase (auth + realtime), Prisma 7 |
| AI Providers | Gemini, Groq, OpenAI, Anthropic |
| Sandbox | E2B (`@e2b/code-interpreter` v2) — browser automation + code execution |
| Canvas Export | html-to-image 1.11, jsPDF 4.2 |
| Language | TypeScript 5 (strict) |

---

## Directory Map
```
app/
  actions/
    ai-architect.ts     # NL prompt → validated flow JSON (12-node schema)
    integration.ts      # OAuth CRUD + executeAppAction (8 providers + browser/E2B)
    auth.ts             # Supabase sign out
    flow.ts             # Flow CRUD: save/get/publish/deploy/delete/folders/templates
    project.ts          # Project CRUD + templates
  api/
    sandbox/execute/route.ts   # POST → SSE: runs serverExecutor; maxDuration=60
    vector-search/route.ts     # BM25 lexical search (no external dep)
  editor/page.tsx        # Main canvas (1700+ lines): FlowCanvas, sidebars, toolbar, AI Architect, approval, chat, terminal, dry-run/live, auto-save
  publish/page.tsx       # Publish & Export: sandbox env config, Run Sandbox (SSE), Share, Deploy, polyglot codegen, Refine (Groq)
  sandbox/[id]/
    page.tsx             # Server component: loads flow, access-controls, renders SandboxClient
    SandboxClient.tsx    # Client: API key config, prompt input, SandboxGallery; calls /api/sandbox/execute
  dashboard/
    page.tsx             # Mission Control: workspace sidebar, recent flows, vault, stats
    integrations/page.tsx  # OAuth integration management UI — 9 providers (8 OAuth + Browser Agent)
  store/page.tsx         # Agent Store: browse/run deployed public flows
  store/AgentGrid.tsx    # Grid + AgentCard — dates use "en-US" locale (hydration-safe)
  view/[id]/page.tsx     # Public read-only / editable flow viewer

components/
  flow/
    nodes/              # One file per node type + NodeCard.tsx (shared wrapper)
    canvas/             # FlowCanvas (editable), ReadOnlyCanvas
    chat/               # ChatHub — floating chat + approval routing
    sidebar/            # NodeSettingsSidebar (app action settings panel), NodeSidebar
    ImageLightbox.tsx          # Shared Framer Motion lightbox — click image → full-size overlay; Escape/overlay click to close
    AIArchitectModal.tsx
    ResponseGallery.tsx        # Editor Terminal + Final Result tabs (reads useFlowStore + useLogStore); image-aware output
    SandboxGallery.tsx         # Prop-driven Terminal + Final Result (reads useSandboxExecution props); image-aware output
    ExecutionLogPanel.tsx
    FinalResultPanel.tsx
    ApprovalBanner.tsx
    VariableInspectorPanel.tsx
    SharedViewContent.tsx

hooks/
  useSandboxExecution.ts  # Client hook: POSTs to /api/sandbox/execute, reads SSE, maintains isolated state (no flowStore writes)

lib/
  flow/
    clientExecutor.ts   # Reactive Engine ("use client") — main editor execution path; calls executeAppAction for appaction nodes
    serverExecutor.ts   # Server-safe reactive engine — used by /api/sandbox/execute; static import of e2bRunner; routes appProvider==="browser" to E2B before OAuth path
    layoutEngine.ts     # Dagre auto-layout (TB/LR)
    validators.ts       # Kahn's cycle detection
    modelRegistry.ts    # Node type registry + model fallback chains
  sandbox/
    e2bRunner.ts        # E2B wrapper — runCodeInE2B(), runBrowserActionInE2B(); 30s timeout; nest_asyncio for screenshot; RESULT markers; base64 whitespace stripping
  providers/
    index.ts            # APP_REGISTRY (9 providers incl. "browser"); AppProvider type
    xService.ts / slackService.ts / discordService.ts / githubService.ts
    notionService.ts / instagramService.ts / linkedinService.ts / mediumService.ts
  codegen/templates.ts  # Polyglot codegen helpers
  constants/templates.ts  # 4 built-in flow templates
  utils/
    export.ts           # exportAsPng/Jpeg/Pdf
    contextPacker.ts    # Pack uploaded files into LLM prompt context
    tokenCost.ts        # Per-model cost calculation
  approvalGate.ts       # Promise-based pause/resume (breaks flowStore circular dep)
  flowCompiler.ts       # Flow → Python/TS/JS (7 HTTP libraries)
  expressionEvaluator.ts  # Boolean/English router condition parser
  flowPersistence.ts / versionSnapshots.ts / savedAgents.ts / template.ts
  prisma.ts / utils.ts / supabase/

stores/
  flowStore.ts          # Primary store — nodes, edges, execution, chat, nodeOutputs, undo/redo
  useLogStore.ts        # Execution log entries
  vaultStore.ts         # API key store + architectKey session persistence
  useCostStore.ts       # Token cost accumulation
  registryStore.ts / simulationStore.ts / themeStore.ts

types/
  flowStoreTypes.ts / agent.ts / dataTypes.ts

next.config.ts          # serverExternalPackages: ["@e2b/code-interpreter", "e2b"]
```

---

## Core Data Types
```ts
FlowPacket   { type: "text"|"file"|"data", payload: any, error?, meta?, attachments?, fileContext? }
NodeData     { label, instructions, provider, modelName, apiKey,
               routes, conditions, resultFormat, packet,
               connectionType, url, method, headers, authType, authValue, bodyMapping,
               appProvider, appAction, appInputs,
               subflowId, subflowName, workflowOverride,
               gatekeeperMessage, batchLogic, schedule, cron, webhookID }
ExecutionContext  { variables: Record<string,FlowPacket>, nodes: Record<string,FlowPacket>, __exit__? }
NodeExecutionStatus  "idle"|"running"|"success"|"error"|"skipped"
```

---

## Execution Paths

### Editor (client-side) — `clientExecutor.ts`
```
runClientFlow(input)
  → set nodeOutputs:{}, nodeStatuses:{}, isRunning:true
  → executeGraph(nodes, edges, input, ...) — topological reactive dispatch
      each node fires when ALL incoming sources complete
      appaction → executeAppAction() [server action]
        if provider==="browser" → e2bRunner (early return, no OAuth lookup)
        else → OAuth token from Prisma → provider service
  → after run: read live chatHistory for output node's addMessage calls
```

### Sandbox (server-side) — `serverExecutor.ts` → `/api/sandbox/execute`
```
POST {nodes, edges, input, apiKeys[]} → SSE stream
  executeGraphServer() — same topological dispatch, no browser deps
  appaction:
    if provider==="browser" → runBrowserActionInE2B / runCodeInE2B (static import)
    else → executeAppAction() [server action, OAuth path]
  SSE events: {t:"log"|"status"|"output"|"result"|"cost"|"done"|"error"}
```

**Key difference:** Editor runs in-browser, uses vaultStore for keys, updates flowStore, supports approval gates. Sandbox runs server-side, accepts `apiKeys[]`, writes to isolated `useSandboxExecution` state only.

---

## E2B Browser Agent

**Provider ID:** `"browser"` — in `APP_REGISTRY`, `AppProvider` type, `executeAppAction`, `serverExecutor`.

**Actions** (all defined in `lib/providers/index.ts` + handled in `lib/sandbox/e2bRunner.ts`):
| Action ID | Description |
|---|---|
| `browse_and_summarize` | requests + BeautifulSoup — extracts readable text |
| `scrape_page` | Structured JSON (title, headings, paragraphs, links) |
| `screenshot_page` | Playwright async + nest_asyncio + file-based PNG → base64 |
| `run_python` | User-supplied Python code, run as-is |
| `run_javascript` | User-supplied JS (Node), run as-is |

**Result extraction protocol:**
- Every script prints `---RESULT_START---{data}---RESULT_END---` with `flush=True`
- `runBrowserActionInE2B` accumulates all stdout into `rawLines[]`, suppresses RESULT lines from user terminal, then regex-extracts after execution
- Base64 image results have all whitespace stripped (handles E2B line-chunking)
- Fallback: `"Error: No result captured from sandbox."`

**Image rendering pipeline:**
- `data:image/` prefix detected in: `ResponseGallery`, `SandboxGallery`, `ChatHub`, `OutputNode`
- All render `<img>` instead of `<pre>`; click → `ImageLightbox` (Framer Motion fade+scale, Escape/overlay to close)

**No OAuth required** — `executeAppAction` returns early for `provider==="browser"` before the Prisma integration lookup.

---

## Reactive Engine — Key Patterns

**Topological dispatch:** adjacency + dependency maps; roots (in-degree 0) fire immediately; each node fires when `remainingDeps === 0`; resolves when `inflight` set empty.

**Exit signal:** AI node returning `"EXIT"|"STOP"` sets `context.__exit__`; pending nodes are SKIPPED.

**Error isolation:** failure cascades SKIPPED only to transitive descendants; other branches continue.

**JIT key resolution (`resolveApiKey` / `resolveApiKeyFromList`):**
1. Node-level `data.apiKey`
2. Vault entry matching provider prefix (`gsk_`→Groq, `sk-`→OpenAI, `AIza`→Gemini, `sk-ant-`→Anthropic)
3. Auto-select first vault entry

**SeqAttn:** strips context to only `{{ref}}`-ed keys before each AI node call.

**`assertTemplateDeps`:** validates all `{{nodeId}}` refs are in context before execution; fails fast on missing edges.

**`.output` alias:** `{{id.output}}` maps `"output"` → `"payload"` in all template resolvers.

**Model fallback chain:** `resolveModelChain()` in `modelRegistry.ts`; 404/410/429 → cascade to next model.

---

## Node Types

### 12 Canonical (AI Architect schema)
| Name | nodeType | Purpose |
|---|---|---|
| Starting Point | `input` | User message entry |
| Smart Trigger | `trigger` | Scheduled/automated entry |
| Webhook | `webhook` | Incoming HTTP trigger |
| AI Brain | `ai` | LLM call (`provider:"auto"` picks vault key) |
| Knowledge Vault | `vault` | RAG / document lookup |
| Decision | `router` | N-way conditional branching |
| Safety Gatekeeper | `gatekeeper` | AI critic or human review |
| Approval Gate | `approval` | Human-in-the-loop pause |
| Logic Processor | `processor` | Data transform / batch loop |
| Integration | `action` | Outgoing HTTP call (requires `url`) |
| App Action | `appaction` | OAuth app (8 providers) or E2B browser (1 provider) |
| Final Result | `output` | Terminal node; feeds ChatHub; shows image thumbnail if payload is `data:image/` |

### Additional (not in architect schema)
| nodeType | Purpose |
|---|---|
| `subflow`/`subagent` | Nested workflow execution |
| `group` | Container for sub-agent node groups |
| `text` | Static canvas annotation |

**Sandbox mode:** `approval`/`gatekeeper` nodes auto-pass with WARN log.

---

## App Integrations

**9 providers in `APP_REGISTRY`** (`lib/providers/index.ts`):

| Provider | Key Actions | Auth |
|---|---|---|
| X (Twitter) | create_tweet, send_dm | Bearer Token |
| Slack | send_message, send_dm | Bot OAuth Token |
| Discord | send_channel_message, send_dm | Bot Token |
| GitHub | create_issue, create_comment | Personal Access Token |
| Notion | create_page | Integration Token |
| Instagram | create_post | Access Token (2-step) |
| LinkedIn | create_post | Client Secret (2-step) |
| Medium | create_post | Integration Token (2-step) |
| **Browser** | browse_and_summarize, scrape_page, screenshot_page, run_python, run_javascript | **E2B_API_KEY (env)** |

`executeAppAction` in `app/actions/integration.ts` — browser provider returns early (no Prisma lookup); all others require an `Integration` row in DB.

---

## AI Architect Rules
- Root must be `input` (user flows) or `trigger` (scheduled)
- All `ai` nodes: `provider:"auto"`, no explicit key
- If Node B references `{{node-a}}`, the ONLY incoming edge to B is from `node-a`
- Approval gate MUST precede any action/appaction that posts data
- Use `appaction` (not `action`) for the 8 OAuth providers
- Output: raw JSON, no markdown fences

---

## Prettified Output Logic (`ResponseGallery` + `SandboxGallery`)
Priority order in `useMemo` on `rawOutput`:
1. Starts with `data:image/` → `{ type:"image", src }` → `<img>` + lightbox on click
2. Starts with `{` and parses as non-array object → `{ type:"json", entries }` → key-value cards
3. Else → `{ type:"text", value }` → `<pre>`

---

## Auth & Persistence
- Supabase: OAuth (Google, GitHub, Apple) + magic link; callback at `app/auth/callback/`
- Flows/Projects/Integrations/Vault → Prisma → Postgres (Supabase)
- Guest mode: localStorage; auto-migrated to DB on login
- Auto-save: debounced 2s with sync indicator
- Version snapshots: localStorage (`lib/versionSnapshots.ts`)

## Prisma Models
| Model | Key Fields |
|---|---|
| Flow | id, userId, projectId, nodes (JSON), edges (JSON), isPublic, publicEditable, isDeployed |
| Project | id, userId, name |
| Folder | id, userId, name |
| Vault | id, userId, key, value (encrypted) |
| Integration | id, userId, provider, accessToken, refreshToken, metadata; unique(userId, provider) |

---

## Code Export (`lib/flowCompiler.ts` + `app/publish/page.tsx`)
Kahn's topo-sort → snake_case identifiers → detect providers → emit per-library blocks.

| Language | Libraries |
|---|---|
| TypeScript | fetch, axios, node-fetch |
| JavaScript | fetch, got, axios |
| Python | requests, httpx, aiohttp |

`lib/codegen/templates.ts` provides: `liftTemplate`, `genHelperCode`, `genInstallComment`, `genHttpBlock`, `genLLMBlock`, `genApprovalPause`, `genAppActionBlock`, `buildRouterCond`, `buildCronBlock`.

---

## Key Store Actions (`flowStore.ts`)
`setNodes/setEdges`, `addNode`, `deleteNode`, `updateNodeData`, `setNodeStatus`, `setNodeOutput`, `runClientFlow`, `setIsDryRun`, `addMessage`, `takeSnapshot/undo`, `clearCanvas`, `unwrapSubagent`, `wrapSubagent`, `applyAutoLayout`, `autoSave/restoreAutoSave`
