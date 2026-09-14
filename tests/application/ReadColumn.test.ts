import { describe, it, expect } from "vitest";
import { ReadColumn } from "../../src/application/use-cases/ReadColumn";
import type { ColumnAnalyser } from "../../src/application/ports/ColumnAnalyser";
import { buildStoryGraph, type ProjectNote } from "../../src/domain/story/BuildGraph";
import { splitScenes } from "../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, type StoryMapFile } from "../../src/domain/story/StoryMapFile";
import { buildThreads } from "../../src/domain/threads/BuildThreads";
import { buildPlotGrid } from "../../src/domain/plot/PlotGrid";
import { parseStoryThreads } from "../../src/domain/threads/StoryThreadsNote";
import type { ProjectSpec } from "../../src/domain/progress/Project";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const one = `# The station\nAnna pocketed the letter without reading it, and the porter said Marta had been asking after a woman off the boat, and Anna said she knew no Marta at all.\n\n# Dinner\nMarta asked after the letter before the soup and Ilse's chair was empty, and the wind came through the shutters while Anna said it was a bill.\n\n# Short\nToo short.\n`;
const note = (path: string, body: string): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), text: body });
const notes = [note("Novel/Characters/Anna.md", ""), note("Novel/Characters/Marta.md", ""), note("Novel/One.md", one)];
const graph = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE);
const threads = parseStoryThreads("## Subplot: The letter\n- [[One#The station]] — pockets it\n- [[One#Short]] — planned\n");

function repo() {
  let file: StoryMapFile = EMPTY_STORY_MAP_FILE;
  return { load: async () => file, save: async (_p: ProjectSpec, f: StoryMapFile) => { file = f; }, update: async (_p: ProjectSpec, change: (f: StoryMapFile) => StoryMapFile) => { file = change(file); return file; }, file: () => file };
}

describe("ReadColumn", () => {
  it("reads the column's empty cells with the brief, keeps what validates, saves after each, skips unchanged scenes next time", async () => {
    const asked: string[] = [];
    const analyser: ColumnAnalyser = {
      name: "fake", rulebook: "v1",
      read: async (text, present, column) => { asked.push(`${column.name}|${column.kind}|${present.join(",")}|${column.examples.join(";")}`); return text.includes("soup") ? { reading: { text: "asked after, lied about", role: "touch", evidence: "said it was a bill" } } : { reading: { text: "bad quote", role: "", evidence: "not there" } }; },
      check: async () => ({ found: false, evidence: "" }), propose: async () => ({}),
    };
    const r = repo();
    const grid = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, threads, new Set(), undefined, () => one));
    const use = new ReadColumn({ projects: () => [novel], notes: async () => notes }, r, analyser);
    const progress: string[] = [];
    const n = await use.execute(novel, grid.columns[0]!, graph, new AbortController().signal, (p) => progress.push(`${p.done}/${p.total}${p.skipped ? " skip" : ""}`));
    expect(n).toBe(1);
    expect(asked).toEqual(["The letter|subplot|Anna,Marta|pockets it;planned"]);
    expect(progress).toEqual(["1/1"]);
    expect(r.file().grid.map((g) => [g.scene.title, g.text, g.state])).toEqual([["Dinner", "asked after, lied about", "open"]]);
    // Same prose, same prompt: skipped.
    const again = await use.execute(novel, grid.columns[0]!, graph, new AbortController().signal, (p) => progress.push(`${p.done}/${p.total}${p.skipped ? " skip" : ""}`));
    expect(again).toBe(0);
    expect(progress.at(-1)).toBe("1/1 skip");
  });

  it("a reading the model returns without a locatable quote is kept as a no, so the scene is not asked again; stopping keeps what landed", async () => {
    const analyser: ColumnAnalyser = { name: "fake", rulebook: "v1", read: async () => ({ reading: { text: "x", role: "", evidence: "nowhere" } }), check: async () => ({}), propose: async () => ({}) };
    const r = repo();
    const grid = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, threads, new Set(), undefined, () => one));
    const use = new ReadColumn({ projects: () => [novel], notes: async () => notes }, r, analyser);
    const controller = new AbortController();
    controller.abort();
    expect(await use.execute(novel, grid.columns[0]!, graph, controller.signal)).toBe(0);
    expect(await use.execute(novel, grid.columns[0]!, graph, new AbortController().signal)).toBe(1);
    expect(r.file().grid[0]).toMatchObject({ state: "none", text: "" });
  });

  it("checks the column's plans against the draft: a found plan carries its quote, a missing one says so", async () => {
    const analyser: ColumnAnalyser = { name: "fake", rulebook: "v1", read: async () => ({ reading: null }), check: async (text, plan) => ({ found: plan.note === "pockets it", evidence: text.includes("pocketed") ? "pocketed the letter" : "" }), propose: async () => ({}) };
    const r = repo();
    const grid = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, threads, new Set(), undefined, () => one));
    const use = new ReadColumn({ projects: () => [novel], notes: async () => notes }, r, analyser);
    expect(await use.check(novel, grid.columns[0]!, graph, new AbortController().signal)).toBe(1);
    expect(r.file().grid.map((g) => [g.scene.title, g.kind, g.text, g.evidence])).toEqual([["The station", "check", "pockets it", "pocketed the letter"]]);
  });
});
