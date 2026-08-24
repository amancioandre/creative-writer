import { describe, it, expect } from "vitest";
import { EntityIndex, aliasesOf, entityKindOf, normalise } from "../../../src/domain/story/EntityIndex";

describe("entityKindOf", () => {
  it("reads type from front matter, case-insensitively, with synonyms", () => {
    expect(entityKindOf({ path: "x.md", frontmatter: { type: "Character" } })).toBe("character");
    expect(entityKindOf({ path: "x.md", frontmatter: { type: "place" } })).toBe("location");
    expect(entityKindOf({ path: "x.md", frontmatter: { kind: "artifact" } })).toBe("item");
  });
  it("falls back to the nearest enclosing folder name", () => {
    expect(entityKindOf({ path: "Novel/Characters/Marta.md", frontmatter: {} })).toBe("character");
    expect(entityKindOf({ path: "Novel/World/Places/Lisbon.md", frontmatter: null })).toBe("location");
    expect(entityKindOf({ path: "Novel/Chapters/One.md", frontmatter: {} })).toBe("note");
  });
  it("front matter beats folder", () => {
    expect(entityKindOf({ path: "Novel/Characters/The Grey Tower.md", frontmatter: { type: "location" } })).toBe("location");
  });
});

describe("aliasesOf", () => {
  it("accepts a string, a list, and a name override", () => {
    expect(aliasesOf({ aliases: "M" })).toEqual(["M"]);
    expect(aliasesOf({ aliases: ["M", " Kovács "], name: "Marta K." })).toEqual(["Marta K.", "M", "Kovács"]);
    expect(aliasesOf(undefined)).toEqual([]);
  });
});

describe("EntityIndex", () => {
  const index = new EntityIndex([
    { path: "Characters/Marta Kovács.md", frontmatter: { aliases: ["Marti"] } },
    { path: "Characters/János Kovács.md", frontmatter: {} },
    { path: "Characters/Ilse.md", frontmatter: {} },
    { path: "Places/Lisbon.md", frontmatter: {} },
    { path: "Chapters/One.md", frontmatter: {} },
  ]);

  it("lists only typed notes", () => {
    expect(index.entities.map((e) => e.name)).toEqual(["Marta Kovács", "János Kovács", "Ilse", "Lisbon"]);
  });
  it("resolves full names, aliases and unique name parts, ignoring accents and possessives", () => {
    expect(index.resolve("Marta Kovács")?.name).toBe("Marta Kovács");
    expect(index.resolve("marta kovacs")?.name).toBe("Marta Kovács");
    expect(index.resolve("Marti")?.name).toBe("Marta Kovács");
    expect(index.resolve("Marta")?.name).toBe("Marta Kovács");
    expect(index.resolve("Marta's")?.name).toBe("Marta Kovács");
    expect(index.resolve("Ilse")?.kind).toBe("character");
  });
  it("refuses an ambiguous surname", () => {
    expect(index.resolve("Kovács")).toBeNull();
    expect(index.knows("Nobody")).toBe(false);
  });
  it("normalises whitespace and case", () => {
    expect(normalise("  Marta   KOVÁCS ")).toBe("marta kovacs");
  });
});
