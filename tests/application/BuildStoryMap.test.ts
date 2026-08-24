import { describe, it, expect } from "vitest";
import { BuildStoryMap } from "../../src/application/use-cases/BuildStoryMap";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { splitScenes } from "../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE } from "../../src/domain/story/StoryMapFile";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 100, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const short: ProjectSpec = { name: "Short", scope: "Novel/Shorts/One.md", targetWords: 10, deadline: null, dailyWords: 0, notePath: "Novel/Shorts/One.md", ignoredNames: [] };
const notes = {
  projects: () => [novel, short],
  notes: async () => [
    { path: "Novel/Characters/Marta.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes("# A\nMarta walked.") },
  ],
};
const repo = { load: async () => EMPTY_STORY_MAP_FILE, save: async () => undefined };

describe("BuildStoryMap", () => {
  it("builds a graph for a project", async () => {
    const g = await new BuildStoryMap(notes, repo).execute(novel);
    expect(g.project).toBe("Novel");
    expect(g.entities.map((e) => e.name)).toEqual(["Marta", "One"]);
    expect(g.timeline).toHaveLength(1);
  });
  it("finds the narrowest project containing a path", () => {
    const uc = new BuildStoryMap(notes, repo);
    expect(uc.projectFor("Novel/Shorts/One.md")?.name).toBe("Short");
    expect(uc.projectFor("Novel/Two.md")?.name).toBe("Novel");
    expect(uc.projectFor("Elsewhere.md")).toBeNull();
    expect(uc.projects()).toHaveLength(2);
  });
});
