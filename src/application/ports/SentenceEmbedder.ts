/**
 * Sentences to vectors, for the echo finder's semantic tier: two
 * sentences that say the same thing in unrelated words. Implemented over
 * a local model (Ollama's embedding endpoint); faked in tests. Called on
 * command only, never on idle.
 */
export interface SentenceEmbedder {
  readonly name: string;
  /** One vector per text, in order. Vectors need not be normalised. */
  embed(texts: readonly string[], signal: AbortSignal): Promise<number[][]>;
}
