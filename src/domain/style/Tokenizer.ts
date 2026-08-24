/** A word with its location and whether a sentence boundary precedes it. */
export interface Token {
  /** Lowercased, straight-apostrophe form. */
  readonly text: string;
  readonly from: number;
  readonly to: number;
  readonly startsSentence: boolean;
}

const APOS = "['’ʼ‘]";
const WORD = new RegExp(`[\\p{L}\\p{M}\\p{N}]+(?:${APOS}[\\p{L}\\p{M}\\p{N}]+)*(?:-[\\p{L}\\p{M}\\p{N}]+(?:${APOS}[\\p{L}\\p{M}\\p{N}]+)*)*`, "gu");
const SENTENCE_END = /[.!?…]|\n/;
/** "Mr. Smith", "St. Ives" — a period after these is not a full stop. */
const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "st", "prof", "sr", "jr", "vs", "etc", "mt", "no", "gen", "col", "capt", "lt", "sgt", "rev", "hon"]);

function boundary(between: string, prev: string, next: string): boolean {
  if (!SENTENCE_END.test(between)) return false;
  // "3.5", "10.000" — a period between digits.
  if (between === "." && /\p{N}$/u.test(prev) && /^\p{N}/u.test(next)) return false;
  // "Mr. Smith" — abbreviation followed only by a period and space.
  if (/^\.\s*$/.test(between) && ABBREVIATIONS.has(prev)) return false;
  return true;
}

/**
 * Shared tokenizer for all style rules. Rules match on `text` and report
 * spans using `from`/`to`, so the original casing and punctuation are never
 * lost — findings always map back to exact document offsets.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let lastEnd = 0;
  let prevText = "";
  let first = true;
  for (const m of text.matchAll(WORD)) {
    const from = m.index;
    const between = text.slice(lastEnd, from);
    const lower = m[0].toLowerCase().replace(/[’ʼ‘]/g, "'");
    tokens.push({
      text: lower,
      from,
      to: from + m[0].length,
      startsSentence: first || boundary(between, prevText, lower),
    });
    lastEnd = from + m[0].length;
    prevText = lower;
    first = false;
  }
  return tokens;
}

/** True when the token's first letter is uppercase mid-sentence — a name, most of the time. */
export function looksLikeName(text: string, tok: Token): boolean {
  return !tok.startsSentence && /\p{Lu}/u.test(text[tok.from]!);
}
