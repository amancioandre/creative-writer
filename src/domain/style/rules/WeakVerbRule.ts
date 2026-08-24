import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import type { PosTagger, TaggedToken } from "../PosTagger";

const COPULAS = new Set(["is", "are", "was", "were", "am", "be", "been", "being", "'s", "'re", "'m"]);
const RELATIVE = new Set(["that", "which", "who", "whom", "whose"]);

const isCopula = (t: TaggedToken) => COPULAS.has(t.normal.replace(/n't$/, "")) || t.lemma === "is" || t.lemma === "be";

/**
 * A long sentence whose only verb is "to be" is a sentence with no engine.
 * Short copula sentences ("The sky was red.") are fine and left alone.
 * The finding sits on the main-clause copula, not one inside a relative
 * clause ("the cat, which was old, was on the mat" → the second "was").
 */
export class WeakVerbRule implements StyleRule {
  constructor(private readonly tagger: PosTagger, private readonly minWords = 14) {}

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger)): Finding[] {
    const bySentence = new Map<number, TaggedToken[]>();
    for (const t of ctx.tagged()) {
      const list = bySentence.get(t.sentence) ?? [];
      list.push(t);
      bySentence.set(t.sentence, list);
    }
    const out: Finding[] = [];
    for (const toks of bySentence.values()) {
      const words = toks.filter((t) => /[\p{L}]/u.test(t.text));
      if (words.length < this.minWords) continue;
      // Halves of a hyphenated compound ("long-haired") are not verbs of the sentence.
      const verbs = words.filter((t, k) => t.tags.has("Verb") && !(k > 0 && text[t.from - 1] === "-"));
      if (verbs.length === 0 || !verbs.every(isCopula)) continue;
      const v = this.mainCopula(words, verbs);
      out.push(Finding.create("weakverb", v.from, v.to, `${words.length} words carried by "${v.text}". Give the sentence a verb that does something.`));
    }
    return out;
  }

  /** The first copula not introduced by a relative pronoun; failing that, the first one. */
  private mainCopula(words: readonly TaggedToken[], verbs: readonly TaggedToken[]): TaggedToken {
    for (const v of verbs) {
      const k = words.indexOf(v);
      let inRelative = false;
      for (let b = k - 1; b >= 0 && b >= k - 6; b--) {
        if (RELATIVE.has(words[b]!.normal)) { inRelative = true; break; }
      }
      if (!inRelative) return v;
    }
    return verbs[0]!;
  }
}
