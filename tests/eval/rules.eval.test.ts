import { describe, it, expect } from "vitest";
import { CORPUS } from "../../eval/corpus";
import { score, formatScorecard } from "../../eval/score";
import { AnalyzeParagraphStyle } from "../../src/application/use-cases/AnalyzeParagraphStyle";
import { CompromiseTagger } from "../../src/infrastructure/nlp/CompromiseTagger";
import { BrysbaertConcreteness } from "../../src/infrastructure/nlp/BrysbaertConcreteness";
import { FINDING_KINDS, type FindingKind } from "../../src/domain/style/Finding";

/**
 * The rules' scorecard on eval/corpus.ts. Floors are deliberately a little
 * below current numbers: the point is to notice a regression, not to lock
 * every decimal. Raise a floor when you improve a rule.
 */
function run(useCase: AnalyzeParagraphStyle) {
  const detected = new Map<string, Set<FindingKind>>();
  for (const item of CORPUS) {
    detected.set(item.text, new Set(useCase.execute({ text: item.text, paragraphFrom: 0, enabled: new Set(FINDING_KINDS) }).map((f) => f.kind)));
  }
  return score(CORPUS, detected);
}

describe("eval: rules", () => {
  const tier1 = run(AnalyzeParagraphStyle.withDefaultRules());
  const tier2 = run(AnalyzeParagraphStyle.withDefaultRules(new CompromiseTagger(), new BrysbaertConcreteness()));
  console.log("\n" + formatScorecard("Tier 1 (rules only)", tier1) + "\n\n" + formatScorecard("Tier 2 (rules + tagger + norms)", tier2) + "\n");

  it("Tier 2 micro precision ≥ 0.85", () => expect(tier2.micro.precision).toBeGreaterThanOrEqual(0.85));
  it("Tier 2 micro recall ≥ 0.80", () => expect(tier2.micro.recall).toBeGreaterThanOrEqual(0.8));
  it("Tier 2 flags at most 3 clean sentences", () => expect(tier2.cleanFalseAlarms.length).toBeLessThanOrEqual(3));
  it("Tier 2 is not worse than Tier 1 on micro F1", () => expect(tier2.micro.f1).toBeGreaterThanOrEqual(tier1.micro.f1 - 0.01));
  for (const k of tier2.byKind.filter((k) => k.tp + k.fn > 0)) {
    it(`Tier 2 ${k.kind} recall ≥ 0.6 (got ${k.recall.toFixed(2)})`, () => expect(k.recall).toBeGreaterThanOrEqual(0.6));
  }
});
