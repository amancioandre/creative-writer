import { describe, it, expect } from "vitest";
import { BuildPlotGrid } from "../../src/application/use-cases/BuildPlotGrid";
import type { BuildStoryThreads } from "../../src/application/use-cases/BuildStoryThreads";
import { EMPTY_GRAPH } from "../../src/domain/story/StoryGraph";
import { EMPTY_THREAD_MODEL } from "../../src/domain/threads/Thread";
import { EMPTY_STORY_MAP_FILE } from "../../src/domain/story/StoryMapFile";
import type { ProjectSpec } from "../../src/domain/progress/Project";

const project: ProjectSpec = { name: "DA", scope: "DA/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "DA/Analysis.md", ignoredNames: [] };
const threads = { executeWithGraph: async () => ({ graph: EMPTY_GRAPH, model: EMPTY_THREAD_MODEL, file: EMPTY_STORY_MAP_FILE, hashes: new Map() }) } as unknown as BuildStoryThreads;
const repo = (text: string) => ({ pathFor: () => "DA/Outline.md", load: async () => text, update: async () => ({ before: text, after: text }) });

describe("BuildPlotGrid and the outline", () => {
  it("reads a flagged Outline.md as the plan and draws its scenes as rows", async () => {
    const grid = await new BuildPlotGrid(threads, repo("---\ncreative-writer-outline: 1\n---\n## One\n### A\n### B\n")).execute(project);
    expect(grid.rows.map((r) => [r.scene.title, r.group?.chapter])).toEqual([["A", "One"], ["B", "One"]]);
    expect(grid.plan?.path).toBe("DA/Outline.md");
  });

  it("ignores an Outline.md without the flag, an empty one, and a project with no outline repository", async () => {
    expect((await new BuildPlotGrid(threads, repo("## One\n### A\n")).execute(project)).plan).toBeNull();
    expect((await new BuildPlotGrid(threads, repo("")).execute(project)).plan).toBeNull();
    expect((await new BuildPlotGrid(threads).execute(project)).plan).toBeNull();
  });
});
