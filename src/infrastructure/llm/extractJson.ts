/**
 * Models wrap JSON in prose, code fences or <think> blocks despite
 * instructions. Find the outermost object and parse it; null if none.
 */
export function extractJson(content: string): unknown {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}
