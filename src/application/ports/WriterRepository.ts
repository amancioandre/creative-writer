import type { WriterFile } from "../../domain/writer/WriterFile";

/** The one `.writer` file of the vault: layout, colours, named edges, framework. Absent until first saved. */
export interface WriterRepository {
  /** The file's path, or null when the vault has none yet. */
  path(): string | null;
  /** The file, or the empty one when there is none or it cannot be read. */
  load(): Promise<WriterFile>;
  save(file: WriterFile): Promise<void>;
  /** Read, change, write, serialised so two quick edits cannot interleave. */
  update(change: (file: WriterFile) => WriterFile): Promise<WriterFile>;
}
