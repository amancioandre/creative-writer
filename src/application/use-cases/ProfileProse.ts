import type { SentenceSegmenter } from "../ports/SentenceSegmenter";
import { measureSentence } from "../../domain/rhythm/SentenceMetrics";
import { countDialogueWords } from "../../domain/text/Dialogue";
import { proseParagraphs } from "../../domain/text/ProseParagraphs";
import {
  type Band,
  dialogueBand,
  fleschKincaidGrade,
  fleschReadingEase,
  readingEaseBand,
  sentenceVariety,
} from "../../domain/readability/Readability";

export interface ProseProfile {
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly paragraphCount: number;
  /** Null when there is nothing to measure. */
  readonly readingEase: { score: number; grade: number; band: Band } | null;
  /** Null with fewer than three sentences. */
  readonly variety: { cv: number; band: Band } | null;
  readonly dialogue: { ratio: number; band: Band };
}

/**
 * Measures prose: readability, sentence-length variety and dialogue share.
 * `paragraph` takes raw text (the cursor paragraph); `document` takes
 * markdown and measures only its prose paragraphs.
 */
export class ProfileProse {
  constructor(private readonly segmenter: SentenceSegmenter) {}

  paragraph(text: string): ProseProfile {
    return this.profile([text]);
  }

  document(markdown: string): ProseProfile {
    return this.profile(proseParagraphs(markdown).map((p) => p.text));
  }

  private profile(paragraphs: readonly string[]): ProseProfile {
    let wordCount = 0;
    let syllableCount = 0;
    let dialogueWords = 0;
    const sentenceLengths: number[] = [];
    for (const text of paragraphs) {
      dialogueWords += countDialogueWords(text);
      for (const sentence of this.segmenter.segment(text)) {
        if (sentence.isBlank) continue;
        const m = measureSentence(sentence);
        if (m.wordCount === 0) continue;
        wordCount += m.wordCount;
        syllableCount += m.syllableCount;
        sentenceLengths.push(m.wordCount);
      }
    }
    const input = { wordCount, sentenceCount: sentenceLengths.length, syllableCount };
    const score = fleschReadingEase(input);
    const grade = fleschKincaidGrade(input);
    const ratio = wordCount === 0 ? 0 : Math.min(1, dialogueWords / wordCount);
    return {
      wordCount,
      sentenceCount: sentenceLengths.length,
      paragraphCount: paragraphs.length,
      readingEase: score === null || grade === null ? null : { score, grade, band: readingEaseBand(score) },
      variety: sentenceVariety(sentenceLengths),
      dialogue: { ratio, band: dialogueBand(ratio) },
    };
  }
}
