import type { Sentence } from "./Sentence";
import { measureSentence, type SentenceMetrics } from "./SentenceMetrics";
import type { RhythmScale } from "./RhythmScale";

/**
 * Effective length is the reader's sense of how "long" a sentence feels,
 * not just the word count:
 *   - every word is one beat;
 *   - every comma introduces a clause boundary, which reads as extra weight;
 *   - words beyond ~1.5 syllables on average add half a beat each, because a
 *     polysyllabic sentence takes longer to say than its word count suggests.
 */
export function effectiveLength(m: SentenceMetrics): number {
  const polysyllabicSurplus = Math.max(0, m.syllableCount - m.wordCount * 1.5);
  return m.wordCount + m.commaCount + polysyllabicSurplus * 0.5;
}

/** Returns a 1-based tier in `1..scale.tierCount`. */
export function classifyRhythm(sentence: Sentence, scale: RhythmScale): number {
  if (sentence.isBlank) return 1;
  return scale.tierFor(effectiveLength(measureSentence(sentence)));
}
