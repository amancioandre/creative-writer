import { describe, it, expect } from "vitest";
import { MetaphorCandidateRule } from "../../../src/domain/style/rules/MetaphorCandidateRule";
import { CompromiseTagger } from "../../../src/infrastructure/nlp/CompromiseTagger";
import { BrysbaertConcreteness } from "../../../src/infrastructure/nlp/BrysbaertConcreteness";
import { METAPHOR_CORPUS } from "../../fixtures/metaphorCorpus";

const rule = new MetaphorCandidateRule(new CompromiseTagger(), new BrysbaertConcreteness());
const spans = (t: string) => rule.analyse(t).map((f) => t.slice(f.from, f.to));

describe("MetaphorCandidateRule", () => {
  it("flags a concrete verb on an abstract subject", () => {
    expect(spans("The silence bruised him.")).toEqual(["silence bruised"]);
  });
  it("flags a concrete verb on an abstract object", () => {
    expect(spans("The news hammered his hope flat.")).toEqual(["hammered his hope"]);
  });
  it("flags a concrete adjective on an abstract noun", () => {
    expect(spans("A velvet silence settled.")).toEqual(["velvet silence"]);
  });
  it("leaves literal pairings alone", () => {
    expect(spans("The knife cut the bread.")).toEqual([]);
    expect(spans("The cat crawled under the bed.")).toEqual([]);
  });
  it("flags dead metaphors from the phrase list with a different note", () => {
    const [f] = rule.analyse("A flood of memories hit her.");
    expect(f!.note).toMatch(/dead metaphor/i);
  });
  it("kind is metaphor and the note hedges", () => {
    const [f] = rule.analyse("Grief swallowed the house.");
    expect(f!.kind).toBe("metaphor");
    expect(f!.note).toMatch(/figurative|fresh/i);
  });

  describe("corpus", () => {
    let tp = 0, fp = 0, fn = 0;
    for (const [s, fig] of METAPHOR_CORPUS) {
      const hit = rule.analyse(s).length > 0;
      if (hit && fig) tp++; else if (hit && !fig) fp++; else if (!hit && fig) fn++;
    }
    const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
    it(`recall ≥ 0.6 (got ${recall.toFixed(2)})`, () => expect(recall).toBeGreaterThanOrEqual(0.6));
    it(`precision ≥ 0.7 (got ${precision.toFixed(2)})`, () => expect(precision).toBeGreaterThanOrEqual(0.7));
  });
});
