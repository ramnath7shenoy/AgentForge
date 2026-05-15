// E2B sandboxed execution — browser automation and code running beyond Vercel's capabilities.
// Requires E2B_API_KEY in environment. All tasks capped at TASK_TIMEOUT_MS.

import { Sandbox, OutputMessage } from "@e2b/code-interpreter";

export type E2BLogFn = (
  msg: string,
  type?: "INFO" | "SUCCESS" | "ERROR" | "WARN"
) => void;

const SANDBOX_CREATE_TIMEOUT_MS = 12_000;
const TASK_TIMEOUT_MS = 60_000;

export interface E2BRunResult {
  output: string;
}

// Domains that block cloud/datacenter IPs at the ASN level — bypass E2B browser for these.
const BLOCKED_DOMAINS = [
  "reddit.com",
  "linkedin.com",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
];

function isBlockedDomain(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return BLOCKED_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

// ── Timeout race ──────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`E2B timed out after ${ms / 1000}s (${label})`)),
        ms
      )
    ),
  ]);
}

// ── Python literal escaping ───────────────────────────────────────────────────
function pyStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

// ── Core runner ───────────────────────────────────────────────────────────────
export async function runCodeInE2B(
  code: string,
  language: "python" | "javascript",
  onLog: E2BLogFn
): Promise<E2BRunResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY is not set. Add it to your .env file.");
  }

  onLog("🐳 E2B: Starting isolated sandbox...", "INFO");

  let sandbox: Sandbox | null = null;
  let killTimeout: NodeJS.Timeout | null = null;

  try {
    sandbox = await withTimeout(
      Sandbox.create({ apiKey }),
      SANDBOX_CREATE_TIMEOUT_MS,
      "sandbox create"
    );

    onLog(`⚡ E2B: Running ${language} in container...`, "INFO");

    const stdoutLines: string[] = [];
    let earlyResolve: (val: string) => void;
    const resultFoundPromise = new Promise<string>((resolve) => {
      earlyResolve = resolve;
    });

    const executionPromise = withTimeout(
      sandbox.runCode(code, {
        language,
        onStdout: (msg: OutputMessage) => {
          const line = msg.line.trimEnd();
          stdoutLines.push(line);
          onLog(`  ${line}`, "INFO");
          // If we see the end marker in any stdout chunk, we can technically resolve the data gathering
          if (line.includes("---RESULT_END---")) {
             // We don't resolve immediately to allow final logs, but we flag it
          }
        },
        onStderr: (msg: OutputMessage) => {
          onLog(`  [stderr] ${msg.line.trimEnd()}`, "WARN");
        },
      }),
      TASK_TIMEOUT_MS,
      "code execution"
    );

    // Wait for either the execution to finish naturally or timeout
    const execution = await executionPromise;

    if (execution.error) {
      throw new Error(`${execution.error.name}: ${execution.error.value}`);
    }

    const resultText =
      execution.text ||
      stdoutLines.join("\n") ||
      execution.logs.stdout.join("\n") ||
      "(no output)";

    onLog("✅ E2B: Execution complete.", "SUCCESS");
    
    // Explicitly return the result before the finally block kills the sandbox
    const finalResult = { output: resultText.trim() };
    
    // Slight delay before killing to ensure logs are flushed if any
    await new Promise(r => setTimeout(r, 100));
    
    return finalResult;
  } finally {
    if (sandbox) {
      // Background the kill so we don't block the response returning to the user
      sandbox.kill().catch(() => {});
      onLog("🐳 E2B: Sandbox closed.", "INFO");
    }
  }
}

// ── RESULT marker extraction ──────────────────────────────────────────────────
const RESULT_RE = /---RESULT_START---([\s\S]*?)---RESULT_END---/;

async function runE2BScriptWithResult(
  script: string,
  onLog: E2BLogFn
): Promise<E2BRunResult> {
  const rawLines: string[] = [];
  const filteredLog: E2BLogFn = (msg, type) => {
    rawLines.push(msg);
    if (!msg.trimStart().startsWith("---RESULT_START---")) onLog(msg, type);
  };

  await runCodeInE2B(script, "python", filteredLog);

  const fullOutput = rawLines.join("\n");
  const match = RESULT_RE.exec(fullOutput);
  if (!match) return { output: "Error: No result captured from sandbox." };

  const raw = match[1].trim();
  const output = raw.startsWith("data:image/") ? raw.replace(/\s+/g, "") : raw;
  return { output };
}

