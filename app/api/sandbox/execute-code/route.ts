import { NextRequest } from "next/server";
import { Sandbox, OutputMessage } from "@e2b/code-interpreter";

export const maxDuration = 60;

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*[mGKHFJA-Z]/g, "");

// Noise patterns that should never reach the user terminal
const STDERR_NOISE: RegExp[] = [
  /^Traceback \(most recent call last\)/,
  /^Exception in thread /,
  /^During handling of the above exception/,
  /^\s+File ".+", line \d+/,          // Python traceback frame
  /^\s+at .+:\d+:\d+\)?$/,            // Node.js/JS stack frame
  /^\s+at .+ \(.+:\d+:\d+\)$/,        // Node.js stack frame variant
  /^\s+[~^|]+\s*$/,                   // Python 3.11+ squiggle underlines
  /^\s*\^\s*$/,                       // single caret
  /^The above exception was the direct cause/,
  /^\s+self\.(run|_target)\(\*self\._args/,
  /^\s+_threading_Thread_run/,
];

function cleanStderr(raw: string): string | null {
  const line = stripAnsi(raw).trimEnd();
  if (!line.trim()) return null;
  if (STDERR_NOISE.some((p) => p.test(line))) return null;
  return line.length > 250 ? line.slice(0, 250) + "…" : line;
}

