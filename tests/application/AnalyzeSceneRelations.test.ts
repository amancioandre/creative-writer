import { describe, it, expect } from "vitest";
import { AnalyzeSceneRelations } from "../../src/application/use-cases/AnalyzeSceneRelations";
import { BuildStoryMap } from "../../src/application/use-cases/BuildStoryMap";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { splitScenes } from "../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, type StoryMapFile } from "../../src/domain/story/StoryMapFile";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 100, deadline: null, dailyWords: 0 };
const long = "Marta took Ilse by the hand and they walked the whole length of the quay while the gulls argued overhead and the tide went out and nobody on the boats looked up at either of them, not once, not for a moment, though Marta looked at every face.";
const body = `# Quay\n${long}\n\n# Short\nMarta sat.\n`;
const notes = {
  projects: () => [novel],
  notes: async () => [
    { path: "Novel/Characters/Marta Kovács.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/Characters/Ilse.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body) },
  ],
};

function memoryRepo() {
  let file: StoryMapFile = EMPTY_STORY_MAP_FILE;
  let saves = 0;
  return { load: async () => file, save: async (_p: ProjectSpec, f: StoryMapFile) => { file = f; saves++; }, get file() { return file; }, get saves() { return saves; } };
}

describe("AnalyzeSceneRelations", () => {
  it("reads scenes long enough, validates, saves per scene, and skips unchanged scenes next time", async () => {
    const repo = memoryRepo();
    const calls: string[][] = [];
    const analyser = {
      name: "fake",
      analyse: async (_t: string, present: readonly string[]) => {
        calls.push([...present]);
        return { relations: [{ from: "Marta", to: "Ilse", label: "sister", evidence: "took Ilse by the hand" }, { from: "Marta", to: "Ghost", label: "x", evidence: "took Ilse by the hand" }], references: [], events: [{ summary: "Walk", participants: ["Ilse"], evidence: "walked the whole length" }] };
      },
    };
    const build = new BuildStoryMap(notes, repo);
    const graph = await build.execute(novel);
    const uc = new AnalyzeSceneRelations(notes, repo, analyser);
    const progress: boolean[] = [];
    const n = await uc.execute(novel, "Novel/One.md", graph, new AbortController().signal, (p) => progress.push(p.skipped));
    expect(n).toBe(1);
    expect(calls).toEqual([["Ilse", "Marta Kovács"]]);
    expect(progress).toEqual([false]);
    expect(repo.saves).toBe(1);
    const reading = repo.file.readings[0]!;
    expect(reading.scene.title).toBe("Quay");
    expect(reading.model).toBe("fake");
    expect(reading.relations).toEqual([{ from: "Marta Kovács", to: "Ilse", label: "sister", evidence: "took Ilse by the hand" }]);
    expect(reading.events[0]!.participants).toEqual(["Ilse"]);

    // The graph now carries the relationship.
    const g2 = await build.execute(novel);
    expect(g2.edges.find((e) => e.kind === "relationship")?.label).toBe("sister");

    const again = await uc.execute(novel, "Novel/One.md", g2, new AbortController().signal, (p) => progress.push(p.skipped));
    expect(again).toBe(0);
    expect(progress).toEqual([false, true]);
    expect(calls).toHaveLength(1);

    const forced = await uc.execute(novel, "Novel/One.md", g2, new AbortController().signal, undefined, true);
    expect(forced).toBe(1);
  });

  it("reads every scene note of the project when no note is given", async () => {
    const repo = memoryRepo();
    const seen: string[] = [];
    const analyser = { name: "fake", analyse: async (text: string) => { seen.push(text.slice(0, 5)); return {}; } };
    const graph = await new BuildStoryMap(notes, repo).execute(novel);
    const n = await new AnalyzeSceneRelations(notes, repo, analyser).execute(novel, null, graph, new AbortController().signal);
    expect(n).toBe(1); // only the Quay scene is long enough; character notes are never read
    expect(seen).toEqual(["Marta"]);
  });

  it("returns 0 for an unknown note and stops when aborted", async () => {
    const repo = memoryRepo();
    const analyser = { name: "fake", analyse: async () => ({}) };
    const uc = new AnalyzeSceneRelations(notes, repo, analyser);
    const graph = await new BuildStoryMap(notes, repo).execute(novel);
    expect(await uc.execute(novel, "nope.md", graph, new AbortController().signal)).toBe(0);
    const ac = new AbortController();
    ac.abort();
    expect(await uc.execute(novel, "Novel/One.md", graph, ac.signal)).toBe(0);
    expect(repo.saves).toBe(0);
  });
});
