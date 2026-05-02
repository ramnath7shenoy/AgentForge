import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";
import {
  Library,
  LLMProvider,
  genImports,
  genLLMImports,
  genLLMBlock,
  genHttpBlock,
  genApprovalPause,
  liftTemplate,
  isPythonLib,
  getDefaultLibrary,
  detectLLMProvider,
  getLLMEnvKey,
  APP_PROVIDER_ENV_KEYS,
} from "./codegen/templates";

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────
function toSnakeCase(str: string): string {
  return str
    .replace(/[^\w\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function getSemanticNames(nodes: Node<NodeData>[]): Record<string, string> {
  const names: Record<string, string> = {};
  const used = new Set<string>();
  nodes.forEach((node, i) => {
    let base = toSnakeCase(node.data.label || node.type || `node_${i + 1}`);
    if (!base) base = `node_${i + 1}`;
    let final = base;
    let c = 1;
    while (used.has(final)) { final = `${base}_${c}`; c++; }
    used.add(final);
    names[node.id] = final;
  });
  return names;
}

// ─────────────────────────────────────────────────────────────────────
// Topological sort — Kahn's algorithm
// Disconnected nodes are appended in original order after reachable nodes.
// ─────────────────────────────────────────────────────────────────────
function topoSort(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData>[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const byId = new Map<string, Node<NodeData>>();

  nodes.forEach(n => { inDeg.set(n.id, 0); adj.set(n.id, []); byId.set(n.id, n); });
  edges.forEach(e => {
    adj.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  });

  const queue: string[] = [];
  nodes.forEach(n => { if ((inDeg.get(n.id) ?? 0) === 0) queue.push(n.id); });

  const result: Node<NodeData>[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    seen.add(id);
    const node = byId.get(id);
    if (node) result.push(node);
    for (const childId of adj.get(id) ?? []) {
      const nd = (inDeg.get(childId) ?? 1) - 1;
      inDeg.set(childId, nd);
      if (nd === 0) queue.push(childId);
    }
  }
  nodes.forEach(n => { if (!seen.has(n.id)) result.push(n); });
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// App Action endpoint registry
// URL path params use {UPPER_SNAKE_CASE} placeholders (e.g. {REPO}, {CHANNEL_ID})
// ─────────────────────────────────────────────────────────────────────
interface AppEndpointDef {
  urlTemplate: string;
  method: string;
  envKey: string;
  authPrefix?: string;          // defaults to "Bearer"; Discord uses "Bot"
  urlPathFields?: string[];     // camelCase field names mapped to {UPPER_SNAKE} in urlTemplate
  bodyFields: string[];
  extraHeaders?: Record<string, string>;
}

const APP_ENDPOINTS: Record<string, Record<string, AppEndpointDef>> = {
  x: {
    create_tweet: {
      urlTemplate: 'https://api.twitter.com/2/tweets',
      method: 'POST',
      envKey: 'X_BEARER_TOKEN',
      bodyFields: ['text'],
    },
    send_dm: {
      urlTemplate: 'https://api.twitter.com/2/dm_conversations/with/{RECIPIENT_ID}/messages',
      method: 'POST',
      envKey: 'X_BEARER_TOKEN',
      urlPathFields: ['recipientId'],
      bodyFields: ['text'],
    },
  },
  slack: {
    send_message: {
      urlTemplate: 'https://slack.com/api/chat.postMessage',
      method: 'POST',
      envKey: 'SLACK_TOKEN',
      bodyFields: ['channel', 'text'],
    },
    send_dm: {
      urlTemplate: 'https://slack.com/api/chat.postMessage',
      method: 'POST',
      envKey: 'SLACK_TOKEN',
      bodyFields: ['channel', 'text'],
    },
  },
  discord: {
    send_channel_message: {
      urlTemplate: 'https://discord.com/api/v10/channels/{CHANNEL_ID}/messages',
      method: 'POST',
      envKey: 'DISCORD_BOT_TOKEN',
      authPrefix: 'Bot',
      urlPathFields: ['channelId'],
      bodyFields: ['content'],
    },
    send_dm: {
      urlTemplate: 'https://discord.com/api/v10/users/@me/channels',
      method: 'POST',
      envKey: 'DISCORD_BOT_TOKEN',
      authPrefix: 'Bot',
      bodyFields: ['recipient_id', 'content'],
    },
  },
  github: {
    create_issue: {
      urlTemplate: 'https://api.github.com/repos/{REPO}/issues',
      method: 'POST',
      envKey: 'GITHUB_TOKEN',
      urlPathFields: ['repo'],
      bodyFields: ['title', 'body'],
    },
    create_comment: {
      urlTemplate: 'https://api.github.com/repos/{REPO}/issues/{ISSUE_NUMBER}/comments',
      method: 'POST',
      envKey: 'GITHUB_TOKEN',
      urlPathFields: ['repo', 'issueNumber'],
      bodyFields: ['body'],
    },
  },
  notion: {
    create_page: {
      urlTemplate: 'https://api.notion.com/v1/pages',
      method: 'POST',
      envKey: 'NOTION_TOKEN',
      bodyFields: ['databaseId', 'title', 'content'],
      extraHeaders: { 'Notion-Version': '2022-06-28' },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────
// Flow metadata collection (pre-pass for imports + ENV keys)
// ─────────────────────────────────────────────────────────────────────
interface FlowMeta {
  llmProviders: Set<LLMProvider>;
  envKeys: Set<string>;
  hasApproval: boolean;
}

function collectFlowMeta(nodes: Node<NodeData>[]): FlowMeta {
  const llmProviders = new Set<LLMProvider>();
  const envKeys = new Set<string>();
  let hasApproval = false;

  for (const node of nodes) {
    const type = node.type || '';
    if (['ai', 'ai_agent', 'llm', 'agent-brain'].includes(type)) {
      const p = detectLLMProvider(node.data.provider, node.data.modelName || node.data.model);
      llmProviders.add(p);
      envKeys.add(getLLMEnvKey(p));
    }
    if (type === 'approval' || type === 'gatekeeper') hasApproval = true;
    if (type === 'app_action') {
      const p = node.data.appProvider;
      if (p) {
        const ep = APP_ENDPOINTS[p.toLowerCase()]?.[node.data.appAction || ''];
        if (ep) envKeys.add(ep.envKey);
        else if (APP_PROVIDER_ENV_KEYS[p]) envKeys.add(APP_PROVIDER_ENV_KEYS[p]);
      }
    }
    if (type === 'action' && node.data.authValue) {
      envKeys.add(node.data.authValue.replace(/[^A-Z0-9_]/gi, '_').toUpperCase());
    }
  }

  return { llmProviders, envKeys, hasApproval };
}

// ─────────────────────────────────────────────────────────────────────
// App Action block generator (manually emits per-library HTTP code)
// ─────────────────────────────────────────────────────────────────────
function genAppActionBlock(
  node: Node<NodeData>,
  varName: string,
  names: Record<string, string>,
  lib: Library,
  ind: string,
  isTS: boolean,
): string {
  const python = isPythonLib(lib);
  const appProvider = (node.data.appProvider || '').toLowerCase();
  const appAction = node.data.appAction || '';
  const appInputs = node.data.appInputs || {};

  const endpoint = APP_ENDPOINTS[appProvider]?.[appAction];
  if (!appProvider || !appAction || !endpoint) {
    return python
      ? `${ind}# WARNING: App action not configured (${appProvider || 'none'}.${appAction || 'none'})\n${ind}ctx['${varName}'] = {'type': 'text', 'payload': 'unconfigured'}\n`
      : `${ind}// WARNING: App action not configured (${appProvider || 'none'}.${appAction || 'none'})\n${ind}ctx['${varName}'] = { type: 'text', payload: 'unconfigured' };\n`;
  }

  const { urlTemplate, method, envKey, authPrefix = 'Bearer', urlPathFields = [], bodyFields, extraHeaders = {} } = endpoint;
  const lines: string[] = [];

  // Resolve URL path params by substituting {UPPER_SNAKE} placeholders
  let urlStr = urlTemplate;
  for (const field of urlPathFields) {
    const placeholder = field.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    const raw = appInputs[field] || '';
    const lifted = liftTemplate(raw, names, lib);
    if (python) {
      const inner = lifted.startsWith('f"') ? lifted.slice(2, -1) : lifted.slice(1, -1);
      urlStr = urlStr.replace(`{${placeholder}}`, inner ? `{${inner}}` : placeholder);
    } else {
      const inner = lifted.startsWith('`') ? lifted.slice(1, -1) : lifted.slice(1, -1);
      urlStr = urlStr.replace(`{${placeholder}}`, inner ? `\${${inner}}` : placeholder);
    }
  }
  const urlExpr = python
    ? (urlStr.includes('{') ? `f"${urlStr.replace(/"/g, '\\"')}"` : `"${urlStr}"`)
    : (urlStr.includes('${') ? `\`${urlStr.replace(/`/g, '\\`')}\`` : `'${urlStr}'`);

  if (python) {
    // Auth + extra headers
    lines.push(`${varName}_headers = {`);
    lines.push(`    'Authorization': f"${authPrefix} {os.environ.get('${envKey}', '')}",`);
    lines.push(`    'Content-Type': 'application/json',`);
    for (const [k, v] of Object.entries(extraHeaders)) lines.push(`    '${k}': '${v}',`);
    lines.push(`}`);

    // Body
    if (bodyFields.length) {
      // Notion needs a structured body
      if (appProvider === 'notion' && appAction === 'create_page') {
        const dbId = liftTemplate(appInputs['databaseId'] || '', names, lib);
        const title = liftTemplate(appInputs['title'] || '', names, lib);
        const content = liftTemplate(appInputs['content'] || '', names, lib);
        lines.push(`${varName}_body = {`);
        lines.push(`    'parent': {'database_id': ${dbId}},`);
        lines.push(`    'properties': {'title': {'title': [{'text': {'content': ${title}}}]}},`);
        lines.push(`    'children': [{'object': 'block', 'type': 'paragraph', 'paragraph': {'rich_text': [{'text': {'content': ${content}}}]}}],`);
        lines.push(`}`);
      } else {
        lines.push(`${varName}_body = {`);
        for (const f of bodyFields) {
          lines.push(`    '${f}': ${liftTemplate(appInputs[f] || '', names, lib)},`);
        }
        lines.push(`}`);
      }
    }

    const bodyArg = bodyFields.length ? `, json=${varName}_body` : '';
    const M = method.toLowerCase();

    if (lib === 'httpx') {
      lines.push(`with httpx.Client() as _${varName}_c:`);
      lines.push(`    ${varName}_r = _${varName}_c.${M}(${urlExpr}${bodyArg}, headers=${varName}_headers)`);
      lines.push(`    ${varName}_r.raise_for_status()`);
      lines.push(`    try:`);
      lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_r.json()}`);
      lines.push(`    except Exception:`);
      lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_r.text}`);
    } else if (lib === 'aiohttp') {
      const jsonArg = bodyFields.length ? `json=${varName}_body, ` : '';
      lines.push(`async with _session.${M}(${urlExpr}, ${jsonArg}headers=${varName}_headers) as ${varName}_r:`);
      lines.push(`    ${varName}_r.raise_for_status()`);
      lines.push(`    try:`);
      lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': await ${varName}_r.json()}`);
      lines.push(`    except Exception:`);
      lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': await ${varName}_r.text()}`);
    } else {
      lines.push(`${varName}_r = requests.${M}(${urlExpr}${bodyArg}, headers=${varName}_headers)`);
      lines.push(`${varName}_r.raise_for_status()`);
      lines.push(`try:`);
      lines.push(`    ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_r.json()}`);
      lines.push(`except Exception:`);
      lines.push(`    ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_r.text}`);
    }
  } else {
    // TypeScript / JavaScript
    const typeAnnotation = isTS ? ': Record<string, string>' : '';
    const M = method.toUpperCase();

    lines.push(`const ${varName}_headers${typeAnnotation} = {`);
    lines.push(`  'Authorization': \`${authPrefix} \${process.env.${envKey} ?? ''}\`,`);
    lines.push(`  'Content-Type': 'application/json',`);
    for (const [k, v] of Object.entries(extraHeaders)) lines.push(`  '${k}': '${v}',`);
    lines.push(`};`);

    if (bodyFields.length) {
      if (appProvider === 'notion' && appAction === 'create_page') {
        const dbId = liftTemplate(appInputs['databaseId'] || '', names, lib);
        const title = liftTemplate(appInputs['title'] || '', names, lib);
        const content = liftTemplate(appInputs['content'] || '', names, lib);
        lines.push(`const ${varName}_body = {`);
        lines.push(`  parent: { database_id: ${dbId} },`);
        lines.push(`  properties: { title: { title: [{ text: { content: ${title} } }] } },`);
        lines.push(`  children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: ${content} } }] } }],`);
        lines.push(`};`);
      } else {
        lines.push(`const ${varName}_body = {`);
        for (const f of bodyFields) {
          lines.push(`  ${f}: ${liftTemplate(appInputs[f] || '', names, lib)},`);
        }
        lines.push(`};`);
      }
    }

    if (lib === 'axios') {
      lines.push(`const ${varName}_r = await axios({`);
      lines.push(`  method: '${M.toLowerCase()}',`);
      lines.push(`  url: ${urlExpr},`);
      lines.push(`  headers: ${varName}_headers,`);
      if (bodyFields.length) lines.push(`  data: ${varName}_body,`);
      lines.push(`});`);
      lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_r.data };`);
    } else if (lib === 'got') {
      lines.push(`const ${varName}_r = await got.${M.toLowerCase()}<unknown>(${urlExpr}, {`);
      lines.push(`  headers: ${varName}_headers,`);
      lines.push(`  responseType: 'json' as const,`);
      if (bodyFields.length) lines.push(`  json: ${varName}_body,`);
      lines.push(`});`);
      lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_r.body };`);
    } else {
      // fetch / node-fetch
      lines.push(`const ${varName}_r = await fetch(${urlExpr}, {`);
      lines.push(`  method: '${M}',`);
      lines.push(`  headers: ${varName}_headers,`);
      if (bodyFields.length) lines.push(`  body: JSON.stringify(${varName}_body),`);
      lines.push(`});`);
      lines.push(`if (!${varName}_r.ok) throw new Error(\`HTTP \${${varName}_r.status}: \${${varName}_r.statusText}\`);`);
      lines.push(`const ${varName}_data = await ${varName}_r.json().catch(() => ${varName}_r.text());`);
      lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_data };`);
    }
  }

  return lines.map(l => `${ind}${l}`).join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────
export function compileFlow(
  nodes: Node<NodeData>[],
  edges: Edge[],
  language: 'python' | 'javascript' | 'typescript',
  library?: Library
): string {
  if (!nodes.length) return language === 'python' ? '# No nodes found to compile.' : '// No nodes found to compile.';

  const lib: Library = library ?? getDefaultLibrary(language);
  const ordered = topoSort(nodes, edges);
  const names = getSemanticNames(nodes);
  const triggerNode = nodes.find(n => n.type === 'trigger');
  const hasSchedule = triggerNode?.data?.schedule === 'Schedule';

  return isPythonLib(lib)
    ? compilePython(ordered, edges, names, lib, hasSchedule, triggerNode)
    : compileTypeScriptOrJS(ordered, edges, names, lib, language as 'typescript' | 'javascript', hasSchedule, triggerNode);
}

// ─────────────────────────────────────────────────────────────────────
// TypeScript / JavaScript (fetch | axios | got | node-fetch)
// ─────────────────────────────────────────────────────────────────────
function compileTypeScriptOrJS(
  nodes: Node<NodeData>[],
  edges: Edge[],
  names: Record<string, string>,
  lib: Library,
  language: 'typescript' | 'javascript',
  hasSchedule: boolean,
  triggerNode: Node<NodeData> | undefined,
): string {
  const isTS = language === 'typescript';
  const meta = collectFlowMeta(nodes);
  const fileExt = isTS ? 'ts' : 'js';

  // Collect unique LLM SDK imports
  const llmImportLines = new Set<string>();
  for (const p of meta.llmProviders) llmImportLines.add(genLLMImports(lib, p));

  // File header
  let code = `/**\n * AgentForge — Compiled Flow (${language}${lib !== 'fetch' ? ` / ${lib}` : ''})\n`;
  code += ` * Run: ${isTS ? `npx ts-node agent.${fileExt}` : `node agent.${fileExt}`}\n`;
  if (meta.envKeys.size) {
    code += ` *\n * Required ENV variables: ${[...meta.envKeys].join(', ')}\n`;
    code += ` * Create a .env file or export them before running.\n`;
  }
  code += ` */\n\n`;

  // HTTP library import
  const httpImports = genImports(lib, hasSchedule);
  if (httpImports) code += httpImports;

  // LLM SDK imports
  for (const imp of llmImportLines) code += imp;
  if (llmImportLines.size) code += '\n';

  // TypeScript context interface
  if (isTS) {
    code += `interface FlowContext {\n  input: { type: string; payload: any };\n  [key: string]: { type: string; payload: any };\n}\n\n`;
  }

  // Function declaration
  const fnDecl = isTS
    ? `async function runAgent(initialInput: string = 'Default'): Promise<FlowContext> {`
    : `async function runAgent(initialInput = 'Default') {`;

  code += fnDecl + '\n';
  code += isTS
    ? `  const ctx: FlowContext = { input: { type: 'text', payload: initialInput } };\n\n`
    : `  const ctx = { input: { type: 'text', payload: initialInput } };\n\n`;

  for (const node of nodes) {
    const varName = names[node.id];
    const label = node.data.label || node.type || varName;
    code += `  // ── [${node.type}] ${label}\n`;

    switch (node.type) {
      case 'input':
      case 'trigger': {
        code += `  ctx['${varName}'] = ctx.input;\n`;
        break;
      }

      case 'ai':
      case 'ai_agent':
      case 'llm':
      case 'agent-brain': {
        const raw = node.data.instructions || '';
        const liftedPrompt = liftTemplate(raw, names, lib);
        const provider = detectLLMProvider(node.data.provider, node.data.modelName || node.data.model);
        const modelName = node.data.modelName || node.data.model || '';
        code += `  const ${varName}_prompt = ${liftedPrompt};\n`;
        code += genLLMBlock(lib, provider, modelName, varName, `${varName}_prompt`, '  ');
        break;
      }

      case 'action': {
        const url = (node.data.url || '').trim();
        const method = (node.data.method || 'POST').toUpperCase();
        const extraHeaders: Record<string, string> = {};
        (node.data.headers || []).forEach(h => { if (h.key) extraHeaders[h.key] = h.value; });
        const authType = (node.data.authType as 'none' | 'bearer' | 'basic') || 'none';
        const authValue = node.data.authValue || node.data.persistence || '';
        const bodyRaw = node.data.bodyMapping || node.data.instructions || '';
        const bodyExpr = bodyRaw ? liftTemplate(bodyRaw, names, lib) : null;

        if (!url) {
          code += `  // WARNING: No endpoint URL configured for "${label}"\n`;
          code += `  ctx['${varName}'] = { type: 'data', payload: null };\n`;
        } else {
          code += genHttpBlock(lib, { method, url, extraHeaders, authType, authValue, body: bodyExpr, varName, ind: '  ' });
        }
        break;
      }

      case 'app_action': {
        code += genAppActionBlock(node, varName, names, lib, '  ', isTS);
        break;
      }

      case 'approval': {
        const label2 = node.data.gatekeeperMessage || node.data.label || 'Approval Gate';
        code += genApprovalPause(lib, label2, varName, '  ');
        break;
      }

      case 'gatekeeper': {
        const verification = (node.data.verification || '').toLowerCase();
        const isHuman = verification.includes('human') || verification.includes('manual');
        if (isHuman) {
          const msg = node.data.gatekeeperMessage || node.data.label || 'Safety Gatekeeper';
          code += genApprovalPause(lib, msg, varName, '  ');
        } else {
          // AI critic — verify upstream content, throw if rejected
          const incomingId = edges.find(e => e.target === node.id)?.source;
          const upstreamVar = incomingId ? names[incomingId] : 'input';
          code += `  const ${varName}_review = \`Review this content for safety and policy compliance. Respond APPROVED or REJECTED:<reason>\\n\\n\${ctx['${upstreamVar}']?.payload ?? ''}\`;\n`;
          code += `  // Gatekeeper: replace with a real LLM safety check if needed\n`;
          code += `  const ${varName}_verdict = 'APPROVED'; // TODO: call LLM with ${varName}_review\n`;
          code += `  if (${varName}_verdict.startsWith('REJECTED')) throw new Error(\`Gatekeeper blocked: \${${varName}_verdict}\`);\n`;
          code += `  ctx['${varName}'] = { type: 'text', payload: 'approved' };\n`;
        }
        break;
      }

      case 'output': {
        const fmt = node.data.resultFormat || '';
        const liftedFmt = liftTemplate(fmt, names, lib);
        code += `  const ${varName}_payload = ${liftedFmt};\n`;
        code += `  ctx['${varName}'] = { type: 'text', payload: ${varName}_payload };\n`;
        code += `  console.log('\\n=== Final Result ===\\n', ${varName}_payload);\n`;
        break;
      }

      case 'router':
      case 'decision': {
        const routes = node.data.routes || ['Path A', 'Path B'];
        const conditions = node.data.conditions || {};
        const incomingId = edges.find(e => e.target === node.id)?.source;
        const upstreamVar = incomingId ? names[incomingId] : Object.keys(names)[0];
        code += `  const ${varName}_input = String(ctx['${upstreamVar}']?.payload ?? '').toLowerCase();\n`;
        routes.forEach((route, i) => {
          const cond = (conditions[route] || '').toLowerCase();
          const jsCond = cond ? `${varName}_input.includes('${cond.replace(/'/g, "\\'")}')` : 'true';
          code += `  ${i === 0 ? 'if' : 'else if'} (${jsCond}) {\n    // Route: ${route}\n    ctx['${varName}'] = { type: 'text', payload: '${route}' };\n  }\n`;
        });
        break;
      }

      case 'processor': {
        const incomingId = edges.find(e => e.target === node.id)?.source;
        const upstreamVar = incomingId ? names[incomingId] : 'input';
        const batchLogic = node.data.batchLogic || '';
        if (batchLogic) {
          const lifted = liftTemplate(batchLogic, names, lib);
          code += `  const ${varName}_result = ${lifted};\n`;
          code += `  ctx['${varName}'] = { type: 'text', payload: ${varName}_result };\n`;
        } else {
          code += `  const ${varName}_raw = ctx['${upstreamVar}']?.payload;\n`;
          code += `  const ${varName}_processed = Array.isArray(${varName}_raw) ? ${varName}_raw.map(String) : [String(${varName}_raw ?? '')];\n`;
          code += `  ctx['${varName}'] = { type: 'data', payload: ${varName}_processed };\n`;
        }
        break;
      }

      case 'vault': {
        const query = node.data.instructions || '';
        const liftedQ = liftTemplate(query, names, lib);
        code += `  // Vault: perform RAG lookup against your knowledge source\n`;
        code += `  const ${varName}_query = ${liftedQ};\n`;
        code += `  ctx['${varName}'] = { type: 'text', payload: \`[Vault result for: \${${varName}_query.substring(0, 80)}]\` };\n`;
        break;
      }

      default: {
        code += `  ctx['${varName}'] = { type: 'text', payload: '${node.type} executed' };\n`;
        break;
      }
    }
    code += '\n';
  }

  code += `  return ctx;\n}\n\n`;

  if (hasSchedule && triggerNode) {
    code += buildCronBlock(triggerNode, 'js');
  } else {
    code += `// ── Run\nrunAgent('Hello')\n  .then(ctx => console.log(JSON.stringify(ctx, null, 2)))\n  .catch(console.error);\n`;
  }

  return code;
}

// ─────────────────────────────────────────────────────────────────────
// Python (requests | httpx | aiohttp)
// ─────────────────────────────────────────────────────────────────────
function compilePython(
  nodes: Node<NodeData>[],
  edges: Edge[],
  names: Record<string, string>,
  lib: Library,
  hasSchedule: boolean,
  triggerNode: Node<NodeData> | undefined,
): string {
  const isAsync = lib === 'aiohttp';
  const meta = collectFlowMeta(nodes);

  // Collect unique LLM SDK imports
  const llmImportLines = new Set<string>();
  for (const p of meta.llmProviders) llmImportLines.add(genLLMImports(lib, p));

  // File header
  let code = `# AgentForge — Compiled Flow (Python / ${lib})\n# Run: python agent.py\n`;
  if (meta.envKeys.size) {
    code += `#\n# Required ENV variables: ${[...meta.envKeys].join(', ')}\n`;
    code += `# Create a .env file and load with python-dotenv, or export them in your shell.\n`;
  }
  code += `\n`;

  // Imports
  code += genImports(lib, hasSchedule);
  for (const imp of llmImportLines) code += imp;
  code += '\n\n';

  const ind = '    '; // 4-space indent inside function
  const defLine = isAsync
    ? `async def run_agent(initial_input: str = "Default") -> dict:`
    : `def run_agent(initial_input: str = "Default") -> dict:`;
  code += defLine + '\n';
  code += `${ind}ctx = {'input': {'type': 'text', 'payload': initial_input}}\n\n`;

  // For aiohttp, open a shared session around all HTTP calls
  const aiohttpSession = isAsync && nodes.some(
    n => (n.type === 'action' && n.data.url?.trim()) || n.type === 'app_action'
  );
  if (aiohttpSession) code += `${ind}async with aiohttp.ClientSession() as _session:\n`;
  const nodeInd = aiohttpSession ? ind + '    ' : ind;

  for (const node of nodes) {
    const varName = names[node.id];
    const label = node.data.label || node.type || varName;
    code += `${nodeInd}# ── [${node.type}] ${label}\n`;

    switch (node.type) {
      case 'input':
      case 'trigger': {
        code += `${nodeInd}ctx['${varName}'] = ctx['input']\n`;
        break;
      }

      case 'ai':
      case 'ai_agent':
      case 'llm':
      case 'agent-brain': {
        const raw = node.data.instructions || '';
        const liftedPrompt = liftTemplate(raw, names, lib);
        const provider = detectLLMProvider(node.data.provider, node.data.modelName || node.data.model);
        const modelName = node.data.modelName || node.data.model || '';
        code += `${nodeInd}${varName}_prompt = ${liftedPrompt}\n`;
        code += genLLMBlock(lib, provider, modelName, varName, `${varName}_prompt`, nodeInd);
        break;
      }

      case 'action': {
        const url = (node.data.url || '').trim();
        const method = (node.data.method || 'POST').toUpperCase();
        const extraHeaders: Record<string, string> = {};
        (node.data.headers || []).forEach(h => { if (h.key) extraHeaders[h.key] = h.value; });
        const authType = (node.data.authType as 'none' | 'bearer' | 'basic') || 'none';
        const authValue = node.data.authValue || node.data.persistence || '';
        const bodyRaw = node.data.bodyMapping || node.data.instructions || '';
        const bodyExpr = bodyRaw ? liftTemplate(bodyRaw, names, lib) : null;

        if (!url) {
          code += `${nodeInd}# WARNING: No endpoint URL configured for "${label}"\n`;
          code += `${nodeInd}ctx['${varName}'] = {'type': 'data', 'payload': None}\n`;
        } else {
          code += genHttpBlock(lib, { method, url, extraHeaders, authType, authValue, body: bodyExpr, varName, ind: nodeInd });
        }
        break;
      }

      case 'app_action': {
        code += genAppActionBlock(node, varName, names, lib, nodeInd, false);
        break;
      }

      case 'approval': {
        const label2 = node.data.gatekeeperMessage || node.data.label || 'Approval Gate';
        code += genApprovalPause(lib, label2, varName, nodeInd);
        break;
      }

      case 'gatekeeper': {
        const verification = (node.data.verification || '').toLowerCase();
        const isHuman = verification.includes('human') || verification.includes('manual');
        if (isHuman) {
          const msg = node.data.gatekeeperMessage || node.data.label || 'Safety Gatekeeper';
          code += genApprovalPause(lib, msg, varName, nodeInd);
        } else {
          const incomingId = edges.find(e => e.target === node.id)?.source;
          const upstreamVar = incomingId ? names[incomingId] : 'input';
          code += `${nodeInd}${varName}_review = f"Review for safety compliance:\\n\\n{ctx.get('${upstreamVar}', {}).get('payload', '')}"\n`;
          code += `${nodeInd}# Gatekeeper: replace with a real LLM safety check if needed\n`;
          code += `${nodeInd}${varName}_verdict = 'APPROVED'  # TODO: call LLM with ${varName}_review\n`;
          code += `${nodeInd}if ${varName}_verdict.startswith('REJECTED'):\n`;
          code += `${nodeInd}    raise ValueError(f"Gatekeeper blocked: {${varName}_verdict}")\n`;
          code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': 'approved'}\n`;
        }
        break;
      }

      case 'output': {
        const fmt = node.data.resultFormat || '';
        const liftedFmt = liftTemplate(fmt, names, lib);
        code += `${nodeInd}${varName}_payload = ${liftedFmt}\n`;
        code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_payload}\n`;
        code += `${nodeInd}print(f"\\n=== Final Result ===\\n{${varName}_payload}")\n`;
        break;
      }

      case 'router':
      case 'decision': {
        const routes = node.data.routes || ['Path A', 'Path B'];
        const conditions = node.data.conditions || {};
        const incomingId = edges.find(e => e.target === node.id)?.source;
        const upstreamVar = incomingId ? names[incomingId] : 'input';
        code += `${nodeInd}${varName}_input = str(ctx.get('${upstreamVar}', {}).get('payload', '')).lower()\n`;
        routes.forEach((route, i) => {
          const cond = (conditions[route] || '').toLowerCase();
          const pyCond = cond ? `'${cond}' in ${varName}_input` : 'True';
          code += `${nodeInd}${i === 0 ? 'if' : 'elif'} ${pyCond}:  # Route: ${route}\n`;
          code += `${nodeInd}    ctx['${varName}'] = {'type': 'text', 'payload': '${route}'}\n`;
        });
        break;
      }

      case 'processor': {
        const incomingId = edges.find(e => e.target === node.id)?.source;
        const upstreamVar = incomingId ? names[incomingId] : 'input';
        const batchLogic = node.data.batchLogic || '';
        if (batchLogic) {
          const lifted = liftTemplate(batchLogic, names, lib);
          code += `${nodeInd}${varName}_result = ${lifted}\n`;
          code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_result}\n`;
        } else {
          code += `${nodeInd}${varName}_raw = ctx.get('${upstreamVar}', {}).get('payload', '')\n`;
          code += `${nodeInd}${varName}_processed = [str(item) for item in ${varName}_raw] if isinstance(${varName}_raw, list) else [str(${varName}_raw)]\n`;
          code += `${nodeInd}ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_processed}\n`;
        }
        break;
      }

      case 'vault': {
        const query = node.data.instructions || '';
        const liftedQ = liftTemplate(query, names, lib);
        code += `${nodeInd}# Vault: perform RAG lookup against your knowledge source\n`;
        code += `${nodeInd}${varName}_query = ${liftedQ}\n`;
        code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': f'[Vault result for: {${varName}_query[:80]}]'}\n`;
        break;
      }

      default: {
        code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': '${node.type} executed'}\n`;
        break;
      }
    }
    code += '\n';
  }

  code += `${ind}return ctx\n\n`;

  code += `if __name__ == "__main__":\n`;
  if (hasSchedule && triggerNode) {
    code += buildCronBlock(triggerNode, 'python');
  } else if (isAsync) {
    code += `    result = asyncio.run(run_agent("Hello"))\n`;
    code += `    print(json.dumps(result, indent=2, default=str))\n`;
  } else {
    code += `    result = run_agent("Hello")\n`;
    code += `    print(json.dumps(result, indent=2, default=str))\n`;
  }

  return code;
}

