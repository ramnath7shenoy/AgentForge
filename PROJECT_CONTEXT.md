# PROJECT_CONTEXT.md

## Stack
Next.js 15 App Router · React 19 · Tailwind 4 · shadcn/ui · Framer Motion 12 · ReactFlow 11 · Zustand 5 · Supabase + Prisma 7 · TypeScript 5 strict · E2B `@e2b/code-interpreter` v2

AI providers: Gemini · Groq · OpenAI · Anthropic (auto-detected via vault key prefix)

---

## Directory Map
```
app/
  actions/
    ai-architect.ts      # NL → validated flow JSON (12-node schema)
    integration.ts       # OAuth CRUD + executeAppAction (8 OAuth + browser/E2B)
    flow.ts              # Flow CRUD: save/get/publish/deploy/delete/folders/templates
    project.ts           # Project CRUD + templates
  api/
    sandbox/
      execute/route.ts        # POST → SSE: runs serverExecutor; maxDuration=60
      execute-code/route.ts   # POST → SSE: raw E2B code execution; pip pre-install from # pip install header; maxDuration=60
    vector-search/route.ts    # BM25 lexical search
  editor/page.tsx        # Main canvas (~1700 lines): FlowCanvas, sidebars, toolbar, AI Architect, approval, chat, terminal, dry-run/live, auto-save
  publish/page.tsx       # Publish & Export: sandbox env config (vault auto-injected), flowId-keyed localStorage persistence, Execute + Recompile buttons, polyglot codegen
  sandbox/[id]/
    page.tsx             # Server: loads flow, access-control, renders SandboxClient
    SandboxClient.tsx    # Client: API key config, prompt input, SandboxGallery
  dashboard/
    page.tsx             # Mission Control: workspace sidebar, recent flows, vault, stats
    integrations/page.tsx
  store/page.tsx + AgentGrid.tsx  # Agent Store: browse/run deployed public flows
  view/[id]/page.tsx     # Public read-only / editable flow viewer

components/flow/
  nodes/                 # One file per node type + NodeCard.tsx
  canvas/                # FlowCanvas (editable), ReadOnlyCanvas
  chat/ChatHub.tsx       # Floating chat + approval routing
  sidebar/               # NodeSettingsSidebar, NodeSidebar
  ResponseGallery.tsx    # Editor Terminal + Final Result (reads flowStore/logStore); image-aware
  SandboxGallery.tsx     # Prop-driven Terminal + Final Result; image-aware
  ImageLightbox.tsx      # Framer Motion lightbox — Escape/overlay click to close

hooks/useSandboxExecution.ts  # POSTs to /api/sandbox/execute, reads SSE, isolated state

lib/
  flow/
    clientExecutor.ts    # Reactive engine ("use client") — editor path; calls executeAppAction
    serverExecutor.ts    # Server-safe reactive engine — /api/sandbox/execute; static e2bRunner import
    layoutEngine.ts / validators.ts / modelRegistry.ts
  sandbox/e2bRunner.ts   # runCodeInE2B(), runBrowserActionInE2B(); RESULT markers; base64 strip; nest_asyncio
  providers/index.ts     # APP_REGISTRY (9 providers); AppProvider type
  codegen/templates.ts   # Polyglot codegen: liftTemplate (triple-quoted Python), genUniversalLLMHelper, genBrowserActionBlock, genHttpBlock, genApprovalPause, genAppActionBlock
  flowCompiler.ts        # Flow → Python/TS/JS; injects universal LLM helper; detects hasBrowserAction; edges passed for upstream URL resolution
  utils/
    resolveTargetUrl.ts  # (new) URL resolution helper
    export.ts / contextPacker.ts / tokenCost.ts
  expressionEvaluator.ts / approvalGate.ts / flowPersistence.ts

stores/
  flowStore.ts / useLogStore.ts / vaultStore.ts / useCostStore.ts / registryStore.ts
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
```

---

## Execution Paths

### Editor — `clientExecutor.ts`
```
runClientFlow(input) → executeGraph() topological dispatch
  appaction → executeAppAction() [server action]
    provider==="browser" → e2bRunner (early return, no OAuth)
    else → Prisma Integration row → provider service
```

### Sandbox — `serverExecutor.ts` → `/api/sandbox/execute`
```
POST {nodes, edges, input, apiKeys[]} → SSE
  executeGraphServer() — same topo dispatch, no browser deps
  appaction: browser → e2bRunner; else → executeAppAction() OAuth path
  SSE: {t:"log"|"status"|"output"|"result"|"cost"|"done"|"error"}
```

