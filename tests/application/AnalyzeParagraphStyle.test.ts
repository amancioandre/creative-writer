import { describe, it, expect } from "vitest";
import { AnalyzeParagraphStyle } from "../../src/application/use-cases/AnalyzeParagraphStyle";
import { Finding, type FindingKind } from "../../src/domain/style/Finding";
import type { StyleRule } from "../../src/domain/style/StyleRule";
import { CompromiseTagger } from "../../src/infrastructure/nlp/CompromiseTagger";
import { BrysbaertConcreteness } from "../../src/infrastructure/nlp/BrysbaertConcreteness";
import { FINDING_KINDS } from "../../src/domain/style/Finding";

const ruleOf = (kind: FindingKind, from: number, to: number): StyleRule => ({
  analyse: () => [Finding.create(kind, from, to, `${kind} note`)],
});

describe("AnalyzeParagraphStyle", () => {
  it("runs only the enabled rules and shifts findings to absolute offsets", () => {
    const useCase = new AnalyzeParagraphStyle({ cliche: ruleOf("cliche", 0, 3), passive: ruleOf("passive", 5, 8) });
    const out = useCase.execute({ text: "abc  def", paragraphFrom: 100, enabled: new Set(["passive"]) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "passive", from: 105, to: 108 });
  });

  it("sorts findings by position", () => {
    const useCase = new AnalyzeParagraphStyle({ cliche: ruleOf("cliche", 5, 8), filter: ruleOf("filter", 0, 2) });
    const out = useCase.execute({ text: "ab   cde", paragraphFrom: 0, enabled: new Set(["cliche", "filter"]) });
    expect(out.map((f) => f.kind)).toEqual(["filter", "cliche"]);
  });

  it("returns nothing when no rules are enabled", () => {
    const useCase = new AnalyzeParagraphStyle({ cliche: ruleOf("cliche", 0, 3) });
    expect(useCase.execute({ text: "abc", paragraphFrom: 0, enabled: new Set() })).toEqual([]);
  });

  it("default wiring produces real findings across kinds", () => {
    const useCase = AnalyzeParagraphStyle.withDefaultRules();
    const text = "At the end of the day the letter was written very slowly. She saw the garden. The garden wept.";
    const kinds = new Set(useCase.execute({ text, paragraphFrom: 0, enabled: new Set(["cliche", "passive", "filter", "adverb", "repetition"]) }).map((f) => f.kind));
    expect([...kinds].sort()).toEqual(["adverb", "cliche", "filter", "passive", "repetition"]);
  });
});

describe("AnalyzeParagraphStyle with a tagger", () => {
  it("tags the paragraph exactly once however many rules need it", () => {
    let calls = 0;
    const tagger = { tag: (t: string) => { calls++; return new CompromiseTagger().tag(t); } };
    const useCase = AnalyzeParagraphStyle.withDefaultRules(tagger, new BrysbaertConcreteness());
    const text = "The letter was written slowly. She made a decision. The house on the hill above the quiet village by the river was old and grey. The silence bruised him.";
    const kinds = new Set(useCase.execute({ text, paragraphFrom: 0, enabled: new Set(FINDING_KINDS) }).map((f) => f.kind));
    expect(calls).toBe(1);
    expect(kinds).toEqual(new Set(["passive", "adverb", "nominalization", "weakverb", "metaphor"]));
  });
});
