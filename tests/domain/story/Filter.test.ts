import { describe, it, expect } from "vitest";
import { ALL_KINDS, ALL_LAYERS, DEFAULT_FILTER, applyFilter, neighbours } from "../../../src/domain/story/Filter";
import type { Edge, Entity, StoryGraph } from "../../../src/domain/story/StoryGraph";

const ent = (id: string, kind: Entity["kind"]): Entity => ({ id, name: id, kind, path: null, aliases: [], bookmarked: false, appearances: [], mentions: 0 });
const edge = (from: string, to: string, kind: Edge["kind"], layer: Edge["layer"], weight = 1): Edge => ({ from, to, kind, layer, source: "extracted", weight, label: "", evidence: [], stale: false });
const graph: StoryGraph = {
  project: "p",
  entities: [ent("marta", "character"), ent("ilse", "character"), ent("lisbon", "location"), ent("ch1", "note"), ent("orpheus", "reference"), ent("nobody", "candidate")],
  edges: [edge("marta", "ilse", "co-occurrence", "internal", 3), edge("marta", "lisbon", "co-occurrence", "internal"), edge("marta", "ch1", "appearance", "explicit"), edge("marta", "orpheus", "reference", "external")],
  timeline: [],
};

describe("applyFilter", () => {
  it("hides notes by default and drops their edges", () => {
    const g = applyFilter(graph, DEFAULT_FILTER);
    expect(g.entities.map((e) => e.id)).not.toContain("ch1");
    expect(g.edges.some((e) => e.kind === "appearance")).toBe(false);
  });
  it("filters by layer", () => {
    const g = applyFilter(graph, { ...DEFAULT_FILTER, layers: new Set(["external"]) });
    expect(g.edges.map((e) => e.kind)).toEqual(["reference"]);
  });
  it("searches by name and keeps direct neighbours only", () => {
    const g = applyFilter(graph, { ...DEFAULT_FILTER, kinds: new Set(ALL_KINDS), layers: new Set(ALL_LAYERS), query: "lis" });
    expect(g.entities.map((e) => e.id).sort()).toEqual(["lisbon", "marta"]);
    const g2 = applyFilter(graph, { ...DEFAULT_FILTER, kinds: new Set(ALL_KINDS), layers: new Set(ALL_LAYERS), query: "marta" });
    expect(g2.entities.map((e) => e.id).sort()).toEqual(["ch1", "ilse", "lisbon", "marta", "orpheus"]);
  });
  it("focuses on one entity and its neighbours, ignoring kind filters", () => {
    const g = applyFilter(graph, { ...DEFAULT_FILTER, focusId: "ilse" });
    expect(g.entities.map((e) => e.id).sort()).toEqual(["ilse", "marta"]);
    const g2 = applyFilter(graph, { ...DEFAULT_FILTER, focusId: "marta" });
    expect(g2.entities.map((e) => e.id).sort()).toEqual(["ch1", "ilse", "lisbon", "marta", "orpheus"]);
  });
  it("can hide isolated nodes", () => {
    const g = applyFilter(graph, { ...DEFAULT_FILTER, hideIsolated: true });
    expect(g.entities.map((e) => e.id)).not.toContain("nobody");
  });
});

describe("neighbours", () => {
  it("returns edges touching the id, strongest first", () => {
    expect(neighbours(graph, "marta").map((e) => e.to)).toEqual(["ilse", "lisbon", "ch1", "orpheus"]);
    expect(neighbours(graph, "ilse")).toHaveLength(1);
  });
});
