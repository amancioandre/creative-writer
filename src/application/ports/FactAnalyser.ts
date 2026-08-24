/**
 * Model-backed reading of one scene for concrete facts about the names in
 * it. Returns the raw report; the domain validates it. Its own type, not
 * `RelationAnalyser`, so the wiring cannot hand one prompt's adapter to
 * the other's use case.
 */
export interface FactAnalyser {
  readonly name: string;
  /** Version of the prompt in use; a reading made under an older one is worth redoing. */
  readonly rulebook: string;
  analyse(text: string, present: readonly string[], signal: AbortSignal): Promise<unknown>;
}
