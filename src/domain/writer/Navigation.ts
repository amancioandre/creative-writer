import type { BoardLayout, PlacedCard, PlacedGroup, PlacedLayer } from "./Layout";

/**
 * Where the keyboard goes next on the board. Lanes are layers, read top to
 * bottom, and the stories band is the lane above the first layer. Inside a
 * lane, groups sit left to right; inside a group, cards read in rows. All
 * of it is pure: a layout, a set of hidden layers and a place in, a place
 * out, so the view only has to select what comes back.
 */
export type Direction = "left" | "right" | "up" | "down";

/** A place the keyboard can stand: the band, a group, or nothing yet. */
export type Spot = { kind: "band" } | { kind: "group"; id: string };

const centreX = (r: { x: number; w: number }) => r.x + r.w / 2;

/** The visible layers, in board order. */
export function visibleLayers(layout: BoardLayout, hidden: ReadonlySet<string>): PlacedLayer[] {
  return layout.layers.filter((l) => !hidden.has(l.name));
}

/** The groups of a layer in the order they are drawn, left to right. */
export function rowOf(layer: PlacedLayer): PlacedGroup[] {
  return [...layer.groups].sort((a, b) => a.rect.x - b.rect.x);
}

/** The visible layer holding a group. */
export function layerOf(layout: BoardLayout, hidden: ReadonlySet<string>, id: string): PlacedLayer | null {
  return visibleLayers(layout, hidden).find((l) => l.groups.some((g) => g.group.def.id === id)) ?? null;
}

/** The group of `layer` whose centre is nearest to `x`. */
function nearestIn(layer: PlacedLayer, x: number): PlacedGroup | null {
  let best: PlacedGroup | null = null, bestD = Infinity;
  for (const g of layer.groups) {
    const d = Math.abs(centreX(g.rect) - x);
    if (d < bestD) { best = g; bestD = d; }
  }
  return best;
}

/**
 * The spot one step from `from`. Left and right walk the row and stop at
 * its ends; up and down cross lanes to the group nearest in x, with the
 * band above the first layer. From the band, down lands on the first
 * layer's leftmost group; left and right stay put (the view walks the
 * stories itself). Null when there is nowhere to go.
 */
export function step(layout: BoardLayout, hidden: ReadonlySet<string>, from: Spot, dir: Direction): Spot | null {
  const layers = visibleLayers(layout, hidden);
  if (from.kind === "band") {
    if (dir !== "down") return null;
    const first = layers[0] && rowOf(layers[0])[0];
    return first ? { kind: "group", id: first.group.def.id } : null;
  }
  const layer = layerOf(layout, hidden, from.id);
  if (!layer) return null;
  const row = rowOf(layer);
  const i = row.findIndex((g) => g.group.def.id === from.id);
  const here = row[i]!;
  if (dir === "left" || dir === "right") {
    const next = row[dir === "left" ? i - 1 : i + 1];
    return next ? { kind: "group", id: next.group.def.id } : null;
  }
  const li = layers.indexOf(layer);
  if (dir === "up") {
    if (li === 0) return { kind: "band" };
    const g = nearestIn(layers[li - 1]!, centreX(here.rect));
    return g ? { kind: "group", id: g.group.def.id } : null;
  }
  const below = layers[li + 1];
  if (!below) return null;
  const g = nearestIn(below, centreX(here.rect));
  return g ? { kind: "group", id: g.group.def.id } : null;
}

/** The first or last group of the row `from` sits in. */
export function endOfRow(layout: BoardLayout, hidden: ReadonlySet<string>, from: Spot, end: "first" | "last"): Spot | null {
  if (from.kind !== "group") return null;
  const layer = layerOf(layout, hidden, from.id);
  if (!layer) return null;
  const row = rowOf(layer);
  const g = end === "first" ? row[0] : row[row.length - 1];
  return g ? { kind: "group", id: g.group.def.id } : null;
}

/**
 * Lane `n`, counted from 1: the band is lane 0, the first visible layer
 * lane 1. Lands on the leftmost group. Null past the last lane.
 */
export function lane(layout: BoardLayout, hidden: ReadonlySet<string>, n: number): Spot | null {
  if (n === 0) return { kind: "band" };
  const layer = visibleLayers(layout, hidden)[n - 1];
  const g = layer && rowOf(layer)[0];
  return g ? { kind: "group", id: g.group.def.id } : null;
}

/** The lane number of a spot, on the same count as `lane`; -1 when it is nowhere. */
export function laneOf(layout: BoardLayout, hidden: ReadonlySet<string>, at: Spot): number {
  if (at.kind === "band") return 0;
  const layer = layerOf(layout, hidden, at.id);
  return layer ? visibleLayers(layout, hidden).indexOf(layer) + 1 : -1;
}

/** Cards of a group in reading order: by row, then left to right. */
export function readingOrder(pg: PlacedGroup): PlacedCard[] {
  return [...pg.cards].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * The card one step from `path` inside its group: left and right follow
 * reading order, up and down go to the card nearest in x on the previous
 * or next row. With no `path`, the first card. Null at the edges or in an
 * empty group.
 */
export function stepCard(pg: PlacedGroup, path: string | null, dir: Direction): PlacedCard | null {
  const cards = readingOrder(pg);
  if (!cards.length) return null;
  if (path === null) return cards[0]!;
  const i = cards.findIndex((c) => c.card.path === path);
  if (i < 0) return cards[0]!;
  const here = cards[i]!;
  if (dir === "left" || dir === "right") return cards[dir === "left" ? i - 1 : i + 1] ?? null;
  // Rows: cards whose y differs by less than half a card share a row.
  const rows: PlacedCard[][] = [];
  for (const c of cards) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0]!.y - c.y) < 36) row.push(c); else rows.push([c]);
  }
  const ri = rows.findIndex((r) => r.includes(here));
  const target = rows[dir === "up" ? ri - 1 : ri + 1];
  if (!target) return null;
  let best: PlacedCard | null = null, bestD = Infinity;
  for (const c of target) { const d = Math.abs(c.x - here.x); if (d < bestD) { best = c; bestD = d; } }
  return best;
}
