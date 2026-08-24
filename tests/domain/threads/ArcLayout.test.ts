import { describe, it, expect } from "vitest";
import { DEFAULT_LAYOUT, STRIP_LABEL_HEIGHT, arcPath, layoutArcs, layoutSlots, layoutStrips } from "../../../src/domain/threads/ArcLayout";
import type { Contradiction, SceneSlot, Thread } from "../../../src/domain/threads/Thread";

const slot = (index: number, words: number, note = "a.md"): SceneSlot => ({ ref: { path: note, title: `S${index}`, line: 0 }, index, words, start: 0, note, bookmarked: false });
const o = { ...DEFAULT_LAYOUT, width: 400, minSlot: 10, bandHeight: 200, barMax: 50, stripHeight: 40, pad: 8 };

describe("layoutSlots", () => {
  it("shares the width by word count, slots abutting, bars by square root", () => {
    const { slots, contentWidth, baseY } = layoutSlots([slot(0, 100), slot(1, 300, "b.md")], o);
    expect(slots.map((s) => [s.x0, s.x1])).toEqual([[0, 100], [100, 400]]);
    expect(slots[0]!.cx).toBe(50);
    expect(contentWidth).toBe(400);
    expect(baseY).toBe(200);
    expect(slots[1]!.barH).toBe(50);
    expect(slots[0]!.barH).toBeCloseTo(50 * Math.sqrt(1 / 3));
    expect(slots.map((s) => s.shade)).toEqual([0, 1]);
  });

  it("never lets a slot shrink below the minimum and lets the content grow instead", () => {
    const scenes = [slot(0, 1000), ...Array.from({ length: 5 }, (_, i) => slot(i + 1, 1, "b.md"))];
    const { slots, contentWidth } = layoutSlots(scenes, o);
    expect(slots.slice(1).every((s) => s.x1 - s.x0 === 10)).toBe(true);
    expect(contentWidth).toBeGreaterThan(400);
    expect(contentWidth).toBe(slots[5]!.x1);
    expect(layoutSlots([slot(0, 0)], o).slots[0]!.x1).toBe(10);
    expect(layoutSlots([], o)).toEqual({ slots: [], contentWidth: 400, baseY: 200 });
  });

  it("alternates the shade per note, not per scene", () => {
    const { slots } = layoutSlots([slot(0, 1, "a"), slot(1, 1, "a"), slot(2, 1, "b"), slot(3, 1, "b"), slot(4, 1, "c")], o);
    expect(slots.map((s) => s.shade)).toEqual([0, 0, 1, 1, 0]);
  });
});

describe("arcPath", () => {
  const box = (cx: number) => ({ index: 0, x0: cx - 5, x1: cx + 5, cx, barH: 0, shade: 0 as const });
  it("draws a half-ellipse left to right whose height is the half-span", () => {
    expect(arcPath(box(10), box(110), 200, 200, 8)).toEqual({ d: "M10.0,200.0 A50.0,50.0 0 0,1 110.0,200.0", apex: { x: 60, y: 150 } });
    expect(arcPath(box(110), box(10), 200, 200, 8).d).toBe("M10.0,200.0 A50.0,50.0 0 0,1 110.0,200.0");
  });
  it("caps the height at the band, keeping the padding", () => {
    const { d, apex } = arcPath(box(0), box(1000), 200, 200, 8);
    expect(d).toBe("M0.0,200.0 A500.0,192.0 0 0,1 1000.0,200.0");
    expect(apex).toEqual({ x: 500, y: 8 });
  });
});

const ref = (index: number, value?: string) => ({ scene: { path: "a.md", title: `S${index}`, line: 0 }, index, note: value ?? "", value });
const thread = (id: string, kind: Thread["kind"], idx: number[]): Thread => ({ id, kind, source: "structure", label: id, refs: idx.map((i) => ref(i)), stale: false });

describe("layoutArcs", () => {
  const { slots, baseY } = layoutSlots([slot(0, 1), slot(1, 1), slot(2, 1), slot(3, 1)], o);
  const clash: Contradiction = { key: "k", threadId: "f", subject: "Ilse", attribute: "eyes", a: ref(0, "green"), b: ref(3, "grey"), dismissed: false, stale: false };

  it("joins consecutive stops only, skips unresolved and same-scene stops, and orders entity < fact < writer < contradiction, long first", () => {
    const arcs = layoutArcs([thread("w", "writer", [1, 2]), thread("e", "entity", [0, 1, 3]), thread("f", "fact", [0, -1, 3]), thread("x", "entity", [2, 2])], [clash], slots, baseY, o);
    expect(arcs.map((a) => [a.threadId, a.from, a.to, a.contradiction !== null])).toEqual([
      ["e", 1, 3, false], ["e", 0, 1, false], ["f", 0, 3, false], ["w", 1, 2, false], ["f", 0, 3, true],
    ]);
    expect(arcs[0]!.span).toBe(2);
    expect(arcs[4]!.kind).toBe("fact");
    expect(arcs[4]!.d).toBe(arcs[2]!.d);
  });

  it("skips a contradiction whose scene is gone", () => {
    expect(layoutArcs([], [{ ...clash, b: ref(9, "grey") }], slots, baseY, o)).toEqual([]);
  });
});

describe("layoutStrips", () => {
  it("copies each slot's x-range into its bar and stacks rows", () => {
    const { slots } = layoutSlots([slot(0, 100), slot(1, 300, "b.md")], o);
    const { rows, bars, height } = layoutStrips([{ id: "cast", label: "Cast", unit: "n", values: [2, 4] }, { id: "zero", label: "Z", unit: "", values: [0, 0] }], slots, 300, o);
    expect(rows.map((r) => [r.id, r.y, r.base, r.max])).toEqual([["cast", 300, 340, 4], ["zero", 340, 380, 0]]);
    expect(height).toBe(80);
    expect(bars.filter((b) => b.stripId === "cast").map((b) => [b.x0, b.x1, b.h, b.value])).toEqual([[0, 100, (40 - STRIP_LABEL_HEIGHT) / 2, 2], [100, 400, 40 - STRIP_LABEL_HEIGHT, 4]]);
    expect(bars.filter((b) => b.stripId === "zero").every((b) => b.h === 0 && b.y === 380)).toBe(true);
    for (const b of bars) { const s = slots[b.index]!; expect([b.x0, b.x1]).toEqual([s.x0, s.x1]); }
  });
});
