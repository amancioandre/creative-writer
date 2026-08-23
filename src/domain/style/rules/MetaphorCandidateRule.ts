import { Finding } from "../Finding";
import { AnalysisContext, type StyleRule } from "../StyleRule";
import type { PosTagger, TaggedToken } from "../PosTagger";
import type { Concreteness } from "../Concreteness";
import { tokenize } from "../Tokenizer";
import { PhraseMatcher } from "./PhraseMatcher";
import { DEAD_METAPHORS } from "../lexicon/deadMetaphors";

export interface MetaphorThresholds {
  /** A verb counts as concrete at this score. Verbs rate lower than nouns in the norms. */
  readonly verbMin: number;
  /** An adjective or noun modifier counts as concrete at this score. */
  readonly modifierMin: number;
  /** A noun counts as abstract at or below this score. */
  readonly abstractMax: number;
  /** The concrete side must exceed the abstract side by at least this much. */
  readonly minGap: number;
}

export const DEFAULT_METAPHOR_THRESHOLDS: MetaphorThresholds = { verbMin: 3.0, modifierMin: 4.0, abstractMax: 3.4, minGap: 0.7 };

const NOT_A_HEAD_VERB = ["Copula", "Auxiliary", "Modal"];
const WINDOW = 3;

/**
 * Selectional-preference violation as a metaphor signal. Three shapes:
 *   - concrete verb with an abstract subject or object: "the silence bruised", "devoured the afternoon"
 *   - concrete modifier on an abstract noun: "velvet silence", "a cold truth"
 *   - abstract subject, copula, concrete predicate noun: "his sorrow was a stone"
 * Deliberately hedged — it finds *candidates*; whether the figure is fresh is the writer's call.
 *
 * Dead metaphors (a curated phrase list) are flagged with a firmer note.
 */
export class MetaphorCandidateRule implements StyleRule {
  private readonly dead: PhraseMatcher<string>;

  constructor(
    private readonly tagger: PosTagger,
    private readonly concreteness: Concreteness,
    private readonly t: MetaphorThresholds = DEFAULT_METAPHOR_THRESHOLDS,
  ) {
    this.dead = new PhraseMatcher(DEAD_METAPHORS.map((p) => [p, p] as const));
  }

  analyse(text: string, ctx = new AnalysisContext(text, this.tagger)): Finding[] {
    const out: Finding[] = [];
    const claimed: Array<[number, number]> = [];
    const claim = (from: number, to: number, note: string) => {
      if (claimed.some(([a, b]) => from < b && to > a)) return;
      claimed.push([from, to]);
      out.push(Finding.create("metaphor", from, to, note));
    };

    for (const m of this.dead.findAll(tokenize(text))) {
      claim(m.from, m.to, `Dead metaphor: "${m.value}". The image has worn off — say it plainly or find a live one.`);
    }

    const toks = ctx.tagged();
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      const isNoun = t.tags.has("Noun") && !t.tags.has("Pronoun");

      if (t.tags.has("Verb") && !NOT_A_HEAD_VERB.some((s) => t.tags.has(s))) {
        const vs = this.score(t);
        if (vs === null || vs < this.t.verbMin) continue;
        const partner = this.abstractNoun(toks, i, +1, vs) ?? this.abstractNoun(toks, i, -1, vs);
        if (partner) claim(Math.min(t.from, partner.from), Math.max(t.to, partner.to), this.note(t, partner, "verb"));
      } else if (t.tags.has("Copula")) {
        const subject = this.abstractNoun(toks, i, -1, Infinity);
        const predicate = this.concreteNounAfter(toks, i);
        if (subject && predicate) claim(subject.from, predicate.to, `Possibly figurative: "${subject.text}" is said to be a "${predicate.text}". Fresh, or familiar?`);
      } else if (t.tags.has("Adjective") || isNoun) {
        const ms = this.score(t);
        if (ms === null || ms < this.t.modifierMin) continue;
        const n = toks[i + 1];
        if (!n || n.sentence !== t.sentence || !n.tags.has("Noun") || n.tags.has("Pronoun")) continue;
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

  /** Nearest noun in one direction (skipping determiners/adjectives/possessives); abstract → candidate, concrete → literal. */
  private abstractNoun(toks: readonly TaggedToken[], i: number, dir: 1 | -1, headScore: number): TaggedToken | null {
    const v = toks[i]!;
    for (let step = 1; step <= WINDOW; step++) {
      const n = toks[i + dir * step];
      if (!n || n.sentence !== v.sentence) return null;
      if (n.tags.has("Verb") || n.tags.has("Preposition") || n.tags.has("Conjunction")) return null;
      if (!n.tags.has("Noun") || n.tags.has("Pronoun") || n.tags.has("Person") || n.tags.has("Place")) continue;
      const ns = this.score(n);
      if (ns === null) return null;
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
      if (!n.tags.has("Noun") || n.tags.has("Pronoun")) return null;
      const ns = this.score(n);
      return ns !== null && ns >= this.t.modifierMin ? n : null;
    }
    return null;
  }

  private note(head: TaggedToken, noun: TaggedToken, kind: string): string {
    return `Possibly figurative: a concrete ${kind} ("${head.text}") on an abstract noun ("${noun.text}"). Fresh, or familiar?`;
  }
}
