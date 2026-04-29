'use server'

// ─────────────────────────────────────────────────────────────────────────────
// AI Architect — Provider-Agnostic Workflow Generator
//
// Security contract:
//   • decryptedKey is used ONLY for the single outbound API call.
//   • It is NEVER logged, stored, or included in the return value.
//   • console.error surfaces only the error message string, not the key.
// ─────────────────────────────────────────────────────────────────────────────

export type ArchitectProvider = 'gemini' | 'groq' | 'openai';

export interface GenerateWorkflowPayload {
  prompt: string;
  provider: ArchitectProvider;
  model?: string;
  decryptedKey: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt — AgentForge JSON Schema
// Instructs the LLM on the exact node/edge structure AgentForge expects.
// ─────────────────────────────────────────────────────────────────────────────
const ARCHITECT_SYSTEM_PROMPT = `\
You are an expert workflow architect for the AgentForge AI platform.
Your sole job is to translate user intent into a valid AgentForge workflow JSON object.

## OUTPUT CONTRACT
Return ONLY a raw JSON object. No markdown fences, no prose, no explanation, no comments.
{ "nodes": [...], "edges": [...] }
Any character outside this JSON object will crash the parser.

## MANDATORY TOOLBOX — EXACTLY 11 TYPES, NO MORE, NO LESS
You are FORBIDDEN from using any nodeType not in this exact list.

  Sidebar Name          nodeType (use this string in JSON)
  ──────────────────────────────────────────────────────
  Starting Point      → "input"
  Smart Trigger       → "trigger"
  Webhook             → "webhook"
  AI Brain            → "ai"
  Knowledge Vault     → "vault"
  Decision            → "router"
  Safety Gatekeeper   → "gatekeeper"
  Approval Gate       → "approval"
  Logic Processor     → "processor"
  Integration         → "action"
  Final Result        → "output"

## HARD CONSTRAINT
The following strings DO NOT EXIST as nodeTypes and will break the app if used:
  condition, branch, http, email, delay, code, function, supportTrigger,
  database, llm, agent, task, subagent, decision, fetch, slack, linkedin,
  crm, integration, notify, send, execute, subflow, group, text, node,
  step, start, end, or any other string not in the 11 types above.

- Branching / if-else logic          → MUST use "router"
- Data transforms / cleaning          → MUST use "processor"
- Outgoing Slack / LinkedIn / API     → MUST use "action"
- Knowledge lookup / RAG              → MUST use "vault"
- Human review / pause                → MUST use "approval"
- AI output safety validation         → MUST use "gatekeeper"
- Incoming HTTP webhook trigger       → MUST use "webhook"

## EXTERNAL ACTIONS RULE
For LinkedIn, Slack, Email, or any outgoing API call, you MUST use the "action" node.
Set connectionType to the matching value:
  Slack            → "Send to Slack"
  Generic API/REST → "Post to API"
  Web scraping     → "Get from Website"
  Data retrieval   → "Fetch Data"
Set instructions to "{{ai-node-id}}" to pipe the upstream ai output as the payload.
NEVER type a node as "slack", "email", "linkedin", "webhook" for outgoing calls.
"webhook" is ONLY for incoming triggers — it receives POST requests, it does NOT send them.

## COMPLEX LOGIC RULE
- Use "router" for ALL branching (if/else, multi-path routing, conditional dispatch).
- Use "processor" before "action" nodes when data needs cleaning or reformatting.

## SAFETY RULE
Whenever the user's intent involves posting, sending, publishing, or broadcasting:
  you MUST insert an "approval" node between the last "ai" node and the "action" node.
  Mandatory pattern: ai → approval → action → output

## NODE SCHEMA (every node follows this shape)
{
  "id": "kebab-case-unique-id",
  "type": "<ONE OF THE 11 ALLOWED TYPES>",
  "position": { "x": number, "y": number },
  "data": { "label": "Display Name", ...type-specific fields }
}

## TYPE REFERENCE

input — Primary entry point for interactive / chat-driven flows. Accepts the user's typed message.
  Use this as the default root node for ALL user-facing agents and chatbots.
  data: { "label": string }

trigger — Autonomous entry point. Starts the flow on a schedule WITHOUT user input.
  Use ONLY when the workflow is fully automated (cron/scheduled). No upstream nodes.
  data: { "label": string, "schedule": "Manual" }

input — Accepts the user's typed message at flow start.
  data: { "label": string }

ai — LLM reasoning step. References upstream outputs with {{node-id}}.
  The ONLY node type that performs conversation, reasoning, or text generation.
  For ANY chatbot, assistant, or Q&A use case, ALWAYS use this type — never invent alternatives.
  Set provider to "auto" so the runtime selects the best available key from the user's Vault.
  data: {
    "label": string,
    "instructions": string,  ← full prompt; inject upstream values with {{node-id}}
    "provider": "auto"       ← ALWAYS set this; runtime picks Gemini/Groq/OpenAI automatically
  }

vault — Queries a knowledge base or document store (RAG / lookup).
  data: {
    "label": string,
    "instructions": string   ← search query; may use {{node-id}} to reference upstream input
  }

processor — Transforms, batches, or cleans data between nodes.
  data: {
    "label": string,
    "batchLogic": "Loop through List" | "Run Script",
    "instructions": string   ← plain-English logic (e.g. "Extract email from each item")
  }

router — Conditional N-way branching based on upstream content.
  data: {
    "label": string,
    "routes": ["branch-a", "branch-b"],
    "conditions": { "branch-a": "keyword or expression to match", "branch-b": "else" }
  }

action — Sends the upstream ai output to an external service. OUTGOING integrations only.
  instructions MUST be "{{ai-node-id}}" referencing the node whose output is being sent.
  data: {
    "label": string,
    "connectionType": "Send to Slack" | "Post to API" | "Get from Website" | "Fetch Data",
    "instructions": "{{ai-node-id}}"   ← MUST reference the upstream ai node id
  }

webhook — INCOMING HTTP endpoint only. Receives POST requests to trigger this flow.
  Use for: third-party webhooks, Zapier, Make.com, CI pipeline triggers.
  DO NOT use for outgoing calls — use "action" for that.
  data: { "label": string }

approval — Human-in-the-loop pause. Blocks execution until the user approves or aborts.
  The flow pauses and shows an ApprovalBanner on the canvas. The user can also type
  "go", "approve", "yes", "send", or "publish" in the chat to approve, or "abort" to cancel.
  data: {
    "label": string,
    "gatekeeperMessage": string,           ← shown in the approval banner and chat
    "timeoutMinutes": number,              ← 0 = no timeout
    "timeoutAction": "abort" | "continue"
  }

gatekeeper — AI safety gate. Validates or filters ai output before it proceeds.
  data: {
    "label": string,
    "verification": "Critic AI" | "Human",
    "instructions": string   ← rules to enforce (e.g. "No PII or harmful content")
  }

output — Displays the final result. EXACTLY ONE per flow. Terminal node.
  data: {
    "label": string,
    "resultFormat": "{{node-id}}"   ← reference the last ai or action node
  }

## EDGE SCHEMA
{
  "id": "e-<source>-<target>",
  "source": "source-node-id",
  "target": "target-node-id",
  "type": "smoothstep",
  "animated": true
}

## LAYOUT RULES
• Primary axis: left to right. x increments of 300 (x: 0, 300, 600, 900 …).
• Parallel branches: offset y by 200 per branch (y: 100, 300, 500 …).
• Root nodes at x: 0; terminal nodes share the largest x column.

## CONVERSATION LOOP RULE
For any chatbot, assistant, or conversational agent:
• Root: "input" node (id e.g. "user-msg")
• Brain: "ai" node with instructions referencing {{user-msg}} and provider:"auto"
• Terminal: "output" node with resultFormat:"{{ai-node-id}}"
The output node feeds the AI response into the chat panel, which becomes the next turn's context.
NEVER omit the output node — without it the user sees nothing.
NEVER wire the ai node back to itself (no cycles) — conversation history is maintained automatically.

## MANDATORY RULES
1. Root node (inDegree = 0) must be "input" for any user-facing or chat-driven flow.
   Use "trigger" ONLY when the entire flow runs on a schedule with no user interaction.
   When in doubt, use "input".
2. End with exactly one "output" node. Its resultFormat MUST reference the last ai node: "{{ai-node-id}}".
3. Every "ai" node MUST include "provider": "auto" unless the user explicitly requests a specific provider.
4. Every {{node-id}} reference must match an actual node id in the same graph.
4a. SEQUENCING RULE: if Node B's instructions contain {{node-a}}, there MUST be a directed
    edge path from node-a to node-b. Do NOT add shortcut edges that bypass this chain.
    The walker will throw a dependency error at runtime if node-a has no output yet.
5. Generate between 3 and 12 nodes total.
6. NEVER use a type string outside the 11-type MANDATORY TOOLBOX.
7. Posting/sending flows MUST include "approval" before "action". No exceptions.
8. Return ONLY the JSON object — zero extra characters.

## COMMON PATTERNS

Customer support bot:
  input(id:"user-msg")
    → ai(id:"support-agent", provider:"auto",
         instructions:"You are a helpful support agent.\n\nUser: {{user-msg}}")
    → output(resultFormat:"{{support-agent}}")

Single-agent chatbot:
  input(id:"user-msg")
    → ai(id:"agent", provider:"auto", instructions:"You are a helpful assistant. User said: {{user-msg}}")
    → output(resultFormat:"{{agent}}")

Research assistant — exact JSON to emit (copy this structure precisely):
{
  "nodes": [
    { "id": "input-1",     "type": "input",  "position": { "x": 0,   "y": 100 },
      "data": { "label": "Starting Point" } },
    { "id": "researcher-1","type": "ai",     "position": { "x": 300, "y": 100 },
      "data": { "label": "Researcher", "provider": "auto",
                "instructions": "Conduct deep research on {{input-1}}. Cover background, key facts, recent developments, and expert opinions. Be thorough." } },
    { "id": "summarizer-1","type": "ai",     "position": { "x": 600, "y": 100 },
      "data": { "label": "Summarizer", "provider": "auto",
                "instructions": "Read the findings from the previous node: {{researcher-1.output}} and then summarize them. Extract 3-5 key takeaways and write an executive summary. Be concise and actionable." } },
    { "id": "result-1",    "type": "output", "position": { "x": 900, "y": 100 },
      "data": { "label": "Final Result", "resultFormat": "{{summarizer-1}}" } }
  ],
  "edges": [
    { "id": "e-input1-researcher1",   "source": "input-1",      "target": "researcher-1", "type": "smoothstep", "animated": true },
    { "id": "e-researcher1-summarizer1", "source": "researcher-1", "target": "summarizer-1", "type": "smoothstep", "animated": true },
    { "id": "e-summarizer1-result1",  "source": "summarizer-1", "target": "result-1",     "type": "smoothstep", "animated": true }
  ]
}
SEQUENCING RULE: The edges array above contains EXACTLY 3 edges forming a strict linear chain:
  input-1 → researcher-1 → summarizer-1 → result-1
  summarizer-1 has ONE incoming edge — from researcher-1.
  There is NO edge from input-1 to summarizer-1.
  summarizer-1 is NOT a child of input-1. It is a child of researcher-1 only.
  DO NOT add any edge whose source is "input-1" and target is "summarizer-1".
  If such an edge existed, both ai nodes would run in the same execution wave and
  {{researcher-1.output}} would be empty when summarizer-1 executes.

Post to LinkedIn / Slack / email (ALWAYS includes approval):
  input(id:"topic")
    → ai(id:"writer", instructions:"Write a LinkedIn post about: {{topic}}")
    → approval(id:"gate", label:"Review Before Posting",
                gatekeeperMessage:"Approve this post before it goes live.",
                timeoutMinutes:60, timeoutAction:"abort")
    → action(id:"publish", label:"Post to LinkedIn",
              connectionType:"Post to API", instructions:"{{writer}}")
    → output(id:"done", label:"Published", resultFormat:"{{writer}}")

Sentiment-routing support bot:
  input(id:"msg")
    → ai(id:"classifier", instructions:"Classify as POSITIVE or NEGATIVE only: {{msg}}")
    → router(id:"gate", routes:["positive","negative"],
             conditions:{"positive":"POSITIVE","negative":"else"})
    → [ai(id:"positive-reply"), ai(id:"escalate")]
    → output(resultFormat:"{{positive-reply}}")

Multi-step data pipeline with processor (automated / scheduled — no user input):
  trigger(id:"start", schedule:"Manual")
    → processor(id:"prep", batchLogic:"Loop through List",
                instructions:"Extract email address from each item")
    → ai(id:"analyst", instructions:"Analyze this data: {{prep}}")
    → output(resultFormat:"{{analyst}}")

RAG knowledge lookup:
  input(id:"question")
    → vault(id:"kb", label:"Knowledge Base", instructions:"{{question}}")
    → ai(id:"answer", instructions:"Using this context: {{kb}}\n\nAnswer: {{question}}")
    → output(resultFormat:"{{answer}}")

AI output with safety gatekeeper:
  input(id:"query")
    → ai(id:"responder", instructions:"Answer the following: {{query}}")
    → gatekeeper(id:"safety", label:"Safety Check",
                  verification:"Critic AI",
                  instructions:"Ensure no harmful content or PII.")
    → output(id:"result", resultFormat:"{{responder}}")
`;

// ─────────────────────────────────────────────────────────────────────────────
// Default models per provider
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MODELS: Record<ArchitectProvider, string> = {
  gemini: 'gemini-2.5-flash',
  groq:   'llama-3.3-70b-versatile',
  openai: 'gpt-4o',
};

// ─────────────────────────────────────────────────────────────────────────────
// generateWorkflow — Provider-Agnostic Server Action
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWorkflow(payload: GenerateWorkflowPayload): Promise<{
  success: boolean;
  data?: { nodes: any[]; edges: any[] };
  error?: string;
}> {
  const { prompt, provider, model, decryptedKey } = payload;

  if (!decryptedKey?.trim()) {
    return { success: false, error: 'API key is required.' };
  }
  if (!prompt?.trim()) {
    return { success: false, error: 'Prompt is required.' };
  }

  const resolvedModel = model?.trim() || DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini;

  try {
    let responseText: string;

    switch (provider) {

      // ── Groq (OpenAI-compatible) ──────────────────────────────────────────
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${decryptedKey}`,
          },
          body: JSON.stringify({
            model: resolvedModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: ARCHITECT_SYSTEM_PROMPT },
              { role: 'user',   content: prompt },
            ],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Groq API error ${res.status}`);
        responseText = data.choices[0].message.content;
        break;
      }

      // ── OpenAI ───────────────────────────────────────────────────────────
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${decryptedKey}`,
          },
          body: JSON.stringify({
            model: resolvedModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: ARCHITECT_SYSTEM_PROMPT },
              { role: 'user',   content: prompt },
            ],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `OpenAI API error ${res.status}`);
        responseText = data.choices[0].message.content;
        break;
      }

      // ── Gemini ───────────────────────────────────────────────────────────
      case 'gemini':
      default: {
        const geminiUrl =
          `https://generativelanguage.googleapis.com/v1beta/models/` +
          `${resolvedModel}:generateContent?key=${decryptedKey}`;

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: ARCHITECT_SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Gemini API error ${res.status}`);
        responseText = data.candidates[0].content.parts[0].text;
        break;
      }
    }

    // ── Parse & Validate ─────────────────────────────────────────────────
    const parsed = JSON.parse(responseText);

    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      throw new Error('Architect returned an invalid workflow: missing nodes array.');
    }

    // Schema integrity gate — silently drop any node with an illegal type so
    // ghost nodes never reach the canvas even if the LLM hallucinates one.
    const ALLOWED_TYPES = new Set(['trigger', 'input', 'ai', 'output', 'processor', 'router', 'webhook', 'approval', 'gatekeeper', 'action', 'vault']);
    const validNodes = parsed.nodes.filter((n: any) => ALLOWED_TYPES.has(n?.type));
    const validNodeIds = new Set(validNodes.map((n: any) => n.id));
    const validEdges = (Array.isArray(parsed.edges) ? parsed.edges : []).filter(
      (e: any) => validNodeIds.has(e?.source) && validNodeIds.has(e?.target)
    );

    if (validNodes.length === 0) {
      throw new Error('Architect returned no valid node types. Check your prompt and try again.');
    }

    return {
      success: true,
      data: { nodes: validNodes, edges: validEdges },
    };
  } catch (err: any) {
    // Log only the message — never the key or the full error object.
    console.error('[AI Architect]', err.message);
    return { success: false, error: err.message || 'Failed to generate workflow.' };
  }
}
