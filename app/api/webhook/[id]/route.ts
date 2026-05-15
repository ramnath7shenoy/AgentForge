import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { executeGraphServer, SandboxApiKey } from "@/lib/flow/serverExecutor";
import { logFlowRun } from "@/app/actions/flow";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params;

  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow || (!flow.isPublic && !flow.isDeployed)) {
    return Response.json({ error: "Flow not found or not deployed" }, { status: 404 });
  }

  let input = "";
  let apiKeys: SandboxApiKey[] = [];

  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body === "object") {
      input = typeof body.input === "string" ? body.input : JSON.stringify(body.input ?? body);
      if (body.apiKeys && typeof body.apiKeys === "object") {
        apiKeys = Object.entries(body.apiKeys).map(([key, value]) => ({
          key,
          value: String(value),
        }));
      }
    } else if (typeof body === "string") {
      input = body;
    }
  } catch {
    input = await req.text().catch(() => "");
  }

  // Fall back to the flow owner's vault keys when none are provided in the request
  if (apiKeys.length === 0 && flow.userId) {
    try {
      const vault = await prisma.vault.findUnique({ where: { userId: flow.userId } });
      if (vault?.encrypted_keys) {
        const entries = JSON.parse(vault.encrypted_keys);
        if (Array.isArray(entries)) {
          apiKeys = entries.filter((e: any) => e.key?.trim() && e.value?.trim());
        }
      }
    } catch {}
  }

  const nodes = (flow.nodes as any[]) ?? [];
  const edges = (flow.edges as any[]) ?? [];

  if (nodes.length === 0) {
    return Response.json({ error: "Flow has no nodes" }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const { context, totalCostUsd } = await executeGraphServer(
      nodes,
      edges,
      input,
      apiKeys
    );

    const output = context.variables.output ?? { type: "text", payload: "" };
    const durationMs = Date.now() - startedAt;

    logFlowRun(flowId, input, output, "success", totalCostUsd, durationMs, "webhook").catch(() => {});

    return Response.json({
      success: true,
      output: (output as any).payload ?? output,
      durationMs,
      costUsd: totalCostUsd,
    });
  } catch (err: any) {
    logFlowRun(flowId, input, null, "error", 0, Date.now() - startedAt, "webhook").catch(() => {});
    return Response.json({ error: err.message || "Execution failed" }, { status: 500 });
  }
}
