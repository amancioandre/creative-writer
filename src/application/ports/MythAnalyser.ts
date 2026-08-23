/** Model-backed reading of a passage for mythic pattern and archetype. Returns the raw report object. */
export interface MythAnalyser {
  readonly name: string;
  analyse(text: string, signal: AbortSignal): Promise<unknown>;
}
