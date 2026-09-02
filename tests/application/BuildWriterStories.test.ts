import { describe, it, expect } from "vitest";
import { BuildWriterStories } from "../../src/application/use-cases/BuildWriterStories";
import type { ProjectNotes } from "../../src/application/ports/ProjectNotes";
import type { WriterVault } from "../../src/application/ports/WriterVault";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import type { ProjectNote } from "../../src/domain/story/BuildGraph";
import { splitScenes } from "../../src/domain/text/Scenes";
import { type WriterNote, buildBoard } from "../../src/domain/writer/Board";
import { EMPTY_WRITER_FILE } from "../../src/domain/writer/WriterFile";

const bear: ProjectSpec = { name: "Bear", notePath: "storytelling/Bear/Bear.md", scope: "storytelling/Bear/", targetWords: 10, deadline: null, dailyWords: 0, ignoredNames: [] };
const horse: ProjectSpec = { name: "Horse", notePath: "storytelling/Horse/Horse.md", scope: "storytelling/Horse/", targetWords: 0, deadline: null, dailyWords: 0, ignoredNames: [] };
const note = (path: string, text: string, frontmatter: Record<string, unknown> = {}): ProjectNote => ({ path, frontmatter, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(text), text });
const projects: ProjectNotes = {
  projects: () => [bear, horse],
  notes: async (spec) => spec === bear
    ? [note("storytelling/Bear/Bear.md", "# Plan\n- outline only\n"), note("storytelling/Bear/Characters/Lee.md", "Lee.", { type: "character" }), note("storytelling/Bear/One.md", "# Camp\nThey walked twelve words into the hills and the bear was there. %% REF: [[Bear idea]] %%\n", {}), { ...note("storytelling/Bear/Two.md", "Links.\n"), links: ["voices/The Narrator.md"] }]
    : [note("storytelling/Horse/Horse.md", "", {})],
};
const fm: Record<string, Record<string, unknown>> = { "storytelling/Bear/Bear.md": { "writing-premise": "A man hunts.", "writing-idea": "[[Bear idea]]", "writing-voice": "[[The Narrator]]" } };
const allPaths = ["storytelling/Bear/Bear.md", "storytelling/Bear/One.md", "storytelling/Horse/Horse.md", "storytelling/Loose/Chapter.md", "storytelling/Empty/Notes.md", "notes/Bear idea.md", "voices/The Narrator.md", "elsewhere/X.md"];
const vault: WriterVault = {
  paths: () => allPaths,
  frontmatter: (p) => fm[p] ?? null,
  resolve: (link) => allPaths.find((p) => p.endsWith(`/${link}.md`)) ?? null,
  exists: async () => true, read: async () => "", write: async () => undefined, createFolder: async () => undefined, processFrontMatter: async () => undefined,
  folderHasProse: async (folder) => folder === "storytelling/Loose",
};
const log = { counts: {}, days: { "2026-09-01": { added: 3, removed: 0, files: { "storytelling/Bear/One.md": { added: 3, removed: 0 } } } } };
const wn = (path: string, tags: string[], story: string | null = null): WriterNote => ({ path, title: path, tags, links: [], excerpt: "", story });
const board = buildBoard([wn("notes/Bear idea.md", ["#writer/premise"]), wn("notes/Other idea.md", ["#writer/premise"]), wn("voices/The Narrator.md", ["#writer/voice"])], EMPTY_WRITER_FILE);

describe("BuildWriterStories", () => {
  it("builds a card per project from the notes, the log and the project note's front matter, most recently worked first", async () => {
    const row = await new BuildWriterStories(projects, vault, () => log, () => "storytelling").execute(board);
    expect(row.stories.map((s) => s.spec.name)).toEqual(["Bear", "Horse"]);
    const b = row.stories[0]!;
    expect(b).toMatchObject({ stage: "finished", declared: false, premise: "A man hunts.", idea: "notes/Bear idea.md", voice: "voices/The Narrator.md", cast: 1, lastWorked: "2026-09-01", target: 10 });
    expect(b.words).toBeGreaterThan(10);
    expect(row.stories[1]).toMatchObject({ stage: "development", words: 0, cast: 0, lastWorked: null, idea: null });
  });
  it("lists ideas without a home and unfiled folders with prose under the stories folder", async () => {
    const row = await new BuildWriterStories(projects, vault, () => log, () => "storytelling").execute(board);
    expect(row.ideas.map((c) => c.path)).toEqual(["notes/Other idea.md"]);
    expect(row.unfiled).toEqual(["storytelling/Loose"]);
    expect((await new BuildWriterStories(projects, vault, () => log, () => "").execute(board)).unfiled).toEqual([]);
  });
  it("counts uses from links and REF comments in the project's notes", async () => {
    const row = await new BuildWriterStories(projects, vault, () => log, () => "storytelling").execute(board);
    expect(row.uses.get("notes/Bear idea.md")).toEqual(["Bear"]);
    expect(row.uses.get("voices/The Narrator.md")).toEqual(["Bear"]);
    expect(row.uses.has("notes/Other idea.md")).toBe(false);
  });
});
