import { Sentence } from "./Sentence";

/**
 * ICU's sentence breaker (UAX #29) knows "e.g." but happily splits after
 * "Mr." — intolerable in fiction. This pass re-joins a segment whose last
 * token is a known abbreviation with the segment that follows it.
 */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "mx", "dr", "prof", "sr", "jr", "st", "mt", "rev", "gen", "col", "lt", "sgt", "capt",
  "vs", "etc", "no", "fig", "vol", "ch", "p", "pp", "approx", "dept", "est", "inc", "ltd", "co",
  "sra", "sr", "dra", "srta", "av", "ex", // common Portuguese/Spanish
]);

const TRAILING_ABBREVIATION = /(?:^|[\s(“"'])([\p{L}]{1,6})\.\s*$/u;

function endsWithAbbreviation(text: string): boolean {
  const m = TRAILING_ABBREVIATION.exec(text);
  return m !== null && ABBREVIATIONS.has(m[1]!.toLowerCase());
}

export function mergeAbbreviationSplits(sentences: readonly Sentence[]): Sentence[] {
  const out: Sentence[] = [];
  for (const current of sentences) {
    const prev = out[out.length - 1];
    if (prev && endsWithAbbreviation(prev.text) && prev.to === current.from) {
      out[out.length - 1] = Sentence.create(prev.text + current.text, prev.from, current.to);
    } else {
      out.push(current);
    }
  }
  return out;
}
