import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import { tokenize } from "../Tokenizer";
import { LY_NOT_ADVERB, DIALOGUE_TAGS, STRUCTURAL_ADVERBS } from "../lexicon/adverbExceptions";
import { indexByOffset, type PosTagger } from "../PosTagger";
import { insideQuotes, quoteSpans } from "../Quotes";

/** Pronoun that may sit between a dialogue tag and its adverb: "she told him gently". */
const TAG_OBJECT = /^(him|her|them|me|us|it)$/;

/**
 * -ly manner adverbs. Each one is a place where a stronger verb might do
 * the work. An adverb glued to a dialogue tag ("she said softly") gets a
 * sharper note.
 *
 * Left alone: words in the not-an-adverb list (whatever the tagger says —
 * it mis-tags "bubbly" and "steely"), structural/stance adverbs ("suddenly",
 * "obviously": no verb replaces them), anything inside quoted speech, and
 * capitalised names mid-sentence ("Emily"). With a tagger, remaining words
 * must carry the Adverb tag.
 */
export class AdverbRule implements StyleRule {
  constructor(private readonly tagger?: PosTagger) {}

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger ?? null)): Finding[] {
    const tokens = tokenize(text);
    const tagged = ctx.hasTagger ? indexByOffset(ctx.tagged()) : null;
    const quotes = quoteSpans(text);
    const out: Finding[] = [];
    let sentenceStart = 0;
    tokens.forEach((tok, i) => {
      if (tok.startsSentence) sentenceStart = tokens[i - 1]?.to ?? 0;
      const w = tok.text;
      if (w.length < 5 || !w.endsWith("ly") || /[^a-z]/.test(w)) return;
      if (STRUCTURAL_ADVERBS.has(w) || LY_NOT_ADVERB.has(w)) return;
      if (insideQuotes(quotes, tok.from)) return;
      if (!tok.startsSentence && /\p{Lu}/u.test(text[tok.from]!)) return;
      const isAdverb = tagged ? (tagged.get(tok.from)?.tags.has("Adverb") ?? false) : true;
      if (!isAdverb) return;

      const prevTok = tok.startsSentence ? undefined : tokens[i - 1];
      const prev = prevTok?.text ?? "";
      const between = prevTok ? text.slice(prevTok.to, tok.from) : "";
      // A speech tag needs speech: a quote must close in this sentence before the adverb.
      const quoteInSentence = quotes.some(([, b]) => b >= sentenceStart && b <= tok.from);
      const tagTok = prevTok && TAG_OBJECT.test(prev) ? tokens[i - 2] : prevTok;
      const onTag = quoteInSentence && tagTok !== undefined && DIALOGUE_TAGS.has(tagTok.text);
      const note = onTag
        ? `Adverb on a dialogue tag. Let the line itself carry the "${w}".`
        : prev && !/[,;:—–-]/.test(between)
          ? `Adverb. Is there a verb that already means "${prev} ${w}"?`
          : `Adverb. Is there a verb that already carries "${w}"?`;
      out.push(Finding.create("adverb", tok.from, tok.to, note));
    });
    return out;
  }
}
