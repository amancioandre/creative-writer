import { describe, it, expect } from "vitest";
import { checkScale, chargeOf, describeScaleProblem, disagreements, gaugeLane, gaugeLanes, pipesOf, readScale, threadLanes } from "../../../src/domain/plot/Gauge";
import { buildPlotGrid, type GridRow } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE } from "../../../src/domain/story/StoryMapFile";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";

// Twelve scenes of The Salt Road, the prose only where a quote needs finding.
const titles = ["The customs house", "The ferry", "Tomas at the gate", "The station", "Dinner", "The quarry", "Night walk", "The bell tower", "Ilse's kitchen", "The flood", "The hearing", "The reading"];
const body = titles.map((t, i) => `# ${t}\n${i === 4 ? "Under the table his hand found her wrist." : `Scene ${i + 1}.`}\n`).join("\n");
const note = (path: string, text: string): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(text), text });
const notes = [note("Novel/Characters/Anna.md", ""), note("Novel/Book.md", body)];
const graph = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE);

const threadsNote = `## Theme: Should jealousy justify violent acts?
<!-- scale: hate, disgust, indifference, sympathy, love -->
- [[Book#The customs house]] — sympathy: Tomas carries her trunk
- [[Book#The ferry]] — love: he sings her name
- [[Book#Tomas at the gate]] — disgust: he reads her letters
- [[Book#The station]] — disgust: she wipes his kiss off
- [[Book#Dinner]] — reversal: hate: "his hand found her wrist" he breaks Ilse's wrist
- [[Book#The quarry]] — indifference: he works the quarry
- [[Book#The bell tower]] — disgust: he follows her up
- [[Book#Ilse's kitchen]] — sympathy: we learn his brother drowned
- [[Book#The flood]] — love: he carries Ilse out
- [[Book#The hearing]] — sympathy: he confesses
- [[Book#The reading]] — disgust: he asks her to forgive the next time

## Arc: [[Anna]]
<!-- scale: hate, fear, calm, trust, love -->
- [[Book#The customs house]] — trust: keeps the letter
- [[Book#Tomas at the gate]] — trust: gives him the key
- [[Book#Dinner]] — fear: says nothing
- [[Book#The flood]] — hate: watches him carry Ilse

## Subplot: The letter
- [[Book#The station]] — plant: Anna pockets it

## Theme: Even
<!-- scale: hate, love -->
- [[Book#Dinner]] — hate: nothing drawn

## Theme: Two words at Dinner
<!-- scale: hate, calm, love -->
- [[Book#Dinner]] — hate: one stop
- [[Book#Dinner]] — love: another
- [[Book#The flood]] — love: agreed
- [[Book#The flood]] — Love: agreed again
`;

function grid(md = threadsNote) {
  const model = buildThreads(graph, EMPTY_STORY_MAP_FILE, parseStoryThreads(md), new Set(), undefined, (p) => notes.find((n) => n.path === p)?.text);
  return buildPlotGrid(graph, model);
}

describe("a scale", () => {
  it("is odd, three to eleven words, without repeats or role words", () => {
    expect(checkScale(["hate", "calm", "love"])).toBeNull();
    expect(checkScale(["hate", "love"])).toBe("even");
    expect(checkScale(["hate"])).toBe("short");
    expect(checkScale(Array.from({ length: 13 }, (_, i) => `w${i}`))).toBe("long");
    expect(checkScale(["hate", "Hate", "love"])).toBe("duplicate");
    expect(checkScale(["hate", "plant", "love"])).toBe("role-word");
    expect(describeScaleProblem("even")).toMatch(/odd number/);
    expect(readScale(["hate", "love"])).toBeNull();
    expect(readScale(null)).toBeNull();
    const five = readScale([" hate", "disgust", "indifference", "sympathy", "love "])!;
    expect(five).toEqual({ words: ["hate", "disgust", "indifference", "sympathy", "love"], neutral: 2, steps: 2 });
    expect(chargeOf("Hate", five)).toBe(-2);
    expect(chargeOf("indifference", five)).toBe(0);
    expect(chargeOf("love", five)).toBe(2);
    expect(chargeOf("rage", five)).toBeNull();
    expect(chargeOf(null, five)).toBeNull();
  });

  it("draws up to three pipes apart and merges the first three from four", () => {
    expect(pipesOf(-2)).toEqual({ block: false, singles: 2 });
    expect(pipesOf(3)).toEqual({ block: false, singles: 3 });
    expect(pipesOf(4)).toEqual({ block: true, singles: 1 });
    expect(pipesOf(-5)).toEqual({ block: true, singles: 2 });
    expect(pipesOf(0)).toEqual({ block: false, singles: 0 });
  });
});

