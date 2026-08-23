/** A word with its location and whether a sentence boundary precedes it. */
export interface Token {
  /** Lowercased, straight-apostrophe form. */
  readonly text: string;
  readonly from: number;
  readonly to: number;
  readonly startsSentence: boolean;
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*(?:-[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*)*/gu;
const SENTENCE_END = /[.!?…]/;

/**
 * Shared tokenizer for all style rules. Rules match on `text` and report
 * spans using `from`/`to`, so the original casing and punctuation are never
 * lost — findings always map back to exact document offsets.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastEnd = 0;
  let first = true;
  for (const m of text.matchAll(WORD)) {
    const from = m.index!;
    const between = text.slice(lastEnd, from);
    tokens.push({
      text: m[0].toLowerCase().replace(/’/g, "'"),
      from,
      to: from + m[0].length,
      startsSentence: first || SENTENCE_END.test(between),
    });
    lastEnd = from + m[0].length;
    first = false;
  }
  return tokens;
}
