import { WORD_PATTERN } from "../rhythm/SentenceMetrics";

/** Counts the words inside straight or curly double quotes. Unclosed quotes run to the end of the text. */
export function countDialogueWords(text: string): number {
  let inQuote = false;
  let start = 0;
  let words = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const opens = ch === "“" || (ch === '"' && !inQuote);
    const closes = ch === "”" || (ch === '"' && inQuote);
    if (!inQuote && opens) {
      inQuote = true;
      start = i + 1;
    } else if (inQuote && closes) {
      words += countWords(text.slice(start, i));
      inQuote = false;
    }
  }
  if (inQuote) words += countWords(text.slice(start));
  return words;
}

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}
