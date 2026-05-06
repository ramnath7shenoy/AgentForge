// AgentForge Polyglot Code Generation Templates
// Library-specific boilerplate for the Publish / Export engine.

export type Library =
  | 'fetch'      // TS/JS  — built-in Fetch API
  | 'axios'      // TS/JS  — axios npm package
  | 'got'        // TS     — got npm package
  | 'node-fetch' // JS     — node-fetch npm package
  | 'requests'   // Python — requests pip package
  | 'httpx'      // Python — httpx pip package
  | 'aiohttp';   // Python — aiohttp pip package (async)

export type Language = 'typescript' | 'javascript' | 'python';

export type LLMProvider = 'groq' | 'openai' | 'gemini' | 'anthropic';

export interface LibraryMeta {
  id: Library;
  label: string;
  language: Language;
  isAsync: boolean;
  installCmd: string;
  description: string;
}

export const LIBRARIES: LibraryMeta[] = [
  {
    id: 'fetch',
    label: 'Fetch API',
    language: 'typescript',
    isAsync: true,
    installCmd: 'built-in (Node 18+)',
    description: 'Native browser / Node HTTP — zero dependencies',
  },
  {
    id: 'axios',
    label: 'Axios',
    language: 'typescript',
    isAsync: true,
    installCmd: 'npm install axios',
    description: 'Promise-based client with interceptors & auto-JSON',
  },
  {
    id: 'got',
    label: 'Got',
    language: 'typescript',
    isAsync: true,
    installCmd: 'npm install got',
    description: 'Human-friendly, powerful HTTP for Node.js',
  },
  {
    id: 'node-fetch',
    label: 'node-fetch',
    language: 'javascript',
    isAsync: true,
    installCmd: 'npm install node-fetch',
    description: 'Lightweight fetch implementation for Node.js',
  },
  {
    id: 'requests',
    label: 'Requests',
    language: 'python',
    isAsync: false,
    installCmd: 'pip install requests',
    description: 'Simple, elegant HTTP — the Python standard',
  },
  {
    id: 'httpx',
    label: 'HTTPX',
    language: 'python',
    isAsync: false,
    installCmd: 'pip install httpx',
    description: 'Requests-compatible with HTTP/2 support',
  },
  {
    id: 'aiohttp',
    label: 'Aiohttp',
    language: 'python',
    isAsync: true,
    installCmd: 'pip install aiohttp',
    description: 'Fully async HTTP with asyncio integration',
  },
];

export function getLibraryMeta(lib: Library): LibraryMeta {
  return LIBRARIES.find(l => l.id === lib)!;
}

export function getLibrariesForTab(tab: 'python' | 'javascript' | 'typescript'): LibraryMeta[] {
  if (tab === 'python') return LIBRARIES.filter(l => l.language === 'python');
  if (tab === 'javascript') return LIBRARIES.filter(l => ['fetch', 'got', 'axios'].includes(l.id));
  // typescript: fetch, axios, node-fetch
  return LIBRARIES.filter(l => ['fetch', 'axios', 'node-fetch'].includes(l.id));
}

export function getDefaultLibrary(tab: 'python' | 'javascript' | 'typescript'): Library {
  return getLibrariesForTab(tab)[0].id;
}

export function isPythonLib(lib: Library): boolean {
  return lib === 'requests' || lib === 'httpx' || lib === 'aiohttp';
}

// ─────────────────────────────────────────────────────────────────────
// LLM Provider Detection & Code Generation
// ─────────────────────────────────────────────────────────────────────

export function detectLLMProvider(provider?: string, modelName?: string): LLMProvider {
  if (provider && provider !== 'auto') return provider as LLMProvider;
  const m = (modelName || '').toLowerCase();
  if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma') || m.includes('groq')) return 'groq';
  if (m.includes('gemini')) return 'gemini';
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('gpt') || m.includes('o1') || m.includes('o3')) return 'openai';
  return 'groq';
}

