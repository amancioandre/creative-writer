import { describe, it, expect } from "vitest";
import { validateCheck, validateGridReading } from "../../../src/domain/plot/Readings";
import { EMPTY_STORY_MAP_FILE, dismissColumnReadings, normalizeStoryMapFile, putGridReading, setGridReadingState, STORY_MAP_VERSION, type GridReading } from "../../../src/domain/story/StoryMapFile";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { textHash } from "../../../src/domain/story/StoryGraph";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";

const prose = "She pocketed the letter without reading it, and the porter said nothing.";

describe("validateGridReading", () => {
  it("keeps a reading whose quote is on the page and whose role the column allows", () => {
    expect(validateGridReading({ reading: { text: "  keeps it unread ", role: "Plant", evidence: "pocketed the letter" } }, prose, "subplot")).toEqual({ text: "keeps it unread", role: "plant", evidence: "pocketed the letter" });
    expect(validateGridReading({ reading: { text: "wants to be nobody's", role: "want", evidence: "without reading it" } }, prose, "arc")).toMatchObject({ role: "want" });
    expect(validateGridReading({ reading: { text: "x", role: "want", evidence: "without reading it" } }, prose, "subplot")).toMatchObject({ role: null });
    expect(validateGridReading({ reading: { text: "x", role: "touch", evidence: "the porter" } }, prose, "free")).toMatchObject({ role: null });
  });

  it("drops a reading with no quote on the page, and reads null as the model's no", () => {
    expect(validateGridReading({ reading: null }, prose, "subplot")).toBeNull();
    expect(validateGridReading({ reading: { text: "x", role: "", evidence: "she burned it" } }, prose, "subplot")).toBeNull();
    expect(validateGridReading({ reading: { text: "", role: "", evidence: "the porter" } }, prose, "subplot")).toBeNull();
    expect(validateGridReading("nonsense", prose, "subplot")).toBeNull();
    // The label where the note should be is not a reading.
    expect(validateGridReading({ reading: { text: "plant", role: "", evidence: "the porter" } }, prose, "subplot")).toBeNull();
    expect(validateGridReading({ reading: { text: "Want.", role: "want", evidence: "the porter" } }, prose, "arc")).toBeNull();
  });

  it("a check is found only with a quote that is on the page", () => {
    expect(validateCheck({ found: true, evidence: "said nothing" }, prose)).toEqual({ found: true, evidence: "said nothing" });
    expect(validateCheck({ found: true, evidence: "said everything" }, prose)).toEqual({ found: false, evidence: "" });
    expect(validateCheck({ found: false, evidence: "said nothing" }, prose)).toEqual({ found: false, evidence: "" });
  });
});

describe("grid readings in Story map.md", () => {
  const scene = { path: "Novel/One.md", title: "The station", line: 0 };
  const reading: GridReading = { scene, hash: "h", column: "Subplot: The letter", model: "m", rulebook: "r", kind: "reading", text: "keeps it", role: "plant", evidence: "pocketed", state: "open" };

  it("keeps one reading per cell, normalises what it reads back, and is version 4", () => {
    const file = putGridReading(putGridReading(EMPTY_STORY_MAP_FILE, reading), { ...reading, text: "newer" });
    expect(file.grid).toHaveLength(1);
    expect(file.grid[0]!.text).toBe("newer");
    expect(file.version).toBe(4);
    expect(STORY_MAP_VERSION).toBe(4);
    const back = normalizeStoryMapFile(JSON.parse(JSON.stringify({ ...file, grid: [...file.grid, { scene, hash: "h", column: "subplot: the letter", text: "dup" }, { hash: "x" }, { ...reading, column: "Other", role: "bogus", state: "weird", kind: "odd" }] })));
    expect(back.grid.map((r) => [r.column, r.text, r.role, r.state, r.kind])).toEqual([["Subplot: The letter", "newer", "plant", "open", "reading"], ["Other", "keeps it", null, "open", "reading"]]);
    expect(normalizeStoryMapFile({ version: 3, readings: [] }).grid).toEqual([]);
  });

  it("dismisses one reading or a column's, and the grid draws only open ones in empty cells, stale when the scene changed", () => {
    const one = `# The station\n${prose}\n\n# Dinner\nMarta asked after it at dinner and was told nothing.\n`;
    const note = (path: string, body: string): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), text: body });
    const graph = buildStoryGraph("Novel", [note("Novel/One.md", one)], EMPTY_STORY_MAP_FILE);
    const threads = parseStoryThreads("## Subplot: The letter\n- [[One#The station]] — pockets it\n");
    const model = buildThreads(graph, EMPTY_STORY_MAP_FILE, threads, new Set(), undefined, () => one);
    const dinner = { path: "Novel/One.md", title: "Dinner", line: 3 };
    const hashes = new Map([[`Novel/One.md#The station`, textHash(splitScenes(one)[0]!.prose)], [`Novel/One.md#Dinner`, textHash(splitScenes(one)[1]!.prose)]]);
    let file = putGridReading(putGridReading(EMPTY_STORY_MAP_FILE, { ...reading, scene: dinner, hash: hashes.get("Novel/One.md#Dinner")! }), { ...reading, text: "answered by a stop" });
    let grid = buildPlotGrid(graph, model, {}, { readings: file.grid, hashes });
    expect(grid.columns[0]!.cells.map((c) => c.reading?.text ?? null)).toEqual([null, "keeps it"]);
    expect(grid.readings).toBe(1);
    file = putGridReading(file, { ...reading, scene: dinner, hash: "old" });
    grid = buildPlotGrid(graph, model, {}, { readings: file.grid, hashes });
    expect(grid.columns[0]!.cells[1]!.reading?.stale).toBe(true);
    expect(grid.readings).toBe(0);
    file = setGridReadingState(file, dinner, "subplot: the letter", "dismissed");
    expect(buildPlotGrid(graph, model, {}, { readings: file.grid, hashes }).columns[0]!.cells[1]!.reading).toBeNull();
    file = dismissColumnReadings(putGridReading(file, { ...reading, scene: dinner, hash: hashes.get("Novel/One.md#Dinner")! }), "Subplot: The letter");
    expect(file.grid.every((r) => r.state === "dismissed")).toBe(true);
  });
});
