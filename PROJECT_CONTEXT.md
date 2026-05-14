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
  auth/
    confirm/route.ts    # Handles token_hash email flow (verifyOtp → /update-password for recovery)
    callback/route.ts   # Handles PKCE code flow (exchangeCodeForSession → detects recovery via recovery_sent_at)
  update-password/
    page.tsx            # Password reset form: strength meter, show/hide, confirm field; updateUser()
  editor/page.tsx        # Main canvas (~1700 lines): FlowCanvas, sidebars, toolbar, AI Architect, chat, terminal
  publish/page.tsx       # Publish & Export: Mirror Mode sandbox, polyglot codegen, flowId-keyed localStorage
  sandbox/[id]/
    page.tsx / SandboxClient.tsx   # Server-rendered sandbox with API key config
  dashboard/page.tsx · integrations/page.tsx
  store/
    page.tsx          # Server: deployed flows + starredIds + wishlistedIds + isVerified per creator
    StoreClient.tsx   # Category filter, Collections, Saved filter, search, Recent/Popular sort
    AgentGrid.tsx     # AgentCard: star + bookmark buttons; ManagePanel for owners; guest clone flow
    WorkflowLightbox.tsx · CodeModal.tsx · ManagePanel.tsx
    [id]/DetailClient.tsx   # Star, Bookmark, Follow, Tip; changelog banner; comments
    creator/[userId]/page.tsx · CreatorFollowButton.tsx

components/flow/
  nodes/                 # One file per node type + NodeCard.tsx
  canvas/                # FlowCanvas, ReadOnlyCanvas (nodeTypes includes ALL custom types incl. appaction + group)
  chat/ChatHub.tsx
  collaboration/
    FlowCollaboration.tsx    # Manages enterRoom/leaveRoom lifecycle; enterRoom wrapped in try/catch (silent skip if LIVEBLOCKS_SECRET_KEY missing)
    CollaborationStatus.tsx  # "Live"/"Syncing…" badge + avatar row for other users
  sidebar/
    NodeSettingsSidebar.tsx  # AppAction label auto-syncs to action.label on mount via useEffect
    NodeSidebar.tsx          # Vault tab: preferred provider dropdown; root div has data-tutorial="node-palette"
  ResponseGallery.tsx / SandboxGallery.tsx / ImageLightbox.tsx

components/ui/tutorial/
  MissionBriefing.tsx   # 9-section flip-through guide; useHighlightRects queries [data-tutorial=id] elements;
                        # HighlightRings renders fixed-position glow rings over tagged UI buttons

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
POST {code, language, envVars:{AGENTFORGE_INPUT, AGENTFORGE_MODE:"PREVIEW", ...vaultKeys}} → SSE
  No HTTP shim — PREVIEW guard is baked into generated code at compile time:
    genHttpBlock (templates.ts): wraps every HTTP call in if AGENTFORGE_MODE==PREVIEW → print DRAFT PAYLOAD
    appaction nodes (flowCompiler.ts): wrapped in PREVIEW guard at both JS and Python call sites
    schedule/trigger nodes: PREVIEW → run agent once immediately; else → start cron loop
  All 9 combos supported: Python×(requests/httpx/aiohttp) · JS×(fetch/axios/got) · TS×(fetch/axios/node-fetch)
  package.json for JS sandbox has NO "type":"module" so require() is available
  Frontend parses DRAFT PAYLOAD blocks → Flow Result card shows
    "🔍 PREVIEW: [AppDisplayName] → Payload Generated (No data sent)"
    APP_DISPLAY_NAMES map in flowCompiler.ts: x→Twitter/X, linkedin→LinkedIn, medium→Medium etc.
  Terminal has Copy button (top-right of Code Output panel)
  Raw ctx JSON dump and "=== Final Result ===" stripped from terminal view
