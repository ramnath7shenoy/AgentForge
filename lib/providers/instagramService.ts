export async function createPost(
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.instagram.com/me/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`,
    { method: "POST" }
  );
  const container = await containerRes.json();
  if (!containerRes.ok || !container.id) {
    throw new Error(container.error?.message || "Instagram: failed to create media container.");
  }

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.instagram.com/me/media_publish?creation_id=${container.id}&access_token=${accessToken}`,
    { method: "POST" }
  );
  const published = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(published.error?.message || "Instagram: failed to publish post.");
  }

  return `Post published (id: ${published.id})`;
}
