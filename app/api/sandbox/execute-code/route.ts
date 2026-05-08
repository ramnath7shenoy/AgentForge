import { NextRequest } from "next/server";
import { Sandbox, OutputMessage } from "@e2b/code-interpreter";

export const maxDuration = 60;

// Parse `# pip install pkg1 pkg2 ...` lines from the script header (first 20 lines).
function parsePipPackages(code: string): string[] {
  const packages: string[] = [];
  for (const line of code.split("\n").slice(0, 20)) {
    const m = line.match(/^#\s*pip\s+install\s+(.+)/i);
    if (m) packages.push(...m[1].trim().split(/\s+/).filter(Boolean));
  }
  return [...new Set(packages)];
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
  if (!e2bApiKey) {
    return new Response(JSON.stringify({ error: "E2B_API_KEY not configured" }), { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* stream closed */ }
      };

      let sandbox: Sandbox | null = null;
      try {
        enqueue({ t: "log", text: "🐳 Starting E2B sandbox..." });

        sandbox = await Sandbox.create({ apiKey: e2bApiKey, envs: envVars });

        // Pre-install packages declared in # pip install comments
        if (language === "python") {
          const pkgs = parsePipPackages(code);
          if (pkgs.length) {
            enqueue({ t: "log", text: `📦 Installing: ${pkgs.join(" ")}...` });
            const installExec = await sandbox.runCode(
              `import subprocess, sys\nr = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", ${pkgs.map(p => `"${p.replace(/"/g, '')}"` ).join(", ")}], capture_output=True, text=True)\nprint(r.stderr[-400:] if r.returncode != 0 else "✅ Packages ready")`,
              { language: "python" }
            );
            const installOut = (installExec.logs?.stdout ?? []).join("").trim();
            const installErr = (installExec.logs?.stderr ?? []).join("").trim();
            if (installOut.trim()) enqueue({ t: "log", text: installOut.trim() });
            if (installErr.trim()) enqueue({ t: "stderr", line: installErr.trim() });
          }
        }

        const runtimeLabel =
          language === "python" ? "Python 3.11" :
          language === "typescript" ? "TypeScript (tsx)" : "Node.js";
        enqueue({ t: "log", text: `⚡ Running ${runtimeLabel}...` });

        let execCode = code;
        let execLang: "python" | "javascript" = language === "python" ? "python" : "javascript";

        if (language === "typescript") {
          const codeB64 = Buffer.from(code).toString("base64");
          execCode = `
const { spawnSync } = require('child_process');
const fs = require('fs');
const tsCode = Buffer.from('${codeB64}', 'base64').toString('utf-8');
fs.writeFileSync('/tmp/_agentforge_script.ts', tsCode);
spawnSync('npm', ['install', '-g', 'tsx', '--prefer-offline', '--quiet'], { stdio: 'pipe', timeout: 30000 });
const proc = spawnSync('tsx', ['/tmp/_agentforge_script.ts'], {
  encoding: 'utf-8', timeout: 25000,
  env: { ...process.env }, maxBuffer: 10 * 1024 * 1024,
});
if (proc.stdout) process.stdout.write(proc.stdout);
if (proc.stderr) process.stderr.write(proc.stderr);
if (proc.error) { console.error(proc.error.message); process.exit(1); }
if (proc.status !== 0) process.exit(proc.status ?? 1);
`.trim();
          execLang = "javascript";
        }

        const execution = await sandbox.runCode(execCode, {
          language: execLang,
          onStdout: (msg: OutputMessage) => enqueue({ t: "stdout", line: msg.line.trimEnd() }),
          onStderr: (msg: OutputMessage) => enqueue({ t: "stderr", line: msg.line.trimEnd() }),
        });

        if (execution.error) {
          enqueue({ t: "error", message: `${execution.error.name}: ${execution.error.value}` });
          enqueue({ t: "done", success: false });
        } else {
          enqueue({ t: "log", text: "✅ Code execution complete." });
          enqueue({ t: "done", success: true });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Execution failed";
        enqueue({ t: "error", message });
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
