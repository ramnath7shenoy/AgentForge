async function postMessage(accessToken: string, channel: string, text: string): Promise<string> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return `Message sent to ${channel}`;
}

export async function sendMessage(accessToken: string, channel: string, text: string): Promise<string> {
  return postMessage(accessToken, channel, text);
}

export async function sendDM(accessToken: string, userId: string, text: string): Promise<string> {
  const openRes = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users: userId }),
  });
  const openData = await openRes.json();
  if (!openData.ok) throw new Error(`Slack open DM error: ${openData.error}`);
  return postMessage(accessToken, openData.channel.id, text);
}
