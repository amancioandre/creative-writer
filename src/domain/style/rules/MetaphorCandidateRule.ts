import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import type { PosTagger, TaggedToken } from "../PosTagger";
import type { Concreteness } from "../Concreteness";
import { tokenize } from "../Tokenizer";
import { PhraseMatcher } from "./PhraseMatcher";
import { DEAD_METAPHORS, DEAD_METAPHORS_OPEN } from "../lexicon/deadMetaphors";

export interface MetaphorThresholds {
  /** A verb counts as concrete at this score. Verbs rate lower than nouns in the norms. */
  readonly verbMin: number;
  /** An adjective counts as concrete at this score. */
  readonly modifierMin: number;
  /** A noun counts as abstract at or below this score. */
  readonly abstractMax: number;
  /** The concrete side must exceed the abstract side by at least this much. */
  readonly minGap: number;
}

export const DEFAULT_METAPHOR_THRESHOLDS: MetaphorThresholds = { verbMin: 3.5, modifierMin: 3.8, abstractMax: 3.4, minGap: 0.7 };

const NOT_A_HEAD_VERB = ["Copula", "Auxiliary", "Modal", "Particle"];
/** Light verbs carry nominalisations ("reached an agreement"); that is a different finding, not a metaphor. */
const LIGHT_VERBS = new Set(["make", "take", "give", "have", "do", "reach", "come", "get", "put", "hold", "keep", "bring", "go", "set", "let", "carry", "conduct", "perform", "provide", "offer"]);
/** A particle that is really a preposition ("run in order to"): ends the search for a partner. */
const PREPOSITION_WORDS = new Set(["in", "on", "at", "to", "for", "of", "with", "from", "into", "onto", "over", "under", "by", "about", "through"]);
/** Verbs whose literal objects are routinely abstract: "cut the budget", "wrote the law", "studied history". */
const LITERAL_WITH_ABSTRACT = new Set([
  "cut", "write", "read", "print", "sign", "study", "learn", "teach", "file", "lodge", "sketch", "record", "publish",
  "draft", "type", "discuss", "draw", "mark", "note", "list", "count", "spell", "cite", "quote", "copy", "send", "post",
]);
/** Skipped over on the way from a verb to its subject/object. */
const TRANSPARENT = ["Auxiliary", "Modal", "Negative", "Adverb", "Particle", "Possessive", "Determiner", "Adjective"];
/** Generic nouns the norms rate abstract; never a metaphor partner. */
const GENERIC_NOUNS = new Set(["thing", "things", "stuff", "way", "ways", "time", "times", "lot", "lots", "something", "anything", "everything", "nothing", "one", "ones", "part", "parts", "kind", "sort", "bit", "end", "ends", "start", "side", "sides", "place", "places", "order"]);
/** "The problem was a car" — specificational, not figurative. */
const SHELL_NOUNS = new Set([
  "problem", "answer", "solution", "issue", "question", "point", "cause", "reason", "trouble", "result", "goal", "plan",
  "subject", "topic", "theme", "winner", "prize", "gift", "job", "name", "target", "choice", "option", "source", "key",
  "idea", "aim", "object", "purpose", "matter", "case", "rest", "only", "first", "last", "next", "best", "worst",
]);
/** Function words the tagger occasionally mis-tags as nouns ("The Office" → Organization); never a partner. */
const FUNCTION_WORDS = new Set(["the", "a", "an", "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their"]);
const WINDOW = 4;
/**
 * Nouns that work as figurative modifiers ("velvet silence", "iron will").
 * Other noun-noun pairs are compounds ("office hours", "car accident") and
 * are left alone.
 */
