export type AppProvider = "x" | "slack" | "discord" | "github" | "notion" | "instagram" | "linkedin" | "medium" | "browser" | "reddit" | "mail";

export interface ActionField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  /** When true this field is auto-filled from the upstream node's output — not shown in the sidebar */
  isContent?: boolean;
}

/** Keys that carry the main "content" payload — auto-injected from the upstream node. */
export const CONTENT_FIELD_KEYS = new Set(["text", "content", "body", "caption"]);

export interface AppAction {
  id: string;
  label: string;
  description: string;
  fields: ActionField[];
}

export interface ConnectField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
}

export interface AppDefinition {
  id: AppProvider;
  name: string;
  icon: string;
  color: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  docsUrl: string;
  actions: AppAction[];
  connectFields?: ConnectField[];
}

export const APP_REGISTRY: AppDefinition[] = [
  {
    id: "x",
    name: "X (Twitter)",
    icon: "𝕏",
    color: "#e2e8f0",
    tokenLabel: "Bearer Token",
    tokenPlaceholder: "AAAA…",
    docsUrl: "https://developer.twitter.com/en/docs/authentication/oauth-2-0/bearer-tokens",
    actions: [
      {
        id: "create_tweet",
        label: "Post Tweet",
        description: "Post a new tweet",
        fields: [
          { key: "text", label: "Tweet Text", type: "textarea", placeholder: "What's happening? (max 280 chars)", required: true, isContent: true },
        ],
      },
      {
        id: "send_dm",
        label: "Send DM",
        description: "Send a direct message to a user",
        fields: [
          { key: "recipientId", label: "Recipient User ID", type: "text", placeholder: "User ID (numeric)", required: true },
          { key: "text", label: "Message", type: "textarea", placeholder: "Your message...", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    color: "#a78bfa",
    tokenLabel: "Bot OAuth Token",
    tokenPlaceholder: "xoxb-…",
    docsUrl: "https://api.slack.com/authentication/token-types#bot",
    actions: [
      {
        id: "send_message",
        label: "Send Message",
        description: "Send a message to a channel",
        fields: [
          { key: "channel", label: "Channel", type: "text", placeholder: "#general", required: true },
          { key: "text", label: "Message", type: "textarea", placeholder: "Your message...", required: true, isContent: true },
        ],
      },
      {
        id: "send_dm",
        label: "Send DM",
        description: "Send a direct message to a user",
        fields: [
          { key: "userId", label: "User ID or Email", type: "text", placeholder: "U12345ABC or user@example.com", required: true },
          { key: "text", label: "Message", type: "textarea", placeholder: "Your message...", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    color: "#818cf8",
    tokenLabel: "Bot Token",
    tokenPlaceholder: "MTI…",
    docsUrl: "https://discord.com/developers/docs/topics/oauth2",
    actions: [
      {
        id: "send_channel_message",
        label: "Send Channel Message",
        description: "Send a message to a Discord channel",
        fields: [
          { key: "channelId", label: "Channel ID", type: "text", placeholder: "Paste channel ID from Discord", required: true },
          { key: "content", label: "Message", type: "textarea", placeholder: "Your message...", required: true, isContent: true },
        ],
      },
      {
        id: "send_dm",
        label: "Send DM",
        description: "Send a DM to a Discord user",
        fields: [
          { key: "userId", label: "User ID", type: "text", placeholder: "Discord user ID (numeric)", required: true },
          { key: "content", label: "Message", type: "textarea", placeholder: "Your message...", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    color: "#6e7681",
    tokenLabel: "Personal Access Token",
    tokenPlaceholder: "ghp_…",
    docsUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
    actions: [
      {
        id: "create_issue",
        label: "Create Issue",
        description: "Open a new issue on a repository",
        fields: [
          { key: "repo", label: "Repository", type: "text", placeholder: "owner/repo", required: true },
          { key: "title", label: "Title", type: "text", placeholder: "Issue title", required: true },
          { key: "body", label: "Body", type: "textarea", placeholder: "Issue description...", isContent: true },
        ],
      },
      {
        id: "create_comment",
        label: "Add Comment",
        description: "Add a comment to an issue or pull request",
        fields: [
          { key: "repo", label: "Repository", type: "text", placeholder: "owner/repo", required: true },
          { key: "issueNumber", label: "Issue / PR #", type: "text", placeholder: "42", required: true },
          { key: "body", label: "Comment", type: "textarea", placeholder: "Your comment...", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    icon: "📝",
    color: "#94a3b8",
    tokenLabel: "Integration Token",
    tokenPlaceholder: "secret_…",
    docsUrl: "https://developers.notion.com/docs/create-a-notion-integration",
    actions: [
      {
        id: "create_page",
        label: "Create Page",
        description: "Create a new page in a database",
        fields: [
          { key: "databaseId", label: "Database ID", type: "text", placeholder: "Notion database ID", required: true },
          { key: "title", label: "Title", type: "text", placeholder: "Page title", required: true },
          { key: "content", label: "Content", type: "textarea", placeholder: "Page content...", isContent: true },
        ],
      },
    ],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "#e1306c",
    tokenLabel: "Access Token",
    tokenPlaceholder: "EAA…",
    docsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
    connectFields: [
      { key: "accessToken", label: "Access Token", placeholder: "EAA…", secret: true },
    ],
    actions: [
      {
        id: "create_post",
        label: "Create Post",
        description: "Publish a photo or reel post",
        fields: [
          { key: "imageUrl", label: "Image URL", type: "text", placeholder: "https://…/image.jpg", required: true },
          { key: "caption", label: "Caption", type: "textarea", placeholder: "Post caption…", isContent: true },
        ],
      },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "#0077b5",
    tokenLabel: "Client Secret",
    tokenPlaceholder: "Your LinkedIn Client Secret",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow",
    connectFields: [
      { key: "clientId", label: "Client ID", placeholder: "86abc123…", secret: false },
      { key: "clientSecret", label: "Client Secret", placeholder: "••••••••", secret: true },
    ],
    actions: [
      {
        id: "create_post",
        label: "Create Post",
        description: "Share a text update on your LinkedIn profile",
        fields: [
          { key: "text", label: "Post Text", type: "textarea", placeholder: "Share an update…", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "medium",
    name: "Medium",
    icon: "✍️",
    color: "#292929",
    tokenLabel: "Integration Token",
    tokenPlaceholder: "Your Medium integration token",
    docsUrl: "https://github.com/Medium/medium-api-docs#22-self-issued-access-tokens",
    connectFields: [
      { key: "integrationToken", label: "Integration Token", placeholder: "Your Medium integration token", secret: true },
    ],
    actions: [
      {
        id: "create_post",
        label: "Create Post",
        description: "Publish a new story to Medium",
        fields: [
          { key: "title", label: "Title", type: "text", placeholder: "Post title", required: true },
          { key: "content", label: "Content", type: "textarea", placeholder: "Post content (HTML or Markdown)…", required: true, isContent: true },
          { key: "contentFormat", label: "Format", type: "select", placeholder: "markdown", options: [{ label: "Markdown", value: "markdown" }, { label: "HTML", value: "html" }] },
        ],
      },
    ],
  },
  {
    id: "reddit",
    name: "Reddit",
    icon: "🟠",
    color: "#ff4500",
    tokenLabel: "Client ID",
    tokenPlaceholder: "your_client_id",
    docsUrl: "https://www.reddit.com/prefs/apps",
    connectFields: [
      { key: "clientId", label: "Client ID", placeholder: "your_client_id", secret: false },
      { key: "clientSecret", label: "Client Secret", placeholder: "your_client_secret", secret: true },
      { key: "username", label: "Reddit Username", placeholder: "u/your_username", secret: false },
      { key: "password", label: "Reddit Password", placeholder: "••••••••", secret: true },
    ],
    actions: [
      {
        id: "submit_post",
        label: "Submit Post",
        description: "Submit a text post to a subreddit",
        fields: [
          { key: "subreddit", label: "Subreddit", type: "text", placeholder: "r/technology", required: true },
          { key: "title", label: "Title", type: "text", placeholder: "Post title", required: true },
          { key: "text", label: "Body", type: "textarea", placeholder: "Post body…", isContent: true },
        ],
      },
      {
        id: "add_comment",
        label: "Add Comment",
        description: "Reply to a post or comment",
        fields: [
          { key: "thingId", label: "Post/Comment ID", type: "text", placeholder: "t3_abc123", required: true },
          { key: "text", label: "Comment", type: "textarea", placeholder: "Your comment…", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "mail",
    name: "Email (SMTP)",
    icon: "✉️",
    color: "#6366f1",
    tokenLabel: "SMTP Password",
    tokenPlaceholder: "••••••••",
    docsUrl: "https://support.google.com/mail/answer/185833",
    connectFields: [
      { key: "host", label: "SMTP Host", placeholder: "smtp.gmail.com", secret: false },
      { key: "port", label: "SMTP Port", placeholder: "587", secret: false },
      { key: "user", label: "Email Address", placeholder: "you@example.com", secret: false },
      { key: "pass", label: "Password / App Password", placeholder: "••••••••", secret: true },
    ],
    actions: [
      {
        id: "send_email",
        label: "Send Email",
        description: "Send an email to one or more recipients",
        fields: [
          { key: "to", label: "To", type: "text", placeholder: "recipient@example.com", required: true },
          { key: "subject", label: "Subject", type: "text", placeholder: "Email subject", required: true },
          { key: "body", label: "Body", type: "textarea", placeholder: "Email body…", required: true, isContent: true },
        ],
      },
      {
        id: "send_reply",
        label: "Send Reply",
        description: "Reply to an existing email thread (requires Message-ID)",
        fields: [
          { key: "to", label: "To", type: "text", placeholder: "recipient@example.com", required: true },
          { key: "subject", label: "Subject", type: "text", placeholder: "Re: original subject", required: true },
          { key: "inReplyTo", label: "In-Reply-To Message-ID", type: "text", placeholder: "<messageid@mail.example.com>", required: true },
          { key: "body", label: "Body", type: "textarea", placeholder: "Reply body…", required: true, isContent: true },
        ],
      },
    ],
  },
  {
    id: "browser",
    name: "Browser Agent",
    icon: "🌐",
    color: "#22d3ee",
    tokenLabel: "E2B API Key",
    tokenPlaceholder: "e2b_…",
    docsUrl: "https://e2b.dev/docs",
    actions: [
      {
        id: "browse_and_summarize",
        label: "Browse & Summarize",
        description: "Fetch a URL and extract readable page content",
        fields: [
          { key: "url", label: "URL", type: "text", placeholder: "https://example.com", required: true },
          { key: "prompt", label: "Focus (optional)", type: "text", placeholder: "What to look for on the page" },
        ],
      },
      {
        id: "scrape_page",
        label: "Scrape Page",
        description: "Extract structured data (title, headings, links, paragraphs) from a URL",
        fields: [
          { key: "url", label: "URL", type: "text", placeholder: "https://example.com", required: true },
          { key: "prompt", label: "Instructions", type: "text", placeholder: "Extract product prices and names" },
        ],
      },
      {
        id: "screenshot_page",
        label: "Screenshot Page",
        description: "Capture a full-page screenshot using headless Chromium",
        fields: [
          { key: "url", label: "URL", type: "text", placeholder: "https://example.com", required: true },
        ],
      },
      {
        id: "run_python",
        label: "Run Python",
        description: "Execute arbitrary Python code in an isolated E2B container",
        fields: [
          { key: "prompt", label: "Python Code", type: "textarea", placeholder: "print('Hello from E2B!')", required: true },
        ],
      },
      {
        id: "run_javascript",
        label: "Run JavaScript",
        description: "Execute arbitrary JavaScript (Node.js) in an isolated E2B container",
        fields: [
          { key: "prompt", label: "JavaScript Code", type: "textarea", placeholder: "console.log('Hello from E2B!')", required: true },
        ],
      },
    ],
  },
];

export function getApp(id: string): AppDefinition | undefined {
  return APP_REGISTRY.find((a) => a.id === id);
}

export function getAction(appId: string, actionId: string): AppAction | undefined {
  return getApp(appId)?.actions.find((a) => a.id === actionId);
}
