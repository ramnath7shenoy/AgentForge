import { Node, Edge } from "reactflow";
import { NodeData } from "@/types/flowStoreTypes";
import {
  Library,
  LLMProvider,
  genImports,
  genLLMBlock,
  genHttpBlock,
  genApprovalPause,
  liftTemplate,
  isPythonLib,
  getDefaultLibrary,
  detectLLMProvider,
  getLLMEnvKey,
  APP_PROVIDER_ENV_KEYS,
  genInstallComment,
  genHelperCode,
  genUniversalLLMHelper,
} from "./codegen/templates";
import { CONTENT_FIELD_KEYS } from "./providers";

// ─────────────────────────────────────────────────────────────────────
// App provider display name map (used in PREVIEW console output)
// ─────────────────────────────────────────────────────────────────────
const APP_DISPLAY_NAMES: Record<string, string> = {
  discord: 'Discord',
  slack: 'Slack',
  github: 'GitHub',
  notion: 'Notion',
  twitter: 'Twitter/X',
  x: 'Twitter/X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  medium: 'Medium',
  sendgrid: 'SendGrid',
  mailchimp: 'Mailchimp',
  stripe: 'Stripe',
  twilio: 'Twilio',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  pinecone: 'Pinecone',
  airtable: 'Airtable',
  google: 'Google',
  shopify: 'Shopify',
};

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
// Only nodes reachable from the connected graph are included.
// Isolated nodes (no edges) are excluded when the graph has edges,
// preventing zombie nodes from prior flows from being compiled.
// ─────────────────────────────────────────────────────────────────────
function topoSort(nodes: Node<NodeData>[], edges: Edge[]): Node<NodeData>[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const byId = new Map<string, Node<NodeData>>();

  // When the graph has edges, only include nodes that participate in at least one edge.
  const connectedIds = edges.length > 0
    ? new Set(edges.flatMap(e => [e.source, e.target]))
    : null;
  const activeNodes = connectedIds
    ? nodes.filter(n => connectedIds.has(n.id))
    : nodes;

  activeNodes.forEach(n => { inDeg.set(n.id, 0); adj.set(n.id, []); byId.set(n.id, n); });
  edges.forEach(e => {
    if (!inDeg.has(e.source) || !inDeg.has(e.target)) return;
    adj.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  });

  const queue: string[] = [];
  activeNodes.forEach(n => { if ((inDeg.get(n.id) ?? 0) === 0) queue.push(n.id); });

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
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Router condition builder
// ─────────────────────────────────────────────────────────────────────
function buildRouterCond(condRaw: string, inputVar: string, lang: 'py' | 'js'): string {
  const cond = (condRaw || '').trim().toLowerCase();
  if (!cond || ['otherwise', 'else', 'default', 'true', 'always'].includes(cond)) {
    return lang === 'py' ? 'True' : 'true';
  }
  // Extract keywords: split on "or", ",", "|"
  const keywords = cond
    .split(/\bor\b|\s*[,|]\s*/)
    .map(k => k.replace(/contains\s+/g, '').replace(/^["'`]|["'`]$/g, '').trim())
    .filter(k => k.length > 0);
  if (!keywords.length) return lang === 'py' ? 'True' : 'true';
  if (lang === 'py') {
    return keywords.map(k => `'${k.replace(/'/g, "\\'")}' in ${inputVar}`).join(' or ');
  }
  return keywords.map(k => `${inputVar}.includes('${k.replace(/'/g, "\\'")}')`).join(' || ');
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
  instagram: {
    create_post: {
      urlTemplate: 'https://graph.instagram.com/me/media',  // Step 1 — Step 2 handled inline
      method: 'POST',
      envKey: 'INSTAGRAM_ACCESS_TOKEN',
      bodyFields: ['imageUrl', 'caption'],
    },
  },
  linkedin: {
    create_post: {
      urlTemplate: 'https://api.linkedin.com/v2/ugcPosts',
      method: 'POST',
      envKey: 'LINKEDIN_ACCESS_TOKEN',
      extraHeaders: { 'X-Restli-Protocol-Version': '2.0.0' },
      bodyFields: ['text'],
    },
  },
  medium: {
    create_post: {
      urlTemplate: 'https://api.medium.com/v1/me',  // Step 1 to get userId — Step 2 inline
      method: 'GET',
      envKey: 'MEDIUM_INTEGRATION_TOKEN',
      bodyFields: ['title', 'content', 'contentFormat'],
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
  hasBrowserAction: boolean;
}

function collectFlowMeta(nodes: Node<NodeData>[]): FlowMeta {
  const llmProviders = new Set<LLMProvider>();
  const envKeys = new Set<string>();
  let hasApproval = false;
  let hasBrowserAction = false;

  for (const node of nodes) {
    const type = node.type || '';
    if (['ai', 'ai_agent', 'llm', 'agent-brain'].includes(type)) {
      const p = detectLLMProvider(node.data.provider, node.data.modelName || node.data.model);
      llmProviders.add(p);
      envKeys.add(getLLMEnvKey(p));
    }
    if (type === 'approval' || type === 'gatekeeper') hasApproval = true;
    if (type === 'appaction' || type === 'app_action') {
      const p = (node.data.appProvider || '').toLowerCase();
      if (p === 'browser') {
        hasBrowserAction = true;
      } else if (p) {
        const ep = APP_ENDPOINTS[p]?.[node.data.appAction || ''];
        if (ep) envKeys.add(ep.envKey);
        else if (APP_PROVIDER_ENV_KEYS[p]) envKeys.add(APP_PROVIDER_ENV_KEYS[p]);
      }
    }
    if (type === 'action' && node.data.authValue) {
      envKeys.add(node.data.authValue.replace(/[^A-Z0-9_]/gi, '_').toUpperCase());
    }
  }

  return { llmProviders, envKeys, hasApproval, hasBrowserAction };
}

// ─────────────────────────────────────────────────────────────────────
// Browser / E2B action block — generates Playwright code for local execution
// ─────────────────────────────────────────────────────────────────────
function genBrowserActionBlock(
  node: Node<NodeData>,
  varName: string,
  names: Record<string, string>,
  lib: Library,
  ind: string,
  isTS: boolean,
  edges: Edge[],
): string {
  const python = isPythonLib(lib);
  const appAction = node.data.appAction || '';
  const appInputs = node.data.appInputs || {};

  // When URL field is empty, resolve from the upstream node's output (rigid template — no guessing)
  let urlExpr: string;
  if (appInputs['url']?.trim()) {
    urlExpr = liftTemplate(appInputs['url'], names, lib);
  } else {
    const upstreamId = edges.find(e => e.target === node.id)?.source;
    const upstreamVar = upstreamId ? (names[upstreamId] ?? 'input') : 'input';
    urlExpr = python
      ? `_get(ctx.get('${upstreamVar}'), 'payload')`
      : `_get(ctx['${upstreamVar}'], 'payload')`;
  }

  // Prompt/code: resolve from upstream when empty
  let promptExpr: string;
  if (appInputs['prompt']?.trim() || appInputs['instructions']?.trim()) {
    promptExpr = liftTemplate(appInputs['prompt'] || appInputs['instructions'] || '', names, lib);
  } else {
    const upstreamId = edges.find(e => e.target === node.id)?.source;
    const upstreamVar = upstreamId ? (names[upstreamId] ?? 'input') : 'input';
    promptExpr = python
      ? `_get(ctx.get('${upstreamVar}'), 'payload')`
      : `_get(ctx['${upstreamVar}'], 'payload')`;
  }

  const lines: string[] = [];

  if (python) {
    switch (appAction) {
      case 'screenshot_page': {
        lines.push(`# Browser: take screenshot (requires: pip install playwright && playwright install chromium)`);
        lines.push(`import base64 as _b64_${varName}, re as _re_${varName}`);
        lines.push(`from playwright.async_api import async_playwright`);
        lines.push(`_pw_url_${varName} = str(${urlExpr}).strip()`);
        lines.push(`_m_${varName} = _re_${varName}.search(r"https?://[^\\s<>]+", _pw_url_${varName})`);
        lines.push(`_pw_url_${varName} = _m_${varName}.group(0).rstrip('.,;:)') if _m_${varName} else ('https://' + _pw_url_${varName} if _pw_url_${varName} and not _pw_url_${varName}.startswith(('http://', 'https://')) else _pw_url_${varName})`);
        lines.push(`async with async_playwright() as _pw_${varName}:`);
        lines.push(`    _browser_${varName} = await _pw_${varName}.chromium.launch(headless=True)`);
        lines.push(`    _ctx_${varName} = await _browser_${varName}.new_context(viewport={"width": 1280, "height": 800})`);
        lines.push(`    _page_${varName} = await _ctx_${varName}.new_page()`);
        lines.push(`    await _page_${varName}.goto(_pw_url_${varName}, wait_until="domcontentloaded", timeout=30000)`);
        lines.push(`    await _page_${varName}.wait_for_timeout(1500)`);
        lines.push(`    _shot_${varName} = _b64_${varName}.b64encode(await _page_${varName}.screenshot(full_page=True)).decode('utf-8')`);
        lines.push(`    await _browser_${varName}.close()`);
        lines.push(`ctx['${varName}'] = {'type': 'file', 'payload': f'data:image/png;base64,{_shot_${varName}}'}`);
        break;
      }
      case 'scrape_page': {
        lines.push(`# Browser: scrape page text (requires: pip install playwright && playwright install chromium)`);
        lines.push(`import re as _re_${varName}`);
        lines.push(`from playwright.async_api import async_playwright`);
        lines.push(`_pw_url_${varName} = str(${urlExpr}).strip()`);
        lines.push(`_m_${varName} = _re_${varName}.search(r"https?://[^\\s<>]+", _pw_url_${varName})`);
        lines.push(`_pw_url_${varName} = _m_${varName}.group(0).rstrip('.,;:)') if _m_${varName} else ('https://' + _pw_url_${varName} if _pw_url_${varName} and not _pw_url_${varName}.startswith(('http://', 'https://')) else _pw_url_${varName})`);
        lines.push(`async with async_playwright() as _pw_${varName}:`);
        lines.push(`    _browser_${varName} = await _pw_${varName}.chromium.launch(headless=True)`);
        lines.push(`    _ctx_${varName} = await _browser_${varName}.new_context()`);
        lines.push(`    _page_${varName} = await _ctx_${varName}.new_page()`);
        lines.push(`    await _page_${varName}.goto(_pw_url_${varName}, wait_until="domcontentloaded", timeout=30000)`);
        lines.push(`    _text_${varName} = await _page_${varName}.evaluate("() => document.body.innerText")`);
        lines.push(`    await _browser_${varName}.close()`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _text_${varName}}`);
        break;
      }
      case 'browse_and_summarize': {
        lines.push(`# Browser: browse and summarize (requires: pip install playwright && playwright install chromium)`);
        lines.push(`import re as _re_${varName}`);
        lines.push(`from playwright.async_api import async_playwright`);
        lines.push(`_pw_url_${varName} = str(${urlExpr}).strip()`);
        lines.push(`_m_${varName} = _re_${varName}.search(r"https?://[^\\s<>]+", _pw_url_${varName})`);
        lines.push(`_pw_url_${varName} = _m_${varName}.group(0).rstrip('.,;:)') if _m_${varName} else ('https://' + _pw_url_${varName} if _pw_url_${varName} and not _pw_url_${varName}.startswith(('http://', 'https://')) else _pw_url_${varName})`);
        lines.push(`async with async_playwright() as _pw_${varName}:`);
        lines.push(`    _browser_${varName} = await _pw_${varName}.chromium.launch(headless=True)`);
        lines.push(`    _ctx_${varName} = await _browser_${varName}.new_context()`);
        lines.push(`    _page_${varName} = await _ctx_${varName}.new_page()`);
        lines.push(`    await _page_${varName}.goto(_pw_url_${varName}, wait_until="domcontentloaded", timeout=30000)`);
        lines.push(`    _text_${varName} = await _page_${varName}.evaluate("() => document.body.innerText")`);
        lines.push(`    await _browser_${varName}.close()`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _text_${varName}[:8000]}  # Truncated for LLM summarization`);
        break;
      }
      case 'run_python': {
        lines.push(`# Execute Python code with captured stdout`);
        lines.push(`import io as _io_${varName}, contextlib as _ctx_${varName}`);
        lines.push(`_py_code_${varName} = ${promptExpr}`);
        lines.push(`_py_out_${varName} = _io_${varName}.StringIO()`);
        lines.push(`with _ctx_${varName}.redirect_stdout(_py_out_${varName}):`);
        lines.push(`    exec(_py_code_${varName}, {"initial_input": initial_input})`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _py_out_${varName}.getvalue() or "Done"}`);
        break;
      }
      case 'run_javascript': {
        lines.push(`# Execute JavaScript via Node.js subprocess`);
        lines.push(`import subprocess as _sub_${varName}`);
        lines.push(`_js_code_${varName} = ${promptExpr}`);
        lines.push(`_js_result_${varName} = _sub_${varName}.run(['node', '-e', _js_code_${varName}], capture_output=True, text=True, timeout=30)`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _js_result_${varName}.stdout or _js_result_${varName}.stderr}`);
        break;
      }
      default: {
        lines.push(`# WARNING: Unknown browser action "${appAction}"`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': 'unconfigured'}`);
      }
    }
  } else {
    // TypeScript / JavaScript
    switch (appAction) {
      case 'screenshot_page': {
        lines.push(`// Browser: take screenshot (requires: npm install playwright && npx playwright install chromium)`);
        lines.push(`const { chromium: _chromium_${varName} } = await import('playwright');`);
        lines.push(`let _url_${varName} = String(${urlExpr}).trim();`);
        lines.push(`if (_url_${varName} && !_url_${varName}.startsWith('http://') && !_url_${varName}.startsWith('https://')) _url_${varName} = 'https://' + _url_${varName};`);
        lines.push(`const _browser_${varName} = await _chromium_${varName}.launch({ headless: true });`);
        lines.push(`const _ctx_${varName} = await _browser_${varName}.newContext({ viewport: { width: 1280, height: 800 } });`);
        lines.push(`const _page_${varName} = await _ctx_${varName}.newPage();`);
        lines.push(`await _page_${varName}.goto(_url_${varName}, { waitUntil: 'domcontentloaded', timeout: 30000 });`);
        lines.push(`await _page_${varName}.waitForTimeout(1500);`);
        lines.push(`const _shotBuf_${varName} = await _page_${varName}.screenshot({ fullPage: true });`);
        lines.push(`const _shotB64_${varName} = _shotBuf_${varName}.toString('base64');`);
        lines.push(`await _browser_${varName}.close();`);
        lines.push(`ctx['${varName}'] = { type: 'file', payload: \`data:image/png;base64,\${_shotB64_${varName}}\` };`);
        break;
      }
      case 'scrape_page': {
        lines.push(`// Browser: scrape page text (requires: npm install playwright && npx playwright install chromium)`);
        lines.push(`const { chromium: _chromium_${varName} } = await import('playwright');`);
        lines.push(`let _url_${varName} = String(${urlExpr}).trim();`);
        lines.push(`if (_url_${varName} && !_url_${varName}.startsWith('http://') && !_url_${varName}.startsWith('https://')) _url_${varName} = 'https://' + _url_${varName};`);
        lines.push(`const _browser_${varName} = await _chromium_${varName}.launch({ headless: true });`);
        lines.push(`const _ctx_${varName} = await _browser_${varName}.newContext();`);
        lines.push(`const _page_${varName} = await _ctx_${varName}.newPage();`);
        lines.push(`await _page_${varName}.goto(_url_${varName}, { waitUntil: 'domcontentloaded', timeout: 30000 });`);
        lines.push(`const _text_${varName} = await _page_${varName}.evaluate(() => document.body.innerText);`);
        lines.push(`await _browser_${varName}.close();`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _text_${varName} };`);
        break;
      }
      case 'browse_and_summarize': {
        lines.push(`// Browser: browse and summarize (requires: npm install playwright && npx playwright install chromium)`);
        lines.push(`const { chromium: _chromium_${varName} } = await import('playwright');`);
        lines.push(`let _url_${varName} = String(${urlExpr}).trim();`);
        lines.push(`if (_url_${varName} && !_url_${varName}.startsWith('http://') && !_url_${varName}.startsWith('https://')) _url_${varName} = 'https://' + _url_${varName};`);
        lines.push(`const _browser_${varName} = await _chromium_${varName}.launch({ headless: true });`);
        lines.push(`const _ctx_${varName} = await _browser_${varName}.newContext();`);
        lines.push(`const _page_${varName} = await _ctx_${varName}.newPage();`);
        lines.push(`await _page_${varName}.goto(_url_${varName}, { waitUntil: 'domcontentloaded', timeout: 30000 });`);
        lines.push(`const _text_${varName} = await _page_${varName}.evaluate(() => document.body.innerText);`);
        lines.push(`await _browser_${varName}.close();`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _text_${varName}.slice(0, 8000) }; // Truncated for LLM summarization`);
        break;
      }
      case 'run_javascript': {
        lines.push(`// Execute JavaScript via Function constructor`);
        lines.push(`const _jsCode_${varName} = ${promptExpr};`);
        lines.push(isTS
          ? `const _jsFn_${varName}: (...args: any[]) => any = new Function('initialInput', _jsCode_${varName});`
          : `const _jsFn_${varName} = new Function('initialInput', _jsCode_${varName});`);
        lines.push(`let _jsOut_${varName} = '';`);
        lines.push(`try { _jsOut_${varName} = String(await _jsFn_${varName}(initialInput) ?? ''); } catch (e${isTS ? ': any' : ''}) { _jsOut_${varName} = String(e?.message ?? e); }`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _jsOut_${varName} };`);
        break;
      }
      case 'run_python': {
        lines.push(`// Execute Python via subprocess (requires Python installed)`);
        lines.push(`const { execSync: _execSync_${varName} } = require('child_process');`);
        lines.push(`const _pyCode_${varName} = ${promptExpr};`);
        lines.push(`let _pyOut_${varName} = '';`);
        lines.push(`try { _pyOut_${varName} = _execSync_${varName}('python -c ' + JSON.stringify(_pyCode_${varName}), { encoding: 'utf-8', timeout: 30000 }); } catch (e${isTS ? ': any' : ''}) { _pyOut_${varName} = String(e?.stdout ?? e?.message ?? e); }`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _pyOut_${varName} };`);
        break;
      }
      default: {
        lines.push(`// WARNING: Unknown browser action "${appAction}"`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: 'unconfigured' };`);
      }
    }
  }

  return lines.map(l => `${ind}${l}`).join('\n') + '\n';
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
  edges: Edge[],
): string {
  const python = isPythonLib(lib);
  const appProvider = (node.data.appProvider || '').toLowerCase();
  const appAction = node.data.appAction || '';
  const appInputs = node.data.appInputs || {};

  // Browser / E2B actions → Playwright code (no REST endpoint needed)
  if (appProvider === 'browser') {
    return genBrowserActionBlock(node, varName, names, lib, ind, isTS, edges);
  }

  const endpoint = APP_ENDPOINTS[appProvider]?.[appAction];
  if (!appProvider || !appAction || !endpoint) {
    return python
      ? `${ind}# WARNING: App action not configured (${appProvider || 'none'}.${appAction || 'none'})\n${ind}ctx['${varName}'] = {'type': 'text', 'payload': 'unconfigured'}\n`
      : `${ind}// WARNING: App action not configured (${appProvider || 'none'}.${appAction || 'none'})\n${ind}ctx['${varName}'] = { type: 'text', payload: 'unconfigured' };\n`;
  }

  const { urlTemplate, method, envKey, authPrefix = 'Bearer', urlPathFields = [], bodyFields, extraHeaders = {} } = endpoint;
  const lines: string[] = [];

  // Resolve upstream variable name for content-field injection
  const incomingEdge = edges.find(e => e.target === node.id);
  const upstreamVar = incomingEdge ? names[incomingEdge.source] : null;

  // ── Special multi-step providers ──────────────────────────────────

  if (appProvider === 'instagram' && appAction === 'create_post') {
    if (python) {
      const imageUrl = liftTemplate(appInputs['imageUrl'] || '', names, lib);
      const caption = upstreamVar
        ? `ctx['${upstreamVar}']['payload']`
        : liftTemplate(appInputs['caption'] || '', names, lib);
      if (lib === 'httpx') {
        lines.push(`# Step 1: create media container`);
        lines.push(`with httpx.Client() as _${varName}_c:`);
        lines.push(`    ${varName}_container_r = _${varName}_c.post(`);
        lines.push(`        'https://graph.instagram.com/me/media',`);
        lines.push(`        params={'image_url': ${imageUrl}, 'caption': ${caption}, 'access_token': os.environ.get('${envKey}', '')}`);
        lines.push(`    )`);
        lines.push(`    ${varName}_container_r.raise_for_status()`);
        lines.push(`    ${varName}_container_id = ${varName}_container_r.json().get('id', '')`);
        lines.push(`    # Step 2: publish container`);
        lines.push(`    ${varName}_publish_r = _${varName}_c.post(`);
        lines.push(`        'https://graph.instagram.com/me/media_publish',`);
        lines.push(`        params={'creation_id': ${varName}_container_id, 'access_token': os.environ.get('${envKey}', '')}`);
        lines.push(`    )`);
        lines.push(`    ${varName}_publish_r.raise_for_status()`);
        lines.push(`    try:`);
        lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_publish_r.json()}`);
        lines.push(`    except Exception:`);
        lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_publish_r.text}`);
      } else if (lib === 'aiohttp') {
        lines.push(`# Step 1: create media container`);
        lines.push(`async with _session.post('https://graph.instagram.com/me/media', params={'image_url': ${imageUrl}, 'caption': ${caption}, 'access_token': os.environ.get('${envKey}', '')}) as ${varName}_container_r:`);
        lines.push(`    ${varName}_container_r.raise_for_status()`);
        lines.push(`    ${varName}_container_data = await ${varName}_container_r.json()`);
        lines.push(`    ${varName}_container_id = ${varName}_container_data.get('id', '')`);
        lines.push(`# Step 2: publish container`);
        lines.push(`async with _session.post('https://graph.instagram.com/me/media_publish', params={'creation_id': ${varName}_container_id, 'access_token': os.environ.get('${envKey}', '')}) as ${varName}_publish_r:`);
        lines.push(`    ${varName}_publish_r.raise_for_status()`);
        lines.push(`    try:`);
        lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': await ${varName}_publish_r.json()}`);
        lines.push(`    except Exception:`);
        lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': await ${varName}_publish_r.text()}`);
      } else {
        // requests
        lines.push(`# Step 1: create media container`);
        lines.push(`${varName}_container_r = requests.post(`);
        lines.push(`    'https://graph.instagram.com/me/media',`);
        lines.push(`    params={'image_url': ${imageUrl}, 'caption': ${caption}, 'access_token': os.environ.get('${envKey}', '')}`);
        lines.push(`)`);
        lines.push(`${varName}_container_r.raise_for_status()`);
        lines.push(`${varName}_container_id = ${varName}_container_r.json().get('id', '')`);
        lines.push(`# Step 2: publish container`);
        lines.push(`${varName}_publish_r = requests.post(`);
        lines.push(`    'https://graph.instagram.com/me/media_publish',`);
        lines.push(`    params={'creation_id': ${varName}_container_id, 'access_token': os.environ.get('${envKey}', '')}`);
        lines.push(`)`);
        lines.push(`${varName}_publish_r.raise_for_status()`);
        lines.push(`try:`);
        lines.push(`    ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_publish_r.json()}`);
        lines.push(`except Exception:`);
        lines.push(`    ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_publish_r.text}`);
      }
    } else {
      // JS/TS instagram
      const imageUrl = liftTemplate(appInputs['imageUrl'] || '', names, lib);
      const caption = upstreamVar
        ? `ctx['${upstreamVar}']?.payload`
        : liftTemplate(appInputs['caption'] || '', names, lib);
      const tok = `process.env.${envKey} ?? ''`;
      if (lib === 'axios') {
        lines.push(`// Step 1: create media container`);
        lines.push(`const ${varName}_containerR = await axios.post(\`https://graph.instagram.com/me/media?image_url=\${encodeURIComponent(${imageUrl})}&caption=\${encodeURIComponent(${caption})}&access_token=\${${tok}}\`);`);
        lines.push(`const ${varName}_containerId = ${varName}_containerR.data?.id ?? '';`);
        lines.push(`// Step 2: publish container`);
        lines.push(`const ${varName}_publishR = await axios.post(\`https://graph.instagram.com/me/media_publish?creation_id=\${${varName}_containerId}&access_token=\${${tok}}\`);`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_publishR.data };`);
      } else if (lib === 'got') {
        lines.push(`// Step 1: create media container`);
        lines.push(`const ${varName}_containerR = await got.post(\`https://graph.instagram.com/me/media?image_url=\${encodeURIComponent(${imageUrl})}&caption=\${encodeURIComponent(${caption})}&access_token=\${${tok}}\`, { responseType: 'json' });`);
        lines.push(`const ${varName}_containerId = ${varName}_containerR.body?.id ?? '';`);
        lines.push(`// Step 2: publish container`);
        lines.push(`const ${varName}_publishR = await got.post(\`https://graph.instagram.com/me/media_publish?creation_id=\${${varName}_containerId}&access_token=\${${tok}}\`, { responseType: 'json' });`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_publishR.body };`);
      } else {
        // fetch / node-fetch
        lines.push(`// Step 1: create media container`);
        lines.push(`const ${varName}_containerR = await fetch(\`https://graph.instagram.com/me/media?image_url=\${encodeURIComponent(${imageUrl})}&caption=\${encodeURIComponent(${caption})}&access_token=\${${tok}}\`, { method: 'POST' });`);
        lines.push(`if (!${varName}_containerR.ok) throw new Error(\`Instagram container error: \${${varName}_containerR.status}\`);`);
        lines.push(`const ${varName}_containerData = await ${varName}_containerR.json();`);
        lines.push(`const ${varName}_containerId = ${varName}_containerData?.id ?? '';`);
        lines.push(`// Step 2: publish container`);
        lines.push(`const ${varName}_publishR = await fetch(\`https://graph.instagram.com/me/media_publish?creation_id=\${${varName}_containerId}&access_token=\${${tok}}\`, { method: 'POST' });`);
        lines.push(`if (!${varName}_publishR.ok) throw new Error(\`Instagram publish error: \${${varName}_publishR.status}\`);`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: await ${varName}_publishR.json() };`);
      }
    }
    return lines.map(l => `${ind}${l}`).join('\n') + '\n';
  }

  if (appProvider === 'linkedin' && appAction === 'create_post') {
    const text = upstreamVar
      ? (python ? `ctx['${upstreamVar}']['payload']` : `ctx['${upstreamVar}']?.payload`)
      : liftTemplate(appInputs['text'] || '', names, lib);
    if (python) {
      const tok = `os.environ.get('${envKey}', '')`;
      const headers = `{'Authorization': f'Bearer {${tok}}', 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0'}`;
      if (lib === 'httpx') {
        lines.push(`# Step 1: get LinkedIn member ID`);
        lines.push(`with httpx.Client() as _${varName}_c:`);
        lines.push(`    ${varName}_me_r = _${varName}_c.get('https://api.linkedin.com/v2/me', headers=${headers})`);
        lines.push(`    ${varName}_me_r.raise_for_status()`);
        lines.push(`    ${varName}_me_id = ${varName}_me_r.json().get('id', '')`);
        lines.push(`    # Step 2: create post`);
        lines.push(`    ${varName}_body = {`);
        lines.push(`        'author': f'urn:li:person:{${varName}_me_id}',`);
        lines.push(`        'lifecycleState': 'PUBLISHED',`);
        lines.push(`        'specificContent': {'com.linkedin.ugc.ShareContent': {'shareCommentary': {'text': ${text}}, 'shareMediaCategory': 'NONE'}},`);
        lines.push(`        'visibility': {'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'},`);
        lines.push(`    }`);
        lines.push(`    ${varName}_r = _${varName}_c.post('https://api.linkedin.com/v2/ugcPosts', json=${varName}_body, headers=${headers})`);
        lines.push(`    ${varName}_r.raise_for_status()`);
        lines.push(`    try:`);
        lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_r.json()}`);
        lines.push(`    except Exception:`);
        lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_r.text}`);
      } else if (lib === 'aiohttp') {
        lines.push(`# Step 1: get LinkedIn member ID`);
        lines.push(`async with _session.get('https://api.linkedin.com/v2/me', headers=${headers}) as ${varName}_me_r:`);
        lines.push(`    ${varName}_me_r.raise_for_status()`);
        lines.push(`    ${varName}_me_data = await ${varName}_me_r.json()`);
        lines.push(`    ${varName}_me_id = ${varName}_me_data.get('id', '')`);
        lines.push(`# Step 2: create post`);
        lines.push(`${varName}_body = {`);
        lines.push(`    'author': f'urn:li:person:{${varName}_me_id}',`);
        lines.push(`    'lifecycleState': 'PUBLISHED',`);
        lines.push(`    'specificContent': {'com.linkedin.ugc.ShareContent': {'shareCommentary': {'text': ${text}}, 'shareMediaCategory': 'NONE'}},`);
        lines.push(`    'visibility': {'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'},`);
        lines.push(`}`);
        lines.push(`async with _session.post('https://api.linkedin.com/v2/ugcPosts', json=${varName}_body, headers=${headers}) as ${varName}_r:`);
        lines.push(`    ${varName}_r.raise_for_status()`);
        lines.push(`    try:`);
        lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': await ${varName}_r.json()}`);
        lines.push(`    except Exception:`);
        lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': await ${varName}_r.text()}`);
      } else {
        // requests
        lines.push(`# Step 1: get LinkedIn member ID`);
        lines.push(`${varName}_li_headers = ${headers}`);
        lines.push(`${varName}_me_r = requests.get('https://api.linkedin.com/v2/me', headers=${varName}_li_headers)`);
        lines.push(`${varName}_me_r.raise_for_status()`);
        lines.push(`${varName}_me_id = ${varName}_me_r.json().get('id', '')`);
        lines.push(`# Step 2: create post`);
        lines.push(`${varName}_body = {`);
        lines.push(`    'author': f'urn:li:person:{${varName}_me_id}',`);
        lines.push(`    'lifecycleState': 'PUBLISHED',`);
        lines.push(`    'specificContent': {'com.linkedin.ugc.ShareContent': {'shareCommentary': {'text': ${text}}, 'shareMediaCategory': 'NONE'}},`);
        lines.push(`    'visibility': {'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'},`);
        lines.push(`}`);
        lines.push(`${varName}_r = requests.post('https://api.linkedin.com/v2/ugcPosts', json=${varName}_body, headers=${varName}_li_headers)`);
        lines.push(`${varName}_r.raise_for_status()`);
        lines.push(`try:`);
        lines.push(`    ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_r.json()}`);
        lines.push(`except Exception:`);
        lines.push(`    ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_r.text}`);
      }
    } else {
      // JS/TS linkedin
      const tok = `process.env.${envKey} ?? ''`;
      const liHeaders = isTS
        ? `const ${varName}_liHeaders: Record<string, string> = { 'Authorization': \`Bearer \${${tok}}\`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' };`
        : `const ${varName}_liHeaders = { 'Authorization': \`Bearer \${${tok}}\`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' };`;
      lines.push(liHeaders);
      if (lib === 'axios') {
        lines.push(`// Step 1: get LinkedIn member ID`);
        lines.push(`const ${varName}_meR = await axios.get('https://api.linkedin.com/v2/me', { headers: ${varName}_liHeaders });`);
        lines.push(`const ${varName}_meId = ${varName}_meR.data?.id ?? '';`);
        lines.push(`// Step 2: create post`);
        lines.push(`const ${varName}_liBody = { author: \`urn:li:person:\${${varName}_meId}\`, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: ${text} }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } };`);
        lines.push(`const ${varName}_r = await axios.post('https://api.linkedin.com/v2/ugcPosts', ${varName}_liBody, { headers: ${varName}_liHeaders });`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_r.data };`);
      } else if (lib === 'got') {
        lines.push(`// Step 1: get LinkedIn member ID`);
        lines.push(`const ${varName}_meR = await got.get('https://api.linkedin.com/v2/me', { headers: ${varName}_liHeaders, responseType: 'json' });`);
        lines.push(`const ${varName}_meId = ${varName}_meR.body?.id ?? '';`);
        lines.push(`// Step 2: create post`);
        lines.push(`const ${varName}_liBody = { author: \`urn:li:person:\${${varName}_meId}\`, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: ${text} }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } };`);
        lines.push(`const ${varName}_r = await got.post('https://api.linkedin.com/v2/ugcPosts', { json: ${varName}_liBody, headers: ${varName}_liHeaders, responseType: 'json' });`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_r.body };`);
      } else {
        // fetch / node-fetch
        lines.push(`// Step 1: get LinkedIn member ID`);
        lines.push(`const ${varName}_meR = await fetch('https://api.linkedin.com/v2/me', { headers: ${varName}_liHeaders });`);
        lines.push(`if (!${varName}_meR.ok) throw new Error(\`LinkedIn /me error: \${${varName}_meR.status}\`);`);
        lines.push(`const ${varName}_meData = await ${varName}_meR.json();`);
        lines.push(`const ${varName}_meId = ${varName}_meData?.id ?? '';`);
        lines.push(`// Step 2: create post`);
        lines.push(`const ${varName}_liBody = { author: \`urn:li:person:\${${varName}_meId}\`, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: ${text} }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } };`);
        lines.push(`const ${varName}_r = await fetch('https://api.linkedin.com/v2/ugcPosts', { method: 'POST', headers: ${varName}_liHeaders, body: JSON.stringify(${varName}_liBody) });`);
        lines.push(`if (!${varName}_r.ok) throw new Error(\`LinkedIn post error: \${${varName}_r.status}\`);`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: await ${varName}_r.json() };`);
      }
    }
    return lines.map(l => `${ind}${l}`).join('\n') + '\n';
  }

  if (appProvider === 'medium' && appAction === 'create_post') {
    const title = liftTemplate(appInputs['title'] || '', names, lib);
    const content = upstreamVar
      ? (python ? `ctx['${upstreamVar}']['payload']` : `ctx['${upstreamVar}']?.payload`)
      : liftTemplate(appInputs['content'] || '', names, lib);
    const contentFormat = liftTemplate(appInputs['contentFormat'] || 'markdown', names, lib);
    if (python) {
      const tok = `os.environ.get('${envKey}', '')`;
      const headers = `{'Authorization': f'Bearer {${tok}}', 'Content-Type': 'application/json'}`;
      if (lib === 'httpx') {
        lines.push(`# Step 1: get Medium user ID`);
        lines.push(`with httpx.Client() as _${varName}_c:`);
        lines.push(`    ${varName}_me_r = _${varName}_c.get('https://api.medium.com/v1/me', headers=${headers})`);
        lines.push(`    ${varName}_me_r.raise_for_status()`);
        lines.push(`    ${varName}_user_id = ${varName}_me_r.json().get('data', {}).get('id', '')`);
        lines.push(`    # Step 2: create post`);
        lines.push(`    ${varName}_body = {'title': ${title}, 'contentFormat': ${contentFormat}, 'content': ${content}, 'publishStatus': 'draft'}`);
        lines.push(`    ${varName}_r = _${varName}_c.post(f'https://api.medium.com/v1/users/{${varName}_user_id}/posts', json=${varName}_body, headers=${headers})`);
        lines.push(`    ${varName}_r.raise_for_status()`);
        lines.push(`    try:`);
        lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_r.json()}`);
        lines.push(`    except Exception:`);
        lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_r.text}`);
      } else if (lib === 'aiohttp') {
        lines.push(`# Step 1: get Medium user ID`);
        lines.push(`async with _session.get('https://api.medium.com/v1/me', headers=${headers}) as ${varName}_me_r:`);
        lines.push(`    ${varName}_me_r.raise_for_status()`);
        lines.push(`    ${varName}_me_data = await ${varName}_me_r.json()`);
        lines.push(`    ${varName}_user_id = ${varName}_me_data.get('data', {}).get('id', '')`);
        lines.push(`# Step 2: create post`);
        lines.push(`${varName}_body = {'title': ${title}, 'contentFormat': ${contentFormat}, 'content': ${content}, 'publishStatus': 'draft'}`);
        lines.push(`async with _session.post(f'https://api.medium.com/v1/users/{${varName}_user_id}/posts', json=${varName}_body, headers=${headers}) as ${varName}_r:`);
        lines.push(`    ${varName}_r.raise_for_status()`);
        lines.push(`    try:`);
        lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': await ${varName}_r.json()}`);
        lines.push(`    except Exception:`);
        lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': await ${varName}_r.text()}`);
      } else {
        // requests
        lines.push(`# Step 1: get Medium user ID`);
        lines.push(`${varName}_med_headers = ${headers}`);
        lines.push(`${varName}_me_r = requests.get('https://api.medium.com/v1/me', headers=${varName}_med_headers)`);
        lines.push(`${varName}_me_r.raise_for_status()`);
        lines.push(`${varName}_user_id = ${varName}_me_r.json().get('data', {}).get('id', '')`);
        lines.push(`# Step 2: create post`);
        lines.push(`${varName}_body = {'title': ${title}, 'contentFormat': ${contentFormat}, 'content': ${content}, 'publishStatus': 'draft'}`);
        lines.push(`${varName}_r = requests.post(f'https://api.medium.com/v1/users/{${varName}_user_id}/posts', json=${varName}_body, headers=${varName}_med_headers)`);
        lines.push(`${varName}_r.raise_for_status()`);
        lines.push(`try:`);
        lines.push(`    ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_r.json()}`);
        lines.push(`except Exception:`);
        lines.push(`    ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_r.text}`);
      }
    } else {
      // JS/TS medium
      const tok = `process.env.${envKey} ?? ''`;
      const medHeaders = isTS
        ? `const ${varName}_medHeaders: Record<string, string> = { 'Authorization': \`Bearer \${${tok}}\`, 'Content-Type': 'application/json' };`
        : `const ${varName}_medHeaders = { 'Authorization': \`Bearer \${${tok}}\`, 'Content-Type': 'application/json' };`;
      lines.push(medHeaders);
      if (lib === 'axios') {
        lines.push(`// Step 1: get Medium user ID`);
        lines.push(`const ${varName}_meR = await axios.get('https://api.medium.com/v1/me', { headers: ${varName}_medHeaders });`);
        lines.push(`const ${varName}_userId = ${varName}_meR.data?.data?.id ?? '';`);
        lines.push(`// Step 2: create post`);
        lines.push(`const ${varName}_medBody = { title: ${title}, contentFormat: ${contentFormat}, content: ${content}, publishStatus: 'draft' };`);
        lines.push(`const ${varName}_r = await axios.post(\`https://api.medium.com/v1/users/\${${varName}_userId}/posts\`, ${varName}_medBody, { headers: ${varName}_medHeaders });`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_r.data };`);
      } else if (lib === 'got') {
        lines.push(`// Step 1: get Medium user ID`);
        lines.push(`const ${varName}_meR = await got.get('https://api.medium.com/v1/me', { headers: ${varName}_medHeaders, responseType: 'json' });`);
        lines.push(`const ${varName}_userId = ${varName}_meR.body?.data?.id ?? '';`);
        lines.push(`// Step 2: create post`);
        lines.push(`const ${varName}_medBody = { title: ${title}, contentFormat: ${contentFormat}, content: ${content}, publishStatus: 'draft' };`);
        lines.push(`const ${varName}_r = await got.post(\`https://api.medium.com/v1/users/\${${varName}_userId}/posts\`, { json: ${varName}_medBody, headers: ${varName}_medHeaders, responseType: 'json' });`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_r.body };`);
      } else {
        // fetch / node-fetch
        lines.push(`// Step 1: get Medium user ID`);
        lines.push(`const ${varName}_meR = await fetch('https://api.medium.com/v1/me', { headers: ${varName}_medHeaders });`);
        lines.push(`if (!${varName}_meR.ok) throw new Error(\`Medium /me error: \${${varName}_meR.status}\`);`);
        lines.push(`const ${varName}_meData = await ${varName}_meR.json();`);
        lines.push(`const ${varName}_userId = ${varName}_meData?.data?.id ?? '';`);
        lines.push(`// Step 2: create post`);
        lines.push(`const ${varName}_medBody = { title: ${title}, contentFormat: ${contentFormat}, content: ${content}, publishStatus: 'draft' };`);
        lines.push(`const ${varName}_r = await fetch(\`https://api.medium.com/v1/users/\${${varName}_userId}/posts\`, { method: 'POST', headers: ${varName}_medHeaders, body: JSON.stringify(${varName}_medBody) });`);
        lines.push(`if (!${varName}_r.ok) throw new Error(\`Medium post error: \${${varName}_r.status}\`);`);
        lines.push(`ctx['${varName}'] = { type: 'data', payload: await ${varName}_r.json() };`);
      }
    }
    return lines.map(l => `${ind}${l}`).join('\n') + '\n';
  }

  // ── Standard single-step providers ────────────────────────────────

  // Resolve URL path params by substituting {UPPER_SNAKE} placeholders
  let urlStr = urlTemplate;
  for (const field of urlPathFields) {
    const placeholder = field.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    const raw = (appInputs[field] || '').trim();
    if (python) {
      if (raw.includes('{{')) {
        // Template ref: lift and extract just the inner f-string body (strip f""" / """ wrappers)
        const lifted = liftTemplate(raw, names, lib);
        let inner: string;
        if (lifted.startsWith('f"""')) inner = lifted.slice(4, -3);
        else if (lifted.startsWith('f"')) inner = lifted.slice(2, -1);
        else if (lifted.startsWith('"""')) inner = lifted.slice(3, -3);
        else inner = lifted.slice(1, -1);
        urlStr = urlStr.replace(`{${placeholder}}`, inner || placeholder);
      } else {
        // Literal value: embed directly so no f-string expression wrapper is needed
        urlStr = urlStr.replace(`{${placeholder}}`, raw || placeholder);
      }
    } else {
      // JS/TS: wrap non-literal values in ${...}; literals evaluate fine in template literals too
      const lifted = liftTemplate(raw, names, lib);
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
        const content = upstreamVar
          ? `ctx['${upstreamVar}']['payload']`
          : liftTemplate(appInputs['content'] || '', names, lib);
        lines.push(`${varName}_body = {`);
        lines.push(`    'parent': {'database_id': ${dbId}},`);
        lines.push(`    'properties': {'title': {'title': [{'text': {'content': ${title}}}]}},`);
        lines.push(`    'children': [{'object': 'block', 'type': 'paragraph', 'paragraph': {'rich_text': [{'text': {'content': ${content}}}]}}],`);
        lines.push(`}`);
      } else {
        lines.push(`${varName}_body = {`);
        for (const f of bodyFields) {
          const val = (upstreamVar && CONTENT_FIELD_KEYS.has(f))
            ? `ctx['${upstreamVar}']['payload']`
            : liftTemplate(appInputs[f] || '', names, lib);
          lines.push(`    '${f}': ${val},`);
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
        const content = upstreamVar
          ? `ctx['${upstreamVar}']?.payload`
          : liftTemplate(appInputs['content'] || '', names, lib);
        lines.push(`const ${varName}_body = {`);
        lines.push(`  parent: { database_id: ${dbId} },`);
        lines.push(`  properties: { title: { title: [{ text: { content: ${title} } }] } },`);
        lines.push(`  children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: ${content} } }] } }],`);
        lines.push(`};`);
      } else {
        lines.push(`const ${varName}_body = {`);
        for (const f of bodyFields) {
          const val = (upstreamVar && CONTENT_FIELD_KEYS.has(f))
            ? `ctx['${upstreamVar}']?.payload`
            : liftTemplate(appInputs[f] || '', names, lib);
          lines.push(`  ${f}: ${val},`);
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
      lines.push(`const ${varName}_r = await got.${M.toLowerCase()}(${urlExpr}, {`);
      lines.push(`  headers: ${varName}_headers,`);
      lines.push(`  responseType: 'json',`);
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

  // Bake the Input node's configured text as the default input value
  const _inputNode = nodes.find(n => n.type === 'input');
  const _inputPayload = (_inputNode?.data?.packet?.payload ?? '') as string;
  const defaultInputLiteral = JSON.stringify(_inputPayload.trim() || 'Run agent');

  // Install comment at very top
  let code = genInstallComment(lib, meta.llmProviders, hasSchedule, meta.hasBrowserAction);

  // File header
  const llmKeyHint = meta.llmProviders.size
    ? 'GROQ_API_KEY or OPENAI_API_KEY or ANTHROPIC_API_KEY or GEMINI_API_KEY (first found wins)'
    : null;
  const envKeysList = [...(llmKeyHint ? [llmKeyHint] : []), ...meta.envKeys].join(', ');
  code += `/**\n * AgentForge — Compiled Flow (${language}${lib !== 'fetch' ? ` / ${lib}` : ''})\n`;
  code += ` * Run: ${isTS ? `npx ts-node agent.${fileExt}` : `node agent.${fileExt}`}\n`;
  if (envKeysList) {
    code += ` *\n * Required ENV variables: ${envKeysList}\n`;
    code += ` * Create a .env file or export them before running.\n`;
  }
  code += ` */\n\n`;

  // HTTP library import (no top-level LLM imports — universal helper uses dynamic import)
  const httpImports = genImports(lib, hasSchedule);
  if (httpImports) code += httpImports;

  // Helper functions (_s, _get, vaultLookup) + universal LLM helper (if AI nodes present)
  code += '\n' + genHelperCode(lib, isTS);
  if (meta.llmProviders.size) code += genUniversalLLMHelper(lib, isTS);

  // TypeScript context interface
  if (isTS) {
    code += `interface FlowContext {\n  input: { type: string; payload: any };\n  [key: string]: { type: string; payload: any };\n}\n\n`;
  }

  // Function declaration
  const fnDecl = isTS
    ? `async function runAgent(initialInput: string = ${defaultInputLiteral}): Promise<FlowContext> {`
    : `async function runAgent(initialInput = ${defaultInputLiteral}) {`;

  code += fnDecl + '\n';
  code += isTS
    ? `  const ctx: FlowContext = { input: { type: 'text', payload: initialInput } };\n\n`
    : `  const ctx = { input: { type: 'text', payload: initialInput } };\n\n`;

  for (const node of nodes) {
    const varName = names[node.id];
    const resolvedLabel = node.type || varName;
    code += `  // ── [${node.type}] ${resolvedLabel}\n`;

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
          code += `  // WARNING: No endpoint URL configured for "${resolvedLabel}"\n`;
          code += `  ctx['${varName}'] = { type: 'data', payload: null };\n`;
        } else {
          code += genHttpBlock(lib, { method, url, extraHeaders, authType, authValue, body: bodyExpr, varName, ind: '  ' });
        }
        break;
      }

      case 'appaction':
      case 'app_action': {
        const _provId = (node.data.appProvider || 'app').toLowerCase();
        const _prov = APP_DISPLAY_NAMES[_provId] ?? _provId;
        const _act = (node.data.appAction || 'action').replace(/_/g, ' ');
        const _appReal = genAppActionBlock(node, varName, names, lib, '    ', isTS, edges);
        code += `  if (process.env.AGENTFORGE_MODE === 'PREVIEW') {\n`;
        code += `    console.log('\\n╯══ DRAFT PAYLOAD ═══════════════════════════════════');\n`;
        code += `    console.log('║  App     : ${_prov} → ${_act}');\n`;
        code += `    console.log('╚═══════════════════════════════════════════════\\n');\n`;
        code += `    ctx['${varName}'] = { type: 'data', payload: {} };\n`;
        code += `  } else {\n`;
        code += _appReal;
        code += `  }\n`;
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
          code += `  // Gatekeeper: auto-approved in exported code. Wire ${varName}_review to your LLM to enforce.\n`;
          code += `  const ${varName}_verdict = 'APPROVED';\n`;
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
          const jsCond = buildRouterCond(conditions[route] || '', `${varName}_input`, 'js');
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
        code += `  ctx['${varName}'] = { type: 'text', payload: await vaultLookup(${varName}_query) };\n`;
        break;
      }

      default: {
        code += `  // NOTE: node type '${node.type}' has no compiled handler — skipped\n`;
        code += `  ctx['${varName}'] = { type: 'text', payload: '' };\n`;
        break;
      }
    }
    code += '\n';
  }

  code += `  return ctx;\n}\n\n`;

  if (hasSchedule && triggerNode) {
    code += `// ── Run\n`;
    code += `if (process.env.AGENTFORGE_MODE === 'PREVIEW') {\n`;
    code += `  // Preview: run once immediately instead of scheduling\n`;
    code += `  runAgent('Scheduled Run')\n`;
    code += `    .then(ctx => console.log(JSON.stringify(ctx, null, 2)))\n`;
    code += `    .catch(console.error);\n`;
    code += `} else {\n`;
    code += buildCronBlock(triggerNode, 'js').split('\n').map(l => l.trim() ? '  ' + l : l).join('\n');
    code += `}\n`;
  } else {
    code += `// ── Run\nrunAgent(process.env.AGENTFORGE_INPUT || ${defaultInputLiteral})\n  .then(ctx => console.log(JSON.stringify(ctx, null, 2)))\n  .catch(console.error);\n`;
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
  const meta = collectFlowMeta(nodes);
  const isAsync = lib === 'aiohttp' || meta.hasBrowserAction;

  // Bake the Input node's configured text as the default input value
  const _inputNode = nodes.find(n => n.type === 'input');
  const _inputPayload = (_inputNode?.data?.packet?.payload ?? '') as string;
  const defaultInputLiteral = JSON.stringify(_inputPayload.trim() || 'Run agent');

  // Install comment at very top
  let code = genInstallComment(lib, meta.llmProviders, hasSchedule, meta.hasBrowserAction);

  // File header
  const llmKeyHint = meta.llmProviders.size
    ? 'GROQ_API_KEY or OPENAI_API_KEY or ANTHROPIC_API_KEY or GEMINI_API_KEY (first found wins)'
    : null;
  code += `# AgentForge — Compiled Flow (Python / ${lib})\n# Run: python agent.py\n`;
  if (meta.envKeys.size || llmKeyHint) {
    const envList = [...(llmKeyHint ? [llmKeyHint] : []), ...meta.envKeys].join(', ');
    code += `#\n# Required ENV variables: ${envList}\n`;
    code += `# Create a .env file and load with python-dotenv, or export them in your shell.\n`;
  }
  code += `\n`;

  // Imports (no top-level LLM imports — universal helper lazy-imports them)
  code += genImports(lib, hasSchedule);
  if (meta.hasBrowserAction && !isAsync) {
    // This case shouldn't happen now since we force isAsync, but just in case
  }
  if (isAsync && lib !== 'aiohttp') {
     code += `import asyncio\n`;
  }
  code += '\n\n';

  // Helper functions (_s, _get, vault_lookup) + universal LLM helper (if AI nodes present)
  code += genHelperCode(lib);
  if (meta.llmProviders.size) code += genUniversalLLMHelper(lib) + '\n';
  else code += '\n';

  const ind = '    '; // 4-space indent inside function
  const defLine = isAsync
    ? `async def run_agent(initial_input: str = ${defaultInputLiteral}) -> dict:`
    : `def run_agent(initial_input: str = ${defaultInputLiteral}) -> dict:`;
  code += defLine + '\n';
  code += `${ind}ctx = {'input': {'type': 'text', 'payload': initial_input}}\n\n`;

  // Only aiohttp needs a shared session wrapper; browser-action flows use requests/httpx directly
  const aiohttpSession = lib === 'aiohttp' && nodes.some(
    n => (n.type === 'action' && n.data.url?.trim()) || n.type === 'app_action' || n.type === 'appaction'
  );
  if (aiohttpSession) code += `${ind}async with aiohttp.ClientSession() as _session:\n`;
  const nodeInd = aiohttpSession ? ind + '    ' : ind;

  for (const node of nodes) {
    const varName = names[node.id];
    const resolvedLabel = node.type || varName;
    code += `${nodeInd}# ── [${node.type}] ${resolvedLabel}\n`;

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
          code += `${nodeInd}# WARNING: No endpoint URL configured for "${resolvedLabel}"\n`;
          code += `${nodeInd}ctx['${varName}'] = {'type': 'data', 'payload': None}\n`;
        } else {
          code += genHttpBlock(lib, { method, url, extraHeaders, authType, authValue, body: bodyExpr, varName, ind: nodeInd });
        }
        break;
      }

      case 'appaction':
      case 'app_action': {
        const _provId2 = (node.data.appProvider || 'app').toLowerCase();
        const _prov2 = APP_DISPLAY_NAMES[_provId2] ?? _provId2;
        const _act2 = (node.data.appAction || 'action').replace(/_/g, ' ');
        const _appReal2 = genAppActionBlock(node, varName, names, lib, nodeInd + '    ', false, edges);
        code += `${nodeInd}if os.environ.get('AGENTFORGE_MODE') == 'PREVIEW':\n`;
        code += `${nodeInd}    print('\\n╯══ DRAFT PAYLOAD ═══════════════════════════════════')\n`;
        code += `${nodeInd}    print('║  App     : ${_prov2} → ${_act2}')\n`;
        code += `${nodeInd}    print('╚═══════════════════════════════════════════════\\n')\n`;
        code += `${nodeInd}    ctx['${varName}'] = {'type': 'data', 'payload': {}}\n`;
        code += `${nodeInd}else:\n`;
        code += _appReal2;
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
          const pyCond = buildRouterCond(conditions[route] || '', `${varName}_input`, 'py');
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
        code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': vault_lookup(${varName}_query)}\n`;
        break;
      }

      default: {
        code += `${nodeInd}# NOTE: node type '${node.type}' has no compiled handler — skipped\n`;
        code += `${nodeInd}ctx['${varName}'] = {'type': 'text', 'payload': ''}\n`;
        break;
      }
    }
    code += '\n';
  }

  code += `${ind}return ctx\n\n`;

  code += `if __name__ == "__main__":\n`;
  if (hasSchedule && triggerNode) {
    // In PREVIEW mode: run once immediately. In production: start the cron loop.
    if (isAsync) {
      code += `    if os.environ.get('AGENTFORGE_MODE') == 'PREVIEW':\n`;
      code += `        import threading as _threading\n`;
      code += `        _result_box: dict = {}\n`;
      code += `        def _run_sched_thread():\n`;
      code += `            import asyncio as _asyncio\n`;
      code += `            _loop = _asyncio.new_event_loop()\n`;
      code += `            _asyncio.set_event_loop(_loop)\n`;
      code += `            try:\n`;
      code += `                _result_box['v'] = _loop.run_until_complete(run_agent('Scheduled Run'))\n`;
      code += `            finally:\n`;
      code += `                _loop.close()\n`;
      code += `        _t = _threading.Thread(target=_run_sched_thread, daemon=True)\n`;
      code += `        _t.start()\n`;
      code += `        _t.join(timeout=55)\n`;
      code += `        print(json.dumps(_result_box.get('v', {}), indent=2, default=str))\n`;
      code += `    else:\n`;
      // indent buildCronBlock output (already 4-space) by 4 more for the else block
      code += buildCronBlock(triggerNode, 'python', isAsync).split('\n').map(l => l.trim() ? '    ' + l : l).join('\n');
    } else {
      code += `    if os.environ.get('AGENTFORGE_MODE') == 'PREVIEW':\n`;
      code += `        result = run_agent('Scheduled Run')\n`;
      code += `        print(json.dumps(result, indent=2, default=str))\n`;
      code += `    else:\n`;
      code += buildCronBlock(triggerNode, 'python', isAsync).split('\n').map(l => l.trim() ? '    ' + l : l).join('\n');
    }
  } else if (isAsync) {
    // Run async agent in a dedicated thread with its own event loop.
    // This works both locally and inside E2B / Jupyter kernels that already
    // have a running event loop (where asyncio.run() would raise RuntimeError).
    code += `    _initial = os.environ.get('AGENTFORGE_INPUT') or ${defaultInputLiteral}\n`;
    code += `    import threading as _threading\n`;
    code += `    _result_box: dict = {}\n`;
    code += `    def _run_agent_thread():\n`;
    code += `        import asyncio as _asyncio\n`;
    code += `        _loop = _asyncio.new_event_loop()\n`;
    code += `        _asyncio.set_event_loop(_loop)\n`;
    code += `        try:\n`;
    code += `            _result_box['v'] = _loop.run_until_complete(run_agent(_initial))\n`;
    code += `        finally:\n`;
    code += `            _loop.close()\n`;
    code += `    _t = _threading.Thread(target=_run_agent_thread, daemon=True)\n`;
    code += `    _t.start()\n`;
    code += `    _t.join(timeout=55)\n`;
    code += `    result = _result_box.get('v', {})\n`;
    code += `    print(json.dumps(result, indent=2, default=str))\n`;
  } else {
    code += `    result = run_agent(os.environ.get('AGENTFORGE_INPUT') or ${defaultInputLiteral})\n`;
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
  isAsync = false,
): string {
  const cronSetting = triggerNode.data.cron || 'Every Minute';
  const timeStr = triggerNode.data.time || '09:00';
  const days = triggerNode.data.days || ['Mon'];

  const intervalSeconds = Number(triggerNode.data.intervalSeconds) || 5;
  const intervalMinutes = Number(triggerNode.data.intervalMinutes) || 5;
  const monthDay = Number(triggerNode.data.monthDay) || 1;
  const cronExpression = (triggerNode.data.cronExpression as string | undefined)?.trim() || '* * * * *';

  if (lang === 'js') {
    // node-cron doesn't support sub-minute; use setInterval for seconds-based schedules.
    if (cronSetting === 'Every N Seconds') {
      return `// ── Scheduled Execution (every ${intervalSeconds}s)\nsetInterval(() => {\n  runAgent().catch(console.error);\n}, ${intervalSeconds * 1000});\n`;
    }
    let expr = '* * * * *';
    if (cronSetting === 'Every N Minutes') expr = `*/${intervalMinutes} * * * *`;
    else if (cronSetting === 'Hourly') {
      const minuteOffset = Number(triggerNode.data.minuteOffset ?? 0);
      expr = `${minuteOffset} * * * *`;
    }
    else if (cronSetting === 'Daily') {
      const [h, m] = timeStr.split(':');
      expr = `${parseInt(m || '0')} ${parseInt(h || '9')} * * *`;
    } else if (cronSetting === 'Weekly') {
      const [h, m] = timeStr.split(':');
      const dayMap: Record<string, string> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
      expr = `${parseInt(m || '0')} ${parseInt(h || '9')} * * ${days.map(d => dayMap[d]).filter(Boolean).join(',') || '1'}`;
    } else if (cronSetting === 'Monthly') {
      const [h, m] = timeStr.split(':');
      expr = `${parseInt(m || '0')} ${parseInt(h || '9')} ${monthDay} * *`;
    } else if (cronSetting === 'Custom') {
      expr = cronExpression;
    }
    return `// ── Scheduled Execution\ncron.schedule('${expr}', () => {\n  runAgent().catch(console.error);\n});\n`;
  }

  const runCmd = isAsync ? 'asyncio.run(run_agent("Scheduled Run"))' : 'run_agent("Scheduled Run")';
  let lines = `    def job():\n        ${runCmd}\n\n`;
  if (cronSetting === 'Every N Seconds') lines += `    schedule.every(${intervalSeconds}).seconds.do(job)\n`;
  else if (cronSetting === 'Every Minute') lines += `    schedule.every(1).minutes.do(job)\n`;
  else if (cronSetting === 'Every N Minutes') lines += `    schedule.every(${intervalMinutes}).minutes.do(job)\n`;
  else if (cronSetting === 'Hourly') {
    const minuteOffset = Number(triggerNode.data.minuteOffset ?? 0);
    lines += minuteOffset > 0
      ? `    schedule.every(1).hours.at(":${String(minuteOffset).padStart(2, '0')}").do(job)\n`
      : `    schedule.every(1).hours.do(job)\n`;
  }
  else if (cronSetting === 'Daily') lines += `    schedule.every().day.at("${timeStr}").do(job)\n`;
  else if (cronSetting === 'Weekly') {
    const dayMap: Record<string, string> = { Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday', Fri: 'friday', Sat: 'saturday', Sun: 'sunday' };
    days.forEach(d => { lines += `    schedule.every().${dayMap[d] || 'monday'}.at("${timeStr}").do(job)\n`; });
  } else if (cronSetting === 'Monthly') {
    // Python `schedule` has no native monthly; approximate with 30 days.
    lines += `    # Monthly on day ${monthDay} at ${timeStr} — approximated as every 30 days\n`;
    lines += `    schedule.every(30).days.at("${timeStr}").do(job)\n`;
  } else if (cronSetting === 'Custom') {
    lines += `    # Custom cron: ${cronExpression} — not natively supported by 'schedule'; replace with a cron daemon or APScheduler\n`;
    lines += `    schedule.every(1).minutes.do(job)  # fallback: every minute\n`;
  } else {
    lines += `    schedule.every(1).minutes.do(job)\n`;
  }
  lines += `\n    while True:\n        schedule.run_pending()\n        time.sleep(1)\n`;
  return lines;
}
