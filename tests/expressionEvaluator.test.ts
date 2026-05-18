import { describe, it, expect } from "vitest";
import {
  evaluateNaturalLanguageCondition,
  evaluateBooleanExpression,
} from "@/lib/expressionEvaluator";

describe("evaluateNaturalLanguageCondition", () => {
  // ── Sentiment keywords ────────────────────────────────────────────────
  describe("sentiment matching", () => {
    it('detects "positive" in data', () => {
      expect(evaluateNaturalLanguageCondition("is positive", "the result is positive")).toBe(true);
    });
    it('detects "good" as positive', () => {
      expect(evaluateNaturalLanguageCondition("good", "good result")).toBe(true);
    });
    it('detects "negative" in data', () => {
      expect(evaluateNaturalLanguageCondition("is negative", "this is a bad outcome")).toBe(true);
    });
    it("returns false when sentiment not matched", () => {
      expect(evaluateNaturalLanguageCondition("is positive", "neutral data")).toBe(false);
    });
  });

  // ── Contains ──────────────────────────────────────────────────────────
  describe("contains matching", () => {
    it("matches a substring with contains", () => {
      expect(evaluateNaturalLanguageCondition("contains 'urgent'", "this is urgent")).toBe(true);
    });
    it("matches without quotes", () => {
      expect(evaluateNaturalLanguageCondition("contains error", "an error occurred")).toBe(true);
    });
    it("returns false when substring absent", () => {
      expect(evaluateNaturalLanguageCondition("contains 'urgent'", "everything is fine")).toBe(false);
    });
    it("is case-insensitive", () => {
      expect(evaluateNaturalLanguageCondition("contains URGENT", "this is urgent")).toBe(true);
    });
  });

  // ── Numeric comparisons ───────────────────────────────────────────────
  describe("numeric comparisons", () => {
    it("evaluates over threshold", () => {
      expect(evaluateNaturalLanguageCondition("is over 100", 150)).toBe(true);
    });
    it("fails over threshold when below", () => {
      expect(evaluateNaturalLanguageCondition("is over 100", 50)).toBe(false);
    });
    it("evaluates under threshold", () => {
      expect(evaluateNaturalLanguageCondition("is under 10", 5)).toBe(true);
    });
    it("fails under threshold when above", () => {
      expect(evaluateNaturalLanguageCondition("is under 10", 15)).toBe(false);
    });
    it("evaluates greater than", () => {
      expect(evaluateNaturalLanguageCondition("greater than 50", 99)).toBe(true);
    });
    it("evaluates less than", () => {
      expect(evaluateNaturalLanguageCondition("less than 50", 10)).toBe(true);
    });
  });

  // ── Numeric expression ────────────────────────────────────────────────
  describe("inline numeric expressions", () => {
    it("evaluates 5 > 3 as true", () => {
      expect(evaluateNaturalLanguageCondition("5 > 3", {})).toBe(true);
    });
    it("evaluates 2 > 9 as false", () => {
      expect(evaluateNaturalLanguageCondition("2 > 9", {})).toBe(false);
    });
    it("evaluates 10 == 10 as true", () => {
      expect(evaluateNaturalLanguageCondition("10 == 10", {})).toBe(true);
    });
    it("evaluates 10 != 5 as true", () => {
      expect(evaluateNaturalLanguageCondition("10 != 5", {})).toBe(true);
    });
    it("evaluates 4 >= 4 as true", () => {
      expect(evaluateNaturalLanguageCondition("4 >= 4", {})).toBe(true);
    });
  });

  // ── Fallback ──────────────────────────────────────────────────────────
  describe("fallback substring match", () => {
    it("matches condition string against JSON data", () => {
      expect(evaluateNaturalLanguageCondition("approved", { status: "approved" })).toBe(true);
    });
    it("returns false when no match", () => {
      expect(evaluateNaturalLanguageCondition("rejected", { status: "approved" })).toBe(false);
    });
  });

  // ── Compatibility alias ───────────────────────────────────────────────
  it("evaluateBooleanExpression delegates to the same logic", () => {
    expect(evaluateBooleanExpression("contains hello", "say hello")).toBe(true);
  });

  // ── Edge cases ────────────────────────────────────────────────────────
  it("returns false for empty condition", () => {
    expect(evaluateNaturalLanguageCondition("", "anything")).toBe(false);
  });
  it("handles numeric data in object field", () => {
    expect(evaluateNaturalLanguageCondition("is over 50", { score: 75 })).toBe(true);
  });
});
