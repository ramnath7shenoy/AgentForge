/**
 * "Plain English" Evaluator
 * 
 * Instead of raw code, this evaluates natural language-ish conditions 
 * against the current flow data.
 */

export function evaluateNaturalLanguageCondition(
  condition: string, 
  data: any
): boolean {
  const text = condition.toLowerCase().trim();
  if (!text) return false;

  // 1. Simple Keyword Matcher (Conversational)
  if (text === "positive" || text.includes("is positive") || text.includes("good")) {
    const dataStr = JSON.stringify(data).toLowerCase();
    return dataStr.includes("positive") || dataStr.includes("good") || dataStr.includes("success");
  }

  if (text === "negative" || text.includes("is negative") || text.includes("bad")) {
    const dataStr = JSON.stringify(data).toLowerCase();
    return dataStr.includes("negative") || dataStr.includes("bad") || dataStr.includes("error");
  }

  if (text.includes("yes") || text.includes("true")) {
    return !!data;
  }

  if (text.includes("no") || text.includes("false")) {
    return !data;
  }

  // 2. Numeric Heuristics (e.g., "price is over 100")
  const numericMatch = text.match(/(?:is\s+)?(?:over|greater\s+than|more\s+than)\s+(\d+)/);
  if (numericMatch) {
    const threshold = parseFloat(numericMatch[1]);
    const value = extractNumericValue(data);
    return value > threshold;
  }

  const numericUnderMatch = text.match(/(?:is\s+)?(?:under|less\s+than|below)\s+(\d+)/);
  if (numericUnderMatch) {
    const threshold = parseFloat(numericUnderMatch[1]);
    const value = extractNumericValue(data);
    return value < threshold;
  }

  // 3. Simple Contains (e.g., "contains 'urgent'")
  const containsMatch = text.match(/contains\s+['"]?([^'"]+)['"]?/);
  if (containsMatch) {
    const searchTerm = containsMatch[1].toLowerCase();
    return JSON.stringify(data).toLowerCase().includes(searchTerm);
  }

  // 4. Fallback: If it's a valid JS expression (for power users / legacy), try it
  try {
    if (/^[\d\s+\-*/().><=!&|]+$/.test(text)) {
       
      return !!eval(text);
    }
  } catch {
    // ignore
  }

  // 5. Ultimate Fallback: Substring match against data
  return JSON.stringify(data).toLowerCase().includes(text);
}

/**
 * Helper to find a number anywhere in the data structure
 */
function extractNumericValue(data: any): number {
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    const n = parseFloat(data);
    if (!isNaN(n)) return n;
  }
  if (data && typeof data === "object") {
    // Try to find common numeric fields
    const commonFields = ["price", "score", "value", "amount", "count", "total"];
    for (const field of commonFields) {
      if (typeof data[field] === "number") return data[field];
      if (typeof data[field] === "string") {
        const n = parseFloat(data[field]);
        if (!isNaN(n)) return n;
      }
    }
    // Deep search (limit to first level for performance)
    for (const key in data) {
      if (typeof data[key] === "number") return data[key];
    }
  }
  return 0;
}

// Keep the old export name for compatibility if needed, but updated logic
export function evaluateBooleanExpression(expression: string, data: any = {}): boolean {
  return evaluateNaturalLanguageCondition(expression, data);
}
