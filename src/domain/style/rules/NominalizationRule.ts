import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import type { PosTagger, TaggedToken } from "../PosTagger";

/** Light verbs that carry a nominalised action: "made a decision", "gave an explanation". */
const LIGHT_VERBS = new Set([
  "make", "makes", "made", "making", "take", "takes", "took", "taken", "taking", "give", "gives", "gave", "given", "giving",
  "have", "has", "had", "having", "do", "does", "did", "done", "doing", "reach", "reaches", "reached", "reaching",
  "come", "comes", "came", "coming", "conduct", "conducts", "conducted", "conducting", "perform", "performs", "performed",
  "performing", "carry", "carries", "carried", "carrying", "provide", "provides", "provided", "providing", "offer", "offers",
  "offered", "offering", "put", "puts", "putting",
]);
/** With these the suffix guess is trustworthy; "had a mission" and "reached the station" are not nominalisations. */
const SUFFIX_VERBS = new Set(["make", "take", "give", "do", "conduct", "perform", "carry", "provide", "offer", "put"]);
/** "have" only nominalises a handful of nouns; the rest is possession ("I have an analysis"). */
const HAVE_NOUNS = new Set(["look", "discussion", "conversation", "argument", "intention", "talk", "chat", "try", "go", "think", "wander", "wash", "rest", "sleep", "nap", "laugh", "cry"]);

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
  failure: "fail", argument: "argue", conversation: "talk", operation: "operate", permission: "permit",
  impression: "impress", question: "ask", inspection: "inspect", difference: "differ", talk: "talk", chat: "chat",
  inquiry: "inquire", enquiry: "enquire", selection: "select", correction: "correct", connection: "connect",
  decisions: "decide", improvements: "improve", explanations: "explain", suggestions: "suggest", attempts: "try",
};
const NOMINAL_SUFFIX = /(tion|sion|ment|ance|ence)$/;
/** Ordinary nouns that happen to end in a nominal suffix. */
const NOT_NOMINAL = new Set([
  "station", "nation", "mission", "vision", "television", "pension", "passion", "session", "condition", "position",
  "mansion", "fraction", "portion", "motion", "potion", "ration", "nation", "lotion", "notion", "caption", "option",
  "fashion", "cushion", "onion", "region", "religion", "opinion", "companion", "champion", "million", "billion",
  "moment", "garment", "pavement", "ointment", "instrument", "document", "monument", "apartment", "department",
  "basement", "cement", "element", "segment", "compartment", "environment", "government", "parliament", "torment",
  "fragrance", "distance", "entrance", "balance", "romance", "substance", "instance", "chance", "finance",
  "science", "audience", "conscience", "sentence", "silence", "essence", "absence", "presence", "fence", "pence",
  "education", "election", "collection", "solution", "relation", "emotion", "reservation", "tradition", "ambition",
  "generation", "population", "situation", "information", "direction", "attention", "mention", "affection",
  "reputation", "vacation", "location", "function", "fiction", "action", "faction", "edition", "addition", "ammunition",
]);
const STOP = new Set(["a", "an", "the", "to", "his", "her", "their", "my", "our", "your", "its", "some", "another", "out", "forward", "him", "them", "me", "us", "it", "you", "no", "any", "every", "each", "such", "this", "that"]);
const LOOKAHEAD = 6;

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
      const hit = this.nounAfter(toks, i, v);
      if (!hit) continue;
      const [n, j] = hit;
      const verb = KNOWN[n.lemma] ?? KNOWN[n.normal];
      const note = verb
        ? `Nominalisation. "${v.text} … ${n.text}" → "${verb}".`
        : `Nominalisation. The action is hiding in "${n.text}" — is there a verb for it?`;
      out.push(Finding.create("nominalization", v.from, toks[j]!.to, note));
    }
    return out;
  }

  /** Determiners/adjectives/adverbs/pronouns, then a nominalised noun in the same sentence; prefer the head of a noun run. */
  private nounAfter(toks: readonly TaggedToken[], i: number, v: TaggedToken): [TaggedToken, number] | null {
    const verbLemma = v.lemma === "carry" || v.lemma === "carries" ? "carry" : v.lemma;
    const suffixOk = SUFFIX_VERBS.has(verbLemma);
    const haveForm = /^(have|has|had|having)$/.test(v.normal);
    for (let j = i + 1; j <= Math.min(toks.length - 1, i + LOOKAHEAD); j++) {
      const t = toks[j]!;
      if (t.sentence !== v.sentence) return null;
      const hit = this.isNominal(t, suffixOk, haveForm);
      if (hit) {
        // "signal failure": the head is the last noun of the run
        let k = j;
        while (k + 1 < toks.length && toks[k + 1]!.sentence === t.sentence && toks[k + 1]!.tags.has("Noun") && !toks[k + 1]!.tags.has("Pronoun") && this.isNominal(toks[k + 1]!, suffixOk, haveForm)) k += 1;
        return [toks[k]!, k];
      }
      if (STOP.has(t.normal) || t.tags.has("Adjective") || t.tags.has("Determiner") || t.tags.has("Adverb") || t.tags.has("Conjunction") || t.tags.has("Negative")) continue;
      if (t.tags.has("Noun") && !t.tags.has("Pronoun") && toks[j + 1]?.tags.has("Noun")) continue; // "signal failure" modifier
      return null;
    }
    return null;
  }

  private isNominal(t: TaggedToken, suffixOk: boolean, haveForm: boolean): boolean {
    const known = KNOWN[t.lemma] !== undefined || KNOWN[t.normal] !== undefined;
    if (haveForm) return known && (HAVE_NOUNS.has(t.lemma) || HAVE_NOUNS.has(t.normal));
    if (known) return t.tags.has("Noun") || !t.tags.has("Pronoun"); // "made use of": compromise tags "use" as a verb
    if (!suffixOk || !t.tags.has("Noun") || t.tags.has("Pronoun") || t.tags.has("ProperNoun")) return false;
    const singular = t.normal.replace(/s$/, "");
    return NOMINAL_SUFFIX.test(singular) && !NOT_NOMINAL.has(singular);
  }
}
