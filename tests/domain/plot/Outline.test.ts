import { describe, it, expect } from "vitest";
import { insertAct, insertChapter, insertScene, markBuilt, moveHeading, parseOutline, removeHeading, renameHeading, serializeOutlineNote, setLogline } from "../../../src/domain/plot/Outline";

const note = `---
creative-writer: false
creative-writer-outline: 1
---
The outline.

# Act I
## The perfect record
### 1 Gainesville courtroom
<!-- Kevin wins a case he knows he should lose -->
### 4 The recess bathroom

## The offer
### 12 The New York invitation
%% a pin, not a logline %%
# Act II
## The firm
### 21 Milton Chadwick and Waters
`;

describe("parseOutline", () => {
  const o = parseOutline(note);

  it("reads acts, chapters and scenes by heading level, with the logline under a scene", () => {
    expect(o.acts.map((a) => [a.title, a.chapters.map((c) => [c.title, c.scenes.map((s) => s.title)])])).toEqual([
      ["Act I", [["The perfect record", ["1 Gainesville courtroom", "4 The recess bathroom"]], ["The offer", ["12 The New York invitation"]]]],
      ["Act II", [["The firm", ["21 Milton Chadwick and Waters"]]]],
    ]);
    expect(o.acts[0]!.chapters[0]!.scenes[0]).toMatchObject({ line: 8, logline: "Kevin wins a case he knows he should lose" });
    expect(o.acts[0]!.chapters[1]!.scenes[0]!.logline).toBe("a pin, not a logline");
    expect([o.scenes, o.chapters, o.built]).toEqual([4, 3, null]);
  });

  it("gives scenes above any chapter an unnamed chapter, and chapters above any act an unnamed act", () => {
    const loose = parseOutline("### A\n### B\n## One\n### C\n");
    expect(loose.acts.map((a) => [a.title, a.line, a.chapters.map((c) => [c.title, c.line, c.scenes.length])])).toEqual([["", -1, [["", -1, 2], ["One", 2, 1]]]]);
    expect(parseOutline("")).toMatchObject({ acts: [], scenes: 0 });
  });

  it("ignores a heading that is commented out", () => {
    expect(parseOutline("## One\n<!--\n### Cut\n-->\n### Kept\n").scenes).toBe(1);
  });
});

describe("outline edits", () => {
  it("inserts a scene after a scene, at the end of a chapter, or into the last chapter", () => {
    const afterScene = insertScene(note, 8, "2 The bar");
    expect(afterScene.split("\n").slice(8, 12)).toEqual(["### 1 Gainesville courtroom", "<!-- Kevin wins a case he knows he should lose -->", "### 2 The bar", "### 4 The recess bathroom"]);
    const endOfChapter = insertScene(note, 7, "7 The verdict", "Not guilty -- the press waits");
    expect(endOfChapter.split("\n").slice(10, 14)).toEqual(["### 4 The recess bathroom", "### 7 The verdict", "<!-- Not guilty – the press waits -->", ""]);
    expect(insertScene(note, null, "34 The subway platform")).toMatch(/### 21 Milton Chadwick and Waters\n### 34 The subway platform\n$/);
    expect(insertScene("", null, "First")).toBe("## Chapter 1\n### First\n");
    expect(insertScene("### Loose\n", null)).toBe("### Loose\n\n### New scene\n");
  });

  it("inserts a chapter with a first scene, after a chapter or at the end, and an act with both", () => {
    const after = insertChapter(note, 7, "The verdict");
    expect(after.split("\n").slice(11, 16)).toEqual(["", "## The verdict", "### New scene", "", "## The offer"]);
    expect(insertChapter(note, null)).toMatch(/\n\n## New chapter\n### New scene\n$/);
    expect(insertAct("", "Act I")).toBe("# Act I\n## New chapter\n### New scene\n");
  });

  it("renames a heading keeping its level, and writes, replaces or removes a logline", () => {
    expect(renameHeading(note, 7, "The Gettys case").split("\n")[7]).toBe("## The Gettys case");
    expect(renameHeading(note, 7, "  ")).toBe(note);
    const written = setLogline(note, 10, "Kevin sees the truth on Gettys' face");
    expect(written.split("\n").slice(10, 12)).toEqual(["### 4 The recess bathroom", "<!-- Kevin sees the truth on Gettys' face -->"]);
    expect(setLogline(note, 8, "He wins").split("\n")[9]).toBe("<!-- He wins -->");
    expect(setLogline(note, 8, "").split("\n")[9]).toBe("### 4 The recess bathroom");
  });

  it("moves a section among its siblings and stops at the ends", () => {
    const down = moveHeading(note, 8, 1);
    expect(down.split("\n").slice(8, 11)).toEqual(["### 4 The recess bathroom", "### 1 Gainesville courtroom", "<!-- Kevin wins a case he knows he should lose -->"]);
    expect(moveHeading(note, 8, -1)).toBe(note);
    expect(moveHeading(note, 10, 1)).toBe(note); // last scene of its chapter: the next scene is in another chapter
    const chapterUp = moveHeading(note, 12, -1);
    expect(parseOutline(chapterUp).acts[0]!.chapters.map((c) => c.title)).toEqual(["The offer", "The perfect record"]);
    const actDown = moveHeading(note, 6, 1);
    expect(parseOutline(actDown).acts.map((a) => a.title)).toEqual(["Act II", "Act I"]);
    expect(parseOutline(actDown).scenes).toBe(4);
  });

  it("removes a scene with its logline, a chapter with its scenes, an act with its chapters", () => {
    expect(parseOutline(removeHeading(note, 8)).acts[0]!.chapters[0]!.scenes.map((s) => s.title)).toEqual(["4 The recess bathroom"]);
    expect(parseOutline(removeHeading(note, 7)).acts[0]!.chapters.map((c) => c.title)).toEqual(["The offer"]);
    expect(parseOutline(removeHeading(note, 6)).acts.map((a) => a.title)).toEqual(["Act II"]);
    expect(removeHeading(note, 4)).toBe(note);
  });

  it("marks the note built in its front matter and can take the mark off", () => {
    const built = markBuilt(note, "2026-09-22");
    expect(built.split("\n").slice(0, 5)).toEqual(["---", "creative-writer: false", "creative-writer-outline: 1", "creative-writer-outline-built: 2026-09-22", "---"]);
    expect(parseOutline(built).built).toBe("2026-09-22");
    expect(markBuilt(built, "2026-09-23").split("\n")[3]).toBe("creative-writer-outline-built: 2026-09-23");
    expect(markBuilt(built, null)).toBe(note);
    expect(markBuilt("### A\n", "2026-09-22")).toBe("---\ncreative-writer-outline-built: 2026-09-22\n---\n### A\n");
  });

  it("serialises a fresh note the first row can be added to", () => {
    const fresh = serializeOutlineNote("The Devil's Advocate");
    expect(fresh.startsWith("---\ncreative-writer: false\ncreative-writer-outline: 1\n---")).toBe(true);
    expect(parseOutline(insertScene(fresh, null, "1 Gainesville courtroom")).acts[0]!.chapters[0]).toMatchObject({ title: "Chapter 1", scenes: [{ title: "1 Gainesville courtroom" }] });
  });
});

describe("the outline flag", () => {
  it("is what makes a note the plan: without it a note called Outline is a chapter like any other", () => {
    expect(parseOutline("---\ncreative-writer-outline: 1\n---\n### A\n").flagged).toBe(true);
    expect(parseOutline("### A\n").flagged).toBe(false);
    expect(parseOutline(serializeOutlineNote("X")).flagged).toBe(true);
  });
});
