import { describe, it, expect } from "vitest";
import { ExportManuscript } from "../../src/application/use-cases/ExportManuscript";
import type { ProjectNotes } from "../../src/application/ports/ProjectNotes";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { DEFAULT_MANUSCRIPT } from "../../src/domain/settings/Settings";

const novel: ProjectSpec = { name: "My: Novel?", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const notes: ProjectNotes = {
  projects: () => [novel],
  notes: async () => [{ path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [], text: "One. %% TODO: two %%" }],
};

describe("ExportManuscript", () => {
  it("writes the stitched note beside the project with a safe name", async () => {
    const written: [string, string][] = [];
    const uc = new ExportManuscript(notes, { write: async (p, c) => { written.push([p, c]); } }, () => DEFAULT_MANUSCRIPT);
    const { path, manuscript } = await uc.execute(novel);
    expect(path).toBe("Novel/My Novel (manuscript).md");
    expect(manuscript.notes).toBe(1);
    expect(written[0]![0]).toBe(path);
    expect(written[0]![1]).toContain("# One\n\nOne.\n");
    expect(written[0]![1]).not.toContain("TODO");
  });

  it("puts a single-note project's export in that note's folder", () => {
    expect(ExportManuscript.pathFor({ ...novel, name: "Story", scope: "Shorts/Story.md" })).toBe("Shorts/Story (manuscript).md");
    expect(ExportManuscript.pathFor({ ...novel, name: "Root", scope: "" })).toBe("Root (manuscript).md");
  });
});
