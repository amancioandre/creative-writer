/** Model-backed reading of one scene for relationships, external references and events. Returns the raw report. */
export interface RelationAnalyser {
  readonly name: string;
  analyse(text: string, present: readonly string[], signal: AbortSignal): Promise<unknown>;
}
