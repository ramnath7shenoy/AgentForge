// E2B sandboxed execution — browser automation and code running beyond Vercel's capabilities.
// Requires E2B_API_KEY in environment. All tasks capped at TASK_TIMEOUT_MS.

import { Sandbox, OutputMessage } from "@e2b/code-interpreter";

export type E2BLogFn = (
  msg: string,
  type?: "INFO" | "SUCCESS" | "ERROR" | "WARN"
) => void;

const SANDBOX_CREATE_TIMEOUT_MS = 12_000;
const TASK_TIMEOUT_MS = 30_000;

export interface E2BRunResult {
  output: string;
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

  try {
    sandbox = await withTimeout(
      Sandbox.create({ apiKey }),
      SANDBOX_CREATE_TIMEOUT_MS,
      "sandbox create"
    );

    onLog(`⚡ E2B: Running ${language} in container...`, "INFO");

    const stdoutLines: string[] = [];

    const execution = await withTimeout(
      sandbox.runCode(code, {
        language,
        onStdout: (msg: OutputMessage) => {
          const line = msg.line.trimEnd();
          stdoutLines.push(line);
          onLog(`  ${line}`, "INFO");
        },
        onStderr: (msg: OutputMessage) => {
          onLog(`  [stderr] ${msg.line.trimEnd()}`, "WARN");
        },
      }),
      TASK_TIMEOUT_MS,
      "code execution"
    );

    if (execution.error) {
      throw new Error(
        `${execution.error.name}: ${execution.error.value}`
      );
    }

    const resultText =
      execution.text ||
      stdoutLines.join("\n") ||
      execution.logs.stdout.join("\n") ||
      "(no output)";

    onLog("✅ E2B: Execution complete.", "SUCCESS");
    return { output: resultText.trim() };
  } finally {
    if (sandbox) {
      await sandbox.kill().catch(() => {});
      onLog("🐳 E2B: Sandbox closed.", "INFO");
    }
  }
}

// ── Browser / scraping runner ─────────────────────────────────────────────────
const RESULT_RE = /---RESULT_START---([\s\S]*?)---RESULT_END---/;

export async function runBrowserActionInE2B(
  action: string,
  url: string,
  prompt: string,
  onLog: E2BLogFn
): Promise<E2BRunResult> {
  const script = buildBrowserScript(action, url, prompt);

  // Accumulate every raw line (including RESULT lines) for post-execution extraction.
  // Only forward non-RESULT lines to the user terminal to avoid flooding with base64.
  const rawLines: string[] = [];
  const filteredLog: E2BLogFn = (msg, type) => {
    rawLines.push(msg);
    if (!msg.trimStart().startsWith("---RESULT_START---")) onLog(msg, type);
  };

  await runCodeInE2B(script, "python", filteredLog);

  const fullOutput = rawLines.join("\n");

  // Debug: print to server console so we can verify marker presence
  console.log("[E2B] output length:", fullOutput.length, "| has marker:", fullOutput.includes("---RESULT_START---"));
  if (!fullOutput.includes("---RESULT_START---")) {
    console.log("[E2B] Full output (first 500 chars):", fullOutput.slice(0, 500));
  }

  const match = RESULT_RE.exec(fullOutput);
  if (!match) {
    return { output: "Error: No result captured from sandbox." };
  }

  const raw = match[1].trim();
  // Strip any whitespace E2B may have introduced by line-chunking the base64 stream.
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
import requests
from bs4 import BeautifulSoup

url = '${pyStr(url)}'
print(f"🌐 Fetching: {url}", flush=True)

headers = {"User-Agent": "Mozilla/5.0 (compatible; AgentForge/1.0)"}
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
import requests, json
from bs4 import BeautifulSoup

url = '${pyStr(url)}'
instructions = '${pyStr(prompt)}'
print(f"🔍 Scraping: {url}", flush=True)
print(f"📋 Target: {instructions}", flush=True)

headers = {"User-Agent": "Mozilla/5.0 (compatible; AgentForge/1.0)"}
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

import asyncio, base64, nest_asyncio
from playwright.async_api import async_playwright

nest_asyncio.apply()

url = '${pyStr(url)}'

async def main():
    print(f"📸 Navigating to: {url}", flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        title = await page.title()
        print(f"📄 Page loaded: {title}", flush=True)
        await page.screenshot(path="screenshot.png", type="png", full_page=False)
        await browser.close()

asyncio.run(main())

with open("screenshot.png", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()
print(f"✅ Screenshot captured ({len(b64):,} base64 chars)", flush=True)
print("---RESULT_START---data:image/png;base64," + b64 + "---RESULT_END---", flush=True)
`.trim();

    case "run_python": {
      // User-supplied code — run as-is
      const userCode = prompt || `print("No code provided")`;
      return userCode;
    }

    case "run_javascript": {
      // User-supplied JS — run as-is
      const userCode = prompt || `console.log("No code provided")`;
      return userCode;
    }

    default:
      return `print(f"Unknown browser action: '${pyStr(action)}'")`;
  }
}