// ── Tavily data bridge ────────────────────────────────────────────────────────
// Called when the target URL belongs to a domain that blocks cloud IPs.
// Tries Extract API first, falls back to Search with raw content.

type TavilyResult =
  | { ok: true; content: string }
  | { ok: false; fatal: boolean; status: number; message: string };

interface TavilyPost {
  title: string;
  url: string;
  snippet: string;
  subreddit?: string;
  relevance: number;
}

type TavilyStructuredResult =
  | { ok: true; posts: TavilyPost[]; platform: string }
  | { ok: false; fatal: boolean; status: number; message: string };

async function fetchViaTavily(
  url: string,
  tavilyApiKey: string,
  onLog: E2BLogFn
): Promise<TavilyResult> {
  // Tavily requires Bearer token in Authorization header (not api_key in body)
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tavilyApiKey}`,
  };

  // 1. Extract API — purpose-built for fetching a specific URL's full content
  try {
    onLog(`🔍 Tavily Extract: fetching ${url}...`, "INFO");
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers,
      body: JSON.stringify({ urls: [url], include_raw_content: true }),
    });

    if (res.status === 401 || res.status === 403) {
      onLog(`❌ Tavily Auth Error (${res.status}) — check TAVILY_API_KEY in vault.`, "ERROR");
      return { ok: false, fatal: true, status: res.status, message: "Tavily API key is invalid or unauthorized. Please check TAVILY_API_KEY in your vault." };
    }
    if (res.status === 404) {
      return { ok: false, fatal: true, status: 404, message: "Tavily could not find content for this URL (404)." };
    }

    if (res.ok) {
      const data = await res.json();
      const content: string | undefined = data.results?.[0]?.raw_content;
      if (content?.trim()) {
        onLog(`✅ Tavily Extract: ${content.length} chars`, "SUCCESS");
        return { ok: true, content };
      }
    }
  } catch {
    /* network error — fall through to search */
  }

  // 2. Search fallback — broad query with raw content, useful when Extract yields nothing
  try {
    onLog(`🔍 Tavily Search fallback (include_raw_content)...`, "INFO");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: url,
        max_results: 5,
        search_depth: "advanced",
        include_raw_content: true,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      onLog(`❌ Tavily Auth Error (${res.status}) — check TAVILY_API_KEY in vault.`, "ERROR");
      return { ok: false, fatal: true, status: res.status, message: "Tavily API key is invalid or unauthorized. Please check TAVILY_API_KEY in your vault." };
    }

    if (res.ok) {
      const data = await res.json();
      const results: Array<{ url: string; raw_content?: string; content?: string }> =
        data.results ?? [];
      const best =
        results.find((r) => r.url === url && r.raw_content) ||
        results.find((r) => r.raw_content);
      const content = best?.raw_content || best?.content;
      if (content?.trim()) {
        onLog(`✅ Tavily Search: ${content.length} chars`, "SUCCESS");
        return { ok: true, content };
      }
    }
  } catch {
    /* fall through */
  }

  // Non-fatal: Tavily responded but found nothing — don't show error card
  return { ok: false, fatal: false, status: 0, message: "Tavily returned no content for this URL." };
}

// ── HTML escaping ─────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── Tavily Search → structured posts ─────────────────────────────────────────
// Uses Search API (not Extract) with include_raw_content:false to get clean
// title/snippet/url data for top 5 results. Token-efficient for AI downstream.
async function fetchTavilySearchStructured(
  url: string,
  tavilyApiKey: string,
  onLog: E2BLogFn
): Promise<TavilyStructuredResult> {
  let platform = "web";
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.includes("reddit.com")) platform = "reddit";
    else if (h.includes("linkedin.com")) platform = "linkedin";
    else if (h.includes("instagram.com")) platform = "instagram";
    else if (h.includes("facebook.com")) platform = "facebook";
    else if (h.includes("twitter.com") || h.includes("x.com")) platform = "twitter";
  } catch { /* keep default */ }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tavilyApiKey}`,
  };

  try {
    onLog(`🔍 Tavily Search (structured, top 5): ${url}...`, "INFO");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: url,
        max_results: 5,
        search_depth: "advanced",
        include_raw_content: false,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      onLog(`❌ Tavily Auth Error (${res.status}) — check TAVILY_API_KEY in vault.`, "ERROR");
      return { ok: false, fatal: true, status: res.status, message: "Tavily API key is invalid or unauthorized. Check TAVILY_API_KEY in your vault." };
    }

    if (res.ok) {
      const data = await res.json();
      const raw: any[] = data.results ?? [];
      const posts: TavilyPost[] = raw.slice(0, 5).map((r) => {
        let subreddit: string | undefined;
        try {
          const m = new URL(r.url ?? "").pathname.match(/\/r\/([^/]+)/);
          if (m) subreddit = m[1];
        } catch { /* no subreddit */ }
        return {
          title: r.title ?? "",
          url: r.url ?? "",
          snippet: r.content ?? "",
          subreddit,
          relevance: r.score ?? 0,
        };
      });

      if (posts.length > 0) {
        onLog(`✅ Tavily: ${posts.length} result${posts.length !== 1 ? "s" : ""}`, "SUCCESS");
        return { ok: true, posts, platform };
      }
    }
  } catch { /* fall through */ }

  return { ok: false, fatal: false, status: 0, message: "Tavily returned no results for this URL." };
}

