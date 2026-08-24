/**
 * Flesch reading ease and its qualitative bands.
 *
 * The syllable counter behind these numbers is a heuristic, so the score is
 * a relative signal, not a measurement. Callers should show the band, not
 * two decimal places.
 */
export interface ReadabilityInput {
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly syllableCount: number;
}

export function fleschReadingEase({ wordCount, sentenceCount, syllableCount }: ReadabilityInput): number | null {
  if (wordCount === 0 || sentenceCount === 0) return null;
  return 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
}

/** US school grade needed to follow the text comfortably. */
export function fleschKincaidGrade({ wordCount, sentenceCount, syllableCount }: ReadabilityInput): number | null {
  if (wordCount === 0 || sentenceCount === 0) return null;
  return 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
}

export interface Band {
  readonly label: string;
  /** One line a writer can act on. */
  readonly hint: string;
}

/** Wikipedia's Flesch bands, with hints rewritten for fiction rather than technical prose. */
export function readingEaseBand(score: number): Band {
  if (score >= 90) return { label: "Very easy", hint: "Reads like a children's book. Fine for pace; check it isn't thin." };
  if (score >= 80) return { label: "Easy", hint: "Conversational. Most commercial fiction sits here." };
  if (score >= 70) return { label: "Fairly easy", hint: "Clear and quick. A comfortable default for narrative." };
  if (score >= 60) return { label: "Plain", hint: "Plain English. Literary fiction often lands here." };
  if (score >= 50) return { label: "Fairly dense", hint: "Longer sentences or heavier words. Deliberate? Keep it." };
  if (score >= 30) return { label: "Dense", hint: "Demanding. Readers will slow down — make sure that's the point." };
  return { label: "Very dense", hint: "Hard to follow. Split sentences or swap Latinate words for short ones." };
}

/**
 * How much sentence length varies, as the coefficient of variation of the
 * per-sentence word counts. Monotone rhythm is the most common complaint
 * about competent-but-flat prose; this names it.
 */
export function sentenceVariety(sentenceWordCounts: readonly number[]): { cv: number; band: Band } | null {
  const counts = sentenceWordCounts.filter((n) => n > 0);
  if (counts.length < 3) return null;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
  const cv = Math.sqrt(variance) / mean;
  return { cv, band: varietyBand(cv) };
}

export function varietyBand(cv: number): Band {
  if (cv < 0.3) return { label: "Monotone", hint: "Sentences are all about the same length. Break one short, let one run." };
  if (cv < 0.55) return { label: "Steady", hint: "Even rhythm. Good for calm passages; tension usually wants more contrast." };
  if (cv < 0.8) return { label: "Varied", hint: "Healthy mix of short and long. This is where most strong prose sits." };
  return { label: "Dynamic", hint: "Big swings between short and long. Powerful in action; check it isn't choppy." };
}

/** Share of words spoken aloud, from 0 to 1. */
export function dialogueBand(ratio: number): Band {
  if (ratio < 0.15) return { label: "Narration-led", hint: "Little dialogue. Fine for interiority or description; scenes may feel told." };
  if (ratio < 0.45) return { label: "Balanced", hint: "Dialogue and narration share the page." };
  return { label: "Dialogue-led", hint: "Mostly talk. Fast to read; make sure the setting and bodies don't vanish." };
}
