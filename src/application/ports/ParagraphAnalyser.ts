import type { Finding } from "../../domain/style/Finding";

/**
 * An analysis that may take time: a tagger, a model, a network call.
 * Tier 1 rules are synchronous `StyleRule`s; anything slower implements this
 * and is driven by `ScheduleAnalysis`, which owns debounce, cancel and cache.
 *
 * Findings must use offsets relative to the paragraph shifted by
 * `paragraphFrom` — i.e. absolute document offsets.
 */
export interface ParagraphAnalyser {
  analyse(text: string, paragraphFrom: number, signal: AbortSignal): Promise<Finding[]>;
}
