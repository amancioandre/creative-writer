import { describe, it, expect } from "vitest";
import { StoryThreadsNoteRepository } from "../../../src/infrastructure/obsidian/StoryThreadsNoteRepository";
import { upsertThreadItem } from "../../../src/domain/threads/StoryThreadsNote";
import type { ProjectSpec } from "../../../src/domain/progress/Project";

function fakeVault(files: Record<string, string> = {}) {
  let writes = 0;
  return { files, get writes() { return writes; }, async exists(p: string) { return p in files; }, async read(p: string) { return files[p]!; }, async write(p: string, d: string) { files[p] = d; writes++; } };
}
const folderProject: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const noteProject: ProjectSpec = { name: "Short", scope: "Shorts/Gull.md", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Shorts/Gull.md", ignoredNames: [] };

describe("StoryThreadsNoteRepository", () => {
  it("puts the note beside the story map note", () => {
    expect(StoryThreadsNoteRepository.pathFor(folderProject)).toBe("Novel/Story threads.md");
    expect(StoryThreadsNoteRepository.pathFor(noteProject)).toBe("Shorts/Story threads.md");
    expect(StoryThreadsNoteRepository.pathFor({ ...folderProject, scope: "" })).toBe("Story threads.md");
  });

  it("is empty when missing and creates the note with front matter on the first edit", async () => {
    const vault = fakeVault();
    const repo = new StoryThreadsNoteRepository(vault);
    expect(await repo.load(folderProject)).toBe("");
    const written = await repo.update(folderProject, (md) => upsertThreadItem(md, "Gate", "One#Camp", "planted"));
    expect(written.startsWith("---\ncreative-writer: false\ncreative-writer-threads: 1\n---")).toBe(true);
    expect(written).toContain("## Gate\n- [[One#Camp]] — planted");
    expect(await repo.load(folderProject)).toBe(written);
  });

  it("does not rewrite an unchanged note, and serialises concurrent edits", async () => {
    const vault = fakeVault({ "Novel/Story threads.md": "## Gate\n- [[One#Camp]]\n" });
    const repo = new StoryThreadsNoteRepository(vault);
    await repo.update(folderProject, (md) => md);
    expect(vault.writes).toBe(0);
    await Promise.all([
      repo.update(folderProject, (md) => upsertThreadItem(md, "Gate", "Two#Return", "")),
      repo.update(folderProject, (md) => upsertThreadItem(md, "Letter", "One#Creek", "")),
    ]);
    expect(vault.files["Novel/Story threads.md"]).toBe("## Gate\n- [[One#Camp]]\n- [[Two#Return]]\n\n## Letter\n- [[One#Creek]]\n");
    expect(vault.writes).toBe(2);
  });

  it("treats an unreadable note as empty", async () => {
    const repo = new StoryThreadsNoteRepository({ async exists() { return true; }, async read() { throw new Error("nope"); }, async write() { /* unused */ } });
    expect(await repo.load(folderProject)).toBe("");
  });
});
