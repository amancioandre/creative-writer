import { describe, it, expect } from "vitest";
import { type WriterNote, buildBoard } from "../../../src/domain/writer/Board";
import { CARD_GAP, CARD_H, CARD_W, GROUP_GAP, GROUP_HEAD, GROUP_PAD, MIN_GROUP_H, MIN_GROUP_W, cardCentre, columnsIn, defaultGroupSize, groupAt, homeGroup, layoutBoard, reorderedGroup } from "../../../src/domain/writer/Layout";
import { EMPTY_WRITER_FILE, placeCard, placeGroup } from "../../../src/domain/writer/WriterFile";

const note = (path: string, tags: string[]): WriterNote => ({ path, title: path.replace(/\.md$/, ""), tags, links: [], excerpt: "" });
const notes = [note("A.md", ["#writer/theme"]), note("B.md", ["#writer/theme", "#writer/quote"]), note("C.md", ["#writer/theme"]), note("D.md", ["#writer/odd"])];
const rectOf = (layout: ReturnType<typeof layoutBoard>, id: string) => layout.groups.find((g) => g.group.def.id === id)!.rect;

describe("layoutBoard", () => {
  it("stacks layers, flows groups left to right and fills cards into their home group's grid", () => {
    const layout = layoutBoard(buildBoard(notes, EMPTY_WRITER_FILE));
    expect(layout.layers.map((l) => l.name)).toEqual(["Wish list", "Premises", "Inspirations", "References", "Voices", "Unsorted"]);
    const wish = layout.layers[0]!;
    expect(wish.y).toBe(0);
    const [genre, plot, theme] = wish.groups;
    expect(genre!.rect.x).toBe(0);
    expect(plot!.rect.x).toBe(genre!.rect.w + GROUP_GAP);
    expect(theme!.cards.map((c) => c.card.path)).toEqual(["A.md", "B.md", "C.md"]);
    expect(theme!.cards[0]).toMatchObject({ x: theme!.rect.x + GROUP_PAD, y: theme!.rect.y + GROUP_HEAD + GROUP_PAD, pinned: false });
    expect(theme!.cards[1]!.x).toBe(theme!.cards[0]!.x + CARD_W + CARD_GAP);
    expect(theme!.cards[2]!.y).toBe(theme!.cards[0]!.y + CARD_H + CARD_GAP);
    expect(layout.layers[1]!.y).toBeGreaterThanOrEqual(wish.y + MIN_GROUP_H);
    expect(layout.cards.size).toBe(4);
    expect(layout.cards.get("B.md")!.group).toBe("theme");
    expect(layout.layers.at(-1)!.groups[0]!.cards.map((c) => c.card.path)).toEqual(["D.md"]);
  });
  it("draws a card once, in its first group, and shows Unsorted only when needed", () => {
    expect(homeGroup(buildBoard(notes, EMPTY_WRITER_FILE).cards.find((c) => c.path === "B.md")!)).toBe("theme");
    const layout = layoutBoard(buildBoard(notes.slice(0, 3), EMPTY_WRITER_FILE));
    expect(layout.layers.map((l) => l.name)).not.toContain("Unsorted");
    expect(layout.groups.find((g) => g.group.def.id === "quote")!.cards).toEqual([]);
  });
  it("never overlaps groups: a saved rectangle gives size and order, and the flow places it", () => {
    const file = placeGroup(EMPTY_WRITER_FILE, "theme", { x: -1, y: 999, w: 700, h: 400 });
    const layout = layoutBoard(buildBoard(notes, file));
    const wish = layout.layers[0]!;
    expect(rectOf(layout, "theme")).toEqual({ x: 0, y: 0, w: 700, h: 400 });
    expect(rectOf(layout, "genre").x).toBe(700 + GROUP_GAP);
    expect(layout.groups.find((g) => g.group.def.id === "theme")!.pinned).toBe(true);
    const sorted = [...wish.groups].sort((a, b) => a.rect.x - b.rect.x);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.rect.x).toBeGreaterThanOrEqual(sorted[i - 1]!.rect.x + sorted[i - 1]!.rect.w);
    expect(layout.layers[1]!.y).toBe(400 + 90);
    expect(rectOf(layout, "premise").y).toBe(400 + 90);
    expect(wish.groups.map((g) => g.group.def.id)).toEqual(["genre", "plot", "theme", "archetype", "world", "dialogue"]);
  });
  it("keeps a saved size no smaller than a card slot", () => {
    const layout = layoutBoard(buildBoard(notes, placeGroup(EMPTY_WRITER_FILE, "genre", { x: 0, y: 0, w: 10, h: 10 })));
    expect(rectOf(layout, "genre")).toMatchObject({ w: MIN_GROUP_W, h: MIN_GROUP_H });
  });
  it("places pinned cards relative to their group, so they move with it", () => {
    const file = placeCard(EMPTY_WRITER_FILE, "A.md", { x: 30, y: 40 });
    const a = layoutBoard(buildBoard(notes, file));
    const theme = rectOf(a, "theme");
    expect(a.cards.get("A.md")).toMatchObject({ x: theme.x + 30, y: theme.y + 40, pinned: true });
    // A sits over the first slot, so B takes the second.
    expect(a.cards.get("B.md")).toMatchObject({ x: theme.x + GROUP_PAD + CARD_W + CARD_GAP, y: theme.y + GROUP_HEAD + GROUP_PAD, pinned: false });
    const moved = layoutBoard(buildBoard(notes, placeGroup(file, "genre", { x: 5000, y: 0, w: 500, h: 300 })));
    // Genres moved to the end of the row, so Themes shifted left; A shifted with it.
    const theme2 = rectOf(moved, "theme");
    expect(theme2.x).toBeLessThan(theme.x);
    expect(moved.cards.get("A.md")).toMatchObject({ x: theme2.x + 30, y: theme2.y + 40 });
  });
  it("skips a grid slot a pinned card already sits in", () => {
    const file = placeCard(EMPTY_WRITER_FILE, "C.md", { x: GROUP_PAD + 3, y: GROUP_HEAD + GROUP_PAD - 2 });
    const layout = layoutBoard(buildBoard(notes, file));
    const theme = rectOf(layout, "theme");
    expect(layout.cards.get("A.md")).toMatchObject({ x: theme.x + GROUP_PAD + CARD_W + CARD_GAP, y: theme.y + GROUP_HEAD + GROUP_PAD });
  });
  it("reorders a dropped group among its row and writes every rectangle of the row", () => {
    const layout = layoutBoard(buildBoard(notes, EMPTY_WRITER_FILE));
    const plot = rectOf(layout, "plot");
    const rects = reorderedGroup(layout, "theme", plot.x - 10);
    expect(rects.map((r) => r.id)).toEqual(["genre", "theme", "plot", "archetype", "world", "dialogue"]);
    expect(rects[0]!.rect.x).toBe(0);
    expect(rects[1]!.rect.x).toBe(rects[0]!.rect.w + GROUP_GAP);
    const file = rects.reduce((f, r) => placeGroup(f, r.id, r.rect), EMPTY_WRITER_FILE);
    expect(layoutBoard(buildBoard(notes, file)).layers[0]!.groups.map((g) => g.group.def.id).sort((a, b) => rectOf(layoutBoard(buildBoard(notes, file)), a).x - rectOf(layoutBoard(buildBoard(notes, file)), b).x)).toEqual(["genre", "theme", "plot", "archetype", "world", "dialogue"]);
    expect(reorderedGroup(layout, "theme", 1e9).map((r) => r.id).at(-1)).toBe("theme");
    expect(reorderedGroup(layout, "nope", 0)).toEqual([]);
  });
  it("sizes groups for their cards and finds the group under a point", () => {
    expect(defaultGroupSize(0)).toMatchObject({ cols: 2 });
    expect(defaultGroupSize(9)).toMatchObject({ cols: 3 });
    expect(defaultGroupSize(30).cols).toBe(4);
    expect(columnsIn({ x: 0, y: 0, w: 2 * GROUP_PAD + 3 * CARD_W + 2 * CARD_GAP, h: 100 })).toBe(3);
    expect(columnsIn({ x: 0, y: 0, w: 10, h: 10 })).toBe(1);
    const layout = layoutBoard(buildBoard(notes, EMPTY_WRITER_FILE));
    const theme = layout.groups.find((g) => g.group.def.id === "theme")!;
    expect(groupAt(layout, cardCentre(theme.cards[0]!))!.group.def.id).toBe("theme");
    expect(groupAt(layout, { x: -500, y: -500 })).toBeNull();
  });
});
