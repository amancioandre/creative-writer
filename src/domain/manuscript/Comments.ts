/**
 * The writer's own marks in the text: `%% comments %%` and `==highlights==`.
 * Obsidian hides comments in reading view; the manuscript page can show
 * them as a proofreading layer, list them in reading order, and colour a
 * comment by the tag it opens with — `%% CHECK: was it a coat? %%` — the
 * way code editors colour TODO and FIXME. Tags are only a word and a
 * colour: no state, no store. Deleting the comment resolves it.
 */
export interface TagSpec {
  readonly name: string;
  /** Hex colour. */
  readonly color: string;
}

export const DEFAULT_TAGS: readonly TagSpec[] = [
  { name: "TODO", color: "#d9a621" },
  { name: "FIX", color: "#d64545" },
  { name: "CHECK", color: "#4a8fe2" },
  { name: "IDEA", color: "#3fa66b" },
  { name: "CUT", color: "#8a8a8a" },
];

/** An uppercase word and a colon at the start of a comment. Lowercase "check the gate" is prose, not a tag. */
export const TAG_PATTERN = /^\s*([A-Z][A-Z0-9_-]{1,15}):\s*/;

/** Where a tag opens a comment in Markdown: right after the `%%`. */
export const TAG_IN_COMMENT = /%%\s*([A-Z][A-Z0-9_-]{1,15}):/g;

export function splitTag(text: string): { tag: string | null; body: string } {
  const m = TAG_PATTERN.exec(text);
  return m ? { tag: m[1]!, body: text.slice(m[0].length).trim() } : { tag: null, body: text.trim() };
}

export interface Annotation {
  readonly kind: "comment" | "highlight";
  readonly tag: string | null;
  readonly text: string;
  /** 0-based line and column of the opening marker in the note. */
  readonly line: number;
  readonly ch: number;
}

const COMMENT = /%%([\s\S]*?)%%/g;
const HIGHLIGHT = /==([^=\n][^\n]*?)==/g;

/** Every comment and highlight in a note, in document order; front matter and code fences are not read. */
export function findAnnotations(markdown: string): Annotation[] {
  const skip = skippedRanges(markdown);
  const inSkipped = (i: number) => skip.some(([a, b]) => i >= a && i < b);
  const lineStarts = [0];
  for (let i = 0; i < markdown.length; i++) if (markdown[i] === "\n") lineStarts.push(i + 1);
  const at = (index: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid]! <= index) lo = mid; else hi = mid - 1; }
    return { line: lo, ch: index - lineStarts[lo]! };
  };
  const out: Annotation[] = [];
  const comments: [number, number][] = [];
  for (const m of markdown.matchAll(COMMENT)) {
    if (inSkipped(m.index)) continue;
    comments.push([m.index, m.index + m[0].length]);
    const { tag, body } = splitTag(m[1]!);
    out.push({ kind: "comment", tag, text: body, ...at(m.index) });
  }
  for (const m of markdown.matchAll(HIGHLIGHT)) {
    if (inSkipped(m.index) || comments.some(([a, b]) => m.index >= a && m.index < b)) continue;
    out.push({ kind: "highlight", tag: null, text: m[1]!.trim(), ...at(m.index) });
  }
  return out.sort((a, b) => a.line - b.line || a.ch - b.ch);
}

/** Character ranges of the front matter and of code fences. */
function skippedRanges(markdown: string): [number, number][] {
  const out: [number, number][] = [];
  if (markdown.startsWith("---")) {
    const end = markdown.indexOf("\n---", 3);
    if (end >= 0) out.push([0, end + 4]);
  }
  const fence = /^\s*(```|~~~).*$/gm;
  let open: RegExpExecArray | null = null;
  for (let m = fence.exec(markdown); m; m = fence.exec(markdown)) {
    if (!open) open = m;
    else if (m[1] === open[1]) { out.push([open.index, m.index + m[0].length]); open = null; }
  }
  if (open) out.push([open.index, markdown.length]);
  return out;
}

export function colorOf(tag: string | null, tags: readonly TagSpec[]): string | null {
  return tag ? tags.find((t) => t.name === tag)?.color ?? null : null;
}
