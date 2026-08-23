import { describe, it, expect } from "vitest";
import { Sentence } from "../../../src/domain/rhythm/Sentence";
import { mergeAbbreviationSplits } from "../../../src/domain/rhythm/AbbreviationMerger";

const chain = (...parts: string[]) => {
  let at = 0;
  return parts.map((p) => { const s = Sentence.create(p, at, at + p.length); at += p.length; return s; });
};

describe("mergeAbbreviationSplits", () => {
  it("merges a segment ending in an honorific into the following one", () => {
    const out = mergeAbbreviationSplits(chain("Mr. ", "Smith left. ", "Then rain."));
    expect(out.map((s) => s.text)).toEqual(["Mr. Smith left. ", "Then rain."]);
    expect(out[0]!.from).toBe(0);
    expect(out[0]!.to).toBe("Mr. Smith left. ".length);
  });

  it("chains merges across several abbreviations", () => {
    const out = mergeAbbreviationSplits(chain("Dr. ", "St. ", "John. ", "End."));
    expect(out.map((s) => s.text)).toEqual(["Dr. St. John. ", "End."]);
  });

  it("leaves ordinary sentences alone", () => {
    const input = chain("One. ", "Two.");
    expect(mergeAbbreviationSplits(input)).toEqual(input);
  });

  it("does not merge when the abbreviation is the final segment", () => {
    const input = chain("See Mr.");
    expect(mergeAbbreviationSplits(input)).toEqual(input);
  });

  it("is case-insensitive for the abbreviation", () => {
    expect(mergeAbbreviationSplits(chain("MRS. ", "X.")).map((s) => s.text)).toEqual(["MRS. X."]);
  });
});
