const URL_RE = /^https?:\/\//i;
const GOOGLE_SEARCH_RE = /^https?:\/\/(?:www\.)?google\.[^/]+\/search[?#]/i;

export async function resolveTargetUrl(
  input: string,
  tavilyApiKey: string | null | undefined,
  onLog?: (msg: string) => void,
  forceSearch = false
): Promise<string> {
  const trimmed = input.trim();

  // Google Search URLs are never a valid navigation target — extract the real query and search Tavily
  if (GOOGLE_SEARCH_RE.test(trimmed)) {
    let query = trimmed;
    try {
      query = new URL(trimmed).searchParams.get("q") || trimmed;
    } catch { /* malformed URL — use trimmed as-is */ }
    onLog?.(`🚫 Google Search URL stripped → resolving: "${query.slice(0, 60)}"`);
    return resolveTargetUrl(query, tavilyApiKey, onLog, false);
  }

  // Direct URL passthrough — Tavily not needed
  if (URL_RE.test(trimmed) && !forceSearch) return trimmed;

  // Tavily is strictly required for any search-based resolution
  if (!tavilyApiKey) {
    throw new Error("Error: TAVILY_API_KEY is required for search-based navigation.");
  }

  const query = forceSearch ? `${trimmed}` : trimmed;
  onLog?.(`🔍 Tavily: resolving "${query.slice(0, 60)}"...`);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        max_results: 1,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily returned ${res.status}`);
    }

    const data = await res.json();
    const topUrl: string | undefined = data.results?.[0]?.url;

    if (topUrl) {
      onLog?.(`✅ Tavily resolved → ${topUrl}`);
      return topUrl;
    }

    throw new Error("Tavily returned no results for the given query.");
  } catch (err: any) {
    throw new Error(`Error: TAVILY_API_KEY search failed — ${err.message}`);
  }
}
