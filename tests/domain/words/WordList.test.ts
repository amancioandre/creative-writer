import { describe, it, expect } from "vitest";
import { WORD_PALETTE, WordMatcher, addTerm, categoryColour, parseWordLists, removeTerm } from "../../../src/domain/words/WordList";

const NOTE = `---
creative-writer-words: true
---
# Bad words

## Filtering
felt, saw, heard, noticed
realised

## Redundant motions
colour: #63B3ED
- turned
- shifted, moved

## Stage direction
then; and then; before

%% a comment %%
## Empty

`;

describe("parseWordLists", () => {
  it("reads one category per heading, the terms under it, comma-, semicolon- or line-separated, bullets or not", () => {
    const cats = parseWordLists(NOTE);
    expect(cats.map((c) => c.name)).toEqual(["Filtering", "Redundant motions", "Stage direction"]);
    expect(cats[0]!.terms).toEqual(["felt", "saw", "heard", "noticed", "realised"]);
    expect(cats[1]!.terms).toEqual(["turned", "shifted", "moved"]);
    expect(cats[2]!.terms).toEqual(["then", "and then", "before"]);
  });
  it("pins a colour from a colour: line and otherwise takes one from the palette by position", () => {
    const cats = parseWordLists(NOTE);
    expect(cats[1]!.colour).toBe("#63b3ed");
    expect(cats[0]!.colour).toBeNull();
    expect(categoryColour(cats[0]!, 0)).toBe(WORD_PALETTE[0]);
    expect(categoryColour(cats[1]!, 1)).toBe("#63b3ed");
    expect(categoryColour(cats[2]!, WORD_PALETTE.length + 2)).toBe(WORD_PALETTE[2]);
  });
  it("drops empty categories, duplicates, decoration and front matter", () => {
    const cats = parseWordLists("## A\n*felt*, `saw`, felt, —\n## B\n\n## C\nSAW, Then");
    expect(cats.map((c) => c.name)).toEqual(["A", "C"]);
    expect(cats[0]!.terms).toEqual(["felt", "saw"]);
    expect(cats[1]!.terms).toEqual(["then"]);
  });
  it("puts terms before any heading in a category of their own", () => {
    const cats = parseWordLists("just, really\n## Motions\nturned");
    expect(cats.map((c) => c.name)).toEqual(["Words", "Motions"]);
  });
  it("normalises curly apostrophes so ye’ll matches ye'll", () => {
    expect(parseWordLists("## A\nye’ll")[0]!.terms).toEqual(["ye'll"]);
  });
});

describe("WordMatcher", () => {
  const matcher = new WordMatcher(parseWordLists(NOTE));
  it("finds every term, whole words only, case-insensitively, longest phrase first", () => {
    const text = "Then she turned. And then the Thenceforth felt nothing before it moved.";
    const found = matcher.findAll(text).map((m) => [text.slice(m.from, m.to), m.term, m.category]);
    expect(found).toEqual([["Then", "then", 2], ["turned", "turned", 1], ["And then", "and then", 2], ["felt", "felt", 0], ["before", "before", 2], ["moved", "moved", 1]]);
  });
  it("never crosses a sentence boundary for a phrase", () => {
    expect(matcher.findAll("And. Then.").map((m) => m.term)).toEqual(["then"]);
  });
  it("is empty when there are no terms", () => {
    const m = new WordMatcher([]);
    expect(m.empty).toBe(true);
    expect(m.findAll("felt")).toEqual([]);
  });
});

describe("editing a list", () => {
  it("adds a term to the category's last line, after a heading with nothing under it, or as a new heading", () => {
    expect(addTerm("## A\nfelt, saw\n\n## B\n- turned\n", "a", "heard")).toBe("## A\nfelt, saw, heard\n\n## B\n- turned\n");
    expect(addTerm("## A\n\n## B\nturned", "A", "heard")).toBe("## A\nheard\n\n## B\nturned");
    expect(addTerm("## A\nfelt", "Glue", "just")).toBe("## A\nfelt\n\n## Glue\njust\n");
    expect(addTerm("", "Glue", "just")).toBe("## Glue\njust\n");
    expect(parseWordLists(addTerm("## A\nfelt", "Glue", "just")).map((c) => c.terms)).toEqual([["felt"], ["just"]]);
  });
  it("removes a term wherever it stands, dropping a line it empties, and leaves headings and colours alone", () => {
    expect(removeTerm("## A\nfelt, *saw*, heard\ncolour: #123456\n- saw\n\n## B\nSAW", "saw")).toBe("## A\nfelt, heard\ncolour: #123456\n\n## B");
    expect(removeTerm("## A\nfelt", "nope")).toBe("## A\nfelt");
  });
});
