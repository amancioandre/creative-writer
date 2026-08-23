import { describe, it, expect } from "vitest";
import { RepetitionRule } from "../../../src/domain/style/rules/RepetitionRule";

const rule = new RepetitionRule({ windowWords: 20 });
const spans = (t: string) => rule.analyse(t).map((f) => t.slice(f.from, f.to));

describe("RepetitionRule", () => {
  it("flags the second occurrence of a content word inside the window", () => {
    expect(spans("The garden was quiet. The garden waited.")).toEqual(["garden"]);
  });
  it("ignores stopwords and short words", () => {
    expect(spans("The cat and the dog and the bird.")).toEqual([]);
  });
  it("ignores repeats outside the window", () => {
    const filler = Array.from({ length: 25 }, (_, i) => `w${i}`).join(" ");
    expect(spans(`garden ${filler} garden`)).toEqual([]);
  });
  it("flags three consecutive sentences starting with the same word", () => {
    const fs = rule.analyse("She opened the door. She looked inside. She screamed.");
    expect(fs.some((f) => f.note.match(/open/i))).toBe(true);
  });
  it("does not flag two consecutive sentences starting alike (deliberate anaphora is fine at two)", () => {
    const fs = rule.analyse("He ran. He fell.");
    expect(fs.filter((f) => /open/i.test(f.note))).toHaveLength(0);
  });
  it("treats inflections as the same word (plural / -ed / -ing)", () => {
    expect(spans("The waves rose. Another wave fell.")).toEqual(["wave"]);
  });
});
