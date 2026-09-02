import { describe, it, expect } from "vitest";
import { BuildWriterBoard } from "../../src/application/use-cases/BuildWriterBoard";
import type { WriterNotes } from "../../src/application/ports/WriterNotes";
import type { WriterRepository } from "../../src/application/ports/WriterRepository";
import { EMPTY_WRITER_FILE, type WriterFile } from "../../src/domain/writer/WriterFile";

const notes: WriterNotes = {
  notes: async (prefix) => [
    { path: "a.md", title: "A", tags: [`#${prefix}/theme`], links: [], excerpt: "" },
    { path: "b.md", title: "B", tags: ["#writer/theme"], links: [], excerpt: "" },
  ],
};
const repo = (file: WriterFile): WriterRepository => ({ path: () => null, load: async () => file, save: async () => undefined, update: async (c) => c(file) });

describe("BuildWriterBoard", () => {
  it("reads the notes with the file's prefix and builds the board", async () => {
    const board = await new BuildWriterBoard(notes, repo({ ...EMPTY_WRITER_FILE, prefix: "me" })).execute();
    expect(board.cards.map((c) => c.path)).toEqual(["a.md"]);
    const both = await new BuildWriterBoard(notes, repo(EMPTY_WRITER_FILE)).execute();
    expect(both.cards.map((c) => c.path)).toEqual(["a.md", "b.md"]);
  });
  it("hands out the schema for the current file", async () => {
    expect(await new BuildWriterBoard(notes, repo({ ...EMPTY_WRITER_FILE, prefix: "me" })).schema()).toContain("`#me/theme`");
  });
});
