export function describeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;

  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === "string") parts.push(obj.message);
    if (typeof obj.details === "string") parts.push(obj.details);
    if (typeof obj.hint === "string") parts.push(`hint: ${obj.hint}`);
    if (typeof obj.code === "string") parts.push(`(code ${obj.code})`);
    if (parts.length) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
