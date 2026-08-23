import { Finding } from "../Finding";
import type { StyleRule } from "../StyleRule";
import { tokenize, type Token } from "../Tokenizer";
import { STOPWORDS } from "../lexicon/stopwords";

export interface RepetitionOptions {
  /** How many words back to look for an echo. */
  readonly windowWords?: number;
  /** How many consecutive sentences may open with the same word before flagging. */
  readonly maxSameOpeners?: number;
}

/** Crude stemmer: enough to make "wave"/"waves"/"waved"/"waving" collide. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
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
    return [...this.echoes(tokens), ...this.openers(tokens)];
  }

  private echoes(tokens: readonly Token[]): Finding[] {
    const out: Finding[] = [];
    const lastSeen = new Map<string, number>();
    tokens.forEach((tok, i) => {
      if (tok.text.length < 4 || STOPWORDS.has(tok.text) || /\d/.test(tok.text)) return;
      const key = stem(tok.text);
      const prev = lastSeen.get(key);
      if (prev !== undefined && i - prev <= this.window) {
        out.push(Finding.create("repetition", tok.from, tok.to, `"${tok.text}" echoes a word ${i - prev} words back.`));
      }
      lastSeen.set(key, i);
    });
    return out;
  }

  private openers(tokens: readonly Token[]): Finding[] {
    const starts = tokens.filter((t) => t.startsSentence);
    const out: Finding[] = [];
    let run = 1;
    for (let i = 1; i < starts.length; i++) {
      if (starts[i]!.text === starts[i - 1]!.text) {
        run += 1;
        if (run > this.maxOpeners) {
          const t = starts[i]!;
          out.push(Finding.create("repetition", t.from, t.to, `${run} sentences in a row open with "${t.text}". Vary the opening.`));
        }
      } else {
        run = 1;
      }
    }
    return out;
  }
}
