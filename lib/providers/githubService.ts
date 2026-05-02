const BASE = "https://api.github.com";

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

export async function createIssue(
  accessToken: string,
  repo: string,
  title: string,
  body?: string
): Promise<string> {
  const res = await fetch(`${BASE}/repos/${repo}/issues`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub error ${res.status}: ${(err as any).message || res.statusText}`);
  }
  const data = await res.json();
  return `Issue #${data.number} created: ${data.html_url}`;
}

export async function createComment(
  accessToken: string,
  repo: string,
  issueNumber: string,
  body: string
): Promise<string> {
  const res = await fetch(`${BASE}/repos/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub error ${res.status}: ${(err as any).message || res.statusText}`);
  }
  const data = await res.json();
  return `Comment added: ${data.html_url}`;
}
