import type { LineSource } from "./LineSource";

/** Inclusive 0-based line range. */
export interface ParagraphRange {
  readonly firstLine: number;
  readonly lastLine: number;
}

const isBlank = (s: string) => s.trim().length === 0;

/**
 * A paragraph is a maximal run of non-blank lines. Returns null when the
 * cursor line is blank or out of range — there is nothing to analyse.
 */
export function locateParagraph(lines: LineSource, cursorLine: number): ParagraphRange | null {
  if (cursorLine < 0 || cursorLine >= lines.lineCount) return null;
  if (isBlank(lines.lineText(cursorLine))) return null;

  let first = cursorLine;
  while (first > 0 && !isBlank(lines.lineText(first - 1))) first -= 1;

  let last = cursorLine;
  while (last < lines.lineCount - 1 && !isBlank(lines.lineText(last + 1))) last += 1;

  return { firstLine: first, lastLine: last };
}