### Code Execution — `/api/sandbox/execute-code`
```
POST {code, language, envVars} → SSE
  Parse # pip install from first 20 lines → pip install --quiet before run
  Vault keys auto-injected from vaultStore (explicit envKeys override)
  E2B Sandbox.create() → runCode() → stream stdout/stderr
  TypeScript: base64-encode → write /tmp script → tsx via spawnSync
  SSE: {t:"log"|"stdout"|"stderr"|"error"|"done"}
```

---

## E2B Browser Agent

**Provider:** `"browser"` — no OAuth, uses `E2B_API_KEY` env.

| Action | Method |
|---|---|
| `browse_and_summarize` | requests + BeautifulSoup |
| `scrape_page` | structured JSON (title, headings, paragraphs, links) |
| `screenshot_page` | Playwright async + nest_asyncio + file-based PNG → base64 |
| `run_python` / `run_javascript` | user code as-is |

**Result protocol:** every script prints `---RESULT_START---{data}---RESULT_END---` (flush=True). `runBrowserActionInE2B` regex-extracts after run; suppresses RESULT lines from user terminal. Base64: all whitespace stripped (handles E2B line-chunking). Fallback: `"Error: No result captured from sandbox."`

**Image rendering:** `data:image/` prefix → `<img>` + `ImageLightbox` in ResponseGallery, SandboxGallery, ChatHub, OutputNode.

---

## Reactive Engine

**Topo dispatch:** adjacency + dependency maps; roots (in-degree 0) fire immediately; node fires when `remainingDeps === 0`; resolves when inflight set empty.

**Exit signal:** AI returning `"EXIT"|"STOP"` sets `context.__exit__`; pending nodes SKIPPED.

**Error isolation:** failure cascades SKIPPED only to transitive descendants.

**JIT key resolution (`resolveApiKey`):**
1. Node-level `data.apiKey`
2. Vault entry matching prefix (`gsk_`→Groq, `sk-`→OpenAI, `AIza`→Gemini, `sk-ant-`→Anthropic)
3. First vault entry

**SeqAttn:** strips context to only `{{ref}}`-ed keys before each AI node.

**`assertTemplateDeps`:** validates all `{{nodeId}}` refs are in context; fails fast.

**`.output` alias:** `{{id.output}}` maps `"output"` → `"payload"`.

---

## Node Types (12 canonical + extras)
`input` · `trigger` · `webhook` · `ai` · `vault` · `router` · `gatekeeper` · `approval` · `processor` · `action` · `appaction` · `output`

Extras: `subflow`/`subagent` · `group` · `text`

Sandbox mode: `approval`/`gatekeeper` auto-pass with WARN log.

---

## App Integrations (9 providers)
X · Slack · Discord · GitHub · Notion · Instagram · LinkedIn · Medium · **Browser** (E2B)

`executeAppAction` returns early for `provider==="browser"` — no Prisma lookup.

---

## Code Export (`flowCompiler.ts` + `publish/page.tsx`)

Kahn's topo-sort → snake_case identifiers → detect providers → emit per-library blocks.

| Language | Libraries |
|---|---|
| Python | requests · httpx · aiohttp |
| TypeScript | fetch · axios · node-fetch |
| JavaScript | fetch · got · axios |

**Universal LLM helper** (`genUniversalLLMHelper`): injected once when any LLM node present. Lazy-imports first provider whose key is in env: GROQ → OPENAI → ANTHROPIC → GEMINI. `# pip install` header auto-lists all four packages.

**Browser action codegen** (`genBrowserActionBlock`): generates Playwright/requests code. When `appInputs['url']` is empty, resolves URL from upstream node via edges: `_get(ctx.get('upstreamVar'), 'payload')`.

**Persistence** (`publish/page.tsx`): `compiledCode` persisted to `FORGE_PUBLISH_STATE_${flowId}` localStorage key. `skipNextCompile` ref prevents overwrite on mount restore.

---

## Auth & Persistence
- Supabase OAuth (Google, GitHub, Apple) + magic link; callback `app/auth/callback/`
- Flows/Projects/Integrations/Vault → Prisma → Postgres
- Guest mode: localStorage; auto-migrated on login
- Auto-save: debounced 2s

## Prisma Models
`Flow` (nodes/edges JSON, isPublic, isDeployed) · `Project` · `Folder` · `Vault` (key/value encrypted) · `Integration` (provider, accessToken, refreshToken; unique userId+provider)

---

## AI Architect Rules
- Root: `input` (user flows) or `trigger` (scheduled)
- All `ai` nodes: `provider:"auto"`, no explicit key
- `{{node-a}}` ref → only incoming edge from `node-a`
- Approval gate before any action/appaction that posts data
- Use `appaction` (not `action`) for OAuth providers
- Output: raw JSON, no markdown fences

---

## Output Rendering Priority (`ResponseGallery` / `SandboxGallery`)
1. `data:image/` → `<img>` + lightbox
2. `{...}` non-array object → key-value cards
3. else → `<pre>`
