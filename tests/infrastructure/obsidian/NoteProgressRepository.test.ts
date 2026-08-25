import { describe, it, expect } from "vitest";
import { NoteProgressRepository } from "../../../src/infrastructure/obsidian/NoteProgressRepository";
import { vaultNoteIO, type VaultLike } from "../../../src/infrastructure/obsidian/VaultNoteIO";
import { EMPTY_LOG } from "../../../src/domain/progress/WritingLog";

const log = { days: { "2026-08-24": { added: 5, removed: 1, files: { "a.md": { added: 5, removed: 1 } } } }, counts: { "a.md": 40 } };

function fakeVault() {
  const files = new Map<string, string>();
  const folders = new Set<string>();
  const vault: VaultLike = {
    getAbstractFileByPath: (p) => (files.has(p) ? { path: p } : folders.has(p) ? { path: p, children: [] } : null),
    cachedRead: async (f) => files.get((f as { path: string }).path)!,
    modify: async (f, c) => { files.set((f as { path: string }).path, c); },
    create: async (p, c) => { files.set(p, c); },
    createFolder: async (p) => { folders.add(p); },
  };
  return { vault, files, folders };
}

describe("NoteProgressRepository", () => {
  it("is empty when there is no note and no legacy history", async () => {
    const { vault } = fakeVault();
    expect(await new NoteProgressRepository(vaultNoteIO(vault), () => "Creative Writer/Writing log.md").load()).toEqual(EMPTY_LOG);
  });
  it("saves into a note, creating parent folders, and reads it back", async () => {
    const { vault, files, folders } = fakeVault();
    const repo = new NoteProgressRepository(vaultNoteIO(vault), () => "Creative Writer/Logs/Writing log.md");
    await repo.save(log);
    expect([...folders]).toEqual(["Creative Writer", "Creative Writer/Logs"]);
    expect(files.get("Creative Writer/Logs/Writing log.md")).toContain("creative-writer-log: 1");
    expect(await repo.load()).toEqual(log);
    await repo.save({ ...log, counts: { "a.md": 41 } });
    expect((await repo.load()).counts["a.md"]).toBe(41);
  });
  it("keeps a parent folder the index does not know yet instead of failing the write", async () => {
    // On "Reload app without saving" the vault index lags the disk: the folder is there, getAbstractFileByPath says it is not.
    const { vault, files } = fakeVault();
    const strict: VaultLike = { ...vault, createFolder: async (p) => { if (p === "Creative Writer") throw new Error("Folder already exists."); await vault.createFolder(p); } };
    await new NoteProgressRepository(vaultNoteIO(strict), () => "Creative Writer/Writing log.md").save(log);
    expect(files.has("Creative Writer/Writing log.md")).toBe(true);
    const broken: VaultLike = { ...vault, createFolder: async () => { throw new Error("EACCES"); } };
    await expect(new NoteProgressRepository(vaultNoteIO(broken), () => "Locked/Writing log.md").save(log)).rejects.toThrow("EACCES");
  });

  it("imports legacy history once, when the note does not exist yet", async () => {
    const { vault, files } = fakeVault();
    let legacyLoads = 0;
    const legacy = { load: async () => { legacyLoads++; return log; }, save: async () => undefined };
    const repo = new NoteProgressRepository(vaultNoteIO(vault), () => "Writing log.md", legacy);
    expect(await repo.load()).toEqual(log);
    expect(files.has("Writing log.md")).toBe(true);
    expect(await repo.load()).toEqual(log);
    expect(legacyLoads).toBe(1);
  });
  it("does not write a note for an empty legacy log", async () => {
    const { vault, files } = fakeVault();
    const repo = new NoteProgressRepository(vaultNoteIO(vault), () => "Writing log.md", { load: async () => EMPTY_LOG, save: async () => undefined });
    expect(await repo.load()).toEqual(EMPTY_LOG);
    expect(files.size).toBe(0);
  });
  it("follows a changed path at the next save", async () => {
    const { vault, files } = fakeVault();
    let path = "A.md";
    const repo = new NoteProgressRepository(vaultNoteIO(vault), () => path);
    await repo.save(log);
    path = "B.md";
    await repo.save(log);
    expect([...files.keys()]).toEqual(["A.md", "B.md"]);
  });
});
