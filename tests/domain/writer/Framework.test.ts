import { describe, it, expect } from "vitest";
import { FRAMEWORKS, GENERIC, TRUBY, UNSORTED, frameworkById, groupId, groupsOf, normalizeFramework } from "../../../src/domain/writer/Framework";

describe("Framework", () => {
  it("ships Truby and Generic with unique, tag-safe group ids and hints on every group", () => {
    for (const fw of FRAMEWORKS) {
      const ids = groupsOf(fw).map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const g of groupsOf(fw)) {
        expect(g.id).toBe(groupId(g.id));
        expect(g.id).not.toBe(UNSORTED.id);
        expect(g.hint.length).toBeGreaterThan(0);
        expect(g.colour).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
    expect(TRUBY.layers.map((l) => l.name)).toEqual(["Wish list", "Premises", "Inspirations", "References", "Voices"]);
    expect(groupsOf(TRUBY).map((g) => g.id)).toContain("archetype");
    expect(frameworkById("truby")).toBe(TRUBY);
    expect(frameworkById("generic")).toBe(GENERIC);
    expect(frameworkById("nope")).toBeNull();
  });
  it("shares tag suffixes between frameworks where the meaning overlaps, so switching keeps cards in place", () => {
    const truby = new Set(groupsOf(TRUBY).map((g) => g.id));
    for (const id of ["theme", "archetype", "world", "premise", "voice"]) expect(truby.has(id) && groupsOf(GENERIC).some((g) => g.id === id)).toBe(true);
  });
  it("folds a tag suffix to a group id", () => {
    expect(groupId(" Themes & Ideas ")).toBe("themes-ideas");
    expect(groupId("QUOTE")).toBe("quote");
    expect(groupId("---")).toBe("");
  });
  it("normalises a hand-written framework, dropping what it cannot use", () => {
    const fw = normalizeFramework({
      name: " Mine ",
      layers: [
        { name: "A", groups: [{ id: "Theme", name: "Themes", colour: "#123456", hint: " h " }, { id: "theme", name: "dup" }, { id: "", name: "x" }, { id: "unsorted" }] },
        { name: "", groups: [{ id: "plot" }] },
        { name: "Empty", groups: [] },
        "junk",
      ],
    });
    expect(fw).toEqual({
      id: "custom",
      name: "Mine",
      layers: [
        { name: "A", groups: [{ id: "theme", name: "Themes", colour: "#123456", hint: "h" }] },
        { name: "Layer 2", groups: [{ id: "plot", name: "plot", colour: UNSORTED.colour, hint: "" }] },
      ],
    });
    expect(normalizeFramework({ layers: [] })).toBeNull();
    expect(normalizeFramework("truby")).toBeNull();
    expect(normalizeFramework(null)).toBeNull();
  });
});
