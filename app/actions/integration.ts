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
    if (!process.env.E2B_API_KEY) {
      return { result: "Browser Agent requires E2B_API_KEY — add it to your Vercel environment variables." };
    }
    const { runBrowserActionInE2B, runCodeInE2B } = await import("@/lib/sandbox/e2bRunner");
    const logs: string[] = [];
    const e2bLog = (msg: string) => { logs.push(msg); };

    try {
      let output: string;
      if (action === "run_python") {
        ({ output } = await runCodeInE2B(resolvedInputs.prompt ?? "", "python", e2bLog));
      } else if (action === "run_javascript") {
        ({ output } = await runCodeInE2B(resolvedInputs.prompt ?? "", "javascript", e2bLog));
      } else {
        const url = resolvedInputs.url ?? "";
        if (!url) return { result: `Browser Agent [${action}] requires a URL.` };
        const prompt = resolvedInputs.prompt ?? resolvedInputs.instructions ?? "";
        ({ output } = await runBrowserActionInE2B(action, url, prompt, e2bLog, tavilyApiKey));
      }
      return { result: output };
    } catch (err: any) {
      return { result: `Browser Agent error: ${err?.message ?? "Unknown error"}` };
    }
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
          resolvedInputs.parentPageId ?? "",
          resolvedInputs.title ?? "",
          resolvedInputs.content
        );
        return { result };
      }
      if (action === "append_to_page") {
        const result = await notionService.appendToPage(
          token,
          resolvedInputs.pageId ?? "",
          resolvedInputs.content ?? ""
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

    case "youtube": {
      const maxResults = parseInt(resolvedInputs.maxResults || "5", 10) || 5;
      if (action === "search_videos") {
        const q = encodeURIComponent(resolvedInputs.query ?? "");
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&maxResults=${maxResults}&type=video&key=${token}`
        );
        if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json();
        const items = (data.items ?? []).map((item: any) => {
          const s = item.snippet;
          return `• ${s.title} — https://youtube.com/watch?v=${item.id.videoId} (${s.channelTitle})`;
        });
        return { result: items.length > 0 ? items.join("\n") : "No results found." };
      }
      if (action === "get_video_details") {
        const id = encodeURIComponent(resolvedInputs.videoId ?? "");
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${id}&key=${token}`
        );
        if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json();
        const item = data.items?.[0];
        if (!item) return { result: "Video not found." };
        const { title, description, channelTitle } = item.snippet;
        const { viewCount, likeCount } = item.statistics ?? {};
        return {
          result: `Title: ${title}\nChannel: ${channelTitle}\nViews: ${Number(viewCount ?? 0).toLocaleString()}\nLikes: ${Number(likeCount ?? 0).toLocaleString()}\nDescription: ${(description ?? "").slice(0, 300)}${(description ?? "").length > 300 ? "…" : ""}`,
        };
      }
      if (action === "post_comment") {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              snippet: {
                videoId: resolvedInputs.videoId ?? "",
                topLevelComment: { snippet: { textOriginal: resolvedInputs.text ?? "" } },
              },
            }),
          }
        );
        if (!res.ok) throw new Error(`YouTube comment error: ${res.status} — ensure you're using an OAuth token, not an API key.`);
        return { result: "Comment posted successfully." };
      }
      break;
    }

  }

  throw new Error(`Unknown action "${action}" for provider "${provider}".`);
}
