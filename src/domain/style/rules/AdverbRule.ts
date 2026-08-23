import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import { tokenize } from "../Tokenizer";
import { LY_NOT_ADVERB, DIALOGUE_TAGS, STRUCTURAL_ADVERBS } from "../lexicon/adverbExceptions";
import { indexByOffset, type PosTagger } from "../PosTagger";

/**
 * -ly manner adverbs. Each one is a place where a stronger verb might do
 * the work. An adverb glued to a dialogue tag ("she said softly") gets a
 * sharper note.
 *
 * With a tagger, "is this an adverb?" comes from the tag and only the
 * structural-adverb allowlist remains; without one, a non-adverb list
 * stands in for the tag.
 */
export class AdverbRule implements StyleRule {
  constructor(private readonly tagger?: PosTagger) {}

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger ?? null)): Finding[] {
    const tokens = tokenize(text);
    const tagged = ctx.hasTagger ? indexByOffset(ctx.tagged()) : null;
    const out: Finding[] = [];
    tokens.forEach((tok, i) => {
      const w = tok.text;
      if (w.length < 5 || !w.endsWith("ly") || /[^a-z]/.test(w)) return;
      if (STRUCTURAL_ADVERBS.has(w)) return;
      const isAdverb = tagged ? (tagged.get(tok.from)?.tags.has("Adverb") ?? false) : !LY_NOT_ADVERB.has(w);
      if (!isAdverb) return;
      const prev = tokens[i - 1]?.text ?? "";
      const note = DIALOGUE_TAGS.has(prev)
        ? `Adverb on a dialogue tag. Let the line itself carry the "${w}".`
        : `Adverb. Is there a verb that already means "${prev} ${w}"?`;
      out.push(Finding.create("adverb", tok.from, tok.to, note));
    });
    return out;
  }
}
