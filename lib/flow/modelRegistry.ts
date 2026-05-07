// Deep cascading fallback chains — 2026 standards.
// Chains are ordered by preference; executor retries each entry when the
// previous one returns 404 (not found), 410 (decommissioned), or 429 (rate limit).
// Hypothetical future models sit at the front and cascade gracefully to
// known-good models when the API returns STALE status codes.

type Cap = "text" | "vision";

const CHAINS: Record<string, Record<Cap, readonly string[]>> = {
  openai: {
    text: [
      "gpt-5.5-pro",
      "gpt-5.5-instant",
      "gpt-5.0-pro",
      "gpt-4.5-preview",
      "gpt-4o",
    ],
    vision: [
      "gpt-5.5-pro",
      "gpt-5.5-instant",
      "gpt-5.0-pro",
      "gpt-4.5-preview",
      "gpt-4o",
    ],
  },
  gemini: {
    text: [
      "gemini-3.1-pro",
      "gemini-3.1-flash",
      "gemini-3.0-pro",
      "gemini-2.5-flash",
      "gemini-1.5-pro-latest",
    ],
    vision: [
      "gemini-3.1-pro",
      "gemini-3.1-flash",
      "gemini-3.0-pro",
      "gemini-2.5-flash",
      "gemini-1.5-pro-latest",
    ],
  },
  anthropic: {
    text: [
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-opus-4-0",
      "claude-3-5-sonnet-20241022",
    ],
    vision: [
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
    ],
  },
  groq: {
    text: [
      "llama-4-scout-17b",
      "llama-4-instant",
      "llama-3.3-70b-versatile",
      "llama-3.1-405b-reasoning",
      "llama-3.1-8b-instant",
    ],
    vision: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.2-11b-vision-instant",
    ],
  },
};

/**
 * Returns an ordered list of models to try for the given provider + capability.
 *
 * - If `requested` is already the first entry in the chain, return as-is.
 * - If `requested` appears later in the chain, promote it to front.
 * - If `requested` is not in the chain AND `hasImages` is false,
 *   prepend it (user's explicit text model choice tried first).
 * - If `requested` is not in the chain AND `hasImages` is true, ignore it
 *   (don't route a text model through a vision call).
 */
export function resolveModelChain(
  provider: string,
  requested: string | undefined,
  hasImages: boolean
): string[] {
  const cap: Cap = hasImages ? "vision" : "text";
  const chain: string[] = [...(CHAINS[provider as keyof typeof CHAINS]?.[cap] ?? [])];

  if (!requested) return chain.length ? chain : [""];

  const idx = chain.indexOf(requested);
  if (idx === 0) return chain;
  if (idx > 0) { chain.splice(idx, 1); chain.unshift(requested); return chain; }

  // Not in chain
  if (!hasImages) chain.unshift(requested); // prepend for text requests only
  return chain.length ? chain : [requested];
}

/** Plain text-only model lists — used as the outer model loop in executeNode. */
export const MODEL_DEFAULTS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CHAINS).map(([p, caps]) => [p, [...caps.text]])
);
