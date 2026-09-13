import { describe, it, expect } from "vitest";
import { castFromGraph, conflictMarks, easeLevel, echoMarks, threadMarks } from "../../../src/domain/manuscript/StoryFacts";
import type { Thread } from "../../../src/domain/threads/Thread";
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
    const marks = conflictMarks([live, { ...live, key: "d", dismissed: true }, { ...live, key: "e", explainedBy: "writer:x" }]);
    expect(marks).toEqual([
      { kind: "conflict", path: "Novel/One.md", line: 0, text: "Marta · eye colour: blue vs grey", otherPath: "Novel/Two.md", otherLine: 3 },
      { kind: "conflict", path: "Novel/Two.md", line: 3, text: "Marta · eye colour: blue vs grey", otherPath: "Novel/One.md", otherLine: 0 },
    ]);
  });
});

describe("threadMarks", () => {
  const stop = (path: string, title: string, index: number, role: "plant" | "touch" | "payoff" | "reversal", anchor: { line: number; ch: number } | null | undefined) => ({ scene: { path, title, line: 2 }, index, note: "", role, quote: "q", anchor });
  const thread = (refs: Thread["refs"], directed = true): Thread => ({ id: "writer:t", kind: "writer", source: "writer", label: "The letter", refs, stale: false, directed, dangling: refs.filter((r) => r.role === "plant" && !refs.some((o) => (o.role === "payoff" || o.role === "reversal") && o.index > r.index)) });

  it("marks anchored plants and payoffs at their sentence, each pointing at the other", () => {
    const marks = threadMarks([thread([stop("One.md", "Station", 0, "plant", { line: 7, ch: 3 }), stop("Two.md", "Dinner", 1, "touch", { line: 1, ch: 0 }), stop("Nine.md", "Reading", 5, "reversal", { line: 12, ch: 0 })])]);
    expect(marks).toEqual([
      { kind: "plant", path: "One.md", line: 7, text: "The letter · plant, reversed in Reading", otherPath: "Nine.md", otherLine: 12 },
      { kind: "reversal", path: "Nine.md", line: 12, text: "The letter · reversal, planted in Station", otherPath: "One.md", otherLine: 7 },
    ]);
  });

  it("says when a plant has no payoff, skips unanchored stops and undirected threads", () => {
    expect(threadMarks([thread([stop("One.md", "Station", 0, "plant", { line: 7, ch: 3 })])])).toEqual([
      { kind: "plant", path: "One.md", line: 7, text: "The letter · plant, no payoff yet", otherPath: "One.md", otherLine: 7 },
    ]);
    expect(threadMarks([thread([stop("One.md", "Station", 0, "plant", null), stop("Two.md", "Dinner", 1, "payoff", undefined)])])).toEqual([]);
    expect(threadMarks([thread([stop("One.md", "Station", 0, "touch", { line: 1, ch: 0 })], false)])).toEqual([]);
  });
});

describe("echoMarks", () => {
  it("marks every anchored occurrence, pointing at the nearest other one, and skips unanchored stops", () => {
    const ref = (path: string, title: string, index: number, anchor: { line: number; ch: number } | null) => ({ scene: { path, title, line: 1 }, index, note: "", quote: "salt on the wind", anchor });
    const echo: Thread = { id: "echo:x", kind: "echo", source: "extracted", label: "salt on the wind", refs: [ref("One.md", "Harbour", 0, { line: 4, ch: 2 }), ref("Two.md", "Crossing", 1, { line: 9, ch: 0 }), ref("Nine.md", "House", 8, null)], stale: false, directed: false, dangling: [] };
    expect(echoMarks([echo])).toEqual([
      { kind: "echo", path: "One.md", line: 4, text: "“salt on the wind” · also in Crossing", otherPath: "Two.md", otherLine: 9 },
      { kind: "echo", path: "Two.md", line: 9, text: "“salt on the wind” · also in Harbour", otherPath: "One.md", otherLine: 4 },
    ]);
    expect(echoMarks([{ ...echo, kind: "writer" }])).toEqual([]);
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
