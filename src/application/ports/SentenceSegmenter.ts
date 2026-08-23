import type { Sentence } from "../../domain/rhythm/Sentence";

/**
 * Splits a paragraph's text into sentences with offsets relative to that text.
 * Implemented in infrastructure (Intl.Segmenter); faked in tests.
 */
export interface SentenceSegmenter {
  segment(text: string): Sentence[];
}
