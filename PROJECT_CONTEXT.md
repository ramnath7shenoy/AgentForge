# PROJECT_CONTEXT.md

## Stack
Next.js 15 App Router · React 19 · Tailwind 4 · shadcn/ui · Framer Motion 12 · ReactFlow 11 · Zustand 5 · Supabase + Prisma 7 · TypeScript 5 strict · E2B `@e2b/code-interpreter` v2 · Liveblocks v3 (`@liveblocks/client`, `@liveblocks/node`, `@liveblocks/zustand`)

AI providers: Gemini · Groq · OpenAI · Anthropic (auto-detected via vault key prefix)

---

## Directory Map
```
app/
  actions/
    ai-architect.ts      # NL → validated flow JSON (12-node schema)
    integration.ts       # OAuth CRUD + executeAppAction (8 OAuth + browser/E2B) + getIntegrationEnvVars()
    flow.ts              # Flow CRUD: save/get/publish/deploy/delete/folders/templates
    project.ts           # Project CRUD + templates
  api/
    sandbox/
      execute/route.ts        # POST → SSE: runs serverExecutor; maxDuration=60
      execute-code/route.ts   # POST → SSE: raw E2B code execution; maxDuration=60
    vector-search/route.ts
  editor/page.tsx        # Main canvas (~1700 lines): FlowCanvas, sidebars, toolbar, AI Architect, chat, terminal
  publish/page.tsx       # Publish & Export: Mirror Mode sandbox, polyglot codegen, flowId-keyed localStorage
  sandbox/[id]/
    page.tsx / SandboxClient.tsx   # Server-rendered sandbox with API key config
  dashboard/page.tsx · integrations/page.tsx
  store/
    page.tsx          # Server component: fetches deployed flows, passes to StoreClient
    StoreClient.tsx   # Category filter, search, Recent/Popular sort toggle
    AgentGrid.tsx     # AgentCard grid; guest clone → localStorage["agentforge_guest_flow"] → /editor
    WorkflowLightbox.tsx · CodeModal.tsx · ManagePanel.tsx

components/flow/
  nodes/                 # One file per node type + NodeCard.tsx
  canvas/                # FlowCanvas, ReadOnlyCanvas
  chat/ChatHub.tsx
  collaboration/
    FlowCollaboration.tsx    # Manages enterRoom/leaveRoom lifecycle (pure side effect, returns null)
    CollaborationStatus.tsx  # "Live"/"Syncing…" badge + avatar row for other users
  sidebar/
    NodeSettingsSidebar.tsx  # AppAction label auto-syncs to action.label on mount via useEffect
    NodeSidebar.tsx          # Vault tab: preferred provider dropdown
  ResponseGallery.tsx / SandboxGallery.tsx / ImageLightbox.tsx

hooks/useSandboxExecution.ts

lib/
  flow/
    clientExecutor.ts    # Reactive engine; strips zombie nodes; strict upstream content injection
    serverExecutor.ts    # Server reactive engine; same zombie strip + content injection
  sandbox/e2bRunner.ts
  providers/index.ts     # APP_REGISTRY (9 providers); CONTENT_FIELD_KEYS; isContent flag on fields
  codegen/templates.ts   # Polyglot codegen helpers; APP_PROVIDER_ENV_KEYS
  flowCompiler.ts        # topoSort skips isolated nodes; upstream ctx used for content fields
  liveblocks/
    client.ts            # createClient({ authEndpoint: "/api/liveblocks-auth" })
    rooms.ts             # getFlowRoomId(flowId) → "flow:<uuid>"; getFlowIdFromRoom(roomId)
  generated/prisma/      # Regenerate with `npx prisma generate` if schema changes

stores/
  flowStore.ts           # deleteNode purges nodeStatuses/nodeOutputs/executedNodeIds/executionResult
  vaultStore.ts          # preferredProvider: string|null persisted; setPreferredProvider()
  useLogStore.ts / useCostStore.ts / registryStore.ts
```

---

