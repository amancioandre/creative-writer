import { describe, it, expect } from "vitest";
import { GENERIC, TRUBY } from "../../../src/domain/writer/Framework";
import { EMPTY_WRITER_FILE, colourOf, normalizeWriterFile, parseWriterFile, placeCard, placeGroup, putEdge, removeEdge, renameCard, resolveFramework, serializeWriterFile, setColour, setFramework, setView } from "../../../src/domain/writer/WriterFile";

describe("WriterFile", () => {
  it("round-trips through JSON", () => {
    let file = placeCard(EMPTY_WRITER_FILE, "notes/A.md", { x: 1.4, y: 2.6 });
    file = placeGroup(file, "theme", { x: 0, y: 0, w: 100, h: 50 });
    file = putEdge(file, { from: "notes/A.md", to: "notes/B.md", label: "inspired by", colour: "#c9a44c" });
    file = setColour(file, "theme", "#123456");
    file = setView(file, { x: 10, y: 20, k: 0.5 });
    const text = serializeWriterFile(file);
    expect(text.endsWith("\n")).toBe(true);
    expect(parseWriterFile(text)).toEqual({ ...file, cards: { "notes/A.md": { x: 1, y: 3 } } });
  });
  it("is empty for bad JSON and drops what it cannot use", () => {
    expect(parseWriterFile("{oops")).toEqual(EMPTY_WRITER_FILE);
    const file = normalizeWriterFile({
      version: 9,
      framework: "nope",
      prefix: "#Me/",
      colours: { theme: "#12345", plot: "#123456", "": "#abcdef" },
      groups: { theme: { x: 1, y: 2, w: 0, h: 5 }, plot: { x: 1, y: 2, w: 3, h: 4 } },
      cards: { "a.md": { x: "1", y: 2 }, "b.md": { x: 1, y: 2 }, "": { x: 1, y: 2 } },
      edges: [{ from: "a.md", to: "a.md", label: "self" }, { from: "a.md", to: "b.md", label: " L ", colour: "bad" }, { from: "b.md", to: "a.md", label: "l" }, { from: "a.md" }],
      view: { x: 0, y: 0, k: 0 },
    });
    expect(file).toEqual({ version: 1, framework: "truby", prefix: "me", colours: { plot: "#123456" }, groups: { plot: { x: 1, y: 2, w: 3, h: 4 } }, cards: { "b.md": { x: 1, y: 2 } }, edges: [{ from: "a.md", to: "b.md", label: "L", colour: "" }], view: null });
  });
  it("resolves shipped and inline frameworks, falling back to Truby", () => {
    expect(resolveFramework(EMPTY_WRITER_FILE)).toBe(TRUBY);
    expect(resolveFramework(setFramework(EMPTY_WRITER_FILE, "generic"))).toBe(GENERIC);
    expect(resolveFramework(setFramework(EMPTY_WRITER_FILE, "nope"))).toBe(TRUBY);
    const inline = setFramework(EMPTY_WRITER_FILE, { id: "x", name: "Mine", layers: [{ name: "L", groups: [{ id: "theme", name: "T", colour: "#000000", hint: "" }] }] });
    expect(resolveFramework(inline).name).toBe("Mine");
    expect(resolveFramework(inline).id).toBe("custom");
  });
  it("applies colour overrides and clears them", () => {
    const theme = TRUBY.layers[0]!.groups.find((g) => g.id === "theme")!;
    expect(colourOf(EMPTY_WRITER_FILE, theme)).toBe(theme.colour);
    const over = setColour(EMPTY_WRITER_FILE, "theme", "#abcdef");
    expect(colourOf(over, theme)).toBe("#abcdef");
    expect(colourOf(setColour(over, "theme", null), theme)).toBe(theme.colour);
    expect(setColour(EMPTY_WRITER_FILE, "theme", "red").colours).toEqual({});
  });
  it("keeps one edge per pair and label, either direction, and renames in place", () => {
    const a = putEdge(EMPTY_WRITER_FILE, { from: "a", to: "b", label: "same theme", colour: "" });
    const b = putEdge(a, { from: "b", to: "a", label: "Same Theme", colour: "#123456" });
    expect(b.edges).toEqual([{ from: "b", to: "a", label: "Same Theme", colour: "#123456" }]);
    const c = putEdge(b, { from: "a", to: "b", label: "contradicts", colour: "" });
    expect(c.edges).toHaveLength(2);
    const d = putEdge(c, { from: "a", to: "b", label: "echoes", colour: "" }, "contradicts");
    expect(d.edges.map((e) => e.label)).toEqual(["Same Theme", "echoes"]);
    expect(removeEdge(d, "b", "a", "ECHOES").edges).toHaveLength(1);
    expect(removeEdge(d, "a", "b", "nope")).toBe(d);
  });
  it("follows a note rename through positions and edges", () => {
    const file = putEdge(placeCard(EMPTY_WRITER_FILE, "a.md", { x: 1, y: 1 }), { from: "a.md", to: "b.md", label: "l", colour: "" });
    const moved = renameCard(file, "a.md", "c.md");
    expect(moved.cards).toEqual({ "c.md": { x: 1, y: 1 } });
    expect(moved.edges).toEqual([{ from: "c.md", to: "b.md", label: "l", colour: "" }]);
    expect(renameCard(file, "zzz.md", "y.md")).toBe(file);
  });
  it("clears a position, a group and a view", () => {
    expect(placeCard(placeCard(EMPTY_WRITER_FILE, "a", { x: 1, y: 1 }), "a", null).cards).toEqual({});
    expect(placeGroup(placeGroup(EMPTY_WRITER_FILE, "g", { x: 0, y: 0, w: 1, h: 1 }), "g", null).groups).toEqual({});
    expect(setView(EMPTY_WRITER_FILE, { x: 0, y: 0, k: 0 }).view).toBeNull();
  });
});
