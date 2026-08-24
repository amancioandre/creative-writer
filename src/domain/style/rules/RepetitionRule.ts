import { Finding } from "../Finding";
import type { StyleRule } from "../StyleRule";
import { tokenize, looksLikeName, type Token } from "../Tokenizer";
import { STOPWORDS } from "../lexicon/stopwords";

export interface RepetitionOptions {
  /** How many words back to look for an echo. */
  readonly windowWords?: number;
  /** How many consecutive sentences may open with the same word before flagging. */
  readonly maxSameOpeners?: number;
}

/** Openers so ordinary that a run of three is unremarkable; these need a longer run. */
const COMMON_OPENERS = new Set(["the", "a", "an", "i", "it", "there"]);
const COMMON_OPENER_RUN = 4;

/** Crude stemmer: enough to make "wave"/"waves"/"waved"/"waving" and "story"/"stories" collide. */
export function stem(word: string): string {
  let w = word;
  // plural first, so "buildings" → "building" → "build" like "building" does
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("es") && /(s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 3 && w.endsWith("ed") && !w.endsWith("eed")) w = w.slice(0, -2);
  // "running" → "runn" → "run"
  if (w.length > 3 && /([bdfgklmnprstz])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e") && !w.endsWith("ee")) w = w.slice(0, -1);
  return w;
}

export class RepetitionRule implements StyleRule {
  private readonly window: number;
  private readonly maxOpeners: number;

  constructor(options: RepetitionOptions = {}) {
    this.window = options.windowWords ?? 30;
    this.maxOpeners = options.maxSameOpeners ?? 2;
  }

  analyse(text: string): Finding[] {
    const tokens = tokenize(text);
    const openers = this.openers(tokens);
    const taken = new Set(openers.map((f) => f.from));
    return [...this.echoes(text, tokens).filter((f) => !taken.has(f.from)), ...openers];
  }

  private echoes(text: string, tokens: readonly Token[]): Finding[] {
    const out: Finding[] = [];
    const lastSeen = new Map<string, number>();
    tokens.forEach((tok, i) => {
      if (tok.text.length < 4 || STOPWORDS.has(tok.text) || /\d/.test(tok.text)) return;
      // Character names recur; that is not an echo.
      if (looksLikeName(text, tok)) return;
      const key = stem(tok.text);
      const prev = lastSeen.get(key);
      if (prev !== undefined && i - prev <= this.window) {
        const d = i - prev;
        out.push(Finding.create("repetition", tok.from, tok.to, `"${tok.text}" echoes a word ${d} word${d === 1 ? "" : "s"} back.`));
      }
      lastSeen.set(key, i);
    });
    return out;
  }

  private openers(tokens: readonly Token[]): Finding[] {
    const starts = tokens.filter((t) => t.startsSentence && !/\d/.test(t.text));
    const out: Finding[] = [];
    let run = 1;
    for (let i = 1; i < starts.length; i++) {
      const t = starts[i]!;
      if (t.text === starts[i - 1]!.text) {
        run += 1;
        const limit = COMMON_OPENERS.has(t.text) ? Math.max(this.maxOpeners, COMMON_OPENER_RUN) : this.maxOpeners;
        if (run > limit) {
          out.push(Finding.create("repetition", t.from, t.to, `${run} sentences in a row open with "${t.text}". Vary the opening.`));
        }
      } else {
        run = 1;
      }
    }
    return out;
  }
}
