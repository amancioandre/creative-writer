import { describe, it, expect } from "vitest";
import { castFromGraph, conflictMarks, easeLevel } from "../../../src/domain/manuscript/StoryFacts";
import type { StoryGraph } from "../../../src/domain/story/StoryGraph";
import type { Contradiction } from "../../../src/domain/threads/Thread";

const entity = (id: string, name: string, kind: StoryGraph["entities"][number]["kind"], mentions: number, path: string | null = null) =>
  ({ id, name, kind, path, aliases: [], bookmarked: false, appearances: [], mentions });

const graph: StoryGraph = {
  project: "Novel",
  entities: [entity("m", "Marta", "character", 9, "Novel/Characters/Marta.md"), entity("l", "Lisbon", "location", 4, "Novel/Places/Lisbon.md"), entity("i", "Ilse", "character", 12), entity("n", "One", "note", 0, "Novel/One.md"), entity("r", "Orpheus", "reference", 1)],
  edges: [],
  timeline: [
    { scene: { path: "Novel/One.md", title: "Camp", line: 0 }, words: 10, bookmarked: false, present: ["m", "l", "n", "r"], events: [] },
    { scene: { path: "Novel/One.md", title: "Creek", line: 5 }, words: 10, bookmarked: false, present: ["i", "m"], events: [] },
    { scene: { path: "Novel/Two.md", title: "", line: 0 }, words: 10, bookmarked: false, present: ["i"], events: [] },
  ],
};

describe("castFromGraph", () => {
  it("lists who is in each note and each scene, characters first, most mentioned first, notes and references left out", () => {
    const cast = castFromGraph(graph);
    expect(cast.get("Novel/One.md")!.cast.map((c) => c.name)).toEqual(["Ilse", "Marta", "Lisbon"]);
    expect(cast.get("Novel/One.md")!.scenes.map((s) => [s.title, s.line, s.cast.map((c) => c.name)])).toEqual([["Camp", 0, ["Marta", "Lisbon"]], ["Creek", 5, ["Ilse", "Marta"]]]);
    expect(cast.get("Novel/Two.md")!.cast.map((c) => [c.name, c.path])).toEqual([["Ilse", null]]);
  });
});

describe("conflictMarks", () => {
  it("marks both scenes of a live contradiction and skips dismissed ones", () => {
    const ref = (path: string, line: number, value: string) => ({ scene: { path, title: "", line }, index: 0, note: "", value });
    const live: Contradiction = { key: "k", threadId: "t", subject: "Marta", attribute: "eye colour", a: ref("Novel/One.md", 0, "blue"), b: ref("Novel/Two.md", 3, "grey"), dismissed: false, stale: false };
    const marks = conflictMarks([live, { ...live, key: "d", dismissed: true }]);
    expect(marks).toEqual([
      { path: "Novel/One.md", line: 0, text: "Marta · eye colour: blue vs grey", otherPath: "Novel/Two.md", otherLine: 3 },
      { path: "Novel/Two.md", line: 3, text: "Marta · eye colour: blue vs grey", otherPath: "Novel/One.md", otherLine: 0 },
    ]);
  });
});

describe("easeLevel", () => {
  it("orders the readability bands from easy to dense", () => {
    expect(easeLevel("Very easy")).toBe(1);
    expect(easeLevel("Plain")).toBe(4);
    expect(easeLevel("Very dense")).toBe(7);
    expect(easeLevel(null)).toBe(0);
    expect(easeLevel("Nonsense")).toBe(0);
  });
});
