import { describe, it, expect } from "vitest";
import { GRID_SNAPSHOT_FLAG, rankSentences, snapshotNote, snapshotPath } from "../../../src/domain/plot/Snapshot";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE } from "../../../src/domain/story/StoryMapFile";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";
import type { ProjectSpec } from "../../../src/domain/progress/Project";

const novel: ProjectSpec = { name: "The | Novel", scope: "Novel/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const one = `# Camp\nMarta woke at the gate.\n\n# Later\n`;
const note = (path: string, body: string): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), text: body });
const graph = buildStoryGraph("Novel", [note("Novel/Characters/Marta.md", ""), note("Novel/One.md", one)], EMPTY_STORY_MAP_FILE);
const threads = parseStoryThreads(`## Subplot: The gate\n- [[One#Camp]] — plant: "at the gate" she | waits\n- [[One#Camp]] — again\n- [[One#Later]] — payoff: "gone" the gate closes\n\n## Empty\n`);
const grid = buildPlotGrid(graph, buildThreads(graph, EMPTY_STORY_MAP_FILE, threads, new Set(), undefined, () => one));

describe("snapshot", () => {
  it("is a dated table beside the project, flagged so it is never read back, pipes escaped", () => {
    expect(snapshotPath(novel, "2026-09-13")).toBe("Novel/Plot grid · 2026-09-13.md");
    expect(snapshotPath({ ...novel, scope: "Novel/Novel.md" }, "2026-09-13")).toBe("Novel/Plot grid · 2026-09-13.md");
    const md = snapshotNote(grid, novel, "2026-09-13");
    expect(md.startsWith(`---\ncreative-writer: false\n${GRID_SNAPSHOT_FLAG}: 1\n---\n`)).toBe(true);
    expect(md).toContain("2 scenes, 2 columns, 2 cells filled, 1 verified, 1 broken");
    expect(md).toContain("| Scene | Words | The gate | Empty |");
    expect(md).toContain("| **One** | | | |");
    expect(md).toContain("| Camp | 5 | plant: she \\| waits ✓ (+1) |  |");
    expect(md).toContain("| Later *(outline)* |  | payoff: the gate closes ✗ |  |");
  });

  it("ranks a scene's sentences by the words they share with a lost quote, document order without one", () => {
    const s = ["The gate was shut at dawn.", "Marta waited.", "At the gate of the camp she waited."];
    expect(rankSentences(s, "she waited at the gate").map((r) => [r.index, r.score])).toEqual([[2, 1], [0, 0.5], [1, 0.25]]);
    expect(rankSentences(s, null).map((r) => r.index)).toEqual([0, 1, 2]);
    expect(rankSentences(s, "").map((r) => r.score)).toEqual([0, 0, 0]);
  });
});
