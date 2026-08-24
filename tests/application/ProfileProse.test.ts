import { describe, it, expect } from "vitest";
import { ProfileProse } from "../../src/application/use-cases/ProfileProse";
import { IntlSentenceSegmenter } from "../../src/infrastructure/segmentation/IntlSentenceSegmenter";

const profile = new ProfileProse(new IntlSentenceSegmenter());

describe("ProfileProse.paragraph", () => {
  it("returns null bands for empty text", () => {
    const p = profile.paragraph("");
    expect(p.wordCount).toBe(0);
    expect(p.readingEase).toBeNull();
    expect(p.variety).toBeNull();
    expect(p.dialogue.ratio).toBe(0);
  });

  it("measures a simple paragraph", () => {
    const p = profile.paragraph("The dog ran. It ran fast. Then it stopped by the creek and drank.");
    expect(p.sentenceCount).toBe(3);
    expect(p.wordCount).toBe(14);
    expect(p.readingEase!.band.label).toMatch(/easy/i);
    expect(p.variety).not.toBeNull();
  });

  it("rates Latinate, long-sentence prose as denser than plain prose", () => {
    const plain = profile.paragraph("He sat. He waited. The room was cold. Nobody came.");
    const dense = profile.paragraph(
      "Notwithstanding the aforementioned considerations, the administrative implementation of the organisational restructuring necessitated comprehensive re-evaluation.",
    );
    expect(dense.readingEase!.score).toBeLessThan(plain.readingEase!.score);
  });

  it("computes dialogue share", () => {
    const p = profile.paragraph('"Come here," she said. "Now." He came.');
    expect(p.dialogue.ratio).toBeCloseTo(3 / 7, 5);
  });
});

describe("ProfileProse.document", () => {
  it("ignores headings and lists and counts prose paragraphs", () => {
    const p = profile.document("# Title\n- a list item\n\nOne. Two three. Four five six.\n\nSeven.");
    expect(p.paragraphCount).toBe(2);
    expect(p.sentenceCount).toBe(4);
    expect(p.wordCount).toBe(7);
  });
});
