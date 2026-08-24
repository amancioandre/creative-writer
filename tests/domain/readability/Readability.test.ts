import { describe, it, expect } from "vitest";
import {
  dialogueBand,
  fleschKincaidGrade,
  fleschReadingEase,
  readingEaseBand,
  sentenceVariety,
  varietyBand,
} from "../../../src/domain/readability/Readability";

describe("fleschReadingEase", () => {
  it("matches the textbook formula", () => {
    // 100 words, 10 sentences, 150 syllables → 206.835 - 10.15 - 126.9 = 69.785
    expect(fleschReadingEase({ wordCount: 100, sentenceCount: 10, syllableCount: 150 })).toBeCloseTo(69.785, 3);
  });

  it("is null with no words or no sentences", () => {
    expect(fleschReadingEase({ wordCount: 0, sentenceCount: 0, syllableCount: 0 })).toBeNull();
    expect(fleschReadingEase({ wordCount: 5, sentenceCount: 0, syllableCount: 6 })).toBeNull();
  });

  it("falls as sentences lengthen or words get heavier", () => {
    const base = fleschReadingEase({ wordCount: 100, sentenceCount: 10, syllableCount: 150 })!;
    expect(fleschReadingEase({ wordCount: 100, sentenceCount: 5, syllableCount: 150 })!).toBeLessThan(base);
    expect(fleschReadingEase({ wordCount: 100, sentenceCount: 10, syllableCount: 200 })!).toBeLessThan(base);
  });
});

describe("fleschKincaidGrade", () => {
  it("matches the textbook formula", () => {
    // 0.39*10 + 11.8*1.5 - 15.59 = 6.01
    expect(fleschKincaidGrade({ wordCount: 100, sentenceCount: 10, syllableCount: 150 })).toBeCloseTo(6.01, 2);
  });
  it("is null with nothing to measure", () => {
    expect(fleschKincaidGrade({ wordCount: 0, sentenceCount: 0, syllableCount: 0 })).toBeNull();
  });
});

describe("readingEaseBand", () => {
  it("covers the whole scale monotonically", () => {
    const labels = [95, 85, 75, 65, 55, 40, 10].map((s) => readingEaseBand(s).label);
    expect(labels).toEqual(["Very easy", "Easy", "Fairly easy", "Plain", "Fairly dense", "Dense", "Very dense"]);
    expect(new Set(labels).size).toBe(7);
  });
  it("handles out-of-range scores", () => {
    expect(readingEaseBand(120).label).toBe("Very easy");
    expect(readingEaseBand(-20).label).toBe("Very dense");
  });
  it("uses the lower bound inclusively", () => {
    expect(readingEaseBand(60).label).toBe("Plain");
    expect(readingEaseBand(59.99).label).toBe("Fairly dense");
  });
});

describe("sentenceVariety", () => {
  it("needs at least three non-empty sentences", () => {
    expect(sentenceVariety([10, 12])).toBeNull();
    expect(sentenceVariety([10, 12, 0])).toBeNull();
  });
  it("is zero for identical lengths and grows with spread", () => {
    expect(sentenceVariety([10, 10, 10])!.cv).toBe(0);
    expect(sentenceVariety([2, 10, 30])!.cv).toBeGreaterThan(sentenceVariety([8, 10, 12])!.cv);
  });
  it("is scale-free", () => {
    expect(sentenceVariety([5, 10, 15])!.cv).toBeCloseTo(sentenceVariety([50, 100, 150])!.cv, 10);
  });
});

describe("bands", () => {
  it("names variety from monotone to dynamic", () => {
    expect([0.1, 0.4, 0.6, 1.0].map((cv) => varietyBand(cv).label)).toEqual(["Monotone", "Steady", "Varied", "Dynamic"]);
  });
  it("names dialogue share", () => {
    expect([0, 0.3, 0.7].map((r) => dialogueBand(r).label)).toEqual(["Narration-led", "Balanced", "Dialogue-led"]);
  });
  it("every band carries an actionable hint", () => {
    for (const b of [readingEaseBand(50), varietyBand(0.5), dialogueBand(0.5)]) expect(b.hint.length).toBeGreaterThan(20);
  });
});
