import { Finding } from "../Finding";
import type { StyleRule } from "../StyleRule";
import { tokenize } from "../Tokenizer";
import { LY_NOT_ADVERB, DIALOGUE_TAGS } from "../lexicon/adverbExceptions";

/**
 * -ly manner adverbs. Not every adverb is a sin, but each one is a place
 * where a stronger verb might do the work. An adverb glued to a dialogue
 * tag ("she said softly") is flagged with a sharper note.
 */
export class AdverbRule implements StyleRule {
  analyse(text: string): Finding[] {
    const tokens = tokenize(text);
    const out: Finding[] = [];
    tokens.forEach((tok, i) => {
      const w = tok.text;
      if (w.length < 5 || !w.endsWith("ly") || LY_NOT_ADVERB.has(w)) return;
      if (/[^a-z]/.test(w)) return;
      const prev = tokens[i - 1]?.text ?? "";
      const note = DIALOGUE_TAGS.has(prev)
        ? `Adverb on a dialogue tag. Let the line itself carry the "${w}".`
        : `Adverb. Is there a verb that already means "${prev} ${w}"?`;
      out.push(Finding.create("adverb", tok.from, tok.to, note));
    });
    return out;
  }
}
