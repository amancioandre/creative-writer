import { describe, it, expect } from "vitest";
import { AnalyzeSceneFacts } from "../../src/application/use-cases/AnalyzeSceneFacts";
import { BuildStoryMap } from "../../src/application/use-cases/BuildStoryMap";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { splitScenes } from "../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading, type StoryMapFile } from "../../src/domain/story/StoryMapFile";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 100, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const long = "Marta took Ilse by the hand and they walked the whole length of the quay while the gulls argued overhead and the tide went out and nobody on the boats looked up at either of them, not once, not for a moment, though Marta looked at every face with her green eyes.";
const body = `# Quay\n${long}\n\n# Short\nMarta sat.\n`;
const notes = {
  projects: () => [novel],
  notes: async () => [
    { path: "Novel/Characters/Marta Kovács.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/Characters/Ilse.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body) },
  ],
};

function memoryRepo(initial: StoryMapFile = EMPTY_STORY_MAP_FILE) {
  let file = initial;
  let saves = 0;
  const save = async (_p: ProjectSpec, f: StoryMapFile) => { file = f; saves++; };
  return { load: async () => file, save, update: async (p: ProjectSpec, change: (f: StoryMapFile) => StoryMapFile) => { await save(p, change(file)); return file; }, get file() { return file; }, get saves() { return saves; } };
}

const analyser = (rulebook = "v1") => {
  const calls: string[][] = [];
  return {
    calls,
    name: "fake",
    rulebook,
    analyse: async (_t: string, present: readonly string[]) => {
      calls.push([...present]);
      return { facts: [
        { subject: "Marta", attribute: "eye colour", value: "green", evidence: "her green eyes" },
        { subject: "Ghost", attribute: "age", value: "9", evidence: "her green eyes" },
        { subject: "Ilse", attribute: "mood", value: "sad", evidence: "not in the text" },
      ] };
    },
  };
};

describe("AnalyzeSceneFacts", () => {
  it("reads scenes long enough, validates, saves per scene, and skips unchanged scenes next time", async () => {
    const repo = memoryRepo();
    const a = analyser();
    const build = new BuildStoryMap(notes, repo);
    const graph = await build.execute(novel);
    const uc = new AnalyzeSceneFacts(notes, repo, a);
    const progress: boolean[] = [];
    const n = await uc.execute(novel, "Novel/One.md", graph, new AbortController().signal, (p) => progress.push(p.skipped));
    expect(n).toBe(1);
    expect(a.calls).toEqual([["Ilse", "Marta Kovács"]]);
    expect(progress).toEqual([false]);
    expect(repo.saves).toBe(1);
    const reading = repo.file.facts[0]!;
    expect(reading.scene.title).toBe("Quay");
    expect(reading.model).toBe("fake");
    expect(reading.rulebook).toBe("v1");
    expect(reading.facts).toEqual([{ subject: "Marta Kovács", attribute: "eye colour", value: "green", evidence: "her green eyes" }]);

    const again = await uc.execute(novel, null, graph, new AbortController().signal, (p) => progress.push(p.skipped));
    expect(again).toBe(0);
    expect(progress).toEqual([false, true]);
    expect(a.calls).toHaveLength(1);
  });

  it("re-reads when the prompt changed or when forced, and leaves relation readings alone", async () => {
    const relation = { scene: { path: "Novel/One.md", title: "Quay", line: 0 }, hash: "x", model: "m", relations: [], references: [], events: [] };
    const repo = memoryRepo(putReading(EMPTY_STORY_MAP_FILE, relation));
    const build = new BuildStoryMap(notes, repo);
    const graph = await build.execute(novel);
    const v1 = analyser("v1");
    await new AnalyzeSceneFacts(notes, repo, v1).execute(novel, null, graph, new AbortController().signal);
    const v2 = analyser("v2");
    const uc2 = new AnalyzeSceneFacts(notes, repo, v2);
    expect(await uc2.execute(novel, null, graph, new AbortController().signal)).toBe(1);
    expect(repo.file.facts[0]!.rulebook).toBe("v2");
    expect(await uc2.execute(novel, null, graph, new AbortController().signal)).toBe(0);
    expect(await uc2.execute(novel, null, graph, new AbortController().signal, undefined, true)).toBe(1);
    expect(repo.file.readings).toEqual([relation]);
    expect(repo.file.facts).toHaveLength(1);
  });

  it("stops at an abort, keeping what was saved, and does nothing for an unknown note", async () => {
    const repo = memoryRepo();
    const build = new BuildStoryMap(notes, repo);
    const graph = await build.execute(novel);
    const controller = new AbortController();
    controller.abort();
    expect(await new AnalyzeSceneFacts(notes, repo, analyser()).execute(novel, null, graph, controller.signal)).toBe(0);
    expect(repo.saves).toBe(0);
    expect(await new AnalyzeSceneFacts(notes, repo, analyser()).execute(novel, "Novel/Nope.md", graph, new AbortController().signal)).toBe(0);
  });
});