const LLM_ENV_KEYS: Record<LLMProvider, string> = {
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

const LLM_DEFAULT_MODELS: Record<LLMProvider, string> = {
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-flash',
  anthropic: 'claude-3-5-sonnet-20241022',
};

export function getLLMEnvKey(provider: LLMProvider): string {
  return LLM_ENV_KEYS[provider];
}

export function genLLMImports(lib: Library, provider: LLMProvider): string {
  if (isPythonLib(lib)) {
    switch (provider) {
      case 'groq': return 'from groq import Groq\n';
      case 'openai': return 'from openai import OpenAI\n';
      case 'gemini': return 'import google.generativeai as genai\n';
      case 'anthropic': return 'import anthropic\n';
    }
  } else {
    switch (provider) {
      case 'groq': return "import Groq from 'groq-sdk';\n";
      case 'openai': return "import OpenAI from 'openai';\n";
      case 'gemini': return "import { GoogleGenerativeAI } from '@google/generative-ai';\n";
      case 'anthropic': return "import Anthropic from '@anthropic-ai/sdk';\n";
    }
  }
}

export function genLLMBlock(
  lib: Library,
  provider: LLMProvider,
  modelName: string,
  varName: string,
  promptExpr: string,
  ind: string,
): string {
  const envKey = LLM_ENV_KEYS[provider];
  const model = modelName || LLM_DEFAULT_MODELS[provider];
  const lines: string[] = [];

  if (isPythonLib(lib)) {
    switch (provider) {
      case 'groq':
        lines.push(`_groq = Groq(api_key=os.environ.get('${envKey}', ''))`);
        lines.push(`_groq_resp = _groq.chat.completions.create(`);
        lines.push(`    model="${model}",`);
        lines.push(`    messages=[{"role": "user", "content": ${varName}_prompt}]`);
        lines.push(`)`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _groq_resp.choices[0].message.content}`);
        break;
      case 'openai':
        lines.push(`_openai = OpenAI(api_key=os.environ.get('${envKey}', ''))`);
        lines.push(`_openai_resp = _openai.chat.completions.create(`);
        lines.push(`    model="${model}",`);
        lines.push(`    messages=[{"role": "user", "content": ${varName}_prompt}]`);
        lines.push(`)`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _openai_resp.choices[0].message.content}`);
        break;
      case 'gemini':
        lines.push(`genai.configure(api_key=os.environ.get('${envKey}', ''))`);
        lines.push(`_gemini = genai.GenerativeModel("${model}")`);
        lines.push(`_gemini_resp = _gemini.generate_content(${varName}_prompt)`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _gemini_resp.text}`);
        break;
      case 'anthropic':
        lines.push(`_anthropic = anthropic.Anthropic(api_key=os.environ.get('${envKey}', ''))`);
        lines.push(`_anthropic_resp = _anthropic.messages.create(`);
        lines.push(`    model="${model}",`);
        lines.push(`    max_tokens=1024,`);
        lines.push(`    messages=[{"role": "user", "content": ${varName}_prompt}]`);
        lines.push(`)`);
        lines.push(`ctx['${varName}'] = {'type': 'text', 'payload': _anthropic_resp.content[0].text}`);
        break;
    }
  } else {
    switch (provider) {
      case 'groq':
        lines.push(`const _groq = new Groq({ apiKey: process.env.${envKey} });`);
        lines.push(`const _groqResp = await _groq.chat.completions.create({`);
        lines.push(`  model: '${model}',`);
        lines.push(`  messages: [{ role: 'user', content: ${varName}_prompt }],`);
        lines.push(`});`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _groqResp.choices[0].message.content ?? '' };`);
        break;
      case 'openai':
        lines.push(`const _openai = new OpenAI({ apiKey: process.env.${envKey} });`);
        lines.push(`const _openaiResp = await _openai.chat.completions.create({`);
        lines.push(`  model: '${model}',`);
        lines.push(`  messages: [{ role: 'user', content: ${varName}_prompt }],`);
        lines.push(`});`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _openaiResp.choices[0].message.content ?? '' };`);
        break;
      case 'gemini':
        lines.push(`const _genAI = new GoogleGenerativeAI(process.env.${envKey} ?? '');`);
        lines.push(`const _gemini = _genAI.getGenerativeModel({ model: '${model}' });`);
        lines.push(`const _geminiResp = await _gemini.generateContent(${varName}_prompt);`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: _geminiResp.response.text() };`);
        break;
      case 'anthropic':
        lines.push(`const _anthropic = new Anthropic({ apiKey: process.env.${envKey} });`);
        lines.push(`const _anthropicResp = await _anthropic.messages.create({`);
        lines.push(`  model: '${model}',`);
        lines.push(`  max_tokens: 1024,`);
        lines.push(`  messages: [{ role: 'user', content: ${varName}_prompt }],`);
        lines.push(`});`);
        lines.push(`ctx['${varName}'] = { type: 'text', payload: (_anthropicResp.content[0] as any).text ?? '' };`);
        break;
    }
  }

  return lines.map(l => `${ind}${l}`).join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// App Action (Universal Connector) — ENV key registry
