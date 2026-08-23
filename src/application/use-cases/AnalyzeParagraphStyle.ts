import type { Finding, FindingKind } from "../../domain/style/Finding";
import type { StyleRule } from "../../domain/style/StyleRule";
import { ClicheRule } from "../../domain/style/rules/ClicheRule";
import { PassiveVoiceRule } from "../../domain/style/rules/PassiveVoiceRule";
import { WeakWordRule } from "../../domain/style/rules/WeakWordRule";
import { AdverbRule } from "../../domain/style/rules/AdverbRule";
import { RepetitionRule } from "../../domain/style/rules/RepetitionRule";

export interface AnalyzeParagraphStyleInput {
  readonly text: string;
  readonly paragraphFrom: number;
  readonly enabled: ReadonlySet<FindingKind>;
}

/** Rules keyed by the kind(s) they produce. One rule may serve several kinds (WeakWordRule → weak + filter). */
export type RuleRegistry = Partial<Record<FindingKind, StyleRule>>;

/**
 * Runs every enabled style rule over one paragraph and returns findings with
 * absolute document offsets, sorted by position. Rules that emit more than
 * one kind are run once and filtered.
 */
export class AnalyzeParagraphStyle {
  constructor(private readonly rules: RuleRegistry) {}

  static withDefaultRules(): AnalyzeParagraphStyle {
    const weak = new WeakWordRule();
    return new AnalyzeParagraphStyle({
      cliche: new ClicheRule(),
      passive: new PassiveVoiceRule(),
      weak,
      filter: weak,
      adverb: new AdverbRule(),
      repetition: new RepetitionRule(),
    });
  }

  execute({ text, paragraphFrom, enabled }: AnalyzeParagraphStyleInput): Finding[] {
    const ran = new Set<StyleRule>();
    const out: Finding[] = [];
    for (const kind of enabled) {
      const rule = this.rules[kind];
      if (!rule || ran.has(rule)) continue;
      ran.add(rule);
      for (const f of rule.analyse(text)) {
        if (enabled.has(f.kind)) out.push(f.shifted(paragraphFrom));
      }
    }
    return out.sort((a, b) => a.from - b.from || a.to - b.to);
  }
}
