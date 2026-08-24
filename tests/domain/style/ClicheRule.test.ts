import { describe, it, expect } from "vitest";
import { ClicheRule } from "../../../src/domain/style/rules/ClicheRule";
import { CLICHES } from "../../../src/domain/style/lexicon/cliches";

const rule = new ClicheRule();

describe("ClicheRule", () => {
  it("finds a cliché and reports its exact span", () => {
    const text = "At the end of the day, she left.";
    const [f] = rule.analyse(text);
    expect(f).toMatchObject({ kind: "cliche", from: 0, to: 21 });
    expect(text.slice(f!.from, f!.to)).toBe("At the end of the day");
  });

  it("is case-insensitive and tolerant of punctuation inside the phrase", () => {
    expect(rule.analyse("It was, in the nick of time, done.")).toHaveLength(1);
    expect(rule.analyse("IN THE NICK OF TIME")).toHaveLength(1);
  });

  it("prefers the longest match at a position", () => {
    const fs = rule.analyse("Only time will tell.");
    expect(fs).toHaveLength(1);
    expect(fs[0]!.to - fs[0]!.from).toBe("Only time will tell".length);
  });

  it("does not match across sentence boundaries", () => {
    expect(rule.analyse("It was the last. Straw that broke.")).toHaveLength(0);
  });

  it("does not flag partial words", () => {
    expect(rule.analyse("The scapegoat was nickel-plated.")).toHaveLength(0);
  });

  it("finds several clichés in one paragraph, non-overlapping", () => {
    const fs = rule.analyse("He was a diamond in the rough, but at the end of the day it is what it is.");
    expect(fs.map((f) => f.kind)).toEqual(["cliche", "cliche", "cliche"]);
    for (let i = 1; i < fs.length; i++) expect(fs[i]!.from).toBeGreaterThanOrEqual(fs[i - 1]!.to);
  });

  it("includes a note", () => {
    expect(rule.analyse("Avoid it like the plague.")[0]!.note.length).toBeGreaterThan(0);
  });
});

describe("cliché lexicon hygiene", () => {
  it("has no duplicates", () => {
    const seen = new Set<string>();
    for (const c of CLICHES) {
      expect(seen.has(c)).toBe(false);
      seen.add(c);
    }
  });
  it("entries are lowercase, multi-word, and contain no punctuation except apostrophes/hyphens", () => {
    for (const c of CLICHES) {
      expect(c).toBe(c.toLowerCase().trim());
      expect(c.split(" ").length >= 2 || c.includes("-")).toBe(true);
      expect(/^[a-z0-9' -]+$/.test(c)).toBe(true);
    }
  });
  it("is substantial", () => {
    expect(CLICHES.length).toBeGreaterThan(250);
  });
});
