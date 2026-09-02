import type { Board, BoardGroup, Card } from "./Board";
import { UNSORTED } from "./Framework";
import type { StoriesRow, StoryCard } from "./Stories";
import type { Point, Rect } from "./WriterFile";

/**
 * Where everything sits on the board. Layers stack top to bottom; inside a
 * layer, groups **flow** left to right and never overlap: a group's saved
 * rectangle gives its size and its order (by `x`), never a free position,
 * so dragging a group reorders it among its neighbours and resizing it
 * pushes the neighbours along. Cards keep a position **relative to their
 * group**, so they travel with it; unplaced cards fill the group's grid.
 *
 * A card in several groups is drawn once, in its first group, with a chip
 * per group; that keeps one position per note in the file. Everything
 * here is deterministic: two machines with the same file draw the same board.
 */
export const CARD_W = 200;
export const CARD_H = 72;
export const CARD_GAP = 12;
export const GROUP_PAD = 16;
export const GROUP_HEAD = 34;
export const GROUP_GAP = 40;
export const LAYER_GAP = 90;
export const MIN_GROUP_W = 2 * GROUP_PAD + CARD_W;
export const MIN_GROUP_H = GROUP_HEAD + 2 * GROUP_PAD + CARD_H;

export interface PlacedCard {
  readonly card: Card;
  /** The group it is drawn in. */
  readonly group: string;
  /** Top-left corner, absolute. */
  readonly x: number;
  readonly y: number;
  /** Whether the writer placed it. */
  readonly pinned: boolean;
}

export interface PlacedGroup {
  readonly group: BoardGroup;
  readonly layer: string;
  readonly rect: Rect;
  /** Whether the writer sized or reordered it. */
  readonly pinned: boolean;
  readonly cards: readonly PlacedCard[];
}

export interface PlacedLayer {
  readonly name: string;
  readonly y: number;
  readonly groups: readonly PlacedGroup[];
}

export interface BoardLayout {
  readonly layers: readonly PlacedLayer[];
  readonly groups: readonly PlacedGroup[];
  /** Every drawn card by note path. */
  readonly cards: ReadonlyMap<string, PlacedCard>;
  readonly bounds: Rect;
}

/** The group a card is drawn in: its first tag's group. */
export function homeGroup(card: Card): string {
  return card.groups[0] ?? UNSORTED.id;
}

