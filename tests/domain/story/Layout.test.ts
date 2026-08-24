import { describe, it, expect } from "vitest";
import { forceLayout } from "../../../src/domain/story/Layout";
import type { Edge, Entity } from "../../../src/domain/story/StoryGraph";

const ent = (id: string): Entity => ({ id, name: id, kind: "character", path: null, aliases: [], bookmarked: false, appearances: [], mentions: 0 });
const edge = (from: string, to: string, weight = 1): Edge => ({ from, to, kind: "co-occurrence", layer: "internal", source: "extracted", weight, label: "", evidence: [], stale: false });
const opts = { width: 400, height: 300, iterations: 120 };

describe("forceLayout", () => {
  it("handles empty and single graphs", () => {
    expect(forceLayout([], [], opts).size).toBe(0);
    expect(forceLayout([ent("a")], [], opts).get("a")).toEqual({ x: 200, y: 150 });
  });
  it("is deterministic and keeps nodes inside the box", () => {
    const es = ["a", "b", "c", "d", "e"].map(ent);
    const eds = [edge("a", "b", 4), edge("b", "c"), edge("d", "e")];
    const p1 = forceLayout(es, eds, opts), p2 = forceLayout(es, eds, opts);
    expect([...p1]).toEqual([...p2]);
    for (const p of p1.values()) {
      expect(p.x).toBeGreaterThanOrEqual(20); expect(p.x).toBeLessThanOrEqual(380);
      expect(p.y).toBeGreaterThanOrEqual(20); expect(p.y).toBeLessThanOrEqual(280);
    }
  });
  it("pulls linked nodes closer than unlinked ones", () => {
    const es = ["a", "b", "c"].map(ent);
    const p = forceLayout(es, [edge("a", "b", 5)], opts);
    const d = (x: string, y: string) => Math.hypot(p.get(x)!.x - p.get(y)!.x, p.get(x)!.y - p.get(y)!.y);
    expect(d("a", "b")).toBeLessThan(d("a", "c"));
  });
  it("honours pinned positions", () => {
    const es = ["a", "b"].map(ent);
    const p = forceLayout(es, [edge("a", "b")], opts, new Map([["a", { x: 33, y: 44 }]]));
    expect(p.get("a")).toEqual({ x: 33, y: 44 });
  });
});
