import { describe, it, expect } from "vitest";
import { type WriterNote, buildBoard } from "../../../src/domain/writer/Board";
import { EMPTY_WRITER_FILE, placeCard, putEdge, setColour, setFramework } from "../../../src/domain/writer/WriterFile";

const note = (path: string, tags: string[], links: string[] = [], excerpt = ""): WriterNote => ({ path, title: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), tags, links, excerpt });

const notes: WriterNote[] = [
  note("sources/poems/Invictus.md", ["#writer/poem", "#writer/quote"], [], "Out of the night that covers me"),
  note("notes/Courage.md", ["writer/theme"], ["sources/poems/Invictus.md", "storytelling/The Bear Hunt/Outline.md"]),
  note("notes/The lone hunter.md", ["#writer/archetype", "#writer/wildcard"]),
  note("notes/Motto.md", ["#writer"]),
  note("storytelling/The Bear Hunt/Outline.md", [], ["notes/Courage.md"]),
  note("journal/Today.md", ["#daily"]),
];

describe("buildBoard", () => {
  it("puts every tagged note in each of its groups, sorted by title, and keeps the rest off the board", () => {
    const board = buildBoard(notes, EMPTY_WRITER_FILE);
    expect(board.framework.id).toBe("truby");
    expect(board.cards.map((c) => c.title)).toEqual(["Courage", "Invictus", "Motto", "The lone hunter"]);
    const group = (id: string) => board.layers.flatMap((l) => l.groups).find((g) => g.def.id === id)!;
    expect(group("poem").cards.map((c) => c.path)).toEqual(["sources/poems/Invictus.md"]);
    expect(group("quote").cards.map((c) => c.path)).toEqual(["sources/poems/Invictus.md"]);
    expect(group("theme").cards.map((c) => c.path)).toEqual(["notes/Courage.md"]);
    expect(group("genre").cards).toEqual([]);
    expect(group("genre").def.hint.length).toBeGreaterThan(0);
  });
  it("sends unknown suffixes and bare prefix tags to Unsorted without losing the known group", () => {
    const board = buildBoard(notes, EMPTY_WRITER_FILE);
    expect(board.unsorted.cards.map((c) => c.path)).toEqual(["notes/Motto.md", "notes/The lone hunter.md"]);
    expect(board.cards.find((c) => c.path === "notes/The lone hunter.md")!.groups).toEqual(["archetype", "unsorted"]);
  });
  it("carries positions, colours and excerpts", () => {
    const file = setColour(placeCard(EMPTY_WRITER_FILE, "notes/Courage.md", { x: 5, y: 6 }), "theme", "#abcdef");
    const board = buildBoard(notes, file);
    expect(board.cards.find((c) => c.path === "notes/Courage.md")!.position).toEqual({ x: 5, y: 6 });
    expect(board.cards.find((c) => c.path === "sources/poems/Invictus.md")!.excerpt).toBe("Out of the night that covers me");
    expect(board.layers[0]!.groups.find((g) => g.def.id === "theme")!.colour).toBe("#abcdef");
  });
  it("derives one undirected edge per linking pair of cards, ignoring links to notes off the board", () => {
    const board = buildBoard(notes, EMPTY_WRITER_FILE);
    expect(board.derived).toEqual([{ from: "notes/Courage.md", to: "sources/poems/Invictus.md" }]);
  });
  it("keeps named edges between cards and marks the ones whose link is gone", () => {
    const file = putEdge(putEdge(putEdge(EMPTY_WRITER_FILE, { from: "sources/poems/Invictus.md", to: "notes/Courage.md", label: "inspired", colour: "" }), { from: "notes/Courage.md", to: "notes/Motto.md", label: "stale", colour: "" }), { from: "notes/Courage.md", to: "journal/Today.md", label: "off board", colour: "" });
    const board = buildBoard(notes, file);
    expect(board.named.map((e) => [e.label, e.linked])).toEqual([["inspired", true], ["stale", false]]);
  });
  it("re-sorts cards when the framework changes, moving orphaned groups to Unsorted", () => {
    const board = buildBoard(notes, setFramework(EMPTY_WRITER_FILE, "generic"));
    expect(board.framework.id).toBe("generic");
    expect(board.unsorted.cards.map((c) => c.title)).toEqual(["Invictus", "Motto", "The lone hunter"]);
    expect(board.layers.flatMap((l) => l.groups).find((g) => g.def.id === "theme")!.cards.map((c) => c.title)).toEqual(["Courage"]);
  });
  it("honours the file's prefix", () => {
    const board = buildBoard([note("a.md", ["#me/theme"]), note("b.md", ["#writer/theme"])], { ...EMPTY_WRITER_FILE, prefix: "me" });
    expect(board.cards.map((c) => c.path)).toEqual(["a.md"]);
    expect(board.prefix).toBe("me");
  });
});
