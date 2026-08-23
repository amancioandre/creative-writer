import { describe, it, expect } from "vitest";
import { WeakWordRule } from "../../../src/domain/style/rules/WeakWordRule";

const rule = new WeakWordRule();
const spans = (t: string) => rule.analyse(t).map((f) => [f.kind, t.slice(f.from, f.to)]);

describe("WeakWordRule", () => {
  it("flags intensifiers and hedges", () => {
    expect(spans("It was very cold and really quite dark, actually.")).toEqual([
      ["weak", "very"], ["weak", "really"], ["weak", "quite"], ["weak", "actually"],
    ]);
  });
  it("flags multi-word crutches like 'started to' and 'in order to'", () => {
    expect(spans("She started to run in order to escape.")).toEqual([["weak", "started to"], ["weak", "in order to"]]);
  });
  it("flags POV filter verbs as 'filter'", () => {
    expect(spans("She saw the door open. He felt the cold. I noticed it.")).toEqual([
      ["filter", "saw"], ["filter", "felt"], ["filter", "noticed"],
    ]);
  });
  it("does not flag 'just' in 'just as' or 'felt' as a noun", () => {
    expect(spans("Just as the felt hat fell.")).toEqual([]);
  });
  it("does not flag 'so' as a conjunction (only 'so' + adjective)", () => {
    expect(spans("He left, so she stayed.")).toEqual([]);
    expect(spans("It was so dark.")).toEqual([["weak", "so"]]);
  });
});
