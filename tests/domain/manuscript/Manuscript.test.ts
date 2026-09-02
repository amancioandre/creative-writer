import { describe, it, expect } from "vitest";
import { buildManuscript, displayTitle, isManuscriptNote, prefixPattern, DEFAULT_STRIP_PREFIX, type ManuscriptOptions, type NoteItem } from "../../../src/domain/manuscript/Manuscript";

const opts: ManuscriptOptions = { folderDepth: 2, noteTitles: true, stripPrefix: DEFAULT_STRIP_PREFIX, demoteHeadings: true, proseOnly: false };
const scope = { scope: "Novel/" };
const note = (path: string, text: string, frontmatter: Record<string, unknown> = {}) => ({ path, text, frontmatter });

describe("isManuscriptNote", () => {
  it("keeps plain notes and drops typed notes, data notes and opted-out notes", () => {
    expect(isManuscriptNote(note("Novel/One.md", ""))).toBe(true);
    expect(isManuscriptNote(note("Novel/Characters/Ilse.md", ""))).toBe(false);
    expect(isManuscriptNote(note("Novel/Ilse.md", "", { type: "character" }))).toBe(false);
    expect(isManuscriptNote(note("Novel/Story map.md", ""))).toBe(false);
    expect(isManuscriptNote(note("Novel/Story threads.md", ""))).toBe(false);
    expect(isManuscriptNote(note("Novel/Research.md", "", { manuscript: false }))).toBe(false);
    expect(isManuscriptNote(note("Novel/Research.md", "", { manuscript: "no" }))).toBe(false);
  });
  it("lets manuscript: true override the type", () => {
    expect(isManuscriptNote(note("Novel/Characters/Ilse.md", "", { manuscript: true }))).toBe(true);
  });
});

describe("displayTitle", () => {
  it("strips sort prefixes with the default pattern", () => {
    const p = prefixPattern(DEFAULT_STRIP_PREFIX);
    expect(displayTitle("01 Act One", p)).toBe("Act One");
    expect(displayTitle("03 - Chapter Three", p)).toBe("Chapter Three");
    expect(displayTitle("2. Creek", p)).toBe("Creek");
    expect(displayTitle("1) Camp", p)).toBe("Camp");
    expect(displayTitle("Camp", p)).toBe("Camp");
  });
  it("keeps a name the pattern would erase, and survives a broken pattern", () => {
    expect(displayTitle("1984", prefixPattern(DEFAULT_STRIP_PREFIX))).toBe("1984");
    expect(prefixPattern("(")).toBeNull();
    expect(prefixPattern("  ")).toBeNull();
    expect(displayTitle("01 x", null)).toBe("01 x");
  });
});

