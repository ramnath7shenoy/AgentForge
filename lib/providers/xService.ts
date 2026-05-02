export async function createTweet(accessToken: string, text: string): Promise<string> {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`X API error ${res.status}: ${(err as any).detail || res.statusText}`);
  }
  const data = await res.json();
  return `Tweet posted (id: ${data.data?.id})`;
}

export async function sendDM(accessToken: string, recipientId: string, text: string): Promise<string> {
  const res = await fetch(
    `https://api.twitter.com/2/dm_conversations/with/${recipientId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`X DM error ${res.status}: ${(err as any).detail || res.statusText}`);
  }
  return `DM sent to user ${recipientId}`;
}