// ─────────────────────────────────────────────────────────────────────
export const APP_PROVIDER_ENV_KEYS: Record<string, string> = {
  x: 'X_BEARER_TOKEN',
  slack: 'SLACK_TOKEN',
  discord: 'DISCORD_BOT_TOKEN',
  github: 'GITHUB_TOKEN',
  notion: 'NOTION_TOKEN',
  instagram: 'INSTAGRAM_ACCESS_TOKEN',
  linkedin: 'LINKEDIN_ACCESS_TOKEN',
  medium: 'MEDIUM_INTEGRATION_TOKEN',
};

// ─────────────────────────────────────────────────────────────────────
// Approval gate — CLI pause
// ─────────────────────────────────────────────────────────────────────
export function genApprovalPause(lib: Library, label: string, varName: string, ind: string): string {
  const msg = (label || 'Approval Gate').replace(/'/g, "\\'").replace(/"/g, '\\"');
  if (isPythonLib(lib)) {
    return [
      `${ind}input("\\n⏸  ${msg} — Press Enter to approve and continue...")`,
      `${ind}ctx['${varName}'] = {'type': 'text', 'payload': 'approved'}`,
    ].join('\n') + '\n';
  }
  return [
    `${ind}await new Promise<void>(resolve => {`,
    `${ind}  const rl = (require('readline') as any).createInterface({ input: process.stdin, output: process.stdout });`,
    `${ind}  rl.question('\\n⏸  ${msg} — Press Enter to approve and continue... ', () => { rl.close(); resolve(); });`,
    `${ind}});`,
    `${ind}ctx['${varName}'] = { type: 'text', payload: 'approved' };`,
  ].join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────
// Import statements
// ─────────────────────────────────────────────────────────────────────
export function genImports(lib: Library, hasSchedule: boolean): string {
  switch (lib) {
    case 'fetch':
      return hasSchedule ? `import * as cron from 'node-cron';\n` : '';
    case 'node-fetch':
      return `import fetch from 'node-fetch';\n` +
        (hasSchedule ? `import * as cron from 'node-cron';\n` : '');
    case 'axios':
      return `import axios from 'axios';\n` +
        (hasSchedule ? `import * as cron from 'node-cron';\n` : '');
    case 'got':
      return `import got from 'got';\n` +
        (hasSchedule ? `import * as cron from 'node-cron';\n` : '');
    case 'requests':
      return `import json\nimport os\nimport requests\n` +
        (hasSchedule ? `import schedule\nimport time\n` : '');
    case 'httpx':
      return `import json\nimport os\nimport httpx\n` +
        (hasSchedule ? `import schedule\nimport time\n` : '');
    case 'aiohttp':
      return `import json\nimport os\nimport asyncio\nimport aiohttp\n`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Template variable lifter
// Converts {{node-id}} / {{node-id.output}} into runtime code expressions.
// Uses _get() helper for safe field access.
// ─────────────────────────────────────────────────────────────────────
export function liftTemplate(
  template: string,
  semanticNames: Record<string, string>,
  lib: Library
): string {
  const python = isPythonLib(lib);
  const lifted = template.replace(/\{\{([^}]+)\}\}/g, (_, ref) => {
    const parts = ref.trim().split('.');
    const key = parts[0];
    const prop = parts[1] === 'output' ? 'payload' : (parts[1] ?? 'payload');
    const varName = semanticNames[key] ?? key.replace(/-/g, '_');
    return python
      ? `{_get(ctx.get('${varName}'), '${prop}')}`
      : `\${_get(ctx['${varName}'], '${prop}')}`;
  });

  if (python) {
    const needsF = lifted.includes('{');
    const escaped = lifted.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return needsF ? `f"${escaped}"` : `"${escaped}"`;
  } else {
    const needsTick = lifted.includes('${');
    const escaped = needsTick
      ? lifted.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
      : lifted.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return needsTick ? `\`${escaped}\`` : `"${escaped}"`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Header serializers
// ─────────────────────────────────────────────────────────────────────
function serializeTsHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers).map(([k, v]) => {
    const ek = k.replace(/'/g, "\\'");
    if (v.includes('${')) return `  '${ek}': \`${v}\``;
    return `  '${ek}': '${v.replace(/'/g, "\\'")}'`;
  });
  return `{\n${entries.join(',\n')}\n}`;
}

function serializePyHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers).map(([k, v]) => {
    const ek = k.replace(/'/g, "\\'");
    if (v.includes('{')) return `    '${ek}': f'${v.replace(/'/g, "\\'")}'`;
    return `    '${ek}': '${v.replace(/'/g, "\\'")}'`;
  });
  return `{\n${entries.join(',\n')}\n}`;
}

// ─────────────────────────────────────────────────────────────────────
// HTTP call block per library
// ─────────────────────────────────────────────────────────────────────
export interface HttpBlockOpts {
  method: string;
  url: string;
  extraHeaders: Record<string, string>;
  authType: 'none' | 'bearer' | 'basic';
  authValue: string;
  body: string | null;  // already-rendered code expression or null
  varName: string;
  ind: string;          // indentation prefix
}

export function genHttpBlock(lib: Library, opts: HttpBlockOpts): string {
  const { method, url, extraHeaders, authType, authValue, body, varName, ind } = opts;
  const M = method.toUpperCase();
  const isGetLike = M === 'GET' || M === 'HEAD' || M === 'OPTIONS';

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };

  if (authType === 'bearer' && authValue) {
    const envKey = authValue.replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
    if (isPythonLib(lib)) {
      headers['Authorization'] = `Bearer {os.environ.get('${envKey}', '${authValue}')}`;
    } else {
      headers['Authorization'] = `Bearer \${process.env.${envKey} ?? '${authValue}'}`;
    }
  } else if (authType === 'basic' && authValue) {
    const envKey = authValue.replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
    if (isPythonLib(lib)) {
      headers['Authorization'] = `Basic {os.environ.get('${envKey}', '')}`;
    } else {
      headers['Authorization'] = `Basic \${Buffer.from(process.env.${envKey} ?? '').toString('base64')}`;
    }
  }

  const i = ind;
  const lines: string[] = [];

  switch (lib) {
    case 'fetch':
    case 'node-fetch': {
      const h = serializeTsHeaders(headers);
      lines.push(`const ${varName}_res = await fetch('${url.replace(/'/g, "\\'")}', {`);
      lines.push(`  method: '${M}',`);
      lines.push(`  headers: ${h.replace(/\n/g, `\n${i}  `)},`);
      if (!isGetLike && body) lines.push(`  body: JSON.stringify(${body}),`);
      lines.push(`});`);
      lines.push(`if (!${varName}_res.ok) throw new Error(\`HTTP \${${varName}_res.status}: \${${varName}_res.statusText}\`);`);
      lines.push(`const ${varName}_data = await ${varName}_res.json().catch(() => ${varName}_res.text());`);
      lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_data };`);
      break;
    }
    case 'axios': {
      const h = serializeTsHeaders(headers);
      lines.push(`const ${varName}_res = await axios({`);
      lines.push(`  method: '${M.toLowerCase()}',`);
      lines.push(`  url: '${url.replace(/'/g, "\\'")}',`);
      lines.push(`  headers: ${h.replace(/\n/g, `\n${i}  `)},`);
      if (!isGetLike && body) lines.push(`  data: ${body},`);
      lines.push(`});`);
      lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_res.data };`);
      break;
    }
    case 'got': {
      const h = serializeTsHeaders(headers);
      const gotOpts = [`headers: ${h.replace(/\n/g, `\n${i}  `)}`, `responseType: 'json' as const`];
      if (!isGetLike && body) gotOpts.push(`json: ${body}`);
      lines.push(`const ${varName}_res = await got.${M.toLowerCase()}<unknown>('${url.replace(/'/g, "\\'")}', {`);
      lines.push(`  ${gotOpts.join(`,\n${i}  `)},`);
      lines.push(`});`);
      lines.push(`ctx['${varName}'] = { type: 'data', payload: ${varName}_res.body };`);
      break;
    }
    case 'requests': {
      const h = serializePyHeaders(headers);
      lines.push(`${varName}_res = requests.${M.toLowerCase()}(`);
      lines.push(`    '${url.replace(/'/g, "\\'")}',`);
      if (!isGetLike && body) lines.push(`    json=${body},`);
      lines.push(`    headers=${h.replace(/\n/g, `\n${i}`)}`);
      lines.push(`)`);
      lines.push(`${varName}_res.raise_for_status()`);
      lines.push(`try:`);
      lines.push(`    ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_res.json()}`);
      lines.push(`except Exception:`);
      lines.push(`    ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_res.text}`);
      break;
    }
    case 'httpx': {
      const h = serializePyHeaders(headers);
      lines.push(`with httpx.Client() as _client:`);
      lines.push(`    ${varName}_res = _client.${M.toLowerCase()}(`);
      lines.push(`        '${url.replace(/'/g, "\\'")}',`);
      if (!isGetLike && body) lines.push(`        json=${body},`);
      lines.push(`        headers=${h.replace(/\n/g, `\n${i}    `)}`);
      lines.push(`    )`);
      lines.push(`    ${varName}_res.raise_for_status()`);
      lines.push(`    try:`);
      lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': ${varName}_res.json()}`);
      lines.push(`    except Exception:`);
      lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': ${varName}_res.text}`);
      break;
    }
    case 'aiohttp': {
      const h = serializePyHeaders(headers);
      const sessionCall = isGetLike
        ? `_session.${M.toLowerCase()}('${url.replace(/'/g, "\\'")}', headers=${h.replace(/\n/g, `\n${i}    `)})`
        : `_session.${M.toLowerCase()}('${url.replace(/'/g, "\\'")}', ${body ? `json=${body}, ` : ''}headers=${h.replace(/\n/g, `\n${i}    `)})`;
      lines.push(`async with ${sessionCall} as ${varName}_res:`);
      lines.push(`    ${varName}_res.raise_for_status()`);
      lines.push(`    try:`);
      lines.push(`        ctx['${varName}'] = {'type': 'data', 'payload': await ${varName}_res.json()}`);
      lines.push(`    except Exception:`);
      lines.push(`        ctx['${varName}'] = {'type': 'text', 'payload': await ${varName}_res.text()}`);
      break;
    }
  }

  return lines.map(l => `${i}${l}`).join('\n');
}