function cleanStdout(raw: string): string | null {
  const line = stripAnsi(raw).trimEnd();
  if (!line.trim()) return null;
  if (line.match(/^data:image\//)) return "📸 [image result]";
  if (line.includes('"payload": "data:image/')) return null;
  return line.length > 500 ? line.slice(0, 500) + "…" : line;
}

function parsePipPackages(code: string): string[] {
  const packages: string[] = [];
  for (const line of code.split("\n")) {
    const m = line.match(/^#\s*pip\s+install\s+(.+)/i);
    if (m) packages.push(...m[1].trim().split(/\s+/).filter(Boolean));
  }
  return [...new Set(packages)];
}

function parseNpmPackages(code: string): string[] {
  const packages: string[] = [];
  for (const line of code.split("\n")) {
    const m = line.match(/^\/\/\s*npm\s+install\s+(.+)/i);
    if (m) packages.push(...m[1].trim().split(/\s+/).filter(Boolean));
  }
  return [...new Set(packages)];
}

// Build the Python subprocess wrapper.
// Runs the user's code as a clean child process so Jupyter kernel thread monitors
// never intercept exceptions. Filters the subprocess stderr down to a single
// human-readable ❌ line emitted to stdout.
function buildPythonWrapper(code: string, runId: string, envVars: Record<string, string>): string {
  const b64 = Buffer.from(code).toString("base64");
  // Build a Python dict literal for the extra env vars — passed explicitly to subprocess
  const envPyPairs = Object.entries(envVars)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ");
  const noisePrefixes = [
    "Traceback (", "Exception in thread", "During handling",
    '  File "', "   ", "~~~", "^^^",
  ];
  const noisePy = JSON.stringify(noisePrefixes);
  return [
    `import subprocess, sys, os, base64 as _b64`,
    `_extra = {${envPyPairs}}`,
    `_env = {**os.environ, **_extra}`,
    `_path = "/tmp/af_${runId}.py"`,
    `with open(_path, 'w', encoding='utf-8') as _f:`,
    `    _f.write(_b64.b64decode("${b64}").decode('utf-8'))`,
    `try:`,
    `    _r = subprocess.run(`,
    `        [sys.executable, _path],`,
    `        capture_output=True, text=True, timeout=50,`,
    `        env=_env`,
    `    )`,
    `    if _r.stdout:`,
    `        print(_r.stdout, end="", flush=True)`,
    `    if _r.returncode != 0:`,
    `        _noise = ${noisePy}`,
    `        _lines = [_l for _l in _r.stderr.splitlines() if _l.strip()]`,
    `        _err = next(`,
    `            (_l.strip() for _l in reversed(_lines)`,
    `             if _l.strip() and not any(_l.startswith(_p) for _p in _noise)),`,
    `            (_lines[-1].strip() if _lines else "Execution failed")`,
    `        )`,
    `        print(f"❌ {_err[:250]}", flush=True)`,
    `except subprocess.TimeoutExpired:`,
    `    print("❌ Execution timed out after 50 s", flush=True)`,
  ].join("\n");
}

// Build the TypeScript/JavaScript subprocess wrapper.
function buildJsWrapper(code: string, language: "typescript" | "javascript", npmPkgs: string[], runId: string, envVars: Record<string, string>): string {
  const b64 = Buffer.from(code).toString("base64");
  const ext = language === "typescript" ? "ts" : "js";
  const dir = `/tmp/af_${runId}`;
  const pkgJson = JSON.stringify({
    ...(npmPkgs.length ? { dependencies: Object.fromEntries(npmPkgs.map((p) => [p, "latest"])) } : {}),
  });
  const npmInstall = npmPkgs.length
    ? [
        `console.log('📦 Installing npm packages: ${npmPkgs.join(" ")}...');`,
        `const _ir = spawnSync('npm', ['install', '--prefix', dir, '--quiet', '--no-fund', '--no-audit'], { stdio: 'pipe', timeout: 60000, cwd: dir });`,
        `if (_ir.status !== 0) process.stderr.write('npm install failed: ' + (_ir.stderr?.toString().slice(-300) ?? ''));`,
        `else console.log('✅ npm packages ready');`,
      ].join("\n")
    : "";
  const envJs = JSON.stringify(envVars);

  return `
const { spawnSync } = require('child_process');
const fs = require('fs');
const _extraEnv = ${envJs};
const dir = '${dir}';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + '/package.json', ${JSON.stringify(pkgJson)});
fs.writeFileSync(dir + '/index.${ext}', Buffer.from('${b64}', 'base64').toString('utf-8'));
spawnSync('npm', ['install', '-g', 'tsx', '--prefer-offline', '--quiet'], { stdio: 'pipe', timeout: 30000 });
${npmInstall}
const proc = spawnSync('tsx', [dir + '/index.${ext}'], {
  encoding: 'utf-8', timeout: 25000,
  env: { ...process.env, ..._extraEnv },
  cwd: dir,
  maxBuffer: 10 * 1024 * 1024,
});
if (proc.stdout) process.stdout.write(proc.stdout);
if (proc.stderr) {
  // Filter JS stack frames — only emit the meaningful error lines
  const filtered = proc.stderr.split('\\n')
    .filter(l => l.trim() && !l.match(/^\\s+at .+:\\d+:\\d+/) && !l.match(/^\\s+at .+ \\(.+:\\d+:\\d+\\)/))
    .join('\\n').trim();
  if (filtered) process.stderr.write(filtered + '\\n');
}
if (proc.error) { console.error('❌ ' + proc.error.message); }
`.trim();
}

export async function POST(req: NextRequest) {
  let code = "";
  let language: "python" | "javascript" | "typescript" = "python";
  let envVars: Record<string, string> = {};

  try {
    const body = await req.json();
    code = body.code ?? "";
    language = body.language ?? "python";
    envVars = body.envVars ?? {};
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const e2bApiKey = process.env.E2B_API_KEY;
  if (!e2bApiKey)
    return new Response(JSON.stringify({ error: "E2B_API_KEY not configured" }), { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: Record<string, unknown>) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); }
        catch { /* stream closed */ }
      };

      let sandbox: Sandbox | null = null;
      try {
        const userKeys = Object.keys(envVars).filter(k => !k.startsWith("AGENTFORGE_"));
        enqueue({ t: "log", text: `🐳 Starting E2B sandbox${userKeys.length ? ` · injecting ${userKeys.length} key(s): ${userKeys.join(", ")}` : " · ⚠️  no API keys found — add them in the env panel"}...` });
        sandbox = await Sandbox.create({ apiKey: e2bApiKey, envs: envVars });

        // ── Python: pip install + optional Playwright
        if (language === "python") {
          const pkgs = parsePipPackages(code);
          if (pkgs.length) {
            enqueue({ t: "log", text: `📦 Installing: ${pkgs.join(" ")}...` });
            const installExec = await sandbox.runCode(
              `import subprocess, sys\n` +
              `r = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", ${pkgs.map(p => `"${p.replace(/"/g, "")}"`).join(", ")}], capture_output=True, text=True)\n` +
              `print(r.stderr[-400:] if r.returncode != 0 else "✅ Packages ready")`,
              { language: "python" }
            );
            const out = (installExec.logs?.stdout ?? []).join("").trim();
            const err = (installExec.logs?.stderr ?? []).join("").trim();
            if (out) enqueue({ t: "log", text: out });
            if (err && installExec.error) enqueue({ t: "stderr", line: err });

            if (pkgs.includes("playwright")) {
              enqueue({ t: "log", text: "🌐 Installing Playwright browser + system libs..." });
              const pwExec = await sandbox.runCode(
                `import subprocess, sys\n` +
                `r1 = subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], capture_output=True, text=True)\n` +
                `r2 = subprocess.run([sys.executable, "-m", "playwright", "install-deps", "chromium"], capture_output=True, text=True)\n` +
                `print("✅ Chromium + deps ready" if (r1.returncode == 0 and r2.returncode == 0) else (r1.stderr[-300:] + r2.stderr[-300:]))`,
                { language: "python" }
              );
              const pwOut = (pwExec.logs?.stdout ?? []).join("").trim();
              if (pwOut) enqueue({ t: "log", text: pwOut });
            }
          }
        }

        const runtimeLabel =
          language === "python" ? "Python 3.11" :
          language === "typescript" ? "TypeScript (tsx)" : "JavaScript (tsx/ESM)";
        enqueue({ t: "log", text: `⚡ Running ${runtimeLabel}...` });

        const runId = Math.random().toString(36).slice(2, 10);
        let execCode: string;
        let execLang: "python" | "javascript";

        if (language === "python") {
          execCode = buildPythonWrapper(code, runId, envVars);
          execLang = "python";
        } else {
          const npmPkgs = parseNpmPackages(code);
          execCode = buildJsWrapper(code, language, npmPkgs, runId, envVars);
          execLang = "javascript";
        }

        // Track whether user code emitted an error (❌ prefix from the wrappers above)
        let hadError = false;

        const execution = await sandbox.runCode(execCode, {
          language: execLang,
          onStdout: (msg: OutputMessage) => {
            // The subprocess wrapper emits its full captured stdout in a single event.
            // Split on newlines so every logical line is processed independently.
            for (const raw of msg.line.split("\n")) {
              const line = cleanStdout(raw);
              if (!line) continue;
              if (line.startsWith("❌")) hadError = true;
              enqueue({ t: "stdout", line });
            }
          },
          onStderr: (msg: OutputMessage) => {
            for (const raw of msg.line.split("\n")) {
              const line = cleanStderr(raw);
              if (line) enqueue({ t: "stderr", line });
            }
          },
        });

        if (execution.error) {
          // Wrapper itself crashed (e.g. base64 decode error, timeout) — extract clean message
          const errLines = stripAnsi(execution.error.value ?? "")
            .split("\n").map((l) => l.trim())
            .filter((l) => l && !STDERR_NOISE.some((p) => p.test(l)));
          const msg = errLines[errLines.length - 1] ?? execution.error.name ?? "Execution failed";
          enqueue({ t: "error", message: msg.slice(0, 300) });
          enqueue({ t: "done", success: false });
        } else {
          enqueue({ t: "log", text: hadError ? "⚠️  Finished with errors." : "✅ Execution complete." });
          enqueue({ t: "done", success: !hadError });
        }
      } catch (err: unknown) {
        enqueue({ t: "error", message: err instanceof Error ? err.message : "Execution failed" });
        enqueue({ t: "done", success: false });
      } finally {
        if (sandbox) await sandbox.kill().catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
