# AgentForge — Visual AI Workflow Builder

Build, execute, and export AI agent pipelines through a drag-and-drop canvas. Connect LLMs, HTTP endpoints, OAuth-connected apps, approval gates, and decision routers into runnable workflows — then compile them to production-ready Python, TypeScript, or JavaScript.

---

## Features

### Canvas & Editor
- **Drag-and-drop node graph** powered by React Flow — 12 canonical node types plus subflow containers
- **AI Architect** — describe a workflow in plain English; the AI generates a fully-connected, validated flow graph
- **Auto-layout** — one-click Dagre-based TB/LR layout reflow
- **Version snapshots** — save and restore named flow versions
- **Canvas export** — download the canvas as PNG, JPEG, or PDF from the toolbar

### Execution Engine
- **Reactive topological execution** — independent branches run concurrently; no manual wave configuration
- **4 LLM providers** — Groq, OpenAI, Gemini, Anthropic; provider auto-detected from vault keys
- **JIT key resolution** — vault keys matched by prefix (`gsk_` → Groq, `sk-` → OpenAI, `AIza` → Gemini)
- **Dry Run mode** — simulate execution without making real API calls
- **Approval gates** — pause mid-flow for human review; resume via chat
- **Subflows** — nest reusable agent graphs inside parent flows
- **Exit signal** — AI nodes can return `"EXIT"` to short-circuit downstream execution

### App Integrations (OAuth)
8 connected platforms with official brand icons in the integrations dashboard:

| Platform | Actions |
|---|---|
| X (Twitter) | Post tweet, Send DM |
| Slack | Send message, Send DM |
| Discord | Send channel message, Send DM |
| GitHub | Create issue, Add comment |
| Notion | Create page |
| Instagram | Create post (2-step: container → publish) |
| LinkedIn | Create post (2-step: resolve member ID → ugcPosts) |
| Medium | Publish article (2-step: resolve user ID → create post) |

### Code Export (Publish)
Compile any flow to a standalone, runnable script:

| Language | Libraries |
|---|---|
| TypeScript | fetch (built-in), axios, node-fetch |
| JavaScript | fetch (built-in), got, axios |
| Python | requests, httpx, aiohttp (async) |

Every exported file includes:
- `pip install` / `npm install` comment listing all required packages
- `_s()` + `_get()` helpers for safe FlowPacket unwrapping and JSON sub-key access
- `vaultLookup()` stub (swap with Pinecone/Chroma/Weaviate)
- Real LLM API calls for all four providers
- Multi-step implementations for Instagram, LinkedIn, and Medium
- CLI `readline` / `input()` pause for approval gates
- `node-cron` / `schedule` blocks for scheduled trigger nodes

### Flow Templates
Four built-in templates to get started:
- **Basic Chatbot** — Input → AI → Output
- **Research Assistant** — Input → AI Researcher → AI Summarizer → Output
- **Omnichannel Content Generator** — AI generates `{x, linkedin, medium}` JSON → human approval → parallel publish to all three platforms
- **Webhook Processor** — Trigger → Processor → AI → Output

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS 4, Framer Motion 12 |
| Graph | React Flow 11 |
| State | Zustand 5 |
| Auth & DB | Supabase (auth + realtime), Prisma 7, PostgreSQL |
| LLM SDKs | @google/genai, openai, groq-sdk, @anthropic-ai/sdk |
| Graph Layout | Dagre |
| Canvas Export | html-to-image, jsPDF |
| Language | TypeScript 5 (strict) |

---

## Project Structure

```
app/
  editor/             # Main canvas + toolbar + all panels
  publish/            # Polyglot code export
  dashboard/
    integrations/     # OAuth provider management (8 platforms)
  view/[id]/          # Public read-only flow viewer

components/flow/
  nodes/              # 16 node components (AI, Action, AppAction, Router, ...)
  canvas/             # FlowCanvas (editable), ReadOnlyCanvas
  chat/               # ChatHub — conversation + approval routing
  sidebar/            # NodeSettingsSidebar, NodeSidebar
  ResponseGallery.tsx # Terminal + Final Result tabs

lib/
  flow/clientExecutor.ts      # Reactive topological execution engine
  flowCompiler.ts             # Polyglot compiler (Python/TS/JS × 7 libraries)
  codegen/templates.ts        # Per-library HTTP/LLM codegen helpers
  providers/                  # Service adapters for all 8 OAuth platforms
  utils/export.ts             # PNG / JPEG / PDF canvas export
  constants/templates.ts      # 4 built-in flow templates

stores/
  flowStore.ts       # Nodes, edges, execution state, chat
  useLogStore.ts     # Execution log stream
  vaultStore.ts      # API key management
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Adding API Keys
Open the **Vault** panel in the editor and add your LLM API keys. The engine auto-detects the provider from the key prefix — no manual selection needed. For `provider: "auto"` nodes the first matching vault key is used.

### Connecting Apps
Navigate to **Dashboard → Integrations** and connect your OAuth apps. App Action nodes automatically pick up stored tokens at runtime — no key configuration on individual nodes.

---

## Node Reference

| Node | Type | Description |
|---|---|---|
| Starting Point | `input` | User message entry — root for chat flows |
| Smart Trigger | `trigger` | Scheduled/webhook entry (no user input) |
| Webhook | `webhook` | Incoming HTTP trigger |
| AI Brain | `ai` | LLM call (Groq / OpenAI / Gemini / Anthropic) |
| Knowledge Vault | `vault` | RAG document lookup |
| Decision | `router` | N-way conditional branching |
| Safety Gatekeeper | `gatekeeper` | AI critic or human review |
| Approval Gate | `approval` | Human-in-the-loop pause |
| Logic Processor | `processor` | Data transform / batch loop |
| Integration | `action` | Generic outgoing HTTP call |
| App Action | `appaction` | OAuth-connected platform action |
| Final Result | `output` | Terminal node; feeds result to chat |

---

## Template Variables

Reference any upstream node's output in prompts, result formats, and app inputs:

```
{{node-id}}            → full output payload of that node
{{node-id.output}}     → alias for the above (.output maps to .payload)
{{node-id.key}}        → extract a key from a JSON-structured output
                          (e.g., {{content-gen.linkedin}} parses the AI's JSON
                           and returns the linkedin field)
```

---

## Architecture Notes

**Reactive Engine**: The executor builds adjacency and dependency maps from the edge list, then fires all root nodes (in-degree 0) simultaneously. Each node dispatches the moment all its upstream deps complete — natural parallelism with no explicit wave management.

**Approval Gates**: A module-level Promise resolver (`lib/approvalGate.ts`) suspends the reactive engine mid-execution. ChatHub polls `isApprovalPending()` every 150ms and routes the user's next message to `resolveApproval()` rather than starting a new execution.

**Codegen Helpers**: Every compiled file gets `_get(entry, key)` — a function that unwraps a FlowPacket's payload, falls back to `JSON.parse(payload)[key]` for structured outputs, and always returns a string. This prevents `[object Object]` in generated code when upstream nodes produce JSON.

**SeqAttn**: Before each LLM call, `applySeqAttn()` prunes the execution context to only the variables actually referenced by `{{...}}` in that node's prompt, reducing token usage.
