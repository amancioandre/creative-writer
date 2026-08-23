import type { SentenceSegmenter } from "../ports/SentenceSegmenter";
import type { RhythmScale } from "../../domain/rhythm/RhythmScale";
import { classifyRhythm } from "../../domain/rhythm/RhythmClassifier";

export interface RhythmAnnotation {
  /** Absolute document offsets. */
  readonly from: number;
  readonly to: number;
  /** 1-based tier in `1..scale.tierCount`. */
  readonly tier: number;
}

export interface AnalyzeParagraphRhythmInput {
  /** The paragraph's full text. */
  readonly text: string;
  /** Document offset where `text` starts, so annotations can be absolute. */
  readonly paragraphFrom: number;
  readonly scale: RhythmScale;
}

/** Turns one paragraph into a list of (range, tier) annotations for rendering. */
export class AnalyzeParagraphRhythm {
  constructor(private readonly segmenter: SentenceSegmenter) {}

  execute({ text, paragraphFrom, scale }: AnalyzeParagraphRhythmInput): RhythmAnnotation[] {
    const annotations: RhythmAnnotation[] = [];
    for (const sentence of this.segmenter.segment(text)) {
      if (sentence.isBlank) continue;
      const trimmedTo = sentence.to - (sentence.text.length - sentence.text.trimEnd().length);
      const trimmedFrom = sentence.from + (sentence.text.length - sentence.text.trimStart().length);
      if (trimmedTo <= trimmedFrom) continue;
      annotations.push({
        from: paragraphFrom + trimmedFrom,
        to: paragraphFrom + trimmedTo,
        tier: classifyRhythm(sentence, scale),
      });
    }
    return annotations;
  }
}
