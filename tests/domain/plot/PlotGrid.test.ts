import { describe, it, expect } from "vitest";
import { buildPlotGrid, gridRows, parseColumnHeading, stateOf } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE } from "../../../src/domain/story/StoryMapFile";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";
import { EMPTY_GRAPH } from "../../../src/domain/story/StoryGraph";
import { EMPTY_THREAD_MODEL } from "../../../src/domain/threads/Thread";

const one = `# The station\nAnna pocketed the letter without reading it. Marta was named by the porter.\n\n# Dinner\nMarta asked after the letter; Ilse's chair was empty.\n\n# The quarry\n`;
const two = `# The reading\nThe letter was addressed to her mother. Anna read it to Marta and Ilse.\n`;
const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), ...extra });
const notes = [
  note("Novel/Characters/Anna.md", ""),
  note("Novel/Characters/Marta.md", ""),
  note("Novel/Characters/Ilse.md", ""),
  note("Novel/One.md", one),
  note("Novel/Two.md", two),
];
const graph = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE);
const text = new Map([["Novel/One.md", one], ["Novel/Two.md", two]]);
const threadsNote = `## Arc: [[Anna]]
- [[One#The station]] — want: "pocketed the letter without reading it" to be nobody's daughter
- [[Two#The reading]] — truth: "addressed to her mother" she reads it aloud

## Subplot: The letter
- [[One#The station]] — plant: "pocketed the letter" Anna pockets it
- [[One#Dinner]] — first mentioned aloud
- [[One#Dinner]] — a second stop at dinner
- [[Two#The reading]] — payoff: "addressed to her father" the anchor moved
- [[Nine#Nowhere]] — a broken link

## Theme: What we owe the dead
- [[Two#The reading]] — the debt is paid by reading

## Salt on the wind
- [[One#The quarry]] — salt in the cut stone
`;
const writer = parseStoryThreads(threadsNote);
const model = buildThreads(graph, EMPTY_STORY_MAP_FILE, writer, new Set(), undefined, (p) => text.get(p));
const grid = buildPlotGrid(graph, model);

describe("parseColumnHeading", () => {
  it("reads the kind prefix, the name, and an arc's link", () => {
    expect(parseColumnHeading("Arc: [[Characters/Anna|Anna K.]]")).toEqual({ kind: "arc", heading: "Arc: [[Characters/Anna|Anna K.]]", name: "Anna K.", link: "Characters/Anna", unknownPrefix: null });
    expect(parseColumnHeading("arc: Anna")).toMatchObject({ kind: "arc", name: "Anna", link: "Anna" });
    expect(parseColumnHeading("Theme:  What we owe the dead ")).toMatchObject({ kind: "theme", name: "What we owe the dead", link: null });
    expect(parseColumnHeading("SUBPLOT: The letter")).toMatchObject({ kind: "subplot", name: "The letter" });
  });

  it("leaves a heading with no prefix a free thread, and flags one that looks like a kind but is not", () => {
    expect(parseColumnHeading("Salt on the wind")).toEqual({ kind: "free", heading: "Salt on the wind", name: "Salt on the wind", link: null, unknownPrefix: null });
    expect(parseColumnHeading("Arcs: Anna")).toMatchObject({ kind: "free", unknownPrefix: "Arcs" });
    expect(parseColumnHeading("Sub-plot: The letter")).toMatchObject({ kind: "free", unknownPrefix: "Sub-plot" });
    expect(parseColumnHeading("https://example.org")).toMatchObject({ kind: "free", unknownPrefix: null });
    expect(parseColumnHeading("Marta ⇄ Ilse: the quarrel")).toMatchObject({ kind: "free", unknownPrefix: null });
  });
});

describe("threads note grammar for the grid", () => {
  it("reads arc roles only under an Arc heading", () => {
    const arc = writer.find((t) => t.name === "Arc: [[Anna]]")!;
    expect(arc.items.map((i) => [i.role, i.quote, i.note])).toEqual([
      ["want", "pocketed the letter without reading it", "to be nobody's daughter"],
      ["truth", "addressed to her mother", "she reads it aloud"],
    ]);
    const sub = parseStoryThreads("## Subplot: X\n- [[One#Dinner]] — want: nothing\n")[0]!;
    expect(sub.items[0]).toMatchObject({ role: "touch", note: "want: nothing" });
  });
});

describe("buildPlotGrid", () => {
  it("rows are every heading in manuscript order, outline headings included", () => {
    expect(grid.rows.map((r) => [r.scene.title, r.outline, r.words > 0])).toEqual([["The station", false, true], ["Dinner", false, true], ["The quarry", true, false], ["The reading", false, true]]);
    expect(grid.rows[0]!.present).toContain("Novel/Characters/Anna.md");
  });

  it("orders columns arcs, themes, subplots, then free threads, note order within each", () => {
    expect(grid.columns.map((c) => [c.heading.kind, c.heading.name])).toEqual([["arc", "Anna"], ["theme", "What we owe the dead"], ["subplot", "The letter"], ["free", "Salt on the wind"]]);
    expect(grid.unknownPrefixes).toEqual([]);
  });

  it("a cell is the thread's stop at the scene, in one of three states from its anchor", () => {
    const letter = grid.columns[2]!;
    expect(letter.cells.map((c) => c.state)).toEqual(["verified", "plan", "empty", "broken"]);
    expect(letter.cells[0]!.stop).toMatchObject({ note: "Anna pockets it", role: "plant" });
    expect(letter.cells[1]!.more.map((s) => s.note)).toEqual(["a second stop at dinner"]);
    expect(letter.unresolved.map((s) => s.unresolved)).toEqual(["Nine#Nowhere"]);
    expect([letter.filled, letter.verified, letter.broken]).toEqual([3, 1, 1]);
    expect(stateOf({ scene: { path: "", title: "", line: 0 }, index: 0, note: "" })).toBe("plan");
  });

  it("binds an arc to its character and marks the scenes where the character is present but unmoved", () => {
    const anna = grid.columns[0]!;
    expect(anna.entity?.path).toBe("Novel/Characters/Anna.md");
    expect(anna.cells.map((c) => [c.state, c.presentUnmoved])).toEqual([["verified", false], ["empty", false], ["empty", false], ["verified", false]]);
    expect(anna.armed).toBe(true);
    const marta = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, parseStoryThreads("## Arc: Marta\n- [[Two#The reading]] — truth: made peace\n"), new Set(), undefined, (p) => text.get(p)));
    expect(marta.columns[0]!.entity?.name).toBe("Marta");
    expect(marta.columns[0]!.cells.map((c) => c.presentUnmoved)).toEqual([true, true, false, false]);
    expect(marta.columns[0]!.armed).toBe(false);
    const nobody = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, parseStoryThreads("## Arc: The porter\n- [[One#Dinner]] — x\n"), new Set()));
    expect(nobody.columns[0]!.entity).toBeNull();
  });

  it("counts the grid, and is empty for an empty project", () => {
    expect([grid.cells, grid.filled, grid.verified, grid.broken]).toEqual([16, 7, 3, 1]);
    expect(buildPlotGrid(EMPTY_GRAPH, EMPTY_THREAD_MODEL).columns).toEqual([]);
    expect(gridRows({ ...EMPTY_GRAPH, headings: [{ path: "a.md", title: "", line: 0 }] })).toEqual([]);
    expect(gridRows({ ...EMPTY_GRAPH, timeline: [{ scene: { path: "a.md", title: "S", line: 0 }, words: 3, bookmarked: true, present: [], events: [] }] })[0]).toMatchObject({ index: 0, words: 3, bookmarked: true, outline: false });
  });
});
