import { describe, it, expect } from "vitest";
import { BrysbaertConcreteness } from "../../../src/infrastructure/nlp/BrysbaertConcreteness";

describe("BrysbaertConcreteness", () => {
  const c = new BrysbaertConcreteness();
  it("scores known lemmas on a 1–5 scale", () => {
    expect(c.score("knife")).toBeGreaterThan(4.5);
    expect(c.score("justice")).toBeLessThan(2.5);
  });
  it("falls back to the lemma for simple inflections", () => {
    expect(c.score("knives")).not.toBeNull();
    expect(c.score("hammered")).toBeCloseTo(c.score("hammer")!, 0);
    expect(c.score("swallowing")).not.toBeNull();
    expect(c.score("bruised")).not.toBeNull();
  });
  it("returns null for unknown words", () => {
    expect(c.score("zxqv")).toBeNull();
  });
  it("is case-insensitive", () => {
    expect(c.score("Knife")).toBe(c.score("knife"));
  });
});
