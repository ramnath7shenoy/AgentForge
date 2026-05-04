import { NextRequest, NextResponse } from "next/server";

interface SearchResult {
  id: number;
  text: string;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  k1 = 1.5,
  b = 0.75
): number {
  const freq = new Map<string, number>();
  for (const t of docTokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  let score = 0;
  const dl = docTokens.length;
  for (const qt of queryTokens) {
    const tf = freq.get(qt) ?? 0;
    if (tf === 0) continue;
    const idf = Math.log(1 + 1); // simplified: treat every term as equally "rare" for now
    const num = tf * (k1 + 1);
    const den = tf + k1 * (1 - b + b * (dl / avgDocLen));
    score += idf * (num / den);
  }
  return score;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = body.query ?? "";
    const chunks: string[] = body.chunks ?? [];
    const topK: number = body.topK ?? 3;

    if (!query.trim() || chunks.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const queryTokens = tokenize(query);
    const tokenizedChunks = chunks.map(tokenize);
    const avgDocLen =
      tokenizedChunks.reduce((s, t) => s + t.length, 0) / tokenizedChunks.length;

    const scored: SearchResult[] = chunks.map((text, i) => ({
      id: i,
      text,
      score: bm25Score(queryTokens, tokenizedChunks[i], avgDocLen),
    }));

    const matches = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter((m) => m.score > 0); // omit zero-relevance chunks

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
