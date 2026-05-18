import { describe, it, expect } from "vitest";

// Pure splitting logic extracted from clientExecutor / serverExecutor
function splitItems(raw: string, separator: string): string[] {
  if (separator === "newline") return raw.split("\n").map((s) => s.trim()).filter(Boolean);
  if (separator === "comma") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (separator === "json") { try { return JSON.parse(raw); } catch { return [raw]; } }
  if (separator === "sentence") return raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return [raw];
}

function applyPromptTemplate(template: string, item: string): string {
  return template.replace(/\{item\}/g, item);
}

function formatOutput(results: string[], format: string): string {
  if (format === "json") return JSON.stringify(results, null, 2);
  if (format === "concat") return results.join("\n\n");
  return results.map((r, i) => `${i + 1}. ${r}`).join("\n\n");
}

describe("Parallel Map — item splitting", () => {
  it("splits by newline", () => {
    expect(splitItems("a\nb\nc", "newline")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace from newline-split items", () => {
    expect(splitItems("  a  \n  b  ", "newline")).toEqual(["a", "b"]);
  });

  it("filters empty lines", () => {
    expect(splitItems("a\n\n\nb", "newline")).toEqual(["a", "b"]);
  });

  it("splits by comma", () => {
    expect(splitItems("apple, banana, cherry", "comma")).toEqual(["apple", "banana", "cherry"]);
  });

  it("splits a valid JSON array", () => {
    expect(splitItems('["x","y","z"]', "json")).toEqual(["x", "y", "z"]);
  });

  it("falls back to single item on invalid JSON", () => {
    expect(splitItems("not json", "json")).toEqual(["not json"]);
  });

  it("splits by sentence", () => {
    const items = splitItems("First sentence. Second sentence! Third sentence?", "sentence");
    expect(items).toHaveLength(3);
    expect(items[0]).toBe("First sentence.");
  });

  it("returns empty array for blank input", () => {
    expect(splitItems("", "newline")).toEqual([]);
    expect(splitItems("   ", "newline")).toEqual([]);
  });

  it("treats single item with no separator as length-1 array", () => {
    expect(splitItems("only one item", "newline")).toEqual(["only one item"]);
  });
});

describe("Parallel Map — prompt template", () => {
  it("replaces {item} with the item value", () => {
    expect(applyPromptTemplate("Summarize: {item}", "some text")).toBe("Summarize: some text");
  });

  it("replaces all occurrences of {item}", () => {
    expect(applyPromptTemplate("{item} — process {item}", "foo")).toBe("foo — process foo");
  });

  it("returns template unchanged when no {item} placeholder", () => {
    expect(applyPromptTemplate("Static prompt", "ignored")).toBe("Static prompt");
  });

  it("handles special regex characters in item value", () => {
    expect(applyPromptTemplate("Process: {item}", "foo$bar")).toBe("Process: foo$bar");
  });
});

describe("Parallel Map — output formatting", () => {
  const results = ["result A", "result B", "result C"];

  it("formats as numbered list by default", () => {
    const out = formatOutput(results, "numbered");
    expect(out).toContain("1. result A");
    expect(out).toContain("2. result B");
    expect(out).toContain("3. result C");
  });

  it("formats as JSON array", () => {
    const out = formatOutput(results, "json");
    const parsed = JSON.parse(out);
    expect(parsed).toEqual(results);
  });

  it("formats as concatenated text", () => {
    const out = formatOutput(results, "concat");
    expect(out).toBe("result A\n\nresult B\n\nresult C");
  });

  it("handles empty results array", () => {
    expect(formatOutput([], "numbered")).toBe("");
    expect(formatOutput([], "json")).toBe("[]");
    expect(formatOutput([], "concat")).toBe("");
  });

  it("handles single result", () => {
    const out = formatOutput(["only one"], "numbered");
    expect(out).toBe("1. only one");
  });
});
