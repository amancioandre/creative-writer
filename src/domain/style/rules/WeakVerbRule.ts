import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import type { PosTagger, TaggedToken } from "../PosTagger";

const COPULAS = new Set(["is", "are", "was", "were", "am", "be", "been", "being"]);

/**
 * A long sentence whose only verb is "to be" is a sentence with no engine.
 * Short copula sentences ("The sky was red.") are fine and left alone.
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
      const verbs = words.filter((t) => t.tags.has("Verb"));
      if (verbs.length === 0 || !verbs.every((v) => COPULAS.has(v.normal))) continue;
      const v = verbs[0]!;
      out.push(Finding.create("weakverb", v.from, v.to, `${words.length} words carried by "${v.text}". Give the sentence a verb that does something.`));
    }
    return out;
  }
}
