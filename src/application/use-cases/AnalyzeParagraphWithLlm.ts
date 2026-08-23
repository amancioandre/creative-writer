import type { Finding, FindingKind } from "../../domain/style/Finding";
import { validateFindings } from "../../domain/style/llm/validateFindings";
import type { ParagraphAnalyser } from "../ports/ParagraphAnalyser";
import type { LlmAnalyser } from "../ports/LlmAnalyser";

/**
 * Kinds a model is asked about. The rules own the mechanical checks (weak
 * words, adverbs, nominalisations, weak verbs, repetition, filter verbs) —
 * on the eval corpus they beat a 7B model by a wide margin. The model is
 * for judgement: is this cliché tired *here*, is this metaphor fresh, does
 * this passive hide an agent the reader should see.
 */
export const MODEL_KINDS: ReadonlySet<FindingKind> = new Set(["cliche", "metaphor", "passive"]);

export interface LlmAnalysisOptions {
  /** Paragraphs shorter than this are not sent — a model call costs time (and sometimes money). */
  readonly minWords?: number;
  /** Override which kinds the model may be asked about. */
  readonly kinds?: ReadonlySet<FindingKind>;
}

/**
 * Bridges a model adapter into the `ParagraphAnalyser` shape the scheduler
 * drives. Every model finding goes through `validateFindings` before it can
 * reach the editor — the model never places a mark directly.
 */
export class AnalyzeParagraphWithLlm implements ParagraphAnalyser {
  private readonly minWords: number;
  private readonly kinds: ReadonlySet<FindingKind>;

  constructor(
    private readonly llm: LlmAnalyser,
    private readonly enabledKinds: () => ReadonlySet<FindingKind>,
    options: LlmAnalysisOptions = {},
  ) {
    this.minWords = options.minWords ?? 4;
    this.kinds = options.kinds ?? MODEL_KINDS;
  }

  async analyse(text: string, paragraphFrom: number, signal: AbortSignal): Promise<Finding[]> {
    const checks = [...this.enabledKinds()].filter((k) => this.kinds.has(k));
    if (checks.length === 0) return [];
    if (text.trim().split(/\s+/).length < this.minWords) return [];
    const raw = await this.llm.analyse({ text, checks }, signal);
    const wanted = new Set(checks);
    return validateFindings(raw, text)
      .filter((f) => wanted.has(f.kind))
      .map((f) => f.shifted(paragraphFrom));
  }
}