// ── Synthetic payload → readable text (for AI node consumption) ───────────────
function syntheticToText(result: { posts: TavilyPost[]; platform: string }, sourceUrl: string): string {
  const lines = [`Source: ${sourceUrl}`, `Platform: ${result.platform}`, ``];
  result.posts.slice(0, 5).forEach((p, i) => {
    lines.push(`${i + 1}. ${p.title}${p.subreddit ? ` (r/${p.subreddit})` : ""}`);
    if (p.snippet) lines.push(`   ${p.snippet.slice(0, 300)}`);
    lines.push(``);
  });
  return lines.join("\n").trim();
}

// ── Reddit-styled HTML for screenshot ────────────────────────────────────────
function generateRedditHtml(sourceUrl: string, posts: TavilyPost[]): string {
  const rows = posts.map((p) => {
    const sub = p.subreddit ? `<div class="sub">r/${escapeHtml(p.subreddit)}</div>` : "";
    const snip = p.snippet
      ? `<p class="snip">${escapeHtml(p.snippet.slice(0, 280))}</p>`
      : "";
    return `<div class="post">${sub}<div class="title"><a href="${escapeHtml(p.url)}">${escapeHtml(p.title)}</a></div>${snip}</div>`;
  }).join("\n");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#dae0e6;padding:20px;min-height:100vh}
.hdr{max-width:740px;margin:0 auto 14px;display:flex;align-items:center;gap:10px}
.logo{width:32px;height:32px;background:#ff4500;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;flex-shrink:0}
.site{font-size:18px;font-weight:700;color:#1c1c1c}
.src{font-size:11px;color:#878a8c;margin-left:auto;background:#fff;border:1px solid #edeff1;border-radius:4px;padding:3px 8px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.feed{max-width:740px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
.post{background:#fff;border:1px solid #ccc;border-radius:4px;padding:12px 16px}
.post:hover{border-color:#0079d3}
.sub{font-size:10px;color:#878a8c;font-weight:700;margin-bottom:4px}
.title a{font-size:15px;font-weight:600;color:#1c1c1c;text-decoration:none;line-height:1.4}
.snip{font-size:12px;color:#3c3c3c;margin-top:6px;line-height:1.5}
.footer{text-align:center;padding:14px;font-size:10px;color:#878a8c}
.orange{color:#ff4500;font-weight:700}
</style></head><body>
<div class="hdr"><div class="logo">r</div><div class="site">reddit</div><div class="src">${escapeHtml(sourceUrl)}</div></div>
<div class="feed">
${rows}
<div class="footer"><span class="orange">●</span> Retrieved via Tavily · ${posts.length} result${posts.length !== 1 ? "s" : ""}</div>
</div></body></html>`;
}

// ── Script: Reddit-styled screenshot (structured posts) ───────────────────────
function buildRedditStyleScreenshotScript(sourceUrl: string, posts: TavilyPost[]): string {
  const htmlB64 = Buffer.from(generateRedditHtml(sourceUrl, posts)).toString("base64");
  return `
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "nest_asyncio", "-q"])
_r = subprocess.run(["playwright", "install", "chromium", "--with-deps"], capture_output=True, text=True)
print("✅ Chromium ready" if _r.returncode == 0 else f"⚠️ chromium: {_r.stderr[:80]}", flush=True)

import asyncio, base64 as _b64, nest_asyncio
from playwright.async_api import async_playwright
nest_asyncio.apply()

html = _b64.b64decode('${htmlB64}').decode('utf-8', errors='replace')

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = await browser.new_page(viewport={"width":1280,"height":900})
        await page.set_content(html, wait_until="load")
        await page.screenshot(path="screenshot.png", type="png", full_page=True)
        await browser.close()

asyncio.run(main())
with open("screenshot.png","rb") as f:
    b64 = _b64.b64encode(f.read()).decode()
print(f"✅ Screenshot captured ({len(b64):,} chars)", flush=True)
print("---RESULT_START---data:image/png;base64," + b64 + "---RESULT_END---", flush=True)
`.trim();
}

// ── Blocked-domain handler ────────────────────────────────────────────────────
async function handleBlockedDomain(
  action: string,
  url: string,
  onLog: E2BLogFn,
  tavilyApiKey?: string
): Promise<E2BRunResult> {
  let domain = "this site";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch { /* malformed */ }

  onLog(`🔒 ${domain} blocks cloud IPs — routing through Tavily data bridge...`, "INFO");

  if (!tavilyApiKey) {
    onLog("⚠️ No Tavily API key in vault — add TAVILY_API_KEY to enable extraction.", "WARN");
    const noKeyMsg = `${domain} blocks requests from cloud environments.\nURL: ${url}\n\nAdd TAVILY_API_KEY to your vault to enable content extraction.`;
    if (action === "scrape_page") {
      return { output: JSON.stringify({ url, type: "blocked", error: noKeyMsg }, null, 2) };
    }
    if (action === "screenshot_page") {
      return runE2BScriptWithResult(buildBlockedCardScript(url, domain, noKeyMsg), onLog);
    }
    return { output: noKeyMsg };
  }

  const structured = await fetchTavilySearchStructured(url, tavilyApiKey, onLog);

  // ── browse_and_summarize: compact text for AI — top 5 posts only ──────────
  if (action === "browse_and_summarize") {
    if (structured.ok) return { output: syntheticToText(structured, url) };
    return { output: structured.message };
  }

  // ── scrape_page: synthetic JSON for UI card rendering ─────────────────────
  if (action === "scrape_page") {
    if (structured.ok) {
      const payload = {
        __synthetic__: true as const,
        platform: structured.platform,
        source_url: url,
        posts: structured.posts,
      };
      return { output: JSON.stringify(payload, null, 2) };
    }
    // Fatal (auth/404) → include error in JSON; non-fatal → generic blocked JSON
    return {
      output: JSON.stringify(
        { url, type: "blocked", error: structured.message, suggestion: structured.fatal ? "Check TAVILY_API_KEY in vault." : "Tavily returned no results." },
        null, 2
      ),
    };
  }

  // ── screenshot_page: render Reddit-styled HTML → E2B Playwright ──────────
  if (action === "screenshot_page") {
    if (structured.ok) {
      return runE2BScriptWithResult(buildRedditStyleScreenshotScript(url, structured.posts), onLog);
    }
    // Fatal (auth/404) → show card explaining the error
    if (structured.fatal) {
      return runE2BScriptWithResult(buildBlockedCardScript(url, domain, structured.message), onLog);
    }
    // Non-fatal → plain text (don't burn a sandbox slot)
    return { output: `Screenshot unavailable — ${domain} blocks cloud IPs and Tavily returned no results. Add TAVILY_API_KEY to your vault.` };
  }

  return { output: structured.ok ? syntheticToText(structured, url) : structured.message };
}

// ── Script: blocked-card screenshot (Tavily auth/404 failure) ─────────────────
function buildBlockedCardScript(url: string, domain: string, reason?: string): string {
  const bodyText = reason ?? `${domain} blocks requests from cloud infrastructure. Tavily extraction also returned no content for this URL.`;
  return `
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "nest_asyncio", "-q"])
_r = subprocess.run(["playwright", "install", "chromium", "--with-deps"], capture_output=True, text=True)
print("✅ Chromium ready" if _r.returncode == 0 else f"⚠️ chromium: {_r.stderr[:80]}", flush=True)

import asyncio, base64, nest_asyncio
from playwright.async_api import async_playwright
nest_asyncio.apply()

html = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:system-ui,sans-serif;background:#f1f5f9;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:12px;padding:36px;max-width:540px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.10)}
.icon{font-size:52px;margin-bottom:14px}
h2{color:#dc2626;margin:0 0 10px;font-size:22px}
p{color:#374151;font-size:14px;line-height:1.7}
.url{font-size:12px;color:#9ca3af;margin-top:12px;word-break:break-all}
.tip{background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:10px 16px;font-size:13px;margin-top:18px;color:#92400e;text-align:left}
</style></head><body><div class="card">
<div class="icon">🔒</div>
<h2>Content Unavailable</h2>
<p>${pyStr(bodyText)}</p>
<div class="url">${pyStr(url)}</div>
<div class="tip">💡 Add a <b>TAVILY_API_KEY</b> to your vault, or try a different URL.</div>
</div></body></html>"""

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--no-sandbox","--disable-dev-shm-usage"])
        page = await browser.new_page(viewport={"width":800,"height":600})
        await page.set_content(html, wait_until="load")
        await page.screenshot(path="screenshot.png", type="png", full_page=False)
        await browser.close()

asyncio.run(main())
with open("screenshot.png","rb") as f:
    b64 = base64.b64encode(f.read()).decode()
print(f"✅ Screenshot captured ({len(b64):,} chars)", flush=True)
print("---RESULT_START---data:image/png;base64," + b64 + "---RESULT_END---", flush=True)
`.trim();
}

// ── Browser / scraping runner ─────────────────────────────────────────────────
export async function runBrowserActionInE2B(
  action: string,
  url: string,
  prompt: string,
  onLog: E2BLogFn,
  tavilyApiKey?: string
): Promise<E2BRunResult> {
  // Universal hybrid: blocked domains skip E2B browser, use Tavily instead
  if (isBlockedDomain(url) && action !== "run_python" && action !== "run_javascript") {
    return handleBlockedDomain(action, url, onLog, tavilyApiKey);
  }

  const script = buildBrowserScript(action, url, prompt);
  const rawLines: string[] = [];
  const filteredLog: E2BLogFn = (msg, type) => {
    rawLines.push(msg);
    if (!msg.trimStart().startsWith("---RESULT_START---")) onLog(msg, type);
  };

  await runCodeInE2B(script, "python", filteredLog);

  const fullOutput = rawLines.join("\n");

  const match = RESULT_RE.exec(fullOutput);
  if (!match) {
    // Self-correcting retry: search Tavily for a working alternative URL
    if (tavilyApiKey) {
      onLog("♻️ Navigation failed — searching Tavily for alternative URL...", "WARN");
      try {
        const { resolveTargetUrl } = await import("@/lib/utils/resolveTargetUrl");
        const correctedUrl = await resolveTargetUrl(url, tavilyApiKey, (msg) => onLog(msg, "INFO"), true);
        if (correctedUrl !== url) {
          onLog(`🔁 Retrying with: ${correctedUrl}`, "INFO");
          return runBrowserActionInE2B(action, correctedUrl, prompt, onLog);
        }
      } catch {
        /* fall through */
      }
    }
    return { output: "Error: No result captured from sandbox." };
  }

  const raw = match[1].trim();
  const output = raw.startsWith("data:image/") ? raw.replace(/\s+/g, "") : raw;
  return { output };
}

// ── Script templates ──────────────────────────────────────────────────────────
function buildBrowserScript(action: string, url: string, prompt: string): string {
  switch (action) {
    case "browse_and_summarize":
      return `
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "beautifulsoup4", "-q"])
import requests, random
from bs4 import BeautifulSoup

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

url = '${pyStr(url)}'
print(f"🌐 Fetching: {url}", flush=True)

headers = {"User-Agent": random.choice(USER_AGENTS)}
resp = requests.get(url, headers=headers, timeout=15)
resp.raise_for_status()
print(f"✅ HTTP {resp.status_code} — {len(resp.content)} bytes", flush=True)

soup = BeautifulSoup(resp.text, "html.parser")
for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
    tag.decompose()

text = soup.get_text(separator="\\n", strip=True)
lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 40]
content = "\\n".join(lines[:100])

print(f"📄 Extracted {len(content)} chars of content", flush=True)
print("---RESULT_START---" + content[:4000] + "---RESULT_END---", flush=True)
`.trim();

    case "scrape_page":
      return `
import subprocess, sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "beautifulsoup4", "-q"])
import requests, json, random
from bs4 import BeautifulSoup

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

url = '${pyStr(url)}'
instructions = '${pyStr(prompt)}'
print(f"🔍 Scraping: {url}", flush=True)
print(f"📋 Target: {instructions}", flush=True)

headers = {"User-Agent": random.choice(USER_AGENTS)}
resp = requests.get(url, headers=headers, timeout=15)
resp.raise_for_status()

soup = BeautifulSoup(resp.text, "html.parser")
result = {
    "url": url,
    "title": soup.title.string.strip() if soup.title else "",
    "description": (soup.find("meta", {"name": "description"}) or {}).get("content", ""),
    "headings": [h.get_text(strip=True) for h in soup.find_all(["h1", "h2", "h3"])[:15]],
    "paragraphs": [
        p.get_text(strip=True)
        for p in soup.find_all("p")
        if len(p.get_text(strip=True)) > 60
    ][:15],
    "links": [
        {"text": a.get_text(strip=True)[:80], "href": a.get("href", "")}
        for a in soup.find_all("a", href=True)[:20]
    ],
}
result_str = json.dumps(result, indent=2, ensure_ascii=False)
print(f"✅ Scraped {len(result['paragraphs'])} paragraphs, {len(result['links'])} links", flush=True)
print("---RESULT_START---" + result_str + "---RESULT_END---", flush=True)
`.trim();

    case "screenshot_page":
      return `
import subprocess, sys
print("📦 Installing dependencies...", flush=True)
subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "nest_asyncio", "-q"])
result = subprocess.run(
    ["playwright", "install", "chromium", "--with-deps"],
    capture_output=True, text=True
)
if result.returncode != 0:
    print(f"⚠️  Chromium install warning: {result.stderr[:200]}", flush=True)
else:
    print("✅ Chromium ready", flush=True)

import asyncio, base64, nest_asyncio, random
from playwright.async_api import async_playwright

nest_asyncio.apply()

STEALTH_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
window.chrome = { runtime: {} };
"""

DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

url = '${pyStr(url)}'

async def main():
    print(f"📸 Navigating to: {url}", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        page = await browser.new_page(
            viewport={"width": 1280, "height": 800},
            user_agent=DESKTOP_UA
        )
        await page.set_extra_http_headers({
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/",
            "DNT": "1",
        })
        await page.add_init_script(STEALTH_SCRIPT)
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        try:
            await page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass  # proceed if networkidle times out (heavy JS apps)
        title = await page.title()
        print(f"📄 Page loaded: {title}", flush=True)
        delay = random.uniform(1, 3)
        print(f"⏳ Human-like pause: {delay:.1f}s", flush=True)
        await asyncio.sleep(delay)
        await page.screenshot(path="screenshot.png", type="png", full_page=False)
        await browser.close()

asyncio.run(main())

with open("screenshot.png", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()
print(f"✅ Screenshot captured ({len(b64):,} base64 chars)", flush=True)
print("---RESULT_START---data:image/png;base64," + b64 + "---RESULT_END---", flush=True)
`.trim();

    case "run_python": {
      const userCode = prompt || `print("No code provided")`;
      return userCode;
    }

    case "run_javascript": {
      const userCode = prompt || `console.log("No code provided")`;
      return userCode;
    }

    default:
      return `print(f"Unknown browser action: '${pyStr(action)}'")`;
  }
}
