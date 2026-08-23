/**
 * Heuristic English syllable counter.
 *
 * Exact syllabification needs a dictionary; for rhythm colouring a cheap
 * estimate is plenty. Rules, in order:
 *   1. Count vowel groups (a, e, i, o, u, y as one run each).
 *   2. A trailing silent "e" does not count ("fire", "queue")…
 *   3. …unless it ends in a consonant + "le" ("table", "little").
 *   4. Any non-empty word has at least one syllable ("rhythm").
 *
 * Known limit: vowel hiatus ("po-et", "cre-ate") is under-counted by one.
 * Acceptable for tier bucketing; not acceptable for a metrics display.
 */
export function estimateSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;

  const vowelGroups = w.match(/[aeiouy]+/g)?.length ?? 0;
  let count = vowelGroups;

  const endsWithSilentE = /[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w);
  if (endsWithSilentE) count -= 1;

  // "queue", "true": a trailing "ue" collapses to the preceding group.
  if (/[^aeiouy]ue$/.test(w)) count -= 1;

  return Math.max(1, count);
}