// ─────────────────────────────────────────────────────────────────────
// Helper code generator — injects _s, _get, vaultLookup at top of file
// ─────────────────────────────────────────────────────────────────────
export function genHelperCode(lib: Library, isTS = true): string {
  if (isPythonLib(lib)) {
    return `def _s(val):
    """Safely stringify a value — dicts/lists are JSON-encoded."""
    if val is None: return ''
    if isinstance(val, (dict, list)): return json.dumps(val, ensure_ascii=False)
    return str(val)

def _get(entry, key='payload'):
    """Resolve a ctx entry field, with JSON sub-key fallback for structured outputs."""
    if entry is None: return ''
    if key in ('payload', 'output'):
        return _s(entry.get('payload', ''))
    raw = entry.get('payload', '')
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        if isinstance(parsed, dict) and key in parsed:
            return _s(parsed[key])
    except Exception: pass
    return _s(entry.get(key, ''))

def vault_lookup(query: str, top_k: int = 3) -> str:
    """TODO: swap with your vector store (Pinecone, Chroma, Weaviate, etc.)"""
    return f'[Knowledge base result for: {query[:80]}]'

`;
  }

  if (isTS) {
    return `const _s = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const _get = (entry: any, key = 'payload'): string => {
  if (!entry) return '';
  if (key === 'payload' || key === 'output') return _s(entry.payload);
  const raw = entry.payload;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); if (p && typeof p === 'object') return _s(p[key]); } catch {}
  }
  if (raw !== null && typeof raw === 'object') return _s((raw as any)[key]);
  return _s(entry[key]);
};

async function vaultLookup(query: string, topK = 3): Promise<string> {
  // TODO: swap with your vector store (Pinecone, Chroma, Weaviate, etc.)
  return \`[Knowledge base result for: \${query.substring(0, 80)}]\`;
}

`;
  }

  // JS without TypeScript types
  return `const _s = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const _get = (entry, key = 'payload') => {
  if (!entry) return '';
  if (key === 'payload' || key === 'output') return _s(entry.payload);
  const raw = entry.payload;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); if (p && typeof p === 'object') return _s(p[key]); } catch {}
  }
  if (raw !== null && typeof raw === 'object') return _s(raw[key]);
  return _s(entry[key]);
};

async function vaultLookup(query, topK = 3) {
  // TODO: swap with your vector store (Pinecone, Chroma, Weaviate, etc.)
  return \`[Knowledge base result for: \${query.substring(0, 80)}]\`;
}

`;
}

