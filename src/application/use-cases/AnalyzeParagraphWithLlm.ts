import type { Finding, FindingKind } from "../../domain/style/Finding";
import { validateFindings } from "../../domain/style/llm/validateFindings";
import type { ParagraphAnalyser } from "../ports/ParagraphAnalyser";
import type { LlmAnalyser } from "../ports/LlmAnalyser";

export interface LlmAnalysisOptions {
  /** Paragraphs shorter than this are not sent — a model call costs time (and sometimes money). */
  readonly minWords?: number;
}

/**
 * Bridges a model adapter into the `ParagraphAnalyser` shape the scheduler
 * drives. Every model finding goes through `validateFindings` before it can
 * reach the editor — the model never places a mark directly.
 */
export class AnalyzeParagraphWithLlm implements ParagraphAnalyser {
  private readonly minWords: number;

  constructor(
    private readonly llm: LlmAnalyser,
    private readonly enabledKinds: () => ReadonlySet<FindingKind>,
    options: LlmAnalysisOptions = {},
  ) {
    this.minWords = options.minWords ?? 4;
  }

  async analyse(text: string, paragraphFrom: number, signal: AbortSignal): Promise<Finding[]> {
    const checks = [...this.enabledKinds()];
    if (checks.length === 0) return [];
    if (text.trim().split(/\s+/).length < this.minWords) return [];
    const raw = await this.llm.analyse({ text, checks }, signal);
    const wanted = new Set(checks);
    return validateFindings(raw, text)
      .filter((f) => wanted.has(f.kind))
      .map((f) => f.shifted(paragraphFrom));
  }
}
