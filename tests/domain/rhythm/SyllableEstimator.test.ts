import { describe, it, expect } from "vitest";
import { estimateSyllables } from "../../../src/domain/rhythm/SyllableEstimator";

describe("estimateSyllables", () => {
  it.each([
    ["cat", 1],
    ["table", 2],      // silent-e rule must not strip the "le" syllable
    ["the", 1],
    ["beautiful", 3],
    ["rhythm", 1],     // no vowels except y → at least one syllable
    ["fire", 1],
    ["happy", 2],      // trailing y is a vowel
    ["melody", 3],
    ["queue", 1],
    ["a", 1],
    ["", 0],
    ["I'm", 1],
    ["extraordinary", 5],
  ])("%s → %i", (word, expected) => {
    expect(estimateSyllables(word)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(estimateSyllables("BEAUTIFUL")).toBe(estimateSyllables("beautiful"));
  });
});
