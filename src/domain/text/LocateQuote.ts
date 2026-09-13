/**
 * Finding a quoted passage in prose loosely: case, curly quotes and
 * whitespace runs are normalised on both sides, and the match is mapped
 * back to offsets in the original text. Model findings, fact evidence and
 * the writer's thread anchors all rely on it, because a quote is the one
 * thing everybody is good at and character arithmetic is not.
 */
export interface Normalised {
  readonly text: string;
  /** normalised index → original index */
  readonly map: number[];
}

/** Lowercase, straighten quotes, collapse whitespace — keeping a map back to original offsets. */
export function normalise(s: string): Normalised {
  let text = "";
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < s.length; i++) {
    let ch = s[i]!.toLowerCase();
    if (ch === "‘" || ch === "’") ch = "'";
    else if (ch === "“" || ch === "”") ch = '"';
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = " ";
      lastSpace = true;
    } else {
      lastSpace = false;
    }
    text += ch;
    map.push(i);
  }
  if (text.endsWith(" ")) {
    map.pop();
  }
  return { text: text.trimEnd(), map };
}

/** Find `needle` in the normalised haystack; prefer the occurrence nearest `hint` (an original-offset guess). */
export function locate(hay: Normalised, needle: string, hint: number | undefined): [number, number] | null {
  const n = needle.trim();
  if (!n) return null;
  const occurrences: number[] = [];
  for (let i = hay.text.indexOf(n); i !== -1; i = hay.text.indexOf(n, i + 1)) occurrences.push(i);
  if (occurrences.length === 0) return null;
  let best = occurrences[0]!;
  if (hint !== undefined && occurrences.length > 1) {
    best = occurrences.reduce((a, b) => (Math.abs(hay.map[b]! - hint) < Math.abs(hay.map[a]! - hint) ? b : a));
  }
  const from = hay.map[best]!;
  const to = hay.map[best + n.length - 1]! + 1;
  return [from, to];
}

/** Does `quote` occur in `text`, ignoring case, curly quotes and whitespace runs? */
export function quoteAppears(text: string, quote: string): boolean {
  return locate(normalise(text), normalise(quote).text, undefined) !== null;
}

/** Where `quote` occurs in `text`, as original offsets; null when it does not. */
export function locateQuote(text: string, quote: string): [number, number] | null {
  return locate(normalise(text), normalise(quote).text, undefined);
}
