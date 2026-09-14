import { describe, it, expect } from "vitest";
import { ALL_KINDS, ALL_LAYERS, applyFilter, explainEmpty, type GraphFilter } from "../../../src/domain/story/Filter";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { EMPTY_STORY_MAP_FILE } from "../../../src/domain/story/StoryMapFile";
import { splitScenes } from "../../../src/domain/text/Scenes";

const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), ...extra });
const graph = buildStoryGraph("Novel", [
  note("Novel/Characters/Marta.md", "", { links: ["Novel/Characters/Ilse.md"] }),
  note("Novel/Characters/Ilse.md", ""),
  note("Novel/Places/Lisbon.md", ""),
  note("Novel/One.md", "# Camp\nMarta woke before Ilse at the gate of Lisbon.\n"),
], EMPTY_STORY_MAP_FILE);
const all: GraphFilter = { layers: new Set(ALL_LAYERS), kinds: new Set(ALL_KINDS), query: "", hideIsolated: false };

describe("explainEmpty", () => {
  it("says nothing while something is shown, or when there is nothing to show at all", () => {
    expect(explainEmpty(graph, all)).toEqual([]);
    expect(explainEmpty({ ...graph, entities: [], edges: [] }, { ...all, query: "zzz" })).toEqual([]);
  });

  it("names the search that matches nothing and how many nodes clearing it would show", () => {
    const why = explainEmpty(graph, { ...all, query: "nobody" });
    expect(why).toEqual([{ cause: "query", count: applyFilter(graph, all).entities.length }]);
  });

  it("names every constraint that is on and would show something if lifted alone", () => {
    const why = explainEmpty(graph, { ...all, kinds: new Set(["event"]), query: "Marta" });
    expect(why.map((w) => w.cause).sort()).toEqual(["kinds"]);
    expect(why[0]!.count).toBeGreaterThan(0);
  });

  it("blames hidden loners when every node is isolated under the current layers", () => {
    const why = explainEmpty(graph, { ...all, layers: new Set(), hideIsolated: true });
    expect(why.map((w) => w.cause)).toEqual(["layers", "isolated"]);
  });
});