const MATERIAL_MODIFIERS = new Set([
  "velvet", "silk", "satin", "iron", "steel", "stone", "granite", "marble", "glass", "ice", "honey", "sugar", "lead",
  "wool", "paper", "wax", "butter", "oil", "salt", "sand", "smoke", "water", "fire", "ash", "rust", "copper", "silver",
  "gold", "mud", "blood", "bone", "leather", "lace", "cotton", "linen", "chalk", "clay", "crystal", "diamond", "pearl",
  "sugar", "syrup", "treacle", "milk", "cream", "snow", "frost", "flint", "brass", "tin", "amber", "ivory", "ebony",
]);

/** A noun that can sit on the abstract side of a pairing: common, not a name, not a function word. */
function isCandidateNoun(t: TaggedToken): boolean {
  return t.tags.has("Noun") && !t.tags.has("Pronoun") && !t.tags.has("ProperNoun") && !t.tags.has("Possessive")
    && !FUNCTION_WORDS.has(t.normal) && !GENERIC_NOUNS.has(t.normal);
}

/** "The silence really bruised him": compromise calls "bruised" an adjective; a lemma that differs says otherwise. */
function isHeadVerb(t: TaggedToken): boolean {
  if (t.tags.has("Verb")) return !NOT_A_HEAD_VERB.some((s) => t.tags.has(s));
  return t.tags.has("Adjective") && t.lemma !== t.normal && /ed$/.test(t.normal);
}

/**
 * Selectional-preference violation as a metaphor signal. Three shapes:
 *   - concrete verb with an abstract subject or object: "the silence bruised", "devoured the afternoon"
 *   - concrete adjective on an abstract noun: "velvet silence", "a cold truth"
 *   - abstract subject, copula, concrete predicate noun: "his sorrow was a stone"
 * Deliberately hedged — it finds *candidates*; whether the figure is fresh is the writer's call.
 *
 * Dead metaphors (a curated phrase list) are flagged with a firmer note;
 * open-ended ones ("a flood of …") only when the complement is abstract.
 */
export class MetaphorCandidateRule implements StyleRule {
  private readonly dead: PhraseMatcher<string>;
  private readonly deadOpen: PhraseMatcher<string>;

