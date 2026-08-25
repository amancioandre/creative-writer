/**
 * The one answer to "is this note the writer's work?" — shared by the
 * writing log, the project totals, the story map and the threads, so that
 * every feature counts and reads the same notes as the editor runs in.
 */
export interface WritingScope {
  /** `text` is the note's current content when the caller has it fresher than the cache (an open editor). */
  counts(path: string, text?: string): boolean;
}
