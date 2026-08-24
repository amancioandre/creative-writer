import { describe, it, expect } from "vitest";
import { linkTarget, parseRelations, removeRelation, upsertRelation } from "../../../src/domain/story/Relations";

const note = `---
type: character
---
Marta is the elder.

## Relationships
- [[Ilse]] — sister
- [[Characters/Zsófi|Zsó]]: rival
- [[The Guild]]
- [Lisbon](Places/Lisbon.md) - home
- Bear — childhood friend

## Notes
- [[Not a relation]] — this is under another heading
`;

describe("parseRelations", () => {
  it("reads every list line under the Relationships heading, with wikilinks, markdown links or bare names", () => {
    expect(parseRelations(note)).toEqual([
      { target: "Ilse", label: "sister", line: 6 },
      { target: "Characters/Zsófi", label: "rival", line: 7 },
      { target: "The Guild", label: "", line: 8 },
      { target: "Places/Lisbon", label: "home", line: 9 },
      { target: "Bear", label: "childhood friend", line: 10 },
    ]);
  });
  it("accepts 'Relations' and any heading level, and finds nothing otherwise", () => {
    expect(parseRelations("### relations\n* [[A]] – ally\n")).toEqual([{ target: "A", label: "ally", line: 1 }]);
    expect(parseRelations("# Intro\n- [[A]] — ally\n")).toEqual([]);
    expect(parseRelations("")).toEqual([]);
  });
});

describe("upsertRelation", () => {
  it("creates the section at the end of a note that has none", () => {
    expect(upsertRelation("Some prose.\n", "[[Ilse]]", "sister")).toBe("Some prose.\n\n## Relationships\n- [[Ilse]] — sister\n");
    expect(upsertRelation("", "[[Ilse]]", "sister")).toBe("## Relationships\n- [[Ilse]] — sister\n");
  });
  it("appends after the last item of an existing section, before the next heading", () => {
    const out = upsertRelation(note, "[[Ilse's mother]]", "aunt");
    const lines = out.split("\n");
    expect(lines[11]).toBe("- [[Ilse's mother]] — aunt");
    expect(lines[12]).toBe("");
    expect(lines[13]).toBe("## Notes");
  });
  it("relabels the existing line for the same target, matching by path basename", () => {
    const out = upsertRelation(note, "[[Characters/Ilse]]", "half-sister");
    expect(parseRelations(out).find((r) => r.target.endsWith("Ilse"))).toEqual({ target: "Characters/Ilse", label: "half-sister", line: 6 });
    expect(parseRelations(out)).toHaveLength(5);
  });
  it("uses previousLabel to pick which of several lines to the same target changes", () => {
    const two = "## Relationships\n- [[Ilse]] — sister\n- [[Ilse]] — rival\n";
    expect(upsertRelation(two, "[[Ilse]]", "ally", "rival")).toBe("## Relationships\n- [[Ilse]] — sister\n- [[Ilse]] — ally\n");
  });
  it("writes a bare link when the label is empty", () => {
    expect(upsertRelation("", "[[Ilse]]", "")).toBe("## Relationships\n- [[Ilse]]\n");
  });
});

describe("removeRelation", () => {
  it("drops the matching line and leaves the rest", () => {
    const out = removeRelation(note, "[[Ilse]]", "sister");
    expect(parseRelations(out).map((r) => r.target)).toEqual(["Characters/Zsófi", "The Guild", "Places/Lisbon", "Bear"]);
    expect(out).toContain("## Notes");
  });
  it("removes the section once it is empty", () => {
    expect(removeRelation("Prose.\n\n## Relationships\n- [[Ilse]] — sister\n", "Ilse", "sister")).toBe("Prose.\n");
  });
  it("is a no-op when nothing matches", () => {
    expect(removeRelation(note, "[[Ilse]]", "enemy")).toBe(note);
  });
});

describe("linkTarget", () => {
  it("strips link syntax of both kinds", () => {
    expect(linkTarget("[[Ilse|Ils]]")).toBe("Ilse");
    expect(linkTarget("[Ilse](Characters/Ilse.md)")).toBe("Characters/Ilse");
    expect(linkTarget("[Zs](Characters/Zs%C3%B3fi.md)")).toBe("Characters/Zsófi");
    expect(linkTarget("Ilse")).toBe("Ilse");
  });
});