```

---

## AppAction Content Field Injection
`CONTENT_FIELD_KEYS = Set(["text","content","body","caption"])` — marked `isContent:true` in APP_REGISTRY.

**Runtime (both executors):** If AppAction node has an incoming edge, the content field is ALWAYS overridden with upstream node's output — ignores whatever is in `appInputs`.

**Compiler (`flowCompiler.ts`):** `genAppActionBlock` resolves `upstreamVar` from edges; content fields in bodyFields use `ctx['upstreamVar']['payload']` (Python) or `ctx['upstreamVar']?.payload` (JS/TS). Special-cased for Instagram caption, LinkedIn text, Medium content, Notion content. `got` calls use no TypeScript generics (`<any>`/`<unknown>`) or `as const` so generated `.js` files are valid.

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
- `getLatestFlow()` filters `isDeployed: { not: true }` — excludes Store snapshots so `/editor` never loads a deployed agent as the default working flow
- **Prisma schema change → must run `npx prisma generate`** to update `lib/generated/prisma/`

### Password Reset Flow
Two paths depending on Supabase email template format:
1. **token_hash path** (default email template): `{SiteURL}/auth/confirm?token_hash=...&type=recovery`
   → `/app/auth/confirm/route.ts` calls `verifyOtp({ type, token_hash })` → redirects to `/update-password`
2. **PKCE code path**: `{SiteURL}/auth/callback?code=...`
   → `/app/auth/callback/route.ts` calls `exchangeCodeForSession(code)` then `getUser()`
   → recovery detected by checking `user.recovery_sent_at` within last 10 minutes → redirects to `/update-password`
   → (Supabase PKCE does NOT append `type=recovery` to redirect URL — cannot rely on URL params)

**Production Supabase setup (do before merging to main):**
- Site URL → production Vercel domain
- Redirect URLs → `https://<prod-domain>/**` + `http://localhost:3000/**`

---

## Real-Time Collaboration (Liveblocks)

**Config:** `liveblocks.config.ts` — global `Presence` (cursor x/y, hoveredNodeId, user metadata), `Storage` (nodes/edges LiveList), `UserMeta` types.

**Client:** `lib/liveblocks/client.ts` — `createClient` with async `authEndpoint` function (POSTs to `/api/liveblocks-auth`). Requires `LIVEBLOCKS_SECRET_KEY` env var in Vercel.

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

## Dashboard

- **Stats**: 2-column grid — Total Flows + Vault Keys (Public stat card removed)
- **Flow grouping**: Named groups shown first (alphabetical), ungrouped flows at bottom
- **Tabs**: Flows · Templates · Account
  - Account tab: user email from Supabase browser client; Sign Out (server action) + Switch Account (`signOut()` → `/login`)
- **Flow cards**: no Eye/Public badge; Share button only in card footer
- **Templates**: matches actual `FLOW_TEMPLATES` — Basic Chatbot (💬), Research Assistant (🔬), Omnichannel Content Generator (📡), Webhook Processor (🔗)

---

## Editor — Tutorial System

- **First visit**: `showTutorialHint` state shown for 6 seconds (small pill notification, does NOT auto-open tutorial)
- **Help FAB**: `fixed bottom-6 right-6 z-[50]` — HelpCircle button opens `MissionBriefing`
- **`data-tutorial` attributes** tag interactive elements for highlight ring targeting:
  - `"node-palette"` (NodeSidebar root), `"utility-pill"`, `"templates"`, `"ai-build"`, `"run-flow"`, `"publish"`, `"share"`, `"right-sidebar"`
- **MissionBriefing**: 9-section flip-through; `HighlightRings` queries `[data-tutorial=id]` via `getBoundingClientRect()`; progress dots clickable; Done button calls `completeTutorial()`

---

## Agent Store

Universal access — identical content for guests and logged-in users.

**What guests can do:** Browse, Sandbox (`/sandbox/[id]`), view Workflow modal, view Code modal, Clone.
**What requires login:** Star, Wishlist, Follow, Deploy to Store.

**Guest clone flow:** `AgentGrid.tsx` detects `!currentUserId` → writes `{ nodes, edges }` to `localStorage["agentforge_guest_flow"]` → `router.push("/editor")`. Editor hydrates from that key on load.

**View count:** Incremented on Sandbox / Workflow / Code button clicks via `incrementViewCount(flowId)` server action (fire-and-forget). Displayed as `<Eye> 1.2k` badge. Popular sort orders by `viewCount DESC`.

**Sandbox run count:** `sandboxRunCount` column on `Flow`; incremented via `incrementSandboxRunCount(flowId)` called in `app/sandbox/[id]/page.tsx` on deployed flows (non-blocking). Shown as `<FlaskConical> X tested` in detail page stats.

