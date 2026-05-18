import { NextRequest } from "next/server";
import {
  executeGraphServer,
  SandboxApiKey,
  SandboxNode,
  SandboxEdge,
  SandboxFlowPacket,
  SandboxNodeStatus,
  SandboxLogType,
} from "@/lib/flow/serverExecutor";
import { logFlowRun } from "@/app/actions/flow";

export const maxDuration = 60;

type SseEvent =
  | { t: "log"; type: SandboxLogType; message: string; nodeId?: string }
  | { t: "status"; nodeId: string; status: SandboxNodeStatus }
  | { t: "output"; nodeId: string; packet: SandboxFlowPacket }
  | { t: "result"; packet: SandboxFlowPacket }
  | { t: "cost"; amount: number }
  | { t: "token"; nodeId: string; token: string }
  | { t: "done" }
  | { t: "error"; message: string };

export async function POST(req: NextRequest) {
  let nodes: SandboxNode[] = [];
  let edges: SandboxEdge[] = [];
  let input = "";
  let apiKeys: SandboxApiKey[] = [];
  let flowId: string | undefined;

  try {
    const raw = await req.text();
    if (raw.length > 500_000) {
      return new Response(JSON.stringify({ error: "Request body too large" }), { status: 413 });
    }
    const body = JSON.parse(raw);
    nodes = body.nodes ?? [];
    edges = body.edges ?? [];
    input = body.input ?? "";
    apiKeys = body.apiKeys ?? [];
    flowId = body.flowId || undefined;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  if (nodes.length === 0) {
    return new Response(JSON.stringify({ error: "No nodes provided" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: SseEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // stream may have been closed
        }
      };

      try {
        const { context, totalCostUsd } = await executeGraphServer(
          nodes,
          edges,
          input,
          apiKeys,
          (message, type = "INFO", nodeId) => {
            enqueue({ t: "log", type: type as SandboxLogType, message, nodeId });
          },
          {
            onNodeStatusChange: (nodeId, status) => {
              enqueue({ t: "status", nodeId, status });
            },
            onNodeComplete: (nodeId, packet) => {
              enqueue({ t: "output", nodeId, packet });
            },
            onToken: (token, nodeId) => {
              enqueue({ t: "token", nodeId, token });
            },
          }
        );

        const resultPacket: SandboxFlowPacket =
          context.variables.output || { type: "text", payload: "" };
        enqueue({ t: "result", packet: resultPacket });
        if (totalCostUsd > 0) enqueue({ t: "cost", amount: totalCostUsd });

        if (flowId) {
          logFlowRun(flowId, input, resultPacket, "success", totalCostUsd, Date.now() - startedAt).catch(() => {});
        }
      } catch (err: any) {
        enqueue({ t: "error", message: err.message || "Execution failed" });
        if (flowId) {
          logFlowRun(flowId, input, null, "error", 0, Date.now() - startedAt).catch(() => {});
        }
      } finally {
        enqueue({ t: "done" });
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
