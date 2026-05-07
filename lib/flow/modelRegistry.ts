// Stable fallback chains per provider + capability.
// First entry is the preferred default; subsequent entries are tried
// automatically when a model returns 404 (not found) or 410 (decommissioned).

type Cap = "text" | "vision";

const CHAINS: Record<string, Record<Cap, readonly string[]>> = {
  gemini: {
    text:   ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    vision: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
  },
  groq: {
    text:   ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"],
    vision: [
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "llama-3.2-11b-vision-instant",
    ],
  },
  openai: {
    text:   ["gpt-4o", "gpt-4-turbo", "gpt-4o-mini"],
    vision: ["gpt-4o", "gpt-4-turbo"],
  },
  anthropic: {
    text:   ["claude-sonnet-4-6", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
    vision: ["claude-sonnet-4-6", "claude-3-5-sonnet-20241022"],
  },
};

/**
 * Returns an ordered list of models to try for the given provider + capability.
 *
 * - If `requested` is already the first entry in the chain, return as-is.
 * - If `requested` appears later in the chain, promote it to front.
 * - If `requested` is not in the chain at all AND `hasImages` is false,
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

/** Plain text-only model lists — drop-in replacement for local MODEL_REGISTRY objects. */
export const MODEL_DEFAULTS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CHAINS).map(([p, caps]) => [p, [...caps.text]])
);
