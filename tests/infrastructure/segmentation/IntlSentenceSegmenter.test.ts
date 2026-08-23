import { describe, it, expect } from "vitest";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";

describe("IntlSentenceSegmenter", () => {
  const seg = new IntlSentenceSegmenter("en");

  it("splits on terminal punctuation and keeps exact offsets", () => {
    const text = "First one. Second, longer one! Third?";
    const out = seg.segment(text);
    expect(out.map((s) => s.text)).toEqual(["First one. ", "Second, longer one! ", "Third?"]);
    for (const s of out) expect(text.slice(s.from, s.to)).toBe(s.text);
  });

  it("does not split on abbreviations like Mr. or e.g.", () => {
    const out = seg.segment("Mr. Smith left, e.g. early. Then rain.");
    expect(out).toHaveLength(2);
  });

  it("covers the whole input contiguously", () => {
    const text = "A. B.\nC across lines. D";
    const out = seg.segment(text);
    expect(out[0]!.from).toBe(0);
    expect(out[out.length - 1]!.to).toBe(text.length);
    for (let i = 1; i < out.length; i++) expect(out[i]!.from).toBe(out[i - 1]!.to);
  });

  it("returns an empty list for empty text", () => {
    expect(seg.segment("")).toEqual([]);
  });

  it("handles quotes and unicode punctuation", () => {
    const out = seg.segment("“Leave,” she said. He didn’t…");
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});
