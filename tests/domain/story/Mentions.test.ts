import { describe, it, expect } from "vitest";
import { EntityIndex } from "../../../src/domain/story/EntityIndex";
import { findMentions, unresolvedCounts } from "../../../src/domain/story/Mentions";

const index = new EntityIndex([
  { path: "Characters/Marta Kovács.md", frontmatter: {} },
  { path: "Places/Lisbon.md", frontmatter: {} },
  { path: "Places/The Grey Tower.md", frontmatter: {} },
]);

describe("findMentions", () => {
  it("resolves known names mid-sentence and at sentence start", () => {
    const m = findMentions("Marta went to Lisbon. Lisbon was hot.", index);
    expect(m.map((x) => [x.surface, x.entityId])).toEqual([
      ["Marta", "Characters/Marta Kovács.md"],
      ["Lisbon", "Places/Lisbon.md"],
      ["Lisbon", "Places/Lisbon.md"],
    ]);
  });
  it("takes the longest resolving span", () => {
    const m = findMentions("She saw Marta Kovács by the Grey Tower.", index);
    expect(m.map((x) => x.surface)).toEqual(["Marta Kovács", "Grey Tower"]);
    expect(m[1]!.entityId).toBe("Places/The Grey Tower.md");
  });
  it("keeps unknown capitalised runs mid-sentence but not at sentence start", () => {
    const m = findMentions("Then Orsolya Nagy laughed. Orsolya left. He went to Porto.", index);
    expect(m.map((x) => [x.surface, x.entityId])).toEqual([
      ["Orsolya Nagy", null],
      ["Porto", null],
    ]);
  });
  it("ignores I, honorifics, months and weekdays", () => {
    const m = findMentions("On Monday I met Dr Ilse in June.", index);
    expect(m.map((x) => x.surface)).toEqual(["Ilse"]);
  });
  it("joins particles between capitals", () => {
    const m = findMentions("He served the Duke of Braganza well.", index);
    expect(m.map((x) => x.surface)).toEqual(["Duke of Braganza"]);
  });
  it("reports offsets into the source and drops a trailing possessive", () => {
    const text = "Hello Marta. He took Orsolya's hat.";
    const [m, o] = findMentions(text, index);
    expect(text.slice(m!.from, m!.to)).toBe("Marta");
    expect(o!.surface).toBe("Orsolya");
    expect(text.slice(o!.from, o!.to)).toBe("Orsolya");
  });
  it("counts a familiar name at sentence start", () => {
    const m = findMentions("Orsolya left. Then Orsolya came back.", index, new Set(["orsolya"]));
    expect(m).toHaveLength(2);
  });
});

describe("unresolvedCounts", () => {
  it("groups unknown names by normalised surface, most frequent first", () => {
    const m = findMentions("He saw Porto, then Orsolya, then Orsolya's hat, then Porto and porto.", index);
    const counts = [...unresolvedCounts(m).values()];
    expect(counts).toEqual([
      { surface: "Porto", count: 2 },
      { surface: "Orsolya", count: 2 },
    ]);
  });
});
