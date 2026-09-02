import { describe, it, expect } from "vitest";
import { WriterFileRepository, type WriterVaultLike } from "../../../src/infrastructure/obsidian/WriterFileRepository";
import { EMPTY_WRITER_FILE, placeCard, serializeWriterFile } from "../../../src/domain/writer/WriterFile";

function fakeVault(initial: Record<string, string> = {}): WriterVaultLike & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    paths: () => Object.keys(files),
    exists: async (p) => p in files,
    read: async (p) => files[p]!,
    write: async (p, c) => { files[p] = c; },
  };
}

describe("WriterFileRepository", () => {
  it("finds the vault's writer file by extension, shortest path first", () => {
    const vault = fakeVault({ "notes/a.md": "", "deep/Writer.writer": "{}", "Board.writer": "{}", "x.canvas": "{}" });
    expect(new WriterFileRepository(vault).path()).toBe("Board.writer");
    expect(new WriterFileRepository(fakeVault({ "a.md": "" })).path()).toBeNull();
  });
  it("loads the empty file when there is none or it is unreadable", async () => {
    expect(await new WriterFileRepository(fakeVault()).load()).toEqual(EMPTY_WRITER_FILE);
    expect(await new WriterFileRepository(fakeVault({ "Writer.writer": "{nope" })).load()).toEqual(EMPTY_WRITER_FILE);
  });
  it("creates the file in the stories folder on first save, at the root without one, and writes in place after", async () => {
    const vault = fakeVault();
    const repo = new WriterFileRepository(vault, () => "/storytelling/");
    const file = placeCard(EMPTY_WRITER_FILE, "a.md", { x: 1, y: 2 });
    await repo.save(file);
    expect(Object.keys(vault.files)).toEqual(["storytelling/Writer.writer"]);
    expect(vault.files["storytelling/Writer.writer"]).toBe(serializeWriterFile(file));
    expect(await repo.load()).toEqual(file);

    const root = fakeVault();
    await new WriterFileRepository(root).save(file);
    expect(Object.keys(root.files)).toEqual(["Writer.writer"]);

    const existing = fakeVault({ "elsewhere/Mine.writer": serializeWriterFile(EMPTY_WRITER_FILE) });
    await new WriterFileRepository(existing, () => "storytelling").save(file);
    expect(Object.keys(existing.files)).toEqual(["elsewhere/Mine.writer"]);
  });
  it("serialises updates", async () => {
    const vault = fakeVault();
    const repo = new WriterFileRepository(vault);
    await Promise.all([
      repo.update((f) => placeCard(f, "a.md", { x: 1, y: 1 })),
      repo.update((f) => placeCard(f, "b.md", { x: 2, y: 2 })),
    ]);
    expect(Object.keys((await repo.load()).cards)).toEqual(["a.md", "b.md"]);
  });
});
