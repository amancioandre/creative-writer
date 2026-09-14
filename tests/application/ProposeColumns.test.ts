import { describe, it, expect } from "vitest";
import { ProposeColumns, briefOf } from "../../src/application/use-cases/ProposeColumns";
import type { ColumnAnalyser } from "../../src/application/ports/ColumnAnalyser";
import { buildStoryGraph, type ProjectNote } from "../../src/domain/story/BuildGraph";
import { splitScenes } from "../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading, type StoryMapFile } from "../../src/domain/story/StoryMapFile";
import { textHash } from "../../src/domain/story/StoryGraph";
import { buildThreads } from "../../src/domain/threads/BuildThreads";
import { buildPlotGrid } from "../../src/domain/plot/PlotGrid";
import { parseStoryThreads } from "../../src/domain/threads/StoryThreadsNote";
import type { ProjectSpec } from "../../src/domain/progress/Project";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const one = `# Arrival\nAnna landed with the letter in her coat.\n\n# Dinner\nMarta asked after it.\n`;
const note = (path: string, body: string): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), text: body });
const notes = [note("Novel/Characters/Anna.md", ""), note("Novel/Characters/Marta.md", ""), note("Novel/One.md", one)];
const graph = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE);
const grid = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, parseStoryThreads("## Subplot: The letter\n- [[One#Arrival]] — x\n"), new Set()));
const repo = (file: StoryMapFile) => ({ load: async () => file, save: async () => undefined, update: async (_p: ProjectSpec, c: (f: StoryMapFile) => StoryMapFile) => c(file) });

describe("ProposeColumns", () => {
  it("says so when no scene has events to propose from", async () => {
    const analyser: ColumnAnalyser = { name: "f", rulebook: "v", read: async () => ({}), check: async () => ({}), propose: async () => { throw new Error("should not be asked"); } };
    expect(await new ProposeColumns(repo(EMPTY_STORY_MAP_FILE), analyser).execute(novel, grid, graph, new AbortController().signal)).toEqual({ needsReading: true });
  });

  it("briefs the model with the events per scene, the cast and the existing columns, and validates what comes back", async () => {
    const file = putReading(EMPTY_STORY_MAP_FILE, { scene: { path: "Novel/One.md", title: "Arrival", line: 0 }, hash: textHash("x"), model: "m", relations: [], references: [], events: [{ summary: "Anna lands with a letter", participants: ["Anna"], evidence: "landed" }] });
    const briefs: unknown[] = [];
    const analyser: ColumnAnalyser = { name: "f", rulebook: "v", read: async () => ({}), check: async () => ({}), propose: async (brief) => { briefs.push(brief); return { columns: [{ kind: "arc", name: "Anna", why: "Learns to open it.", scenes: ["Arrival", "Dinner"] }, { kind: "subplot", name: "The letter", why: "", scenes: ["Arrival"] }] }; } };
    const out = await new ProposeColumns(repo(file), analyser).execute(novel, grid, graph, new AbortController().signal);
    expect(briefOf(file, grid, graph)).toEqual({ scenes: [{ title: "Arrival", events: ["Anna lands with a letter"] }, { title: "Dinner", events: [] }], cast: [{ name: "Anna", kind: "character" }, { name: "Marta", kind: "character" }], existing: ["Subplot: The letter"] });
    expect(briefs).toHaveLength(1);
    expect(out).toEqual({ scenesRead: 1, proposals: [
      { kind: "arc", name: "Anna", why: "Learns to open it.", scenes: ["Arrival", "Dinner"], heading: "Arc: [[Anna]]", existing: false },
      { kind: "subplot", name: "The letter", why: "", scenes: ["Arrival"], heading: "Subplot: The letter", existing: true },
    ] });
  });
});