## Core Data Types
```ts
FlowPacket   { type:"text"|"file"|"data", payload:any, error?, meta?, attachments?, fileContext? }
NodeData     { label, instructions, provider, modelName, apiKey,
               routes, conditions, resultFormat, packet,
               connectionType, url, method, headers, authType, authValue, bodyMapping,
               appProvider, appAction, appInputs,
               subflowId, subflowName, workflowOverride,
               gatekeeperMessage, batchLogic, schedule, cron, webhookID }
ExecutionContext  { variables: Record<string,FlowPacket>, nodes: Record<string,FlowPacket>, __exit__? }
ActionField  { key, label, type, placeholder?, isContent?: boolean }  // isContent = auto-filled from upstream
```

---

## Execution Paths

### Editor — `clientExecutor.ts`
```
runClientFlow(input) → executeGraph(_nodes, edges, ...)
  Zombie filter: nodes with no edges stripped when graph has edges
  appaction → content field always overridden from upstream output if incoming edge exists
            → executeAppAction() [server action] → Prisma Integration → provider service
```

### Sandbox — `serverExecutor.ts` → `/api/sandbox/execute`
```
POST {nodes, edges, input, apiKeys[]} → SSE
  Same zombie filter + strict content injection as clientExecutor
  AGENTFORGE_MODE=LIVE — full execution, real OAuth tokens
```

### Code Sandbox — `/api/sandbox/execute-code` (Mirror Mode)
```
POST {code, language, envVars:{AGENTFORGE_INPUT, AGENTFORGE_MODE:"PREVIEW"}} → SSE
  Mirror Mode shim prepended to compiled code:
    Python: requests/httpx/aiohttp — GET allowed; POST/PUT/DELETE/PATCH → prints DRAFT PAYLOAD block
    JS/TS:  fetch/axios/got        — same GET-pass/mutating-block logic
  No API keys injected (isolated logic checker)
  Frontend parses DRAFT PAYLOAD blocks → Flow Result card shows
    "🔍 PREVIEW: [Node] → Payload Generated (No data sent)"
  Raw ctx JSON dump and "=== Final Result ===" stripped from terminal view
```

---

## AppAction Content Field Injection
`CONTENT_FIELD_KEYS = Set(["text","content","body","caption"])` — marked `isContent:true` in APP_REGISTRY.

**Runtime (both executors):** If AppAction node has an incoming edge, the content field is ALWAYS overridden with upstream node's output — ignores whatever is in `appInputs`.

**Compiler (`flowCompiler.ts`):** `genAppActionBlock` resolves `upstreamVar` from edges; content fields in bodyFields use `ctx['upstreamVar']['payload']` (Python) or `ctx['upstreamVar']?.payload` (JS/TS). Special-cased for Instagram caption, LinkedIn text, Medium content, Notion content.

**Sidebar:** Action dropdown `onChange` also updates `node.data.label` to `action.label`. Provider dropdown `onChange` updates label to `provider.name`. `useEffect` in `NodeSettingsSidebar` auto-syncs label on mount if mismatched.

---

## Reactive Engine

**Topo dispatch:** adjacency + dependency maps; roots (in-degree 0) fire immediately.

**Zombie filter:** `edges.length > 0` → only nodes appearing in at least one edge are processed. Prevents stale nodes from prior flows being dispatched.

**Exit signal:** AI returning `"EXIT"|"STOP"` sets `context.__exit__`; pending nodes SKIPPED.

**Error isolation:** failure cascades SKIPPED to transitive descendants only.

**JIT key resolution (`resolveApiKey` / `resolveApiKeyFromList`):**
1. Vault preferred provider (`preferredProvider` in vaultStore / `PREFERRED_PROVIDER` key for server)
2. Node-level `data.apiKey`
3. Vault entry matching prefix (`gsk_`→Groq, `sk-`→OpenAI, `AIza`→Gemini, `sk-ant-`→Anthropic)
4. First vault entry

**`deleteNode`:** purges `nodes`, `edges`, `nodeStatuses`, `nodeOutputs`, `executedNodeIds`, `executionResult` atomically.

---

## App Integrations (9 providers)
X · Slack · Discord · GitHub · Notion · Instagram · LinkedIn · Medium · **Browser** (E2B)

`executeAppAction` uses `prisma.integration.accessToken` — no vault lookup.
`getIntegrationEnvVars(providers[])` → maps provider → canonical env key (e.g. `discord→DISCORD_BOT_TOKEN`) for external use.

---

## Code Export (`flowCompiler.ts` + `publish/page.tsx`)

