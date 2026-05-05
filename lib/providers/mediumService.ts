export async function createPost(
  integrationToken: string,
  title: string,
  content: string,
  contentFormat: "markdown" | "html" = "markdown"
): Promise<string> {
  // Resolve the user's Medium ID
  const meRes = await fetch("https://api.medium.com/v1/me", {
    headers: { Authorization: `Bearer ${integrationToken}` },
  });
  if (!meRes.ok) throw new Error("Medium: could not resolve user profile.");
  const me = await meRes.json();
  const userId = me.data?.id;
  if (!userId) throw new Error("Medium: missing user ID in profile response.");

  const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${integrationToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      contentFormat,
      content,
      publishStatus: "public",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.message || "Medium: post failed.");
  return `Post published at ${data.data?.url || "(no url returned)"}`;
}
