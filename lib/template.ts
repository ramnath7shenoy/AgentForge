import { ExecutionContext } from "@/types/flowStoreTypes";

function resolveInString(template: string, context: ExecutionContext): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_, expression: string) => {
    const path = expression.trim().split(".");

    if (path.length === 1) {
      const key = path[0];
      if (key in context.variables) {
        return String(context.variables[key] ?? "");
      }
      if (key in context.nodes) {
        return JSON.stringify(context.nodes[key] ?? "");
      }
      return "";
    }

    const [root, ...rest] = path;

    let base: unknown;
    if (root === "input" || root === "output") {
      base = context.variables[root];
    } else {
      base = context.nodes[root];
    }

    let value: any = base;
    for (const segment of rest) {
      if (value == null) break;
      value = (value as any)[segment];
    }

    return value == null ? "" : String(value);
  });
}

export function resolveTemplates<T>(
  value: T,
  context: ExecutionContext,
): T {
  if (typeof value === "string") {
    return resolveInString(value, context) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplates(item, context)) as T;
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = resolveTemplates(v, context);
    }
    return result as T;
  }

  return value;
}