**Stars:** `FlowStar` model — `@@unique([flowId, userId])`. `toggleStar` server action.

**Wishlist/Bookmark:** `FlowWishlist` model — `@@unique([flowId, userId])`. `toggleWishlist` / `getUserWishlist` actions. Bookmark icon (violet when saved) on cards and detail page. "Saved" filter button in store filter bar (logged-in only).

**Follow:** `FlowFollow` model — `followerId`/`followingId` as plain UUID strings (no FK to auth.users). `toggleFollow` / `getFollowStatus` / `getFollowerCount` actions. UserPlus/UserCheck button on detail page; `CreatorFollowButton` client component on creator profile page.

**Verified badge:** Computed server-side — no stored field. Threshold: creator has **3+ deployed agents AND 50+ total stars** across all their flows. Shown as `✓` chip next to creator name on cards, detail page, and creator profile.

**Changelog / What's New:** `changelog String?` on `Flow`. Owner can edit via ManagePanel → EditModal. Shown as emerald `<Sparkles>` banner on detail page when non-empty.

**Collections:** Client-side tag-filter sections in `StoreClient.tsx` — "Best for Marketing", "Starter Packs", "Data & Analytics", "Dev Tools". Each maps to a tag array; renders a collapsible grid section between "New This Week" and the filter bar.

**Version snapshots:** `FlowVersion` model (nodes/edges JSON + optional note). Auto-snapshot created on each `deployToStore` call; trimmed to 20 per flow.

**Support Creator:** Placeholder "tip" modal (rose Heart button on detail page) — explains coming soon, suggests starring.

**Thumbnail upload:** Owner can upload a custom image in ManagePanel EditModal. Client-side compressed to max 640×360 JPEG (0.82 quality) via canvas before save. Stored as base64 data URL in `Flow.thumbnail`. Cards show thumbnail when set, fall back to `AgentVisual` SVG otherwise.

**CodeModal disclaimer:** Amber bar between toolbar and code block warns users to manually review community-submitted code before local use.

**Categories:** All · Vision (multimodal providers) · Text · Logic (router/decision nodes) · Productivity (trigger/action/webhook nodes). Sort: Recent (default, `updated_at DESC`) or Popular (`viewCount DESC`).

### Store directory
```
app/store/
  page.tsx              # Server: fetches flows + starredIds + wishlistedIds; computes isVerified per creator
  StoreClient.tsx       # Filter bar, Collections section, Saved filter, search, sort
  AgentGrid.tsx         # AgentCard with star + bookmark buttons; ManagePanel for owners
  ManagePanel.tsx       # Gear menu: Edit (name/desc/tags/thumbnail/changelog/featured) + Unpublish
  WorkflowLightbox.tsx  # ReadOnlyCanvas modal
  CodeModal.tsx
  [id]/
    page.tsx            # Server: full detail + related + follow/wishlist/verified data
    DetailClient.tsx    # Star, Bookmark, Follow, Tip buttons; changelog banner; comments
  creator/[userId]/
    page.tsx            # Creator profile; own profile shows analytics dashboard
    CreatorFollowButton.tsx  # Client component: optimistic follow toggle
```

## Prisma Models
`Flow` (nodes/edges JSON, isPublic, isDeployed, viewCount, **sandboxRunCount Int? @default(0)**, **changelog String?**, creatorName, description, thumbnail, groupName) · `Project` · `Folder` · `Vault` · `Integration`

`FlowStar` (`flowId`, `userId`, `@@unique([flowId, userId])`) · `FlowWishlist` (`flowId`, `userId`, `@@unique([flowId, userId])`) · `FlowFollow` (`followerId`, `followingId`, `@@unique([followerId, followingId])`) · `FlowVersion` (`flowId`, nodes JSON, edges JSON, note?, `@@index([flowId])`)

`viewCount` — incremented on Sandbox/Workflow/Code interactions. `sandboxRunCount` — incremented when `/sandbox/[id]` page loads for a deployed flow. Both use atomic `{ increment: 1 }`.

**Schema changes require:** `npx prisma db push` then `npx prisma generate`, then restart dev server.

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
