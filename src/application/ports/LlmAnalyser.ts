import type { FindingKind } from "../../domain/style/Finding";

export interface LlmRequest {
  /** The paragraph to analyse. */
  readonly text: string;
  /** Which kinds the model should look for. */
  readonly checks: readonly FindingKind[];
}

/** Model-backed analysis. Returns the model's raw findings; the use case validates them. */
export interface LlmAnalyser {
  readonly name: string;
  analyse(request: LlmRequest, signal: AbortSignal): Promise<unknown[]>;
}
