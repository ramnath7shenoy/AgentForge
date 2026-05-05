export async function createPost(
  clientId: string,
  clientSecret: string,
  text: string
): Promise<string> {
  // LinkedIn's Share API requires an OAuth access token (user-delegated).
  // clientId + clientSecret are app credentials used to obtain the token via
  // the Authorization Code flow. This stub assumes an access token has already
  // been obtained and is passed as clientSecret for now.
  const token = clientSecret;

  // Resolve the author URN (member ID)
  const meRes = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) throw new Error("LinkedIn: could not resolve member profile.");
  const me = await meRes.json();
  const authorUrn = `urn:li:person:${me.id}`;

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "LinkedIn: post failed.");
  return `Post published (id: ${data.id})`;
}
