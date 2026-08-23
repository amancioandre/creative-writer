/**
 * Part-of-speech view of a text. Defined by the domain, implemented in
 * infrastructure (compromise). Rules that accept a tagger must still work
 * without one — the tagger sharpens, it does not enable.
 */
export interface TaggedToken {
  /** Exact slice of the source text. */
  readonly text: string;
  readonly from: number;
  readonly to: number;
  /** Lowercased, punctuation-stripped form. */
  readonly normal: string;
  /** Penn-ish tag names as the tagger reports them: Noun, Verb, Participle, Adverb, Adjective, Copula, Auxiliary… */
  readonly tags: ReadonlySet<string>;
  /** 0-based sentence index. */
  readonly sentence: number;
}

export interface PosTagger {
  tag(text: string): TaggedToken[];
}

/** Index tagged tokens by start offset for O(1) lookup from the plain tokenizer's tokens. */
export function indexByOffset(tokens: readonly TaggedToken[]): Map<number, TaggedToken> {
  const m = new Map<number, TaggedToken>();
  for (const t of tokens) m.set(t.from, t);
  return m;
}
