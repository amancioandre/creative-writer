/**
 * A note cut into the blocks Markdown renders separately — paragraphs,
 * headings, lists, quotes, tables, fences, rules — each with the source
 * lines it came from. The manuscript view renders one element per block so
 * a click can be traced back to a line, and a changed note re-renders
 * without touching the rest of the page.
 */
export type BlockKind = "paragraph" | "heading" | "quote" | "callout" | "list" | "table" | "code" | "rule" | "html" | "comment" | "other";

export interface SourceBlock {
  readonly kind: BlockKind;
  /** 0-based line range in the note, inclusive. */
  readonly from: number;
  readonly to: number;
  readonly markdown: string;
  /** Heading level for a heading block, 0 otherwise. */
  readonly heading: number;
  /** The heading's text without its hashes. */
  readonly headingText: string;
}

/** Blocks that carry the story when everything else is stripped away. */
export const PROSE_KINDS: ReadonlySet<BlockKind> = new Set<BlockKind>(["paragraph", "heading", "quote", "rule"]);

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST = /^\s*([-*+]|\d+[.)])\s/;
const TABLE = /^\s*\|/;
const QUOTE = /^\s*>/;
const CALLOUT = /^\s*>\s*\[!/;
const HTML = /^\s*<[a-zA-Z/!]/;

export function splitBlocks(markdown: string): SourceBlock[] {
  const lines = markdown.split("\n");
  const out: SourceBlock[] = [];
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) start = end + 1;
  }

  let buffer: string[] = [];
  let first = -1;
  const push = (kind: BlockKind, from: number, to: number, text: string[]) => {
    const md = text.join("\n");
    if (kind === "heading") {
      const m = HEADING.exec(md)!;
      out.push({ kind, from, to, markdown: md, heading: m[1]!.length, headingText: m[2]! });
    } else out.push({ kind, from, to, markdown: md, heading: 0, headingText: "" });
  };
  const flush = (lastLine: number) => {
    if (buffer.length) push(kindOf(buffer[0]!), first, lastLine, buffer);
    buffer = [];
    first = -1;
  };

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    if (FENCE.test(raw)) {
      flush(i - 1);
      const fence = raw.trim().slice(0, 3);
      let j = i + 1;
      while (j < lines.length && !lines[j]!.trim().startsWith(fence)) j++;
      const end = Math.min(j, lines.length - 1);
      push("code", i, end, lines.slice(i, end + 1));
      i = end;
      continue;
    }
    if (raw.trim().startsWith("%%") && !raw.trim().slice(2).includes("%%")) {
      // A block comment: everything to the closing marker is one hidden block.
      flush(i - 1);
      let j = i + 1;
      while (j < lines.length && !lines[j]!.includes("%%")) j++;
      const end = Math.min(j, lines.length - 1);
      push("comment", i, end, lines.slice(i, end + 1));
      i = end;
      continue;
    }
    if (raw.trim() === "") { flush(i - 1); continue; }
    if (HEADING.test(raw)) { flush(i - 1); push("heading", i, i, [raw]); continue; }
    if (RULE.test(raw) && buffer.length === 0) { push("rule", i, i, [raw]); continue; }
    if (first < 0) first = i;
    buffer.push(raw);
  }
  flush(lines.length - 1);
  return out;
}

function kindOf(firstLine: string): BlockKind {
  if (CALLOUT.test(firstLine)) return "callout";
  if (QUOTE.test(firstLine)) return "quote";
  if (LIST.test(firstLine)) return "list";
  if (TABLE.test(firstLine)) return "table";
  if (HTML.test(firstLine)) return "html";
  if (firstLine.trim().startsWith("%%")) return "comment";
  return "paragraph";
}
