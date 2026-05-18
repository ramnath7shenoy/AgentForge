import { describe, it, expect } from "vitest";
import { resolveTemplates } from "@/lib/template";
import type { ExecutionContext } from "@/types/flowStoreTypes";

function ctx(
  nodes: Record<string, any> = {},
  variables: Record<string, any> = {}
): ExecutionContext {
  return { nodes, variables };
}

describe("resolveTemplates", () => {
  // ── Basic node ref ────────────────────────────────────────────────────
  it("resolves {{node-id}} to node payload as JSON", () => {
    const result = resolveTemplates("Result: {{brain-1}}", ctx({
      "brain-1": { type: "text", payload: "hello" },
    }));
    expect(result).toContain("hello");
  });

  it("resolves {{node-id.payload}} to the payload string", () => {
    const result = resolveTemplates("{{brain-1.payload}}", ctx({
      "brain-1": { type: "text", payload: "world" },
    }));
    expect(result).toBe("world");
  });

  // ── Dot-notation subkey ───────────────────────────────────────────────
  it("extracts a nested key via dot notation", () => {
    const result = resolveTemplates("Post: {{gen-1.type}}", ctx({
      "gen-1": { type: "file", payload: "data" },
    }));
    expect(result).toBe("Post: file");
  });

  // ── Variable refs ─────────────────────────────────────────────────────
  it("resolves {{input}} from variables as stringified object", () => {
    // {{input}} with no dot returns String(packet) — use {{input.payload}} for the value
    const result = resolveTemplates("{{input}}", ctx(
      {},
      { input: { type: "text", payload: "test input" } }
    ));
    expect(result).toBe("[object Object]");
  });

  it("resolves {{input.payload}} from variables to the payload string", () => {
    const result = resolveTemplates("Input was: {{input.payload}}", ctx(
      {},
      { input: { type: "text", payload: "test input" } }
    ));
    expect(result).toBe("Input was: test input");
  });

  // ── Missing refs ──────────────────────────────────────────────────────
  it("resolves unknown node ref to empty string", () => {
    const result = resolveTemplates("{{nonexistent}}", ctx());
    expect(result).toBe("");
  });

  it("resolves missing dot-path to empty string", () => {
    const result = resolveTemplates("{{brain-1.missing}}", ctx({
      "brain-1": { type: "text", payload: "hi" },
    }));
    expect(result).toBe("");
  });

  // ── Multiple refs in one string ───────────────────────────────────────
  it("resolves multiple refs in the same string", () => {
    const result = resolveTemplates("{{a.payload}} and {{b.payload}}", ctx({
      a: { type: "text", payload: "foo" },
      b: { type: "text", payload: "bar" },
    }));
    expect(result).toBe("foo and bar");
  });

  // ── Non-string passthrough ────────────────────────────────────────────
  it("passes through numbers unchanged", () => {
    expect(resolveTemplates(42, ctx())).toBe(42);
  });

  it("passes through null unchanged", () => {
    expect(resolveTemplates(null, ctx())).toBeNull();
  });

  // ── Array recursion ───────────────────────────────────────────────────
  it("resolves templates inside arrays", () => {
    const result = resolveTemplates(["Hello {{n.payload}}", "static"], ctx({
      n: { type: "text", payload: "world" },
    }));
    expect(result).toEqual(["Hello world", "static"]);
  });

  // ── Object recursion ─────────────────────────────────────────────────
  it("resolves templates inside nested objects", () => {
    const result = resolveTemplates(
      { message: "Hi {{n.payload}}", count: 1 },
      ctx({ n: { type: "text", payload: "there" } })
    );
    expect(result).toEqual({ message: "Hi there", count: 1 });
  });

  // ── Whitespace in ref ─────────────────────────────────────────────────
  it("handles whitespace around node id", () => {
    const result = resolveTemplates("{{ brain-1 }}", ctx({
      "brain-1": { type: "text", payload: "trimmed" },
    }));
    expect(result).toContain("trimmed");
  });
});
