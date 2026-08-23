import nlp from "compromise";
import type { PosTagger, TaggedToken } from "../../domain/style/PosTagger";

interface CompromiseTerm {
  text: string;
  normal: string;
  tags: string[];
  offset: { start: number; length: number };
}

/** `compromise` adapter. Pure JS, no WASM; a few milliseconds per paragraph. */
export class CompromiseTagger implements PosTagger {
  tag(text: string): TaggedToken[] {
    if (text.trim().length === 0) return [];
    const sentences = nlp(text).json({ offset: true, terms: { offset: true, tags: true, normal: true } }) as Array<{ terms: CompromiseTerm[] }>;
    const out: TaggedToken[] = [];
    sentences.forEach((s, sentence) => {
      for (const term of s.terms) {
        if (term.offset.length === 0) continue; // compromise emits an empty "Negative" term for n't
        const from = term.offset.start;
        const to = from + term.offset.length;
        out.push({
          text: text.slice(from, to),
          from,
          to,
          normal: term.normal.toLowerCase(),
          tags: new Set(term.tags),
          sentence,
        });
      }
    });
    return out;
  }
}
