import { proseParagraphs } from "./ProseParagraphs";

/** A heading and everything under it until the next heading of any level. */
export interface Scene {
  readonly title: string;
  readonly level: number;
  /** 0-based line of the heading; text before the first heading has line 0 and level 0. */
  readonly line: number;
  /** The section's prose paragraphs joined, markup stripped. */
  readonly prose: string;
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Splits a note into scenes at its headings. Front matter and code fences are respected via `proseParagraphs`. */
export function splitScenes(markdown: string): Scene[] {
  const lines = markdown.split("\n");
  const paragraphs = proseParagraphs(markdown);
  const headings: { title: string; level: number; line: number }[] = [];
  let inFence = false;
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) start = end + 1;
  }
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    if (/^\s*(```|~~~)/.test(raw)) inFence = !inFence;
    if (inFence) continue;
    const m = HEADING.exec(raw);
    if (m) headings.push({ title: m[2]!, level: m[1]!.length, line: i });
  }

  const scenes: Scene[] = [];
  const bounds = [{ title: "", level: 0, line: 0 }, ...headings];
  for (let h = 0; h < bounds.length; h++) {
    const from = bounds[h]!.line;
    const to = h + 1 < bounds.length ? bounds[h + 1]!.line : Number.POSITIVE_INFINITY;
    const prose = paragraphs
      .filter((p) => p.firstLine >= from && p.firstLine < to)
      .map((p) => p.text)
      .join("\n\n");
    if (h === 0 && prose.trim() === "") continue;
    scenes.push({ ...bounds[h]!, prose });
  }
  return scenes;
}
