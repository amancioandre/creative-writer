import type { Finding, FindingKind } from "../../domain/style/Finding";
import { AnalysisContext, type StyleRule } from "../../domain/style/StyleRule";
import type { PosTagger } from "../../domain/style/PosTagger";
import type { Concreteness } from "../../domain/style/Concreteness";
import { MetaphorCandidateRule } from "../../domain/style/rules/MetaphorCandidateRule";
import { NominalizationRule } from "../../domain/style/rules/NominalizationRule";
import { WeakVerbRule } from "../../domain/style/rules/WeakVerbRule";
import { ClicheRule } from "../../domain/style/rules/ClicheRule";
import { PassiveVoiceRule } from "../../domain/style/rules/PassiveVoiceRule";
import { FilterVerbRule } from "../../domain/style/rules/FilterVerbRule";
import { AdverbRule } from "../../domain/style/rules/AdverbRule";
import { RepetitionRule } from "../../domain/style/rules/RepetitionRule";

export interface AnalyzeParagraphStyleInput {
  readonly text: string;
  readonly paragraphFrom: number;
  readonly enabled: ReadonlySet<FindingKind>;
}

/** Rules keyed by the kind(s) they produce. One rule may serve several kinds. */
export type RuleRegistry = Partial<Record<FindingKind, StyleRule>>;

/**
 * Runs every enabled style rule over one paragraph and returns findings with
 * absolute document offsets, sorted by position. Rules that emit more than
 * one kind are run once and filtered.
 */
export class AnalyzeParagraphStyle {
  constructor(private readonly rules: RuleRegistry, private readonly tagger: PosTagger | null = null) {}

  /**
   * Without a tagger: the five Tier 1 rules on word shape alone.
   * With one: passive and adverb use real tags, and nominalisation and
   * weak-verb checks become possible. With concreteness norms as well,
   * metaphor candidates are detected. The tagger runs once per paragraph.
   */
  static withDefaultRules(tagger?: PosTagger, concreteness?: Concreteness): AnalyzeParagraphStyle {
    const rules: RuleRegistry = {
      cliche: new ClicheRule(),
      passive: new PassiveVoiceRule(tagger),
      filter: new FilterVerbRule(tagger),
      adverb: new AdverbRule(tagger),
      repetition: new RepetitionRule(),
    };
    if (tagger) {
      rules.nominalization = new NominalizationRule(tagger);
      rules.weakverb = new WeakVerbRule(tagger);
      if (concreteness) rules.metaphor = new MetaphorCandidateRule(tagger, concreteness);
    }
    return new AnalyzeParagraphStyle(rules, tagger ?? null);
  }

  execute({ text, paragraphFrom, enabled }: AnalyzeParagraphStyleInput): Finding[] {
    const ctx = new AnalysisContext(text, this.tagger);
    const ran = new Set<StyleRule>();
    const out: Finding[] = [];
    for (const kind of enabled) {
      const rule = this.rules[kind];
      if (!rule || ran.has(rule)) continue;
      ran.add(rule);
      for (const f of rule.analyse(text, ctx)) {
        if (enabled.has(f.kind)) out.push(f.shifted(paragraphFrom));
      }
    }
    return out.sort((a, b) => a.from - b.from || a.to - b.to);
  }
}