describe("a lane", () => {
  const g = grid();
  const rows = g.rows;
  const theme = g.columns.find((c) => c.heading.name.startsWith("Should"))!;
  const anna = g.columns.find((c) => c.heading.kind === "arc")!;

  it("charges each row from its keyword, walks the running total in order, and marks where the total changes sign", () => {
    const lane = gaugeLane(theme, rows)!;
    expect(theme.scale).toEqual(["hate", "disgust", "indifference", "sympathy", "love"]);
    expect(lane.rows.map((r) => r.charge)).toEqual([1, 2, -1, -1, -2, 0, null, -1, 1, 2, 1, -1]);
    expect(lane.rows.map((r) => r.total)).toEqual([1, 3, 2, 1, -1, -1, -1, -2, -1, 1, 2, 1]);
    expect(lane.inversions).toEqual([4, 9]);
    expect(lane.rows[4]).toMatchObject({ inversion: true, marked: true, keyword: "hate" });
    expect(lane.rows[9]).toMatchObject({ inversion: true, marked: false, keyword: "love" });
    // The empty row holds the total and gives nothing of its own.
    expect(lane.rows[6]).toMatchObject({ charge: null, keyword: null, total: -1, inversion: false });
    expect(lane.charged).toBe(11);
    expect(lane.unread).toBe(0);
    expect(lane.maxTotal).toBe(3);
    expect(lane.unit).toBe(2);
  });

  it("zero holds the sign: a total that lands on zero is not an inversion, the next non-zero total decides", () => {
    const md = `## Theme: T\n<!-- scale: hate, calm, love -->\n- [[Book#The customs house]] — love: up\n- [[Book#The ferry]] — hate: back to zero\n- [[Book#Tomas at the gate]] — love: up again\n- [[Book#The station]] — hate: zero\n- [[Book#Dinner]] — hate: below\n`;
    const lane = gaugeLane(grid(md).columns[0]!, rows)!;
    expect(lane.rows.slice(0, 5).map((r) => [r.total, r.inversion])).toEqual([[1, false], [0, false], [1, false], [0, false], [-1, true]]);
    expect(lane.inversions).toEqual([4]);
  });

  it("gives nothing for a column with no scale or an even one, and reads two disagreeing stops as unread", () => {
    expect(gaugeLane(g.columns.find((c) => c.heading.kind === "subplot")!, rows)).toBeNull();
    expect(gaugeLane(g.columns.find((c) => c.heading.name === "Even")!, rows)).toBeNull();
    const two = gaugeLane(g.columns.find((c) => c.heading.name === "Two words at Dinner")!, rows)!;
    expect(two.rows[4]).toMatchObject({ charge: null, conflict: ["hate", "love"], total: 0 });
    expect(two.rows[9]).toMatchObject({ charge: 1, keyword: "love", conflict: null, total: 1 });
    expect(two.unread).toBe(1);
    expect(two.charged).toBe(1);
  });

  it("finds the rows where two lanes carry opposite signs, and lists every lane of the grid in its order", () => {
    const lanes = gaugeLanes(g.columns, rows);
    expect(lanes.map((l) => l.column.heading.name)).toEqual(["Anna", "Should jealousy justify violent acts?", "Two words at Dinner"]);
    const [a, t] = [gaugeLane(anna, rows)!, gaugeLane(theme, rows)!];
    expect(a.rows.map((r) => r.charge)).toEqual([1, null, 1, null, -1, null, null, null, null, -2, null, null]);
    expect(disagreements(t, a)).toEqual([2, 9]);
    // Anna banks +2 before Dinner's fear, so her line only flips at the flood.
    expect(a.inversions).toEqual([9]);
  });

  it("walks the rows in the order it is given, so a filtered or sorted order is a different measure", () => {
    const reversed: GridRow[] = [...rows].reverse();
    const lane = gaugeLane(theme, reversed)!;
    expect(lane.rows[0]).toMatchObject({ charge: -1, total: -1 });
    expect(lane.inversions).not.toEqual([4, 9]);
  });
});

describe("thread lanes", () => {
  it("reads every graded hand-drawn thread along the model's scenes, the same series the grid draws", () => {
    const model = buildThreads(graph, EMPTY_STORY_MAP_FILE, parseStoryThreads(threadsNote), new Set(), undefined, (p) => notes.find((n) => n.path === p)?.text);
    const lanes = threadLanes(model);
    expect(lanes.map((l) => l.thread.label)).toEqual(["Theme: Should jealousy justify violent acts?", "Arc: [[Anna]]", "Theme: Two words at Dinner"]);
    expect(lanes[0]!.inversions).toEqual([4, 9]);
    expect(lanes[0]!.rows.map((r) => r.total)).toEqual([1, 3, 2, 1, -1, -1, -1, -2, -1, 1, 2, 1]);
    expect(lanes[0]!.rows[4]).toMatchObject({ keyword: "hate", marked: true });
    expect(lanes[1]!.inversions).toEqual([9]);
  });
});
