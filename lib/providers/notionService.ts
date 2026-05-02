const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

export async function createPage(
  accessToken: string,
  databaseId: string,
  title: string,
  content?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    parent: { database_id: databaseId },
    properties: {
      title: { title: [{ type: "text", text: { content: title } }] },
    },
  };

  if (content) {
    body.children = [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content } }] },
      },
    ];
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
