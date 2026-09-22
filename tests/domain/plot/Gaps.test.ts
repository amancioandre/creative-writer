import { describe, it, expect } from "vitest";
import { findGaps } from "../../../src/domain/plot/Gaps";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE } from "../../../src/domain/story/StoryMapFile";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";

// Ten written scenes; Anna is in every one, Marta in the first four.
const chapter = Array.from({ length: 10 }, (_, i) => `# Scene ${i + 1}\nAnna walked in.${i < 4 ? " Marta followed." : ""}\n`).join("\n");
const note = (path: string, body: string): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), text: body });
const notes = [note("N/Characters/Anna.md", ""), note("N/Characters/Marta.md", ""), note("N/One.md", chapter)];
const graph = buildStoryGraph("N", notes, EMPTY_STORY_MAP_FILE);
const threads = `## Arc: [[Anna]]
- [[One#Scene 1]] — want: "walked in" to be seen
- [[One#Scene 2]] — a stop
- [[One#Scene 7]] — a stop

## Arc: [[Marta]]
- [[One#Scene 1]] — want: "followed" to keep up

## Theme: Salt
- [[One#Scene 3]] — a stop
- [[One#Scene 4]] — a stop
- [[One#Scene 5]] — a stop

## Time
- [[One#Scene 1]] — Day 1
`;
const grid = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, parseStoryThreads(threads), new Set(), undefined, (p) => notes.find((n) => n.path === p)?.text), { time: "Time" });

describe("findGaps", () => {
  it("counts thin columns and unmoved stretches, leaves Time and POV alone, and says nothing on a short draft", () => {
    const gaps = findGaps(grid);
    expect(gaps.map((g) => [g.kind, g.column, g.text])).toEqual([
      ["unmoved-stretch", "Arc: [[Anna]]", "Anna is on the page in 4 scenes in a row, Scene 3 to Scene 6, and the arc has no stop there."],
      ["unmoved-stretch", "Arc: [[Anna]]", "Anna is on the page in 3 scenes in a row, Scene 8 to Scene 10, and the arc has no stop there."],
      ["thin-column", "Arc: [[Marta]]", "Marta has a stop in 1 of 10 written scenes."],
      ["unmoved-stretch", "Arc: [[Marta]]", "Marta is on the page in 3 scenes in a row, Scene 2 to Scene 4, and the arc has no stop there."],
    ]);
    expect(gaps[0]!.rows).toEqual([2, 3, 4, 5]);
    expect(findGaps(grid, { minScenes: 20, thinShare: 0.25, stretch: 5 })).toEqual([]);
  });
});
