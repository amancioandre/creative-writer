import { describe, it, expect } from "vitest";
import { BuildManuscript } from "../../src/application/use-cases/BuildManuscript";
import type { ProjectNotes } from "../../src/application/ports/ProjectNotes";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { DEFAULT_MANUSCRIPT } from "../../src/domain/settings/Settings";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const notes: ProjectNotes = {
  projects: () => [novel],
  notes: async () => [
    { path: "Novel/Two.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [], text: "Two." },
    { path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [], text: "One." },
    { path: "Novel/Old.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
  ],
};

describe("BuildManuscript", () => {
  it("stitches the project's notes with the current options", async () => {
    let titles = true;
    const uc = new BuildManuscript(notes, () => ({ ...DEFAULT_MANUSCRIPT, noteTitles: titles }));
    const m = await uc.execute(novel);
    expect(m.items.map((i) => (i.kind === "note" ? `${i.title}:${i.showTitle}` : i.kind))).toEqual(["One:true", "Two:true"]);
    titles = false;
    expect((await uc.execute(novel)).items.every((i) => i.kind === "note" && !i.showTitle)).toBe(true);
  });
});
