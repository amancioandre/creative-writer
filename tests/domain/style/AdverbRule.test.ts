import { describe, it, expect } from "vitest";
import { AdverbRule } from "../../../src/domain/style/rules/AdverbRule";

const rule = new AdverbRule();
const spans = (t: string) => rule.analyse(t).map((f) => t.slice(f.from, f.to));

describe("AdverbRule", () => {
  it("flags -ly adverbs", () => {
    expect(spans("She walked slowly and spoke softly.")).toEqual(["slowly", "softly"]);
  });
  it("ignores -ly words that are not adverbs", () => {
    expect(spans("The lonely, friendly, elderly family in Italy had a rally early in July.")).toEqual([]);
  });
  it("ignores short words ending in ly", () => {
    expect(spans("Fly, ally, rely, July.")).toEqual([]);
  });
  it("marks adverbs on dialogue tags as more serious in the note", () => {
    const [f] = rule.analyse('"Go," she said quietly.');
    expect(f!.note).toMatch(/dialogue/i);
  });
  it("kind is adverb", () => {
    expect(rule.analyse("He ran quickly.")[0]!.kind).toBe("adverb");
  });
});
