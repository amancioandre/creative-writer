/**
 * How long the manuscript takes to read, from its word count and an average
 * reading speed. Adults read prose silently at roughly 200–300 words a
 * minute (Brysbaert, 2019, puts the mean near 240 for non-fiction and a
 * little higher for fiction); 250 is the round figure the plugin starts
 * from, and the writer can set their own.
 */
export const DEFAULT_READING_SPEED = 250;
export const MIN_READING_SPEED = 100;
export const MAX_READING_SPEED = 600;

/** Whole minutes at the given speed; never below one for any text at all. */
export function readingMinutes(words: number, wordsPerMinute: number = DEFAULT_READING_SPEED): number {
  if (words <= 0 || !Number.isFinite(words)) return 0;
  const wpm = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : DEFAULT_READING_SPEED;
  return Math.max(1, Math.round(words / wpm));
}

/**
 * The estimate as it reads on the page: `under a minute`, `12 min`, `2 h`,
 * `2 h 15 min`. Empty for no words at all.
 */
export function formatReadingTime(words: number, wordsPerMinute: number = DEFAULT_READING_SPEED): string {
  if (words <= 0 || !Number.isFinite(words)) return "";
  const wpm = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : DEFAULT_READING_SPEED;
  if (words / wpm < 0.5) return "under a minute";
  const minutes = readingMinutes(words, wpm);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
