import type { Sentence } from "./Sentence";
import { estimateSyllables } from "./SyllableEstimator";

/** Everything the rhythm classifier needs to know about one sentence. */
export interface SentenceMetrics {
  readonly wordCount: number;
  readonly syllableCount: number;
  readonly commaCount: number;
  /** Commas per word; 0 when there are no words. */
  readonly commaDensity: number;
}

/**
 * A "word" is a run of unicode letters/digits, optionally joined by
 * apostrophes or hyphens ("don't", "over-think" count once each).
 */
export const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function measureSentence(sentence: Sentence): SentenceMetrics {
  const words = sentence.text.match(WORD_PATTERN) ?? [];
  const wordCount = words.length;
  const syllableCount = words.reduce((sum, w) => sum + estimateSyllables(w), 0);
  const commaCount = (sentence.text.match(/,/g) ?? []).length;

  return {
    wordCount,
    syllableCount,
    commaCount,
    commaDensity: wordCount === 0 ? 0 : commaCount / wordCount,
  };
}
