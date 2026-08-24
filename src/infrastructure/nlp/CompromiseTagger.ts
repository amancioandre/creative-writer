import nlp from "compromise";
import type { PosTagger, TaggedToken } from "../../domain/style/PosTagger";

interface CompromiseTerm {
  text: string;
  normal: string;
  root?: string;
  tags: string[];
  offset: { start: number; length: number };
}

/**
 * compromise does not end a sentence at an ellipsis, so "the office… The
 * office grew" becomes one sentence and "The Office" an organisation. Split
 * on an ellipsis followed by a capital (or an opening quote) before tagging;
 * each chunk is tagged on its own and its offsets shifted back.
 */
const ELLIPSIS_BOUNDARY = /(?:…|\.{3})[”"’')\]]*\s+(?=[\p{Lu}“"‘'])/gu;

export function splitAtEllipses(text: string): Array<{ text: string; offset: number }> {
  const chunks: Array<{ text: string; offset: number }> = [];
  let start = 0;
  for (const m of text.matchAll(ELLIPSIS_BOUNDARY)) {
    const end = m.index + m[0].length;
    chunks.push({ text: text.slice(start, end), offset: start });
    start = end;
  }
  chunks.push({ text: text.slice(start), offset: start });
  return chunks;
}

/**
 * "Silence bruised him." — compromise reads a sentence-initial verb homograph
 * as an imperative. A bare word followed directly by a past-tense verb is a
 * subject, not a command; retag it as a noun.
 */
function fixImperativeSubject(out: TaggedToken[], start: number): void {
  const first = out[start];
  const second = out[start + 1];
  if (!first || !second) return;
  if (!first.tags.has("Verb") || first.tags.has("Auxiliary") || first.tags.has("Copula")) return;
  if (!second.tags.has("Verb") || !second.tags.has("PastTense") || second.tags.has("Auxiliary")) return;
  const tags = new Set(first.tags);
  for (const t of ["Verb", "Imperative", "Infinitive", "PresentTense", "Gerund"]) tags.delete(t);
  tags.add("Noun").add("Singular");
  out[start] = { ...first, tags, lemma: first.normal };
}

/** `compromise` adapter. Pure JS, no WASM; a few milliseconds per paragraph. */
export class CompromiseTagger implements PosTagger {
  tag(text: string): TaggedToken[] {
    if (text.trim().length === 0) return [];
    const out: TaggedToken[] = [];
    let sentence = 0;
    for (const chunk of splitAtEllipses(text)) {
      if (chunk.text.trim().length === 0) continue;
      const doc = nlp(chunk.text);
      doc.compute("root");
      // `root` is produced by compute("root") but missing from compromise's json option typings.
      const jsonOptions = { offset: true, terms: { offset: true, tags: true, normal: true, root: true } } as Parameters<typeof doc.json>[0];
      const sentences = doc.json(jsonOptions) as Array<{ terms: CompromiseTerm[] }>;
      for (const s of sentences) {
        const start = out.length;
        for (const term of s.terms) {
          if (term.offset.length === 0) continue; // compromise emits an empty "Negative" term for n't
          const from = chunk.offset + term.offset.start;
          const to = from + term.offset.length;
          out.push({
            text: text.slice(from, to),
            from,
            to,
            normal: term.normal.toLowerCase(),
            lemma: (term.root || term.normal).toLowerCase(),
            tags: new Set(term.tags),
            sentence,
          });
        }
        fixImperativeSubject(out, start);
        sentence++;
      }
    }
    return out;
  }
}