// ─────────────────────────────────────────────────────────────────────
// Install comment generator — emits a pip/npm install comment at file top
// ─────────────────────────────────────────────────────────────────────
export function genInstallComment(lib: Library, providers: Set<LLMProvider>, hasSchedule: boolean): string {
  const llmPyPkgs: Record<LLMProvider, string> = {
    groq: 'groq',
    openai: 'openai',
    gemini: 'google-generativeai',
    anthropic: 'anthropic',
  };
  const llmJsPkgs: Record<LLMProvider, string> = {
    groq: 'groq-sdk',
    openai: 'openai',
    gemini: '@google/generative-ai',
    anthropic: '@anthropic-ai/sdk',
  };

  if (isPythonLib(lib)) {
    const pkgs: string[] = [
      lib,
      ...(hasSchedule ? ['schedule'] : []),
      ...[...providers].map(p => llmPyPkgs[p]),
    ];
    return `# pip install ${pkgs.join(' ')}\n`;
  }

  // JS/TS
  const pkgs: string[] = [
    ...(lib !== 'fetch' ? [lib] : []),
    ...(hasSchedule ? ['node-cron'] : []),
    ...[...providers].map(p => llmJsPkgs[p]),
  ];
  if (!pkgs.length) return '';
  return `// npm install ${pkgs.join(' ')}\n`;
}