  constructor(
    private readonly tagger: PosTagger,
    private readonly concreteness: Concreteness,
    private readonly t: MetaphorThresholds = DEFAULT_METAPHOR_THRESHOLDS,
  ) {
    this.dead = new PhraseMatcher(DEAD_METAPHORS.map((p) => [p, p] as const));
    this.deadOpen = new PhraseMatcher(DEAD_METAPHORS_OPEN.map((p) => [p, p] as const));
  }

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger)): Finding[] {
    const out: Finding[] = [];
    const claimed: Array<[number, number]> = [];
    const claim = (from: number, to: number, note: string) => {
      if (claimed.some(([a, b]) => from < b && to > a)) return;
      claimed.push([from, to]);
      out.push(Finding.create("metaphor", from, to, note));
    };
    const deadNote = (p: string) => `Dead metaphor: "${p}". The image has worn off — say it plainly or find a live one.`;

    const plain = tokenize(text);
    for (const m of this.dead.findAll(plain)) claim(m.from, m.to, deadNote(m.value));

    const toks = ctx.tagged();
    for (const m of this.deadOpen.findAll(plain)) {
      const complement = this.nounStartingAt(toks, m.to);
      if (complement && this.score(complement) !== null && this.score(complement)! <= this.t.abstractMax) {
        claim(m.from, complement.to, deadNote(`${m.value} ${complement.text}`));
      }
    }

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (isHeadVerb(t) && !LIGHT_VERBS.has(t.lemma) && !LITERAL_WITH_ABSTRACT.has(t.lemma)) {
        const vs = this.score(t);
        if (vs === null || vs < this.t.verbMin) continue;
        const partner = this.abstractNoun(toks, i, +1, vs) ?? this.abstractNoun(toks, i, -1, vs);
        if (partner) claim(Math.min(t.from, partner.from), Math.max(t.to, partner.to), this.note(t, partner, "verb"));
      } else if (t.tags.has("Copula")) {
        const subject = this.abstractNoun(toks, i, -1, Infinity);
        if (!subject || SHELL_NOUNS.has(subject.normal)) continue;
        const predicate = this.concreteNounAfter(toks, i);
        if (predicate) claim(subject.from, predicate.to, `Possibly figurative: "${subject.text}" is said to be a "${predicate.text}". Fresh, or familiar?`);
      } else if (!t.tags.has("Possessive") && ((t.tags.has("Adjective") && !t.tags.has("Noun")) || MATERIAL_MODIFIERS.has(t.normal))) {
        const ms = this.score(t);
        if (ms === null || ms < this.t.modifierMin) continue;
        const n = toks[i + 1];
        if (!n || n.sentence !== t.sentence || !isCandidateNoun(n)) continue;
        const ns = this.score(n);
        if (ns === null || ns > this.t.abstractMax || ms - ns < this.t.minGap) continue;
        claim(t.from, n.to, this.note(t, n, t.tags.has("Adjective") ? "adjective" : "modifier"));
      }
    }
    return out.sort((a, b) => a.from - b.from);
  }

  private score(t: TaggedToken): number | null {
    return this.concreteness.score(t.lemma) ?? this.concreteness.score(t.normal);
  }

  /** The noun phrase head right after a phrase: skips determiners/adjectives. */
  private nounStartingAt(toks: readonly TaggedToken[], offset: number): TaggedToken | null {
    let i = toks.findIndex((t) => t.from >= offset);
    if (i < 0) return null;
    for (let step = 0; step < 3 && i + step < toks.length; step++) {
      const t = toks[i + step]!;
      if (t.tags.has("Determiner") || t.tags.has("Adjective") || t.tags.has("Possessive")) continue;
      return isCandidateNoun(t) ? t : null;
    }
    return null;
  }

  /** Nearest noun in one direction (skipping auxiliaries, adverbs, determiners…); abstract → candidate, concrete → literal. */
  private abstractNoun(toks: readonly TaggedToken[], i: number, dir: 1 | -1, headScore: number): TaggedToken | null {
    const v = toks[i]!;
    for (let step = 1; step <= WINDOW; step++) {
      const n = toks[i + dir * step];
      if (!n || n.sentence !== v.sentence) return null;
      if (n.tags.has("Particle") && PREPOSITION_WORDS.has(n.normal)) return null;
      if (TRANSPARENT.some((s) => n.tags.has(s)) && !n.tags.has("Noun")) continue;
      if (n.tags.has("Verb") && !n.tags.has("Noun")) return null;
      if (n.tags.has("Preposition") || n.tags.has("Conjunction")) return null;
      if (!isCandidateNoun(n)) continue;
      const ns = this.score(n);
      if (ns === null) continue;
      return ns <= this.t.abstractMax && headScore - ns >= this.t.minGap ? n : null;
    }
    return null;
  }

  /** "was a stone": determiner(s) then a concrete noun, before any preposition. */
  private concreteNounAfter(toks: readonly TaggedToken[], i: number): TaggedToken | null {
    for (let step = 1; step <= WINDOW; step++) {
      const n = toks[i + step];
      if (!n || n.sentence !== toks[i]!.sentence || n.tags.has("Preposition") || n.tags.has("Verb")) return null;
      if (n.tags.has("Determiner")) continue;
      if (n.tags.has("Adjective") && !n.tags.has("Noun")) continue;
      if (!n.tags.has("Noun") || n.tags.has("Pronoun") || n.tags.has("Actor") || n.tags.has("ProperNoun")) return null;
      const ns = this.score(n);
      return ns !== null && ns >= this.t.modifierMin ? n : null;
    }
    return null;
  }

  private note(head: TaggedToken, noun: TaggedToken, kind: string): string {
    return `Possibly figurative: a concrete ${kind} ("${head.text}") on an abstract noun ("${noun.text}"). Fresh, or familiar?`;
  }
}
