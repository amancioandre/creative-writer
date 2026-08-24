import { describe, it, expect } from "vitest";
import { Simulation } from "../../../src/domain/story/Simulation";
import { DEFAULT_FORCES } from "../../../src/domain/settings/Settings";
import type { Edge, Entity } from "../../../src/domain/story/StoryGraph";

const ent = (id: string): Entity => ({ id, name: id, kind: "character", path: null, aliases: [], bookmarked: false, appearances: [], mentions: 0 });
const edge = (from: string, to: string, weight = 1): Edge => ({ from, to, kind: "co-occurrence", layer: "internal", source: "extracted", weight, label: "", evidence: [], stale: false });
const dist = (s: Simulation, a: string, b: string) => Math.hypot(s.position(a)!.x - s.position(b)!.x, s.position(a)!.y - s.position(b)!.y);

describe("Simulation", () => {
  it("is deterministic and comes to rest", () => {
    const es = ["a", "b", "c", "d", "e"].map(ent);
    const eds = [edge("a", "b", 4), edge("b", "c"), edge("d", "e")];
    const s1 = new Simulation(DEFAULT_FORCES, 0, 0), s2 = new Simulation(DEFAULT_FORCES, 0, 0);
    s1.setGraph(es, eds); s2.setGraph(es, eds);
    s1.settle(1000); s2.settle(1000);
    expect(s1.resting).toBe(true);
    expect([...s1.positions()]).toEqual([...s2.positions()]);
    expect(s1.tick()).toBe(false);
  });
  it("keeps linked nodes closer than unlinked ones, near the link distance", () => {
    const s = new Simulation({ ...DEFAULT_FORCES, linkDistance: 40 }, 0, 0);
    s.setGraph(["a", "b", "c"].map(ent), [edge("a", "b", 4)]);
    s.settle(1000);
    expect(dist(s, "a", "b")).toBeLessThan(dist(s, "a", "c"));
    expect(dist(s, "a", "b")).toBeGreaterThan(20);
    expect(dist(s, "a", "b")).toBeLessThan(70);
  });
  it("stronger repulsion spreads the graph", () => {
    const es = ["a", "b", "c", "d"].map(ent);
    const loose = new Simulation({ ...DEFAULT_FORCES, repulsion: 0.3 }, 0, 0), tight = new Simulation({ ...DEFAULT_FORCES, repulsion: 3 }, 0, 0);
    loose.setGraph(es, []); tight.setGraph(es, []);
    loose.settle(1000); tight.settle(1000);
    expect(dist(tight, "a", "b")).toBeGreaterThan(dist(loose, "a", "b"));
  });
  it("keeps positions across a graph update and honours pins and drags", () => {
    const s = new Simulation(DEFAULT_FORCES, 0, 0);
    s.setGraph(["a", "b"].map(ent), [edge("a", "b")]);
    s.settle(500);
    const before = s.position("a")!;
    s.setGraph(["a", "b", "c"].map(ent), [edge("a", "b"), edge("b", "c")]);
    expect(s.position("a")).toEqual(before);
    expect(s.resting).toBe(false);
    s.drag("a", { x: 100, y: 100 });
    s.pin("a", true);
    s.settle(500);
    expect(s.position("a")).toEqual({ x: 100, y: 100 });
    expect(s.isPinned("a")).toBe(true);
    s.pin("a", false);
    s.setForces({ ...DEFAULT_FORCES, gravity: 0.5 });
    s.settle(500);
    expect(s.position("a")).not.toEqual({ x: 100, y: 100 });
  });
  it("handles an empty graph", () => {
    const s = new Simulation(DEFAULT_FORCES, 0, 0);
    s.setGraph([], []);
    expect(s.tick()).toBe(true);
    expect(s.positions().size).toBe(0);
    expect(s.position("x")).toBeUndefined();
  });
});
