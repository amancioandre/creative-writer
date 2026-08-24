import type { Contradiction, SceneSlot, Strip, Thread, ThreadKind } from "./Thread";

/**
 * Geometry for the threads view, kept away from the DOM so it can be
 * tested to the pixel. The x-axis is the manuscript: every scene gets a
 * slot as wide as its share of the words (never narrower than `minSlot`),
 * so the axis itself is the length histogram. Arcs are half-ellipses on
 * the baseline whose height grows with their span — a connection across
 * the whole book rises to the top of the band, a connection between
 * neighbouring scenes barely lifts off.
 */
export interface LayoutOptions {
  /** Width to fit the axis into; content may overflow it when many scenes hit `minSlot`. */
  readonly width: number;
  readonly minSlot: number;
  /** Height of the arc band above the baseline. */
  readonly bandHeight: number;
  /** Tallest scene bar below the baseline. */
  readonly barMax: number;
  readonly stripHeight: number;
  /** Space kept between the tallest arc and the top of the band. */
  readonly pad: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = { width: 800, minSlot: 6, bandHeight: 220, barMax: 60, stripHeight: 44, pad: 8 };
/** Room for a strip's label above its bars. */
export const STRIP_LABEL_HEIGHT = 14;

export interface SlotBox {
  readonly index: number;
  readonly x0: number;
  readonly x1: number;
  readonly cx: number;
  readonly barH: number;
  /** Alternates whenever the note changes, so chapters read as bands. */
  readonly shade: 0 | 1;
}

export interface ArcPath {
  readonly threadId: string;
  readonly kind: ThreadKind;
  readonly from: number;
  readonly to: number;
  readonly d: string;
  readonly span: number;
  /** Apex, for anchoring a card. */
  readonly apex: { readonly x: number; readonly y: number };
  readonly contradiction: Contradiction | null;
}

export interface StripRow {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  /** Top of the row (label line). */
  readonly y: number;
  /** Baseline the bars stand on. */
  readonly base: number;
  readonly max: number;
}

export interface StripBar {
  readonly stripId: string;
  readonly index: number;
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly h: number;
  readonly value: number;
}

export function layoutSlots(scenes: readonly SceneSlot[], o: LayoutOptions): { slots: SlotBox[]; contentWidth: number; baseY: number } {
  const total = scenes.reduce((s, x) => s + x.words, 0);
  const maxWords = Math.max(1, ...scenes.map((s) => s.words));
  const slots: SlotBox[] = [];
  let x = 0, shade: 0 | 1 = 0, lastNote: string | null = null;
  for (const s of scenes) {
    const w = Math.max(o.minSlot, total > 0 ? (s.words / total) * o.width : o.minSlot);
    if (lastNote !== null && s.note !== lastNote) shade = shade === 0 ? 1 : 0;
    lastNote = s.note;
    // Square root, so one six-thousand-word chapter does not flatten every other bar to a hairline.
    const barH = o.barMax * Math.sqrt(s.words / maxWords);
    slots.push({ index: s.index, x0: x, x1: x + w, cx: x + w / 2, barH, shade });
    x += w;
  }
  return { slots, contentWidth: Math.max(o.width, x), baseY: o.bandHeight };
}

/** Left to right always, so the sweep flag is constant and the arc always bulges upward. */
export function arcPath(a: SlotBox, b: SlotBox, baseY: number, bandHeight: number, pad: number): { d: string; apex: { x: number; y: number } } {
  const [l, r] = a.cx <= b.cx ? [a, b] : [b, a];
  const rx = (r.cx - l.cx) / 2;
  const ry = Math.min(rx, bandHeight - pad);
  return { d: `M${f(l.cx)},${f(baseY)} A${f(rx)},${f(ry)} 0 0,1 ${f(r.cx)},${f(baseY)}`, apex: { x: l.cx + rx, y: baseY - ry } };
}

/**
 * One arc per consecutive pair of stops in each thread, plus one per
 * contradiction on top. Paint order: entity threads first (the densest,
 * the least important), then facts, then the writer's own, then
 * contradictions last so red is never buried; within a kind, long arcs
 * first so short ones stay clickable on top of them.
 */
export function layoutArcs(threads: readonly Thread[], contradictions: readonly Contradiction[], slots: readonly SlotBox[], baseY: number, o: LayoutOptions): ArcPath[] {
  const byIndex = new Map(slots.map((s) => [s.index, s]));
  const arcs: ArcPath[] = [];
  for (const t of threads) {
    const stops = t.refs.filter((r) => r.index >= 0);
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = byIndex.get(stops[i]!.index), b = byIndex.get(stops[i + 1]!.index);
      if (!a || !b || a.index === b.index) continue;
      const { d, apex } = arcPath(a, b, baseY, o.bandHeight, o.pad);
      arcs.push({ threadId: t.id, kind: t.kind, from: a.index, to: b.index, d, span: Math.abs(b.index - a.index), apex, contradiction: null });
    }
  }
  const rank: Record<ThreadKind, number> = { entity: 0, fact: 1, writer: 2 };
  arcs.sort((x, y) => rank[x.kind] - rank[y.kind] || y.span - x.span);
  for (const c of contradictions) {
    const a = byIndex.get(c.a.index), b = byIndex.get(c.b.index);
    if (!a || !b || a.index === b.index) continue;
    const { d, apex } = arcPath(a, b, baseY, o.bandHeight, o.pad);
    arcs.push({ threadId: c.threadId, kind: "fact", from: Math.min(a.index, b.index), to: Math.max(a.index, b.index), d, span: Math.abs(b.index - a.index), apex, contradiction: c });
  }
  return arcs;
}

/** Strips stack under the scene bars; each bar copies its slot's x-range verbatim, which is the whole alignment guarantee. */
export function layoutStrips(strips: readonly Strip[], slots: readonly SlotBox[], top: number, o: LayoutOptions): { rows: StripRow[]; bars: StripBar[]; height: number } {
  const rows: StripRow[] = [];
  const bars: StripBar[] = [];
  let y = top;
  for (const strip of strips) {
    const max = Math.max(0, ...strip.values);
    const base = y + o.stripHeight;
    rows.push({ id: strip.id, label: strip.label, unit: strip.unit, y, base, max });
    const usable = o.stripHeight - STRIP_LABEL_HEIGHT;
    for (const s of slots) {
      const value = strip.values[s.index] ?? 0;
      const h = max > 0 ? (value / max) * usable : 0;
      bars.push({ stripId: strip.id, index: s.index, x0: s.x0, x1: s.x1, y: base - h, h, value });
    }
    y = base;
  }
  return { rows, bars, height: y - top };
}

function f(n: number): string { return n.toFixed(1); }