/** The default size of a group holding `n` cards: at least two slots wide and two tall, so the hint has room. */
export function defaultGroupSize(n: number): { w: number; h: number; cols: number } {
  const cols = n <= 2 ? 2 : Math.min(4, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(2, Math.ceil(n / cols));
  return { cols, w: 2 * GROUP_PAD + cols * CARD_W + (cols - 1) * CARD_GAP, h: GROUP_HEAD + 2 * GROUP_PAD + rows * CARD_H + (rows - 1) * CARD_GAP };
}

/** How many card columns fit in a rectangle. */
export function columnsIn(rect: Rect): number {
  return Math.max(1, Math.floor((rect.w - 2 * GROUP_PAD + CARD_GAP) / (CARD_W + CARD_GAP)));
}

export function layoutBoard(board: Board): BoardLayout {
  const homes = new Map<string, Card[]>();
  for (const c of board.cards) {
    const g = homeGroup(c);
    const list = homes.get(g) ?? [];
    list.push(c);
    homes.set(g, list);
  }
  const layers: PlacedLayer[] = [];
  const groups: PlacedGroup[] = [];
  const cards = new Map<string, PlacedCard>();
  let y = 0;
  const sourceLayers = [...board.layers.map((l) => ({ name: l.name, groups: l.groups })), ...(board.unsorted.cards.length ? [{ name: UNSORTED.name, groups: [board.unsorted] }] : [])];
  for (const layer of sourceLayers) {
    // Order: a saved rectangle's x among the saved, framework order among the rest, merged by where the framework would have put each.
    let probe = 0;
    const keyed = layer.groups.map((group) => {
      const mine = homes.get(group.def.id) ?? [];
      const size = group.rect ? { w: Math.max(MIN_GROUP_W, group.rect.w), h: Math.max(MIN_GROUP_H, group.rect.h) } : defaultGroupSize(mine.length);
      const key = group.rect ? group.rect.x : probe;
      probe += size.w + GROUP_GAP;
      return { group, mine, size, key };
    });
    keyed.sort((a, b) => a.key - b.key);
    let x = 0, height = 0;
    const placedGroups: PlacedGroup[] = [];
    for (const { group, mine, size } of keyed) {
      const rect: Rect = { x, y, w: size.w, h: size.h };
      x += rect.w + GROUP_GAP;
      height = Math.max(height, rect.h);
      const placedCards = placeCards(mine, group.def.id, rect);
      for (const pc of placedCards) cards.set(pc.card.path, pc);
      placedGroups.push({ group, layer: layer.name, rect, pinned: group.rect !== null, cards: placedCards });
    }
    // Back in framework order for panels and lists; the rectangles carry the flow order.
    placedGroups.sort((a, b) => layer.groups.indexOf(a.group) - layer.groups.indexOf(b.group));
    layers.push({ name: layer.name, y, groups: placedGroups });
    groups.push(...placedGroups);
    y += Math.max(height, MIN_GROUP_H) + LAYER_GAP;
  }
  return { layers, groups, cards, bounds: boundsOf(groups, [...cards.values()]) };
}

/** Pinned cards sit where the writer put them, relative to the group; the rest fill the grid's free slots in order, spilling below when it is full. */
function placeCards(mine: readonly Card[], group: string, rect: Rect): PlacedCard[] {
  const out: PlacedCard[] = [];
  const cols = columnsIn(rect);
  const slot = (i: number): Point => ({ x: rect.x + GROUP_PAD + (i % cols) * (CARD_W + CARD_GAP), y: rect.y + GROUP_HEAD + GROUP_PAD + Math.floor(i / cols) * (CARD_H + CARD_GAP) });
  const taken = new Set<number>();
  for (const c of mine) {
    if (!c.position) continue;
    out.push({ card: c, group, x: rect.x + c.position.x, y: rect.y + c.position.y, pinned: true });
    const i = slotAt(c.position, cols);
    if (i !== null) taken.add(i);
  }
  let i = 0;
  for (const c of mine) {
    if (c.position) continue;
    while (taken.has(i)) i++;
    const p = slot(i++);
    out.push({ card: c, group, x: p.x, y: p.y, pinned: false });
  }
  return out;
}

/** The grid slot a relative position's card would occupy, or null when it lies outside the grid. */
function slotAt(rel: Point, cols: number): number | null {
  const col = Math.round((rel.x - GROUP_PAD) / (CARD_W + CARD_GAP));
  const row = Math.round((rel.y - GROUP_HEAD - GROUP_PAD) / (CARD_H + CARD_GAP));
  if (col < 0 || col >= cols || row < 0) return null;
  return row * cols + col;
}

function boundsOf(groups: readonly PlacedGroup[], cards: readonly PlacedCard[]): Rect {
  const xs: number[] = [], ys: number[] = [];
  for (const g of groups) { xs.push(g.rect.x, g.rect.x + g.rect.w); ys.push(g.rect.y - 30, g.rect.y + g.rect.h); }
  for (const c of cards) { xs.push(c.x, c.x + CARD_W); ys.push(c.y, c.y + CARD_H); }
  if (!xs.length) return { x: 0, y: 0, w: 800, h: 600 };
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The group whose rectangle holds a point; the last drawn wins when they overlap. */
export function groupAt(layout: BoardLayout, p: Point): PlacedGroup | null {
  for (let i = layout.groups.length - 1; i >= 0; i--) {
    const g = layout.groups[i]!;
    const r = g.rect;
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return g;
  }
  return null;
}

/**
 * The rectangle to save for a group dropped with its left edge at `x`: its
 * size, and an order key that lands it between the neighbours it was
 * dropped among. Neighbours without a saved rectangle are given one too,
 * so the order the writer sees is the order the file keeps.
 */
export function reorderedGroup(layout: BoardLayout, id: string, x: number): { id: string; rect: Rect }[] {
  const pg = layout.groups.find((g) => g.group.def.id === id);
  if (!pg) return [];
  const row = layout.groups.filter((g) => g.layer === pg.layer).sort((a, b) => a.rect.x - b.rect.x);
  const others = row.filter((g) => g !== pg);
  let index = others.findIndex((g) => x < g.rect.x + g.rect.w / 2);
  if (index < 0) index = others.length;
  const ordered = [...others.slice(0, index), pg, ...others.slice(index)];
  let cursor = 0;
  return ordered.map((g) => { const rect = { x: cursor, y: g.rect.y, w: g.rect.w, h: g.rect.h }; cursor += g.rect.w + GROUP_GAP; return { id: g.group.def.id, rect }; });
}

export const cardCentre = (c: { x: number; y: number }): Point => ({ x: c.x + CARD_W / 2, y: c.y + CARD_H / 2 });

// --- the stories band ------------------------------------------------------------

export const STORY_W = 280;
export const STORY_H = 124;
export const PILL_H = 30;
export const PILL_GAP = 10;

export interface PlacedStory { readonly story: StoryCard; readonly x: number; readonly y: number }
export interface PlacedPill { readonly key: string; readonly label: string; readonly x: number; readonly y: number; readonly w: number }

/** The band above the layers: story cards in a row, then ideas and unfiled folders as pills on a line below. */
export interface StoriesBand {
  readonly rect: Rect;
  readonly stories: readonly PlacedStory[];
  readonly ideas: readonly PlacedPill[];
  readonly unfiled: readonly PlacedPill[];
}

const pillWidth = (label: string) => Math.min(320, Math.max(90, 24 + label.length * 7));

/** Lays the band out above a board whose top edge is `top`, left-aligned at x = 0. */
export function layoutStories(row: StoriesRow, top: number): StoriesBand {
  const stories: PlacedStory[] = [];
  const pillsLine = row.ideas.length || row.unfiled.length ? PILL_H + PILL_GAP : 0;
  const h = GROUP_HEAD + GROUP_PAD + (row.stories.length ? STORY_H : MIN_GROUP_H - GROUP_HEAD - 2 * GROUP_PAD) + pillsLine + GROUP_PAD;
  const y = top - LAYER_GAP - h;
  let x = GROUP_PAD;
  for (const story of row.stories) { stories.push({ story, x, y: y + GROUP_HEAD + GROUP_PAD }); x += STORY_W + CARD_GAP; }
  const rowWidth = x;
  const pillY = y + h - GROUP_PAD - PILL_H;
  x = GROUP_PAD;
  const ideas: PlacedPill[] = [];
  for (const c of row.ideas) { const w = pillWidth(c.title); ideas.push({ key: c.path, label: c.title, x, y: pillY, w }); x += w + PILL_GAP; }
  const unfiled: PlacedPill[] = [];
  for (const f of row.unfiled) { const label = f.slice(f.lastIndexOf("/") + 1); const w = pillWidth(label); unfiled.push({ key: f, label, x, y: pillY, w }); x += w + PILL_GAP; }
  const w = Math.max(rowWidth, x, 2 * STORY_W + CARD_GAP + 2 * GROUP_PAD);
  return { rect: { x: 0, y, w: w + GROUP_PAD - (rowWidth > x ? CARD_GAP : PILL_GAP), h }, stories, ideas, unfiled };
}

/** The union of two rectangles. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
