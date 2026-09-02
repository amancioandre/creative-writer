import { type Board, buildBoard } from "../../domain/writer/Board";
import { writerSchema } from "../../domain/writer/Schema";
import type { WriterFile } from "../../domain/writer/WriterFile";
import type { WriterNotes } from "../ports/WriterNotes";
import type { WriterRepository } from "../ports/WriterRepository";

/** Reads the tagged notes and the writer file and builds the board. Cheap enough to redo on every refresh. */
export class BuildWriterBoard {
  constructor(private readonly notes: WriterNotes, private readonly repo: WriterRepository) {}

  async execute(): Promise<Board> {
    const file = await this.repo.load();
    return buildBoard(await this.notes.notes(file.prefix), file);
  }

  /** The board from a file already in hand. */
  async boardFor(file: WriterFile): Promise<Board> {
    return buildBoard(await this.notes.notes(file.prefix), file);
  }

  /** The protocol text for the vault's current framework and prefix. */
  async schema(): Promise<string> {
    return writerSchema(await this.repo.load());
  }
}
