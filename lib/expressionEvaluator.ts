// Very small, safe-ish boolean expression evaluator for decision nodes.
// Supports comparisons, boolean operators, and numeric literals.

export function evaluateBooleanExpression(expression: string): boolean {
  const sanitized = expression.trim();
  if (!sanitized) return false;

  // Allow only a restricted character set.
  if (!/^[\d\s+\-*/().><=!&|]+$/.test(sanitized)) {
    throw new Error("Expression contains unsupported characters");
  }

  // eslint-disable-next-line no-eval
  const result = eval(sanitized);
  if (typeof result !== "boolean") {
    throw new Error("Expression did not evaluate to a boolean");
  }
  return result;
}

