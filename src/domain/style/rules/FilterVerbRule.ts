import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import { tokenize, type Token } from "../Tokenizer";
import { PhraseMatcher } from "./PhraseMatcher";
import { FILTER_VERBS, type FilterEntry } from "../lexicon/filterVerbs";
import { indexByOffset, type PosTagger } from "../PosTagger";
import { insideQuotes, quoteSpans } from "../Quotes";

type Guard = (tokens: readonly Token[], start: number, end: number) => boolean;
const prevIs = (t: readonly Token[], s: number, re: RegExp) => re.test(t[s - 1]?.text ?? "");
const nextIs = (t: readonly Token[], e: number, re: RegExp) => re.test(t[e]?.text ?? "");
const atSentenceEnd = (t: readonly Token[], e: number) => t[e] === undefined || t[e].startsSentence;

/** "the felt", "a thought", "of feeling": a noun, not a verb. */
const NOUN_SLOT = /^(the|a|an|of|my|his|her|their|our|your|its|this|that|every|no|any|second|for|made)$/;
/** "was decided", "were watched", "once decided": passive or attributive participle, not a filter. */
const PASSIVE_SLOT = /^(was|were|is|are|been|being|once|be|get|got)$/;
/** "smelled of", "heard from", "felt for", "seemed to", "listened to": linking or idiomatic, not filtering. */
const LINKING_NEXT = /^(of|from|for|to|like|about)$/;
/** "knew" filters a clause, not a thing: "knew that…", "knew she…". "He knew the town" is fine. */
const CLAUSE_START = /^(that|he|she|it|they|we|i|you|there|what|how|why|where|when|whether|if|nothing|something|everything|better|then)$/;

const GUARDS: Record<string, Guard> = {
  felt: (t, s, e) => !prevIs(t, s, NOUN_SLOT) && !nextIs(t, e, /^(hat|cloth|tip|pen|boots?|lining|slippers?|marker)$/),
  see: (t, s, e) => !nextIs(t, e, /^(you|page|below|above|also|chapter|note|fig|figure)$/) && !atSentenceEnd(t, e) && !prevIs(t, s, /^(let's|and|you|i|wait)$/),
  feel: (t, s, e) => !nextIs(t, e, /^(free|like)$/) && !t[s]!.startsSentence && !prevIs(t, s, /^(you|do|how)$/),
  saw: (t, s, e) => !prevIs(t, s, /^(the|a|an|chain|hand|band|circular|table)$/) && !nextIs(t, e, /^(to|it|in|heavy|action|service|use|off)$/),
  knew: (t, _s, e) => nextIs(t, e, CLAUSE_START),
  knows: (t, _s, e) => nextIs(t, e, CLAUSE_START),
  heard: (t, s) => !prevIs(t, s, /^(you|have|had|has|ever|never)$/),
  listened: (t, _s, e) => !nextIs(t, e, /^(to|for|in)$/),
  observed: (t, _s, e) => !nextIs(t, e, /^(the|a|an)$/) || true,
  // "realised profits", "realised his dream" — achieve, not notice.
  realized: (t, _s, e) => !nextIs(t, e, /^(profits?|gains?|assets?|losses?|value)$/) && !(nextIs(t, e, /^(his|her|their|my|our|a|the)$/) && /^(dreams?|ambitions?|potential|goals?|visions?|profit|gains?)$/.test(t[e + 1]?.text ?? "")),
  realised: (t, _s, e) => !nextIs(t, e, /^(profits?|gains?|assets?|losses?|value)$/) && !(nextIs(t, e, /^(his|her|their|my|our|a|the)$/) && /^(dreams?|ambitions?|potential|goals?|visions?|profit|gains?)$/.test(t[e + 1]?.text ?? "")),
  recalled: (t, _s, e) => !nextIs(t, e, /^(the|a|an|to)$/),
  decided: (t, _s, e) => !prevIs(t, e - 1, /^once$/),
};

/**
 * POV filter verbs. Matched from the lexicon (longest phrase wins: "could
 * see" over "see"), then guarded:
 *   - not inside quoted speech (a character may narrate her own seeing);
 *   - not in a noun slot ("the felt", "a thought") or a passive/attributive
 *     one ("was decided", "the watched pot");
 *   - not followed by a linking preposition ("smelled of", "seemed to");
 *   - with a tagger, the head must be tagged as a verb.
 */
export class FilterVerbRule implements StyleRule {
  private readonly matcher: PhraseMatcher<FilterEntry>;

  constructor(private readonly tagger?: PosTagger, entries: readonly FilterEntry[] = FILTER_VERBS) {
    this.matcher = new PhraseMatcher(entries.map((e) => [e.phrase, e] as const));
  }

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger ?? null)): Finding[] {
    const tokens = tokenize(text);
    const tagged = ctx.hasTagger ? indexByOffset(ctx.tagged()) : null;
    const quotes = quoteSpans(text);
    const out: Finding[] = [];
    for (const m of this.matcher.findAll(tokens)) {
      const { tokenStart: s, tokenEnd: e, value } = m;
      const first = tokens[s]!;
      if (insideQuotes(quotes, first.from)) continue;
      const single = e - s === 1;
      if (single) {
        if (prevIs(tokens, s, NOUN_SLOT) && !GUARDS[value.phrase]) continue;
        if (prevIs(tokens, s, PASSIVE_SLOT)) continue;
        if (nextIs(tokens, e, LINKING_NEXT) && !/^(saw|see|watched|noticed|felt|feel)$/.test(value.phrase)) continue;
        if (nextIs(tokens, e, /^(of|from|for)$/)) continue;
        const guard = GUARDS[value.phrase];
        if (guard && !guard(tokens, s, e)) continue;
        const tag = tagged?.get(first.from);
        if (tag && !tag.tags.has("Verb")) continue;
        // "The soup tasted good", "she seemed tired": linking verb with an adjective complement.
        if (/^(tasted|smelled|felt|seemed|seems|feels|looked)$/.test(value.phrase) && tokens[e] && tagged?.get(tokens[e].from)?.tags.has("Adjective") && !prevIs(tokens, s, /^(he|she|i|they|we|you)$/)) continue;
      }
      out.push(Finding.create("filter", m.from, m.to, value.note));
    }
    return out;
  }
}
