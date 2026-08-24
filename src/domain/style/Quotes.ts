/**
 * Spans of quoted speech in a paragraph. Straight double quotes pair up in
 * order; curly quotes pair “ with ”. An unclosed quote runs to the end of
 * the text. Rules use this to leave a character's voice alone.
 */
export function quoteSpans(text: string): ReadonlyArray<readonly [number, number]> {
  const spans: Array<readonly [number, number]> = [];
  let open: number | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "“" || (c === '"' && open === null)) {
      if (open === null) open = i;
    } else if (c === "”" || (c === '"' && open !== null)) {
      if (open !== null) {
        spans.push([open, i + 1]);
        open = null;
      }
    }
  }
  if (open !== null) spans.push([open, text.length]);
  return spans;
}

export function insideQuotes(spans: ReadonlyArray<readonly [number, number]>, pos: number): boolean {
  return spans.some(([a, b]) => pos > a && pos < b);
}
