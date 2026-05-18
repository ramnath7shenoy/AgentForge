const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function contentToBlocks(content: string) {
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
    }));
}

/** Create a sub-page under an existing Notion page (not a database). */
export async function createPage(
  accessToken: string,
  parentPageId: string,
  title: string,
  content?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    parent: { page_id: parentPageId },
    properties: {
      title: { title: [{ type: "text", text: { content: title } }] },
    },
  };

  if (content) {
    body.children = contentToBlocks(content);
  }

  const res = await fetch(`${BASE}/pages`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion error ${res.status}: ${(err as any).message || res.statusText}`);
  }
  const data = await res.json();
  return `Notion page created: ${data.url}`;
}

/** Append paragraph blocks to the end of an existing Notion page. */
export async function appendToPage(
  accessToken: string,
  pageId: string,
  content: string
): Promise<string> {
  const blocks = contentToBlocks(content);
  const res = await fetch(`${BASE}/blocks/${pageId}/children`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify({ children: blocks }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Notion error ${res.status}: ${(err as any).message || res.statusText}`);
  }
  return `Content appended to Notion page.`;
}
