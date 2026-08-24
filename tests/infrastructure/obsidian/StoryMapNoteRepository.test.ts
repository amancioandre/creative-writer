import { describe, it, expect } from "vitest";
import { StoryMapNoteRepository } from "../../../src/infrastructure/obsidian/StoryMapNoteRepository";
import { EMPTY_STORY_MAP_FILE, putReading } from "../../../src/domain/story/StoryMapFile";
import type { ProjectSpec } from "../../../src/domain/progress/Project";

function fakeVault(files: Record<string, string> = {}) {
  return { files, async exists(p: string) { return p in files; }, async read(p: string) { return files[p]!; }, async write(p: string, d: string) { files[p] = d; } };
}
const folderProject: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const noteProject: ProjectSpec = { name: "Short", scope: "Shorts/Gull.md", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Shorts/Gull.md", ignoredNames: [] };

describe("StoryMapNoteRepository", () => {
  it("puts the note in the project folder, or beside a single-note project", () => {
    expect(StoryMapNoteRepository.pathFor(folderProject)).toBe("Novel/Story map.md");
    expect(StoryMapNoteRepository.pathFor(noteProject)).toBe("Shorts/Story map.md");
    expect(StoryMapNoteRepository.pathFor({ ...folderProject, scope: "" })).toBe("Story map.md");
  });
  it("is empty when missing, round-trips otherwise", async () => {
    const vault = fakeVault();
    const repo = new StoryMapNoteRepository(vault);
    expect(await repo.load(folderProject)).toEqual(EMPTY_STORY_MAP_FILE);
    const file = putReading(EMPTY_STORY_MAP_FILE, { scene: { path: "Novel/One.md", title: "A", line: 0 }, hash: "h", model: "m", relations: [], references: [], events: [] });
    await repo.save(folderProject, file);
    expect(vault.files["Novel/Story map.md"]).toContain("creative-writer-storymap: 1");
    expect(await repo.load(folderProject)).toEqual(file);
  });
});
