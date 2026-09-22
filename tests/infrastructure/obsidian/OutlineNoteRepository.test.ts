import { describe, it, expect } from "vitest";
import { OutlineNoteRepository } from "../../../src/infrastructure/obsidian/OutlineNoteRepository";
import { insertScene } from "../../../src/domain/plot/Outline";
import type { ProjectSpec } from "../../../src/domain/progress/Project";

function fakeVault(files: Record<string, string> = {}) {
  let writes = 0;
  return { files, get writes() { return writes; }, async exists(p: string) { return p in files; }, async read(p: string) { return files[p]!; }, async write(p: string, d: string) { files[p] = d; writes++; } };
}
const project: ProjectSpec = { name: "The Devil's Advocate", scope: "Analyses/DA/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Analyses/DA/Analysis.md", ignoredNames: [] };

describe("OutlineNoteRepository", () => {
  it("puts the note beside the threads note, is empty when missing, and creates it with front matter on the first row", async () => {
    const vault = fakeVault();
    const repo = new OutlineNoteRepository(vault);
    expect(repo.pathFor(project)).toBe("Analyses/DA/Outline.md");
    expect(await repo.load(project)).toBe("");
    const { before, after } = await repo.update(project, (md) => insertScene(md, null, "1 Gainesville courtroom"));
    expect(before).toBe("");
    expect(after.startsWith("---\ncreative-writer: false\ncreative-writer-outline: 1\n---")).toBe(true);
    expect(after).toMatch(/## Chapter 1\n### 1 Gainesville courtroom\n$/);
    expect(await repo.load(project)).toBe(after);
  });

  it("an undo that blanks the note is followed by a fresh start, and an unchanged note is not rewritten", async () => {
    const vault = fakeVault();
    const repo = new OutlineNoteRepository(vault);
    const first = await repo.update(project, (md) => insertScene(md, null));
    await repo.update(project, () => first.before);
    expect(vault.files["Analyses/DA/Outline.md"]).toBe("");
    const again = await repo.update(project, (md) => insertScene(md, null, "Again"));
    expect(again.after).toContain("creative-writer-outline: 1");
    expect(again.after).toContain("### Again");
    const writes = vault.writes;
    await repo.update(project, (md) => md);
    expect(vault.writes).toBe(writes);
  });
});
