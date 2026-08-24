/**
 * The paragraphs of a markdown document that are actually prose: headings,
 * list items, block quotes' markers, code fences, tables, front matter and
 * inline markup are not the writer's sentences and would skew every metric.
 */
export interface ProseParagraph {
  readonly text: string;
  /** 0-based line range in the source, inclusive. */
  readonly firstLine: number;
  readonly lastLine: number;
}

const FENCE = /^\s*(```|~~~)/;
const SKIP_LINE = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||[-*_]{3,}\s*$)/;

export function proseParagraphs(markdown: string): ProseParagraph[] {
  const lines = markdown.split("\n");
  const out: ProseParagraph[] = [];
  let inFence = false;
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) start = end + 1;
  }

  let buffer: string[] = [];
  let first = -1;
  const flush = (lastLine: number) => {
    if (buffer.length) out.push({ text: buffer.join("\n"), firstLine: first, lastLine });
    buffer = [];
    first = -1;
  };

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]!;
    if (FENCE.test(raw)) {
      inFence = !inFence;
      flush(i - 1);
      continue;
    }
    if (inFence || raw.trim() === "" || SKIP_LINE.test(raw)) {
      flush(i - 1);
      continue;
    }
    const clean = stripInlineMarkup(raw.replace(/^\s*>\s?/, ""));
    if (first < 0) first = i;
    buffer.push(clean);
  }
  flush(lines.length - 1);
  return out;
}

/** Removes emphasis, links, inline code and comments; keeps the visible words. */
export function stripInlineMarkup(line: string): string {
  return line
    .replace(/%%.*?%%/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|]*)\|?([^\]]*)\]\]/g, (_m, target: string, alias: string) => alias || target)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~=]{1,3}/g, "");
}
