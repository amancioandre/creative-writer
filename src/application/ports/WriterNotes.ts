import type { WriterNote } from "../../domain/writer/Board";

/** Reads every note in the vault that carries a tag under the writer prefix. */
export interface WriterNotes {
  notes(prefix: string): Promise<WriterNote[]>;
}
