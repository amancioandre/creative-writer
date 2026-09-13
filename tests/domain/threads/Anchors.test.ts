import { describe, it, expect } from "vitest";
import { anchorQuote } from "../../../src/domain/threads/Anchors";

const note = `---
story: true
---
# The station

Anna *pocketed* the letter without reading it. “Later,” she said.
The train was late.

# Platform

She pocketed the letter again, in a different chapter.
`;

describe("anchorQuote", () => {
  const lines = note.split("\n");

  it("finds a quote inside its scene and gives the line and column it starts at, in the raw text", () => {
    expect(anchorQuote(note, 3, 8, "the letter without reading it")).toEqual({ line: 5, ch: lines[5]!.indexOf("the letter") });
    expect(anchorQuote(note, 3, 8, "The train was late.")).toEqual({ line: 6, ch: 0 });
  });

  it("looks through emphasis marks and curly quotes", () => {
    expect(anchorQuote(note, 3, 8, "Anna pocketed the letter")).toEqual({ line: 5, ch: 0 });
    expect(anchorQuote(note, 3, 8, "pocketed the letter")).toEqual({ line: 5, ch: lines[5]!.indexOf("pocketed") });
    expect(anchorQuote(note, 3, 8, '"Later," she said')).toEqual({ line: 5, ch: lines[5]!.indexOf("“Later") });
  });

  it("stays inside the scene's lines and reports a missing quote as null", () => {
    expect(anchorQuote(note, 3, 8, "in a different chapter")).toBeNull();
    expect(anchorQuote(note, 8, -1, "in a different chapter")).toEqual({ line: 10, ch: lines[10]!.indexOf("in a") });
    expect(anchorQuote(note, 3, 8, "never written")).toBeNull();
    expect(anchorQuote(note, 30, -1, "anything")).toBeNull();
  });
});