Kahn's topo-sort (isolated nodes excluded) → snake_case identifiers → per-library blocks.

| Language | Libraries |
|---|---|
| Python | requests · httpx · aiohttp |
| TypeScript | fetch · axios · node-fetch |
| JavaScript | fetch · got · axios |

Entry points throw `RuntimeError`/`Error` if `AGENTFORGE_INPUT` env var is missing (no 'Hello' fallback).

**Execution Plan** in terminal parsed from `# ── [type] label` comments in compiled code. Node/edge counts fall back to `steps.length` / `steps.length-1` when store is empty (localStorage-restored compiledCode).

---

## Auth & Persistence
- Supabase OAuth (Google, GitHub) + magic link  ← Apple removed
- Flows/Projects/Integrations/Vault → Prisma → Postgres
- Guest mode: localStorage; auto-migrated on login
- Auto-save: debounced 2s
- **Prisma schema change → must run `npx prisma generate`** to update `lib/generated/prisma/`

---

## Real-Time Collaboration (Liveblocks)

**Config:** `liveblocks.config.ts` — global `Presence` (cursor x/y, hoveredNodeId, user metadata), `Storage` (nodes/edges LiveList), `UserMeta` types.

**Auth:** `app/api/liveblocks-auth/route.ts` — POST, checks Supabase session + Prisma flow ownership.
- Owner → `FULL_ACCESS`
- Public + editable → `FULL_ACCESS`
- Public read-only → `READ_ACCESS`
- Private (non-owner) → 403

**Room ID:** `"flow:<uuid>"` — keyed per flow. `getFlowRoomId` / `getFlowIdFromRoom` in `lib/liveblocks/rooms.ts`.

**Store:** `flowStore.ts` wrapped with `liveblocks()` middleware. `presenceMapping` syncs cursor + hoveredNodeId. `storageMapping` syncs nodes/edges.
`cloneForRealtime<T>()` = `JSON.parse(JSON.stringify(value))` — strips non-serializable ReactFlow internal fields before pushing to Liveblocks storage.

**Components:**
- `FlowCollaboration` — mounts in editor and `/view/[id]`; calls `enterRoom`/`leaveRoom`. Pure side effect.
- `CollaborationStatus` — toolbar badge: emerald "Live" pulse or amber "Syncing…"; avatar row for other users (up to 4 + "+N more"); dropdown lists users and their hovered node.
- `FlowCanvas` — `collaborationEnabled` prop gates cursor overlay and pointer tracking. Remote cursors rendered with viewport transform: `cursorX = cursor.x * zoom + panX`.
- `NodeCard` — shows colored "X hovering" badge above node when remote users have `hoveredNodeId === nodeId`.

---

## Agent Store

Universal access — identical content for guests and logged-in users.

**What guests can do:** Browse, Sandbox (`/sandbox/[id]`), view Workflow modal, view Code modal, Clone.
**What requires login:** Deploy to Store only.

**Guest clone flow:** `AgentGrid.tsx` detects `!currentUserId` → writes `{ nodes, edges }` to `localStorage["agentforge_guest_flow"]` → `router.push("/editor")`. Editor hydrates from that key on load.

**View count:** Incremented on Sandbox / Workflow / Code button clicks via `incrementViewCount(flowId)` server action (fire-and-forget, silently ignores errors). Displayed as `<Eye> 1.2k` badge on card. Popular sort orders by `viewCount DESC`.

**CodeModal disclaimer:** Amber bar between toolbar and code block warns users to manually review community-submitted code before local use.

**Categories:** All · Vision (multimodal providers) · Text · Logic (router/decision nodes) · Productivity (trigger/action/webhook nodes). Sort: Recent (default, `updated_at DESC`) or Popular (`viewCount DESC`).

## Prisma Models
`Flow` (nodes/edges JSON, isPublic, isDeployed, isDeployed, viewCount, creatorName, description, thumbnail) · `Project` · `Folder` · `Vault` · `Integration` (provider, accessToken, refreshToken; unique userId+provider)

`viewCount Int? @default(0) @map("view_count")` — incremented (atomic `{ increment: 1 }`) on Sandbox/Workflow/Code interactions in the store. DB column: `view_count`. **Requires SQL migration when first added:** `ALTER TABLE public.flows ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;`

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
