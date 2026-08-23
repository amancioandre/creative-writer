import { describe, it, expect } from "vitest";
import { Sentence } from "../../../src/domain/rhythm/Sentence";
import { measureSentence } from "../../../src/domain/rhythm/SentenceMetrics";

const s = (text: string) => Sentence.create(text, 0, text.length);

describe("measureSentence", () => {
  it("counts words using unicode letter runs", () => {
    expect(measureSentence(s("The quick brown fox.")).wordCount).toBe(4);
  });

  it("treats hyphenated and apostrophe words as single words", () => {
    expect(measureSentence(s("Don't over-think it.")).wordCount).toBe(3);
  });

  it("counts commas", () => {
    expect(measureSentence(s("One, two, three.")).commaCount).toBe(2);
  });

  it("reports comma density as commas per word", () => {
    const m = measureSentence(s("One, two, three, four."));
    expect(m.commaDensity).toBeCloseTo(3 / 4);
  });

  it("sums syllables across words", () => {
    expect(measureSentence(s("Beautiful cat.")).syllableCount).toBe(4);
  });

  it("handles an empty/whitespace sentence without dividing by zero", () => {
    const m = measureSentence(s("   "));
    expect(m.wordCount).toBe(0);
    expect(m.commaDensity).toBe(0);
    expect(m.syllableCount).toBe(0);
  });

  it("counts non-ASCII words (Portuguese)", () => {
    expect(measureSentence(s("A canção é linda.")).wordCount).toBe(4);
  });
});
