import { describe, it, expect } from "vitest";
import { calculateExecutionCost, formatCost } from "@/lib/utils/tokenCost";

describe("calculateExecutionCost", () => {
  it("returns 0 for zero tokens", () => {
    expect(calculateExecutionCost("gpt-4o", 0, 0)).toBe(0);
  });

  it("calculates gpt-4o correctly ($2.50/1M in, $10/1M out)", () => {
    const cost = calculateExecutionCost("gpt-4o", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(12.5, 4);
  });

  it("calculates claude-sonnet-4-6 correctly ($3/1M in, $15/1M out)", () => {
    const cost = calculateExecutionCost("claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18.0, 4);
  });

  it("uses fallback rate for unknown models", () => {
    const cost = calculateExecutionCost("unknown-model-xyz", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.04, 4); // $0.01 + $0.03 fallback
  });

  it("scales linearly with token count", () => {
    const half = calculateExecutionCost("gpt-4o", 500_000, 0);
    const full = calculateExecutionCost("gpt-4o", 1_000_000, 0);
    expect(full).toBeCloseTo(half * 2, 6);
  });

  it("input and output are priced independently", () => {
    const inputOnly = calculateExecutionCost("gpt-4o", 1_000_000, 0);
    const outputOnly = calculateExecutionCost("gpt-4o", 0, 1_000_000);
    expect(inputOnly).toBeCloseTo(2.5, 4);
    expect(outputOnly).toBeCloseTo(10.0, 4);
  });
});

describe("formatCost", () => {
  it('formats $0 as "$0.00"', () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it('formats tiny values as "<$0.0001"', () => {
    expect(formatCost(0.00001)).toBe("<$0.0001");
  });

  it("formats sub-cent values to 4 decimal places", () => {
    expect(formatCost(0.0042)).toBe("$0.0042");
  });

  it("formats normal values to 2 decimal places", () => {
    expect(formatCost(1.5)).toBe("$1.50");
  });

  it("formats large values correctly", () => {
    expect(formatCost(12.5)).toBe("$12.50");
  });
});