describe("buildManuscript", () => {
  const notes = [
    note("Novel/Novel.md", "# Outline\n- beats\n", { "writing-target": 1 }),
    note("Novel/01 Part One/02 Chapter Two.md", "# Chapter Two\nTwo.\n\n## Creek\nAlone."),
    note("Novel/01 Part One/01 Chapter One.md", "One.\n\n# Camp\nMarta woke."),
    note("Novel/02 Part Two/03 Chapter Three.md", "Three."),
    note("Novel/Characters/Ilse.md", "Younger."),
    note("Novel/Epilogue.md", "Last."),
    note("Novel/Prologue.md", "First.", { "story-order": 0 }),
  ];

  it("stitches notes in manuscript order with folders as headings", () => {
    const m = buildManuscript(scope, notes, opts);
    expect(m.notes).toBe(5);
    expect(m.items.map((i) => (i.kind === "folder" ? `F${i.level}:${i.title}` : `N${i.level}:${i.title}`))).toEqual([
      "N1:Prologue", "F1:Part One", "N2:Chapter One", "N2:Chapter Two", "F1:Part Two", "N2:Chapter Three", "N1:Epilogue",
    ]);
    expect((m.items[1] as { folder: string }).folder).toBe("Novel/01 Part One/");
  });

  it("skips the outline note with no prose and the typed note", () => {
    const paths = buildManuscript(scope, notes, opts).items.filter((i): i is NoteItem => i.kind === "note").map((i) => i.path);
    expect(paths).not.toContain("Novel/Novel.md");
    expect(paths).not.toContain("Novel/Characters/Ilse.md");
  });

  it("hides a note title its first heading repeats, and demotes headings under the outline", () => {
    const items = buildManuscript(scope, notes, opts).items.filter((i): i is NoteItem => i.kind === "note");
    const two = items.find((i) => i.title === "Chapter Two")!;
    expect(two.showTitle).toBe(false);
    expect(two.blocks.filter((b) => b.heading).map((b) => [b.headingText, b.level])).toEqual([["Chapter Two", 2], ["Creek", 3]]);
    const one = items.find((i) => i.title === "Chapter One")!;
    expect(one.showTitle).toBe(true);
    expect(one.blocks.filter((b) => b.heading).map((b) => [b.headingText, b.level])).toEqual([["Camp", 3]]);
  });

  it("shows a prefixed heading that repeats the name as the stripped name", () => {
    const m = buildManuscript(scope, [note("Novel/03 Chapter Three.md", "# 03 Chapter Three\nText.")], opts);
    const item = m.items[0] as NoteItem;
    expect(item.showTitle).toBe(false);
    expect(item.blocks[0]).toMatchObject({ headingText: "Chapter Three", level: 1 });
  });

  it("respects folder depth, hidden note titles and no demotion", () => {
    const flat = buildManuscript(scope, notes, { ...opts, folderDepth: 0, noteTitles: false, demoteHeadings: false });
    expect(flat.items.every((i) => i.kind === "note" && i.level === 1 && !i.showTitle)).toBe(true);
    const one = flat.items.find((i) => i.kind === "note" && i.title === "Chapter One") as NoteItem;
    expect(one.blocks.filter((b) => b.heading).map((b) => b.level)).toEqual([1]);
  });

  it("drops non-prose blocks when asked, but never the note", () => {
    const n = [note("Novel/One.md", "Text.\n\n- a list\n\n| t |\n|---|\n\n***\n\n> quoted\n\n```\ncode\n```")];
    const all = (buildManuscript(scope, n, opts).items[0] as NoteItem).blocks.map((b) => b.kind);
    expect(all).toEqual(["paragraph", "list", "table", "rule", "quote", "code"]);
    const prose = (buildManuscript(scope, n, { ...opts, proseOnly: true }).items[0] as NoteItem).blocks.map((b) => b.kind);
    expect(prose).toEqual(["paragraph", "rule", "quote"]);
  });

  it("carries each note's comments and highlights, attached to their paragraphs", () => {
    const text = "%% ORPHAN: before anything %%\n\nOne %% TODO: more %% and ==this==.\n\n%%\nFIX: about One\n%%\n\n- list %% IDEA: in a list %%\n\nTwo.";
    const m = buildManuscript(scope, [note("Novel/One.md", text)], opts);
    const item = m.items[0] as NoteItem;
    expect(item.annotations.map((a) => a.tag)).toEqual(["ORPHAN", "TODO", null, "FIX", "IDEA"]);
    expect(item.blocks.map((b) => [b.kind, b.annotations.map((a) => a.tag ?? "==")])).toEqual([["paragraph", ["ORPHAN", "TODO", "==", "FIX"]], ["list", ["IDEA"]], ["paragraph", []]]);
    const prose = (buildManuscript(scope, [note("Novel/One.md", text)], { ...opts, proseOnly: true }).items[0] as NoteItem).blocks;
    expect(prose.map((b) => b.annotations.map((a) => a.tag))).toEqual([["ORPHAN", "TODO", null, "FIX", "IDEA"], []]);
  });

  it("counts words without front matter and handles a single-note or root scope", () => {
    const m = buildManuscript({ scope: "Novel/One.md" }, [note("Novel/One.md", "---\nx: y\n---\nOne two three.")], opts);
    expect(m.words).toBe(3);
    expect(m.items).toHaveLength(1);
    const root = buildManuscript({ scope: "" }, [note("Part/One.md", "Hi.")], opts);
    expect(root.items.map((i) => i.kind)).toEqual(["folder", "note"]);
  });
});
