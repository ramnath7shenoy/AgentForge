export async function sendChannelMessage(
  botToken: string,
  channelId: string,
  content: string
): Promise<string> {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Discord error ${res.status}: ${(err as any).message || res.statusText}`);
  }
  const data = await res.json();
  return `Discord message sent (id: ${data.id})`;
}

export async function sendDM(
  botToken: string,
  userId: string,
  content: string
): Promise<string> {
  // Open a DM channel first
  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!dmRes.ok) {
    const err = await dmRes.json().catch(() => ({}));
    throw new Error(`Discord DM open error ${dmRes.status}: ${(err as any).message || dmRes.statusText}`);
  }
  const dmChannel = await dmRes.json();
  return sendChannelMessage(botToken, dmChannel.id, content);
}