// ─────────────────────────────────────────────────────────────────────
// Schedule block builder
// ─────────────────────────────────────────────────────────────────────
function buildCronBlock(
  triggerNode: Node<NodeData>,
  lang: 'python' | 'js',
): string {
  const cronSetting = triggerNode.data.cron || 'Every Minute';
  const timeStr = triggerNode.data.time || '09:00';
  const days = triggerNode.data.days || ['Mon'];

  if (lang === 'js') {
    let cronExpression = '* * * * *';
    if (cronSetting === 'Hourly') cronExpression = '0 * * * *';
    else if (cronSetting === 'Daily') {
      const [h, m] = timeStr.split(':');
      cronExpression = `${parseInt(m || '0')} ${parseInt(h || '9')} * * *`;
    } else if (cronSetting === 'Weekly') {
      const [h, m] = timeStr.split(':');
      const dayMap: Record<string, string> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
      cronExpression = `${parseInt(m || '0')} ${parseInt(h || '9')} * * ${days.map(d => dayMap[d]).filter(Boolean).join(',') || '1'}`;
    }
    return `// ── Scheduled Execution\ncron.schedule('${cronExpression}', () => {\n  runAgent().catch(console.error);\n});\n`;
  }

  let lines = `    def job():\n        run_agent("Scheduled Run")\n\n`;
  if (cronSetting === 'Every Minute') lines += `    schedule.every(1).minutes.do(job)\n`;
  else if (cronSetting === 'Hourly') lines += `    schedule.every(1).hours.do(job)\n`;
  else if (cronSetting === 'Daily') lines += `    schedule.every().day.at("${timeStr}").do(job)\n`;
  else if (cronSetting === 'Weekly') {
    const dayMap: Record<string, string> = { Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday', Fri: 'friday', Sat: 'saturday', Sun: 'sunday' };
    days.forEach(d => { lines += `    schedule.every().${dayMap[d] || 'monday'}.at("${timeStr}").do(job)\n`; });
  }
  lines += `\n    while True:\n        schedule.run_pending()\n        time.sleep(1)\n`;
  return lines;
}
