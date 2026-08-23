import { describe, it, expect } from "vitest";
import { locateParagraph } from "../../../src/domain/text/Paragraph";
import { ArrayLineSource } from "../../../src/domain/text/LineSource";

const src = (...lines: string[]) => new ArrayLineSource(lines);

describe("locateParagraph", () => {
  it("returns the block of non-blank lines around the cursor line", () => {
    const lines = src("a", "b", "", "c", "d", "e", "", "f");
    const p = locateParagraph(lines, 4); // "d"
    expect(p).toEqual({ firstLine: 3, lastLine: 5 });
  });

  it("returns a single-line paragraph", () => {
    expect(locateParagraph(src("", "x", ""), 1)).toEqual({ firstLine: 1, lastLine: 1 });
  });

  it("returns null when the cursor sits on a blank line", () => {
    expect(locateParagraph(src("a", "", "b"), 1)).toBeNull();
  });

  it("treats whitespace-only lines as blank separators", () => {
    const lines = src("a", "   ", "b");
    expect(locateParagraph(lines, 2)).toEqual({ firstLine: 2, lastLine: 2 });
  });

  it("clamps to document boundaries", () => {
    const lines = src("a", "b");
    expect(locateParagraph(lines, 0)).toEqual({ firstLine: 0, lastLine: 1 });
    expect(locateParagraph(lines, 1)).toEqual({ firstLine: 0, lastLine: 1 });
  });

  it("returns null for out-of-range line numbers", () => {
    expect(locateParagraph(src("a"), 5)).toBeNull();
    expect(locateParagraph(src("a"), -1)).toBeNull();
  });
});
