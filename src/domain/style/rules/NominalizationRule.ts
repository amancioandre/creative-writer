import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import type { PosTagger, TaggedToken } from "../PosTagger";

/** Light verbs that carry a nominalised action: "made a decision", "gave an explanation". */
const LIGHT_VERBS = new Set([
  "make", "makes", "made", "making", "take", "takes", "took", "taken", "taking", "give", "gives", "gave", "given", "giving",
  "have", "has", "had", "having", "do", "does", "did", "done", "doing", "reach", "reaches", "reached", "reaching",
  "come", "comes", "came", "coming", "conduct", "conducts", "conducted", "conducting", "perform", "performs", "performed",
  "performing", "carry", "carried", "provide", "provides", "provided", "offer", "offers", "offered", "put", "puts",
]);

/** Nominalisations with the verb that replaces them. The suffix rule catches the rest with a generic note. */
const KNOWN: Record<string, string> = {
  decision: "decide", agreement: "agree", explanation: "explain", investigation: "investigate", conclusion: "conclude",
  look: "look", examination: "examine", consideration: "consider", suggestion: "suggest", announcement: "announce",
  assumption: "assume", assessment: "assess", analysis: "analyse", arrangement: "arrange", attempt: "try",
  comparison: "compare", complaint: "complain", contribution: "contribute", description: "describe", discussion: "discuss",
  evaluation: "evaluate", improvement: "improve", indication: "indicate", intention: "intend", judgment: "judge",
  judgement: "judge", observation: "observe", payment: "pay", preparation: "prepare", presentation: "present",
  proposal: "propose", provision: "provide", realization: "realise", realisation: "realise", recommendation: "recommend",
  reduction: "reduce", reference: "refer", refusal: "refuse", statement: "state", recognition: "recognise",
  appearance: "appear", performance: "perform", resistance: "resist", response: "respond", reply: "reply",
  promise: "promise", request: "request", search: "search", visit: "visit", use: "use", choice: "choose",
  mention: "mention", apology: "apologise", confession: "confess", admission: "admit", objection: "object",
};
const NOMINAL_SUFFIX = /(tion|sion|ment|ance|ence|ity|ure|al)$/;
const STOP = new Set(["a", "an", "the", "to", "his", "her", "their", "my", "our", "your", "its", "some", "another"]);

/**
 * Weak verb + noun built from a verb: "made a decision" → "decided". Needs a
 * tagger to tell a light-verb-as-verb from a noun ("the make of the car").
 */
export class NominalizationRule implements StyleRule {
  constructor(private readonly tagger: PosTagger) {}

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger)): Finding[] {
    const toks = ctx.tagged();
    const out: Finding[] = [];
    for (let i = 0; i < toks.length; i++) {
      const v = toks[i]!;
      if (!LIGHT_VERBS.has(v.normal) || !v.tags.has("Verb")) continue;
      const hit = this.nounAfter(toks, i);
      if (!hit) continue;
      const [n, j] = hit;
      const verb = KNOWN[n.normal];
      const note = verb
        ? `Nominalisation. "${v.text} … ${n.text}" → "${verb}".`
        : `Nominalisation. The action is hiding in "${n.text}" — is there a verb for it?`;
      out.push(Finding.create("nominalization", v.from, toks[j]!.to, note));
    }
    return out;
  }

  /** Up to three determiners/adjectives, then a nominalised noun in the same sentence. */
  private nounAfter(toks: readonly TaggedToken[], i: number): [TaggedToken, number] | null {
    for (let j = i + 1; j <= Math.min(toks.length - 1, i + 4); j++) {
      const t = toks[j]!;
      if (t.sentence !== toks[i]!.sentence) return null;
      if (STOP.has(t.normal) || t.tags.has("Adjective") || t.tags.has("Determiner")) continue;
      if (t.tags.has("Noun") && (KNOWN[t.normal] !== undefined || NOMINAL_SUFFIX.test(t.normal))) return [t, j];
      return null;
    }
    return null;
  }
}
