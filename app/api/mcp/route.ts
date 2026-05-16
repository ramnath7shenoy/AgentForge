import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { executeGraphServer, SandboxApiKey } from "@/lib/flow/serverExecutor";
import { logFlowRun } from "@/app/actions/flow";

export const maxDuration = 60;

const MCP_VERSION = "2024-11-05";

function ok(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || body.jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid JSON-RPC request");
  }

  const { method, params, id } = body;

  // Notifications are fire-and-forget — acknowledge but don't respond
  if (typeof method === "string" && method.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  if (method === "ping") {
    return ok(id, {});
  }

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: MCP_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "AgentForge", version: "1.0.0" },
    });
  }

  if (method === "tools/list") {
    const flows = await prisma.flow.findMany({
      where: { isDeployed: true, isPublic: true },
      select: { id: true, name: true, description: true, tags: true },
      orderBy: { viewCount: "desc" },
      take: 50,
    });

    const tools = flows.map((flow) => ({
      name: toSlug(flow.name ?? flow.id),
      description: [
        flow.description ?? "An AgentForge agent",
        flow.tags?.length ? `Tags: ${flow.tags.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      inputSchema: {
        type: "object" as const,
        properties: {
          input: {
            type: "string",
            description: "The input or prompt to send to this agent",
          },
        },
        required: ["input"],
      },
    }));

    return ok(id, { tools });
  }

  if (method === "tools/call") {
    const toolName = params?.name as string;
    const input = (params?.arguments?.input as string) ?? "";

    if (!toolName) {
      return rpcError(id, -32602, "Missing tool name");
    }

    const flows = await prisma.flow.findMany({
      where: { isDeployed: true, isPublic: true },
      select: { id: true, name: true, nodes: true, edges: true, userId: true },
    });

    const flow = flows.find((f) => toSlug(f.name ?? f.id) === toolName);

    if (!flow) {
      return rpcError(id, -32602, `Tool "${toolName}" not found`);
    }

    let apiKeys: SandboxApiKey[] = [];
    if (flow.userId) {
      try {
        const vault = await prisma.vault.findUnique({
          where: { userId: flow.userId },
        });
        if (vault?.encrypted_keys) {
          const entries = JSON.parse(vault.encrypted_keys);
          if (Array.isArray(entries)) {
            apiKeys = entries.filter(
              (e: { key?: string; value?: string }) =>
                e.key?.trim() && e.value?.trim()
            );
          }
        }
      } catch {}
    }

    const nodes = (flow.nodes as any[]) ?? [];
    const edges = (flow.edges as any[]) ?? [];
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

      logFlowRun(
        flow.id,
        input,
        output,
        "success",
        totalCostUsd,
        durationMs,
        "mcp"
      ).catch(() => {});

      const text =
        typeof (output as any).payload === "string"
          ? (output as any).payload
          : JSON.stringify((output as any).payload ?? output);

      return ok(id, {
        content: [{ type: "text", text }],
      });
    } catch (e: any) {
      logFlowRun(
        flow.id,
        input,
        null,
        "error",
        0,
        Date.now() - startedAt,
        "mcp"
      ).catch(() => {});

      return rpcError(id, -32603, e.message ?? "Execution failed");
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}
