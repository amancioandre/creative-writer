/**
 * How concrete a word is, 1 (abstract: "justice") to 5 (concrete: "knife").
 * Domain-defined port; infrastructure supplies the norms.
 */
export interface Concreteness {
  /** Null when the word (and its likely lemma) is unknown. */
  score(word: string): number | null;
}
