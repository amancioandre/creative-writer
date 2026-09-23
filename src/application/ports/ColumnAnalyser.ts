import type { ColumnKind } from "../../domain/threads/StoryThreadsNote";
import type { ProposalBrief } from "../../domain/plot/Proposals";

/** What the model is told about the column it reads for: its name, its kind, and the stops already written, as examples of the writer's voice. */
export interface ColumnBrief {
  readonly name: string;
  readonly kind: ColumnKind;
  readonly examples: readonly string[];
  /** For an arc: the character the column follows. */
  readonly character?: string;
  /** For a graded column: its scale, most negative first, so the reading can name the one word the scene mostly appears to be. */
  readonly scale?: readonly string[];
}

/**
 * Model-backed reading of one scene for one column of the plot grid.
 * `read` asks what the thread is doing in the scene; `check` asks
 * whether a plan the writer typed is on the page, and where. Both return
 * the raw report; the domain validates it and the writer answers it.
 * The model never writes a cell.
 */
export interface ColumnAnalyser {
  readonly name: string;
  /** Version of the prompt in use; a reading made under an older one is worth redoing. */
  readonly rulebook: string;
  read(text: string, present: readonly string[], column: ColumnBrief, signal: AbortSignal): Promise<unknown>;
  check(text: string, plan: { readonly note: string; readonly role: string | null }, column: ColumnBrief, signal: AbortSignal): Promise<unknown>;
  /** Which threads run through the book, from the events already read and the cast. One call, not one per scene. */
  propose(brief: ProposalBrief, signal: AbortSignal): Promise<unknown>;
}
