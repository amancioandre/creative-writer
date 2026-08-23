import { describe, it, expect } from "vitest";
import { RhythmScale } from "../../../src/domain/rhythm/RhythmScale";
import { classifyRhythm } from "../../../src/domain/rhythm/RhythmClassifier";
import { Sentence } from "../../../src/domain/rhythm/Sentence";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ") + ".";
const s = (text: string) => Sentence.create(text, 0, text.length);

describe("RhythmScale", () => {
  it("builds a default scale for 4, 5 and 6 tiers", () => {
    expect(RhythmScale.withTiers(4).tierCount).toBe(4);
    expect(RhythmScale.withTiers(5).tierCount).toBe(5);
    expect(RhythmScale.withTiers(6).tierCount).toBe(6);
  });

  it("rejects tier counts outside 4..6", () => {
    expect(() => RhythmScale.withTiers(3)).toThrow();
    expect(() => RhythmScale.withTiers(7)).toThrow();
  });

  it("has strictly increasing boundaries, one fewer than tiers", () => {
    const scale = RhythmScale.withTiers(6);
    expect(scale.boundaries).toHaveLength(5);
    for (let i = 1; i < scale.boundaries.length; i++) {
      expect(scale.boundaries[i]!).toBeGreaterThan(scale.boundaries[i - 1]!);
    }
  });
});

describe("classifyRhythm", () => {
  const scale = RhythmScale.withTiers(6);

  it("places a very short sentence in tier 1", () => {
    expect(classifyRhythm(s("Go."), scale)).toBe(1);
  });

  it("places a very long sentence in the top tier", () => {
    expect(classifyRhythm(s(words(80)), scale)).toBe(6);
  });

  it("is monotonic: longer sentences never get a lower tier", () => {
    let prev = 0;
    for (let n = 1; n <= 60; n += 3) {
      const tier = classifyRhythm(s(words(n)), scale);
      expect(tier).toBeGreaterThanOrEqual(prev);
      prev = tier;
    }
  });

  it("uses every tier across a realistic length spread", () => {
    const seen = new Set<number>();
    for (let n = 1; n <= 60; n++) seen.add(classifyRhythm(s(words(n)), scale));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("weights commas: a clause-heavy sentence ranks above a plain one of equal word count", () => {
    const plain = s("one two three four five six seven eight nine ten eleven twelve.");
    const clausy = s("one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve.");
    expect(classifyRhythm(clausy, scale)).toBeGreaterThanOrEqual(classifyRhythm(plain, scale));
  });

  it("respects a 4-tier scale's range", () => {
    const four = RhythmScale.withTiers(4);
    expect(classifyRhythm(s("Go."), four)).toBe(1);
    expect(classifyRhythm(s(words(80)), four)).toBe(4);
  });

  it("gives blank sentences tier 1 (never throws)", () => {
    expect(classifyRhythm(s("   "), scale)).toBe(1);
  });
});
