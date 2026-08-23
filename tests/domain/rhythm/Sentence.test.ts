import { describe, it, expect } from "vitest";
import { Sentence } from "../../../src/domain/rhythm/Sentence";

describe("Sentence value object", () => {
  it("exposes text and offsets", () => {
    const s = Sentence.create("Hello.", 10, 16);
    expect(s.text).toBe("Hello.");
    expect(s.from).toBe(10);
    expect(s.to).toBe(16);
  });

  it("rejects ranges where to < from", () => {
    expect(() => Sentence.create("x", 5, 4)).toThrow();
  });

  it("rejects a text whose length does not match the range", () => {
    expect(() => Sentence.create("abc", 0, 2)).toThrow();
  });

  it("reports whether it is blank", () => {
    expect(Sentence.create("  \n", 0, 3).isBlank).toBe(true);
    expect(Sentence.create("Hi", 0, 2).isBlank).toBe(false);
  });

  it("compares by value", () => {
    expect(Sentence.create("a", 0, 1).equals(Sentence.create("a", 0, 1))).toBe(true);
    expect(Sentence.create("a", 0, 1).equals(Sentence.create("a", 1, 2))).toBe(false);
  });
});

describe("Sentence.length", () => {
  it("equals to - from", () => {
    expect(Sentence.create("abcd", 3, 7).length).toBe(4);
  });
});
