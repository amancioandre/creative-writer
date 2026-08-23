import { Sentence } from "../../domain/rhythm/Sentence";
import type { SentenceSegmenter } from "../../application/ports/SentenceSegmenter";
import { mergeAbbreviationSplits } from "../../domain/rhythm/AbbreviationMerger";

/**
 * Sentence segmentation via the platform's ICU data (`Intl.Segmenter`), which
 * Electron ships — no dependency and abbreviation-aware out of the box.
 */
export class IntlSentenceSegmenter implements SentenceSegmenter {
  private readonly segmenter: Intl.Segmenter;

  constructor(locale: string = "en") {
    this.segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  }

  segment(text: string): Sentence[] {
    const out: Sentence[] = [];
    for (const { segment, index } of this.segmenter.segment(text)) {
      out.push(Sentence.create(segment, index, index + segment.length));
    }
    return mergeAbbreviationSplits(out);
  }
}
