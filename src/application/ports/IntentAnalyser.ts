/** One side of a contradiction as the model sees it: where, what was said, and a little around it. */
export interface IntentSide {
  readonly scene: string;
  readonly value: string;
  readonly evidence: string;
  /** The paragraph the evidence sits in, so the model can tell a reveal from a slip. */
  readonly context: string;
}

export interface IntentRequest {
  readonly subject: string;
  readonly attribute: string;
  /** The earlier scene in manuscript order. */
  readonly first: IntentSide;
  readonly second: IntentSide;
}

/**
 * Model-backed reading of one contradiction: does the later scene mean
 * to overturn the earlier one (a reversal), slip (an error), or say the
 * same thing another way? Returns the raw report; the domain validates
 * it. The verdict is a proposal the writer accepts; code never sets a
 * thread from it.
 */
export interface IntentAnalyser {
  readonly name: string;
  readonly rulebook: string;
  analyse(request: IntentRequest, signal: AbortSignal): Promise<unknown>;
}
