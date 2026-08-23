import { Finding } from "../Finding";
import type { StyleRule } from "../StyleRule";
import { tokenize, type Token } from "../Tokenizer";
import { PhraseMatcher } from "./PhraseMatcher";
import { WEAK_WORDS, type WeakEntry } from "../lexicon/weakWords";

/** Context guards for words that are only weak in some positions. */
const GUARDS: Record<string, (tokens: readonly Token[], start: number, end: number) => boolean> = {
  // "so" is an intensifier only before an adjective-ish word, never as a conjunction.
  so: (t, _s, e) => {
    const next = t[e];
    return next !== undefined && !next.startsSentence && !/^(that|i|he|she|it|we|they|you|the|a|an)$/.test(next.text);
  },
  // "just as", "just then" are temporal, not filler.
  just: (t, _s, e) => !/^(as|then|when|before|after|now)$/.test(t[e]?.text ?? ""),
  // "felt" as a noun ("felt hat") sits before a noun with no object.
  felt: (t, _s, e) => !/^(hat|cloth|tip|pen|boots?)$/.test(t[e]?.text ?? ""),
  // "pretty" as adjective ("a pretty girl") vs hedge ("pretty cold"): guard on preceding article.
  pretty: (t, s) => !/^(a|an|the|very|so)$/.test(t[s - 1]?.text ?? ""),
};

export class WeakWordRule implements StyleRule {
  private readonly matcher: PhraseMatcher<WeakEntry>;

  constructor(entries: readonly WeakEntry[] = WEAK_WORDS) {
    this.matcher = new PhraseMatcher(entries.map((e) => [e.phrase, e] as const));
  }

  analyse(text: string): Finding[] {
    const tokens = tokenize(text);
    const out: Finding[] = [];
    for (const m of this.matcher.findAll(tokens)) {
      const guard = GUARDS[m.value.phrase];
      if (guard && !guard(tokens, m.tokenStart, m.tokenEnd)) continue;
      out.push(Finding.create(m.value.kind, m.from, m.to, m.value.note));
    }
    return out;
  }
}
