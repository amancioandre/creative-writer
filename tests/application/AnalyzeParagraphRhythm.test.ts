import { describe, it, expect } from "vitest";
import { AnalyzeParagraphRhythm } from "../../src/application/use-cases/AnalyzeParagraphRhythm";
import type { SentenceSegmenter } from "../../src/application/ports/SentenceSegmenter";
import { Sentence } from "../../src/domain/rhythm/Sentence";
import { RhythmScale } from "../../src/domain/rhythm/RhythmScale";

/** Deterministic segmenter: splits on ". " so tests don't depend on Intl. */
const fakeSegmenter: SentenceSegmenter = {
  segment(text: string): Sentence[] {
    const out: Sentence[] = [];
    const re = /[^.]*\.?\s*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && m[0].length > 0) {
      out.push(Sentence.create(m[0], m.index, m.index + m[0].length));
    }
    return out;
  },
};

describe("AnalyzeParagraphRhythm", () => {
  const useCase = new AnalyzeParagraphRhythm(fakeSegmenter);
  const scale = RhythmScale.withTiers(6);

  it("returns one annotation per non-blank sentence, offset by paragraph start", () => {
    const text = "Go. This one is a little bit longer than the first.";
    const result = useCase.execute({ text, paragraphFrom: 100, scale });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ from: 100, to: 103, tier: 1 }); // "Go." — trailing space trimmed
    expect(result[1]!.from).toBe(104);
    expect(result[1]!.to).toBe(100 + text.length);
    expect(result[1]!.tier).toBeGreaterThan(1);
  });

  it("trims trailing whitespace out of the annotated span", () => {
    const result = useCase.execute({ text: "Hi.   ", paragraphFrom: 0, scale });
    expect(result[0]).toMatchObject({ from: 0, to: 3 });
  });

  it("skips blank sentences entirely", () => {
    expect(useCase.execute({ text: "   ", paragraphFrom: 0, scale })).toEqual([]);
  });

  it("never produces an empty or inverted range", () => {
    for (const r of useCase.execute({ text: "A. B. C.", paragraphFrom: 0, scale })) {
      expect(r.to).toBeGreaterThan(r.from);
    }
  });
});
