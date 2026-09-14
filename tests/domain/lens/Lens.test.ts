import { describe, it, expect } from "vitest";
import { LENSES, LENS_LABELS, isLens, nextLens, toggleLens } from "../../../src/domain/lens/Lens";

describe("lenses", () => {
  it("names every lens, none first", () => {
    expect(LENSES[0]).toBe("none");
    for (const l of LENSES) expect(LENS_LABELS[l]).toBeTruthy();
  });
  it("recognises a lens and rejects anything else", () => {
    expect(isLens("words")).toBe(true);
    expect(isLens("sepia")).toBe(false);
    expect(isLens(undefined)).toBe(false);
  });
  it("walks the lenses in a circle", () => {
    let l = LENSES[0]!;
    const seen = [l];
    for (let i = 1; i < LENSES.length; i++) { l = nextLens(l); seen.push(l); }
    expect(seen).toEqual(LENSES);
    expect(nextLens(l)).toBe("none");
  });
  it("a lens command switches its lens on, and off again when it is the one on", () => {
    expect(toggleLens("none", "words")).toBe("words");
    expect(toggleLens("style", "words")).toBe("words");
    expect(toggleLens("words", "words")).toBe("none");
  });
});
