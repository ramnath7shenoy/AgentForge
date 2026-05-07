// Token cost calculator — pricing per 1M tokens (input / output).
// Hypothetical 2026 models use forward-projected rates; real models use current pricing.

const PRICING: Record<string, [number, number]> = {
  // ── OpenAI ─────────────────────────────────────────────────────────
  "gpt-5.5-pro":              [30.00, 180.00],
  "gpt-5.5-instant":          [2.00,   8.00],
  "gpt-5.0-pro":              [10.00, 40.00],
  "gpt-4.5-preview":          [75.00, 150.00],
  "gpt-4o":                   [2.50,  10.00],
  "gpt-4o-mini":              [0.15,   0.60],
  "gpt-4-turbo":              [10.00, 30.00],
  "gpt-4":                    [30.00, 60.00],
  // ── Google Gemini ───────────────────────────────────────────────────
  "gemini-3.1-pro":           [1.25,   6.50],
  "gemini-3.1-flash":         [0.30,   2.50],
  "gemini-3.0-pro":           [7.00,  21.00],
  "gemini-2.5-flash":         [0.15,   0.60],
  "gemini-2.0-flash":         [0.10,   0.40],
  "gemini-1.5-pro":           [1.25,   5.00],
  "gemini-1.5-pro-latest":    [1.25,   5.00],
  "gemini-1.5-flash":         [0.075,  0.30],
  // ── Anthropic ───────────────────────────────────────────────────────
  "claude-opus-4-7":             [5.00,  25.00],
  "claude-sonnet-4-6":           [3.00,  15.00],
  "claude-haiku-4-5":            [0.25,   1.25],
  "claude-haiku-4-5-20251001":   [0.25,   1.25],
  "claude-opus-4-0":             [15.00, 75.00],
  "claude-3-5-sonnet-20241022":  [3.00,  15.00],
  "claude-3-haiku-20240307":     [0.25,   1.25],
  // ── Groq / Meta ─────────────────────────────────────────────────────
  "llama-4-scout-17b":                              [0.125, 0.75],
  "meta-llama/llama-4-scout-17b-16e-instruct":      [0.125, 0.75],
  "llama-4-instant":                                [0.05, 0.15],
  "llama-3.3-70b-versatile":                        [0.59, 0.79],
  "llama-3.1-405b-reasoning":                       [2.00, 3.00],
  "llama-3.1-8b-instant":                           [0.05, 0.08],
  "meta-llama/llama-4-maverick-17b-128e-instruct":  [0.20, 0.60],
  "llama-3.2-11b-vision-instant":                   [0.18, 0.18],
  "mixtral-8x7b-32768":                             [0.24, 0.24],
};

const FALLBACK_RATE: [number, number] = [0.01, 0.03];

export function calculateExecutionCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const [inRate, outRate] = PRICING[model] ?? FALLBACK_RATE;
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
