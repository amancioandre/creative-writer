import { describe, it, expect, afterEach } from "vitest";
import { EMPTY_WORD_LISTS, listsFor, wordListsFacet, wordsExtension, type WordLists } from "../../../src/infrastructure/codemirror/wordsExtension";
import { allFindings } from "../../../src/infrastructure/codemirror/findingsTooltip";
import { parseWordLists } from "../../../src/domain/words/WordList";
import { mount, type Harness } from "./helpers";

const DOC = "She felt the cold and then she turned.\n\nThen nothing.";
const LISTS: WordLists = {
  vault: parseWordLists("## Filtering\nfelt\n## Stage direction\ncolour: #7a4fd6\nthen, and then"),
  byScope: { "book/": parseWordLists("## Motions\nturned") },
  vaultPath: "Bad words.md",
  scopePaths: { "book/": "book/Words.md" },
};
const marks = (h: Harness) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(".czm-words"));
const ext = (path: string | null, lists: WordLists = LISTS) => [wordListsFacet.of(lists), wordsExtension(() => path)];

describe("wordsExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("tints every term in view by category when the words lens is on", () => {
    h = mount(DOC, ext("notes/ch1.md"), { lens: "words" });
    const ms = marks(h);
    expect(ms.map((m) => m.textContent)).toEqual(["felt", "and then", "Then"]);
    expect(ms[0]!.getAttribute("style")).toContain("--czm-words: #9a74ed");
    expect(ms[1]!.getAttribute("style")).toContain("--czm-words: #7a4fd6");
  });

  it("uses a project's own list inside that project", () => {
    h = mount(DOC, ext("book/ch1.md"), { lens: "words" });
    expect(marks(h).map((m) => m.textContent)).toEqual(["turned"]);
  });

  it("marks nothing under another lens, and follows a lens switch", () => {
    h = mount(DOC, ext("notes/ch1.md"), { lens: "style" });
    expect(marks(h)).toHaveLength(0);
    h.setSettings({ lens: "words" });
    expect(marks(h)).toHaveLength(3);
    h.setSettings({ lens: "none" });
    expect(marks(h)).toHaveLength(0);
  });

  it("marks nothing without a list", () => {
    h = mount(DOC, ext("notes/ch1.md", EMPTY_WORD_LISTS), { lens: "words" });
    expect(marks(h)).toHaveLength(0);
  });

  it("answers the hover with the category and the count in the note", () => {
    h = mount(DOC, ext("notes/ch1.md"), { lens: "words" });
    const fs = allFindings(h.view);
    expect(fs.map((f) => [f.kind, f.note])).toEqual([["words", "Filtering · 1 in this note"], ["words", "Stage direction · 1 in this note"], ["words", "Stage direction · 1 in this note"]]);
    h.moveCursor(DOC.length);
    h.type(" Then.");
    expect(allFindings(h.view).at(-1)!.note).toBe("Stage direction · 2 in this note");
  });
});

describe("listsFor", () => {
  it("prefers the most specific project scope and falls back to the vault list", () => {
    const lists: WordLists = { vault: [{ name: "V", colour: null, terms: ["a"] }], byScope: { "book/": [{ name: "B", colour: null, terms: ["b"] }], "book/part/": [{ name: "P", colour: null, terms: ["p"] }] } };
    expect(listsFor(lists, "book/part/ch.md")[0]!.name).toBe("P");
    expect(listsFor(lists, "book/ch.md")[0]!.name).toBe("B");
    expect(listsFor(lists, "elsewhere.md")[0]!.name).toBe("V");
    expect(listsFor(lists, null)[0]!.name).toBe("V");
  });
});

describe("wordsExtension — actions", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  it("offers to remove the word from its list, naming the note the list came from", () => {
    const removed: [string, string][] = [];
    h = mount(DOC, [wordListsFacet.of(LISTS), wordsExtension(() => "book/ch1.md", { removeTerm: (p, t) => { removed.push([p, t]); } })], { lens: "words" });
    const f = allFindings(h.view)[0]!;
    expect(f.actions?.map((a) => a.label)).toEqual(['Remove "turned" from Motions']);
    f.actions![0]!.run();
    expect(removed).toEqual([["book/Words.md", "turned"]]);
  });
  it("offers nothing without a host to write, or a note to write to", () => {
    h = mount(DOC, ext("notes/ch1.md", { ...LISTS, vaultPath: null }), { lens: "words" });
    expect(allFindings(h.view)[0]!.actions).toBeUndefined();
  });
});
