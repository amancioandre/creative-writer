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
    expect(snapshotPath(novel, null)).toBe("Novel/Plot grid.md");
    expect(snapshotNote(grid, novel, null)).toContain("An export, refreshed on every export");
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

describe("a snapshot read back", () => {
  it("names the day and the label from the file, and parses the table into chapters, scenes and cells", async () => {
    const { parseSnapshot, snapshotName, snapshotNote } = await import("../../../src/domain/plot/Snapshot");
    expect(snapshotName("Novel/Plot grid · 2026-09-13.md")).toEqual({ day: "2026-09-13", label: "" });
    expect(snapshotName("Novel/Plot grid · 2026-09-13 · before the rewrite.md")).toEqual({ day: "2026-09-13", label: "before the rewrite" });
    expect(snapshotName("Novel/Plot grid.md")).toBeNull();
    const md = `---\ncreative-writer: false\ncreative-writer-grid-snapshot: 1\n---\n%% Novel: the plot grid on 2026-09-13. 3 scenes. %%\n\n| Scene | Words | Anna | The letter \\| B |\n| --- | ---: | --- | --- |\n| **One** | | | |\n| Camp | 1,480 | want: to be seen ✓ | plant: pockets it (+1) |\n| Later *(outline)* |  |  |  |\n| **Two** | | | |\n| Return | 900 |  | payoff ✗ |\n`;
    const t = parseSnapshot(md);
    expect(t.summary).toBe("Novel: the plot grid on 2026-09-13. 3 scenes.");
    expect(t.columns).toEqual(["Anna", "The letter | B"]);
    expect(t.rows).toEqual([
      { chapter: "One", scene: "Camp", words: "1,480", outline: false, cells: ["want: to be seen ✓", "plant: pockets it (+1)"] },
      { chapter: "One", scene: "Later", words: "", outline: true, cells: ["", ""] },
      { chapter: "Two", scene: "Return", words: "900", outline: false, cells: ["", "payoff ✗"] },
    ]);
    // What the grid writes, the tabs read back whole.
    const written = parseSnapshot(snapshotNote(grid, { name: "Novel", scope: "Novel/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Novel/N.md", ignoredNames: [] }, "2026-09-13"));
    expect(written.columns).toEqual(grid.columns.map((c) => c.heading.name));
    expect(written.rows.map((r) => r.scene)).toEqual(grid.rows.map((r) => r.scene.title));
  });
});
