import type { Finding } from "./Finding";
import type { PosTagger, TaggedToken } from "./PosTagger";

/**
 * Per-analysis scratch shared by every rule, so expensive work (tagging)
 * happens once per paragraph however many rules need it.
 */
export class AnalysisContext {
  private memo: TaggedToken[] | null = null;

  constructor(readonly text: string, private readonly tagger: PosTagger | null) {}

  get hasTagger(): boolean {
    return this.tagger !== null;
  }

  tagged(): TaggedToken[] {
    if (!this.tagger) return [];
    return (this.memo ??= this.tagger.tag(this.text));
  }
}

/** A pure style check over one paragraph's text. Findings use text-relative offsets. */
export interface StyleRule {
  analyse(text: string, ctx?: AnalysisContext): Finding[];
}
