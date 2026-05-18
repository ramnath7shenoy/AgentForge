import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runBrowserActionInE2B, runCodeInE2B } from "@/lib/sandbox/e2bRunner";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.E2B_API_KEY) {
    return NextResponse.json({ error: "Browser Agent requires E2B_API_KEY — add it to Vercel environment variables." }, { status: 500 });
  }

  let action: string, url: string, prompt: string, tavilyApiKey: string | undefined;
  try {
    ({ action, url, prompt, tavilyApiKey } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const logs: string[] = [];
  const onLog = (msg: string) => { logs.push(msg); };

  try {
    let output: string;
    if (action === "run_python") {
      ({ output } = await runCodeInE2B(prompt ?? "", "python", onLog));
    } else if (action === "run_javascript") {
      ({ output } = await runCodeInE2B(prompt ?? "", "javascript", onLog));
    } else {
      if (!url) return NextResponse.json({ error: `Browser Agent [${action}] requires a URL.` }, { status: 400 });
      ({ output } = await runBrowserActionInE2B(action, url, prompt ?? "", onLog, tavilyApiKey));
    }
    return NextResponse.json({ result: output, logs });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Browser Agent failed", logs }, { status: 500 });
  }
}
