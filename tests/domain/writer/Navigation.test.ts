import { describe, it, expect } from "vitest";
import { type WriterNote, buildBoard } from "../../../src/domain/writer/Board";
import { EMPTY_WRITER_FILE } from "../../../src/domain/writer/WriterFile";
import { layoutBoard } from "../../../src/domain/writer/Layout";
import { endOfRow, lane, laneOf, readingOrder, step, stepCard } from "../../../src/domain/writer/Navigation";

const note = (path: string, tags: string[]): WriterNote => ({ path, title: path.replace(/\.md$/, ""), tags, links: [], excerpt: "" });
const notes: WriterNote[] = [
  note("Courage.md", ["#writer/theme"]),
  note("Invictus.md", ["#writer/poem"]),
  note("Wild.md", ["#writer/wildcard"]),
];
const layout = layoutBoard(buildBoard(notes, EMPTY_WRITER_FILE));
const none = new Set<string>();
const at = (id: string) => ({ kind: "group" as const, id });

describe("Navigation", () => {
  it("walks a row left and right and stops at its ends", () => {
    expect(step(layout, none, at("genre"), "right")).toEqual(at("plot"));
    expect(step(layout, none, at("plot"), "left")).toEqual(at("genre"));
    expect(step(layout, none, at("genre"), "left")).toBeNull();
    expect(endOfRow(layout, none, at("theme"), "last")).toEqual(at("dialogue"));
    expect(endOfRow(layout, none, at("theme"), "first")).toEqual(at("genre"));
  });
  it("crosses lanes to the group nearest in x, reaching the band above the first layer and the first group below it", () => {
    expect(step(layout, none, at("theme"), "down")).toEqual(at("premise"));
    expect(step(layout, none, at("premise"), "down")).toEqual(at("poem"));
    expect(step(layout, none, at("poem"), "up")).toEqual(at("premise"));
    expect(step(layout, none, at("premise"), "up")).toEqual(at("genre"));
    expect(step(layout, none, at("genre"), "up")).toEqual({ kind: "band" });
    expect(step(layout, none, { kind: "band" }, "down")).toEqual(at("genre"));
    expect(step(layout, none, { kind: "band" }, "up")).toBeNull();
    expect(step(layout, none, at("unsorted"), "down")).toBeNull();
  });
  it("skips hidden layers", () => {
    const hidden = new Set(["Premises"]);
    // Themes is the third group of the wish list; Music is the third of the inspirations, straight beneath it.
    expect(step(layout, hidden, at("theme"), "down")).toEqual(at("music"));
    expect(lane(layout, hidden, 2)).toEqual(at("poem"));
  });
  it("numbers lanes with the band as zero", () => {
    expect(lane(layout, none, 0)).toEqual({ kind: "band" });
    expect(lane(layout, none, 1)).toEqual(at("genre"));
    expect(lane(layout, none, 2)).toEqual(at("premise"));
    expect(lane(layout, none, 6)).toEqual(at("unsorted"));
    expect(lane(layout, none, 7)).toBeNull();
    expect(laneOf(layout, none, at("poem"))).toBe(3);
    expect(laneOf(layout, none, { kind: "band" })).toBe(0);
    expect(laneOf(layout, none, at("nowhere"))).toBe(-1);
  });
  it("steps through a group's cards in reading order and by column across rows", () => {
    const five = layoutBoard(buildBoard([1, 2, 3, 4, 5].map((n) => note(`T${n}.md`, ["#writer/theme"])), EMPTY_WRITER_FILE));
    const pg = five.groups.find((g) => g.group.def.id === "theme")!;
    // Five cards: three columns, two rows.
    expect(readingOrder(pg).map((c) => c.card.path)).toEqual(["T1.md", "T2.md", "T3.md", "T4.md", "T5.md"]);
    expect(stepCard(pg, null, "right")!.card.path).toBe("T1.md");
    expect(stepCard(pg, "T1.md", "right")!.card.path).toBe("T2.md");
    expect(stepCard(pg, "T1.md", "left")).toBeNull();
    expect(stepCard(pg, "T1.md", "down")!.card.path).toBe("T4.md");
    expect(stepCard(pg, "T3.md", "down")!.card.path).toBe("T5.md");
    expect(stepCard(pg, "T5.md", "up")!.card.path).toBe("T2.md");
    expect(stepCard(pg, "T5.md", "down")).toBeNull();
    const empty = five.groups.find((g) => g.group.def.id === "genre")!;
    expect(stepCard(empty, null, "right")).toBeNull();
  });
});
