import { tokenize } from "../style/Tokenizer";
import { EntityIndex, normalise } from "./EntityIndex";

/** A name as it occurs in prose — resolved to a known entity or left as a surface form. */
export interface Mention {
  readonly surface: string;
  /** Entity id when resolved; null for an unknown name. */
  readonly entityId: string | null;
  readonly from: number;
  readonly to: number;
}

/**
 * Capitalised words that are not names. Sentence-initial words are never
 * counted unless they resolve to a known entity, so this list only has to
 * cover mid-sentence capitals: pronoun, honorifics, calendar, deities and
 * the words dialogue tags start with after a quote.
 */
const NOT_A_NAME = new Set([
  "i", "i'm", "i'd", "i'll", "i've", "god", "lord", "christ", "jesus", "mr", "mrs", "ms", "dr", "sir", "madam", "lady", "miss", "mister",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "ok", "okay", "tv", "pm", "am", "the", "a", "an", "and", "but", "or", "yes", "no", "oh", "ah", "hey", "well", "then", "now", "so",
  "north", "south", "east", "west", "christmas", "easter", "english", "french", "german", "spanish", "portuguese", "italian", "latin", "greek",
]);

/** "Marta Kovács", "St. Ives", "Mount Doom", "the Grey Tower" (article dropped) — a run of capitalised tokens, optionally joined by a particle. */
const JOINERS = new Set(["of", "de", "da", "do", "di", "van", "von", "der", "den", "la", "le", "del", "the", "y", "e"]);

/**
 * Finds proper-noun mentions in a piece of prose. No tagger: a capital
 * letter mid-sentence is the signal, which is wrong for "I" and for
 * shouted words but right for names nearly all of the time. At sentence
 * start only known entities count — plus `familiar` surface forms
 * (normalised), names already seen mid-sentence elsewhere in the project,
 * so "Zsófi watched." is Zsófi once she has been "as Zsófi always was".
 */
export function findMentions(text: string, index: EntityIndex, familiar: ReadonlySet<string> = new Set()): Mention[] {
  const tokens = tokenize(text);
  const out: Mention[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    const capital = isCapital(text, t.from);
    if (!capital || NOT_A_NAME.has(t.text)) { i++; continue; }
    // Extend across consecutive capitalised tokens (and a particle between two of them).
    let j = i;
    while (j + 1 < tokens.length) {
      const next = tokens[j + 1]!;
      const gap = text.slice(tokens[j]!.to, next.from);
      if (!/^[ \t]$/.test(gap) && !/^\.\s$/.test(gap)) break;
      if (isCapital(text, next.from) && !next.startsSentence && !NOT_A_NAME.has(next.text)) { j++; continue; }
      if (JOINERS.has(next.text) && j + 2 < tokens.length) {
        const after = tokens[j + 2]!;
        const gap2 = text.slice(next.to, after.from);
        if (/^[ \t]$/.test(gap2) && isCapital(text, after.from) && !after.startsSentence) { j += 2; continue; }
      }
      break;
    }
    // Longest span that resolves; else the whole run if it is mid-sentence.
    let chosen: { from: number; to: number; id: string | null } | null = null;
    for (let end = j; end >= i; end--) {
      const surface = text.slice(t.from, tokens[end]!.to);
      const hit = index.resolve(surface);
      if (hit) { chosen = { from: t.from, to: tokens[end]!.to, id: hit.id }; j = end; break; }
      if (familiar.has(normalise(surface))) { chosen = { from: t.from, to: tokens[end]!.to, id: null }; j = end; break; }
    }
    if (!chosen) {
      if (t.startsSentence) { i++; continue; }
      chosen = { from: t.from, to: tokens[j]!.to, id: null };
    }
    // "Braganza's letter" — the possessive is not part of the name.
    const raw = text.slice(chosen.from, chosen.to);
    const surface = raw.replace(/['’ʼ‘]s$/u, "");
    out.push({ surface, entityId: chosen.id, from: chosen.from, to: chosen.from + surface.length });
    i = j + 1;
  }
  return out;
}

function isCapital(text: string, at: number): boolean {
  return /\p{Lu}/u.test(text[at]!);
}

/** Groups unresolved mentions by normalised surface, most frequent first. */
export function unresolvedCounts(mentions: readonly Mention[]): Map<string, { surface: string; count: number }> {
  const counts = new Map<string, { surface: string; count: number }>();
  for (const m of mentions) {
    if (m.entityId) continue;
    const key = normalise(m.surface);
    const cur = counts.get(key);
    if (cur) cur.count++;
    else counts.set(key, { surface: m.surface, count: 1 });
  }
  return new Map([...counts].sort((a, b) => b[1].count - a[1].count));
}
