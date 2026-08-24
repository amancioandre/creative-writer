import { describe, it, expect } from "vitest";
import { FilterVerbRule } from "../../../src/domain/style/rules/FilterVerbRule";

const rule = new FilterVerbRule();
const spans = (t: string) => rule.analyse(t).map((f) => [f.kind, t.slice(f.from, f.to)]);

describe("FilterVerbRule", () => {
  it("flags POV filter verbs as 'filter'", () => {
    expect(spans("She saw the door open. He felt the cold. I noticed it.")).toEqual([
      ["filter", "saw"], ["filter", "felt"], ["filter", "noticed"],
    ]);
  });
  it("does not flag 'felt' as a noun", () => {
    expect(spans("The felt hat fell.")).toEqual([]);
  });
  it("leaves intensifiers and hedges to Harper", () => {
    expect(spans("It was very cold and really quite dark, actually.")).toEqual([]);
  });
});
