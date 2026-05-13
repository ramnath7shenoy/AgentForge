'use server'

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import * as xService from "@/lib/providers/xService";
import * as slackService from "@/lib/providers/slackService";
import * as discordService from "@/lib/providers/discordService";
import * as githubService from "@/lib/providers/githubService";
import * as notionService from "@/lib/providers/notionService";
import * as instagramService from "@/lib/providers/instagramService";
import * as linkedinService from "@/lib/providers/linkedinService";
import * as mediumService from "@/lib/providers/mediumService";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getIntegrations() {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized", integrations: [] };

  const integrations = await prisma.integration.findMany({
    where: { userId: user.id },
    select: { id: true, provider: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return { integrations };
}

export async function upsertIntegration(
  provider: string,
  accessToken: string,
  refreshToken?: string,
  metadata?: Record<string, unknown>
) {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const integration = await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    create: {
      userId: user.id,
      provider,
      accessToken,
      refreshToken: refreshToken ?? null,
      metadata: (metadata ?? {}) as any,
    },
    update: {
      accessToken,
      ...(refreshToken !== undefined ? { refreshToken } : {}),
      ...(metadata !== undefined ? { metadata: metadata as any } : {}),
    },
  });
  return { integration };
}

export async function deleteIntegration(provider: string) {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  await prisma.integration.delete({
    where: { userId_provider: { userId: user.id, provider } },
  });
  return { ok: true };
}

// Maps each OAuth provider to the env var name used by compiled/sandbox code.
const PROVIDER_TO_ENV_KEY: Record<string, string> = {
  x: "X_BEARER_TOKEN",
  slack: "SLACK_TOKEN",
  discord: "DISCORD_BOT_TOKEN",
  github: "GITHUB_TOKEN",
  notion: "NOTION_TOKEN",
  instagram: "INSTAGRAM_ACCESS_TOKEN",
  linkedin: "LINKEDIN_ACCESS_TOKEN",
  medium: "MEDIUM_INTEGRATION_TOKEN",
};

/**
 * Fetches OAuth tokens for a set of providers and returns them keyed by the
 * canonical env var name (e.g. "DISCORD_BOT_TOKEN"). Used by the sandbox to
 * avoid requiring users to manually copy tokens into the vault.
 */
export async function getIntegrationEnvVars(providers: string[]): Promise<Record<string, string>> {
  const user = await getAuthUser();
  if (!user) return {};

  const rows = await prisma.integration.findMany({
    where: { userId: user.id, provider: { in: providers } },
    select: { provider: true, accessToken: true },
  });

  const result: Record<string, string> = {};
  for (const row of rows) {
    const envKey = PROVIDER_TO_ENV_KEY[row.provider];
    if (envKey && row.accessToken) result[envKey] = row.accessToken;
  }
  return result;
}

export async function executeAppAction(
  provider: string,
  action: string,
  resolvedInputs: Record<string, string>,
  tavilyApiKey?: string
): Promise<{ result: string }> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized — please sign in.");

  // Browser Agent uses E2B — no OAuth integration row needed.
  if (provider === "browser") {
    const { runBrowserActionInE2B, runCodeInE2B } = await import("@/lib/sandbox/e2bRunner");
    const logs: string[] = [];
    const e2bLog = (msg: string) => { logs.push(msg); };

    let output: string;
    if (action === "run_python") {
      ({ output } = await runCodeInE2B(resolvedInputs.prompt ?? "", "python", e2bLog));
    } else if (action === "run_javascript") {
      ({ output } = await runCodeInE2B(resolvedInputs.prompt ?? "", "javascript", e2bLog));
    } else {
      const url = resolvedInputs.url ?? "";
      if (!url) throw new Error(`Browser Agent [${action}] requires a URL.`);
      const prompt = resolvedInputs.prompt ?? resolvedInputs.instructions ?? "";
      ({ output } = await runBrowserActionInE2B(action, url, prompt, e2bLog, tavilyApiKey));
    }
    return { result: output };
  }

  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId: user.id, provider } },
  });

  if (!integration) {
    throw new Error(
      `No "${provider}" integration connected. Go to Settings → Integrations to connect it.`
    );
  }

  const token = integration.accessToken;

  switch (provider) {
    case "x": {
      if (action === "create_tweet") {
        const result = await xService.createTweet(token, resolvedInputs.text ?? "");
        return { result };
      }
      if (action === "send_dm") {
        const result = await xService.sendDM(token, resolvedInputs.recipientId ?? "", resolvedInputs.text ?? "");
        return { result };
      }
      break;
    }

    case "discord": {
      if (action === "send_channel_message") {
        const result = await discordService.sendChannelMessage(token, resolvedInputs.channelId ?? "", resolvedInputs.content ?? "");
        return { result };
      }
      if (action === "send_dm") {
        const result = await discordService.sendDM(token, resolvedInputs.userId ?? "", resolvedInputs.content ?? "");
        return { result };
      }
      break;
    }

    case "slack": {
      if (action === "send_message") {
        const result = await slackService.sendMessage(token, resolvedInputs.channel ?? "", resolvedInputs.text ?? "");
        return { result };
      }
      if (action === "send_dm") {
        const result = await slackService.sendDM(token, resolvedInputs.userId ?? "", resolvedInputs.text ?? "");
        return { result };
      }
      break;
    }

    case "github": {
      if (action === "create_issue") {
        const result = await githubService.createIssue(
          token,
          resolvedInputs.repo ?? "",
          resolvedInputs.title ?? "",
          resolvedInputs.body
        );
        return { result };
      }
      if (action === "create_comment") {
        const result = await githubService.createComment(
          token,
          resolvedInputs.repo ?? "",
          resolvedInputs.issueNumber ?? "",
          resolvedInputs.body ?? ""
        );
        return { result };
      }
      break;
    }

    case "notion": {
      if (action === "create_page") {
        const result = await notionService.createPage(
          token,
          resolvedInputs.databaseId ?? "",
          resolvedInputs.title ?? "",
          resolvedInputs.content
        );
        return { result };
      }
      break;
    }

    case "instagram": {
      if (action === "create_post") {
        const result = await instagramService.createPost(
          token,
          resolvedInputs.imageUrl ?? "",
          resolvedInputs.caption ?? ""
        );
        return { result };
      }
      break;
    }

    case "linkedin": {
      if (action === "create_post") {
        // token stored as JSON: { clientId, clientSecret }
        let clientId = "";
        let clientSecret = token;
        try {
          const parsed = JSON.parse(token);
          clientId = parsed.clientId ?? "";
          clientSecret = parsed.clientSecret ?? token;
        } catch { /* token is plain string — treat as clientSecret */ }
        const result = await linkedinService.createPost(clientId, clientSecret, resolvedInputs.text ?? "");
        return { result };
      }
      break;
    }

    case "medium": {
      if (action === "create_post") {
        const fmt = (resolvedInputs.contentFormat ?? "markdown") as "markdown" | "html";
        const result = await mediumService.createPost(
          token,
          resolvedInputs.title ?? "",
          resolvedInputs.content ?? "",
          fmt
        );
        return { result };
      }
      break;
    }

  }

  throw new Error(`Unknown action "${action}" for provider "${provider}".`);
}
