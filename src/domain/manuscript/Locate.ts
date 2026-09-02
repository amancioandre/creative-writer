/**
 * From a click in rendered text back to the source: the sentence under
 * the click is found in the rendered text, and its opening words are
 * searched for in the raw Markdown of the same block — tolerating the
 * emphasis marks, links and quotes that rendering stripped. The result is
 * a line and column inside the block; the caller adds the block's first
 * line.
 */
export interface Located {
  readonly line: number;
  readonly ch: number;
}

export interface SentenceSpan {
  readonly text: string;
  readonly from: number;
  readonly to: number;
}

const WORD = /[\p{L}\p{N}']+/gu;
const START: Located = { line: 0, ch: 0 };

export function locateInBlock(raw: string, rendered: string, sentences: readonly SentenceSpan[], offset: number): Located {
  const sentence = sentences.find((s) => offset >= s.from && offset < s.to) ?? sentences[sentences.length - 1];
  if (!sentence) return START;
  const words = (sentence.text.match(WORD) ?? []).slice(0, 4);
  if (words.length === 0) return START;
  const pattern = new RegExp(words.map(escape).join("[^\\p{L}\\p{N}]{0,12}"), "iu");
  // The same words may open an earlier sentence, or sit mid-sentence: the words occur in the same order in
  // both texts, so the match wanted in the raw text is the one with as many matches before it as in the rendered text.
  const skip = countMatches(pattern, rendered.slice(0, sentence.from + words[0]!.length));
  let index = -1, from = 0;
  for (let n = 0; n <= skip; n++) {
    const m = pattern.exec(raw.slice(from));
    if (!m) break;
    index = from + m.index;
    from = index + 1;
  }
  if (index < 0) return START;
  const head = raw.slice(0, index);
  const nl = head.lastIndexOf("\n");
  return { line: (head.match(/\n/g) ?? []).length, ch: index - (nl + 1) };
}

/** Matches strictly before the end of `text` — a match that starts inside it but is cut off does not count. */
function countMatches(pattern: RegExp, text: string): number {
  let n = 0, from = 0;
  for (;;) {
    const m = pattern.exec(text.slice(from));
    if (!m) return n;
    n++;
    from += m.index + 1;
  }
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
