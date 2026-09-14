import { describe, it, expect } from "vitest";
import { proposalHeading, validateProposals } from "../../../src/domain/plot/Proposals";

const brief = {
  scenes: [{ title: "Arrival", events: ["Anna lands"] }, { title: "Dinner", events: [] }, { title: "The reading", events: ["The letter is read"] }],
  cast: [{ name: "Anna", kind: "character" }, { name: "The harbour", kind: "location" }],
  existing: ["Subplot: The letter", "Salt on the wind"],
};

describe("proposals", () => {
  it("writes a heading per kind, an arc's name linked", () => {
    expect(proposalHeading("arc", "Anna")).toBe("Arc: [[Anna]]");
    expect(proposalHeading("theme", "What we owe the dead")).toBe("Theme: What we owe the dead");
    expect(proposalHeading("subplot", "The letter")).toBe("Subplot: The letter");
    expect(proposalHeading("free", "Salt")).toBe("Salt");
  });

  it("keeps kinded, named proposals whose scenes were on the list, arcs only for characters, existing ones marked, arcs first", () => {
    const out = validateProposals({ columns: [
      { kind: "subplot", name: "The letter", why: "An unopened letter.", scenes: ["the reading", "Arrival", "Nowhere"] },
      { kind: "arc", name: "anna", why: "She learns to read it.", scenes: ["Arrival", "The reading"] },
      { kind: "arc", name: "The harbour", why: "no", scenes: ["Arrival"] },
      { kind: "theme", name: "Salt on the wind", why: "Pressure.", scenes: ["Dinner"] },
      { kind: "theme", name: "", why: "", scenes: ["Dinner"] },
      { kind: "myth", name: "X", why: "", scenes: ["Dinner"] },
      { kind: "subplot", name: "Nothing", why: "", scenes: ["Elsewhere"] },
      { kind: "subplot", name: "The letter", why: "twice", scenes: ["Dinner"] },
    ] }, brief);
    expect(out.map((p) => [p.kind, p.name, p.heading, p.existing, p.scenes])).toEqual([
      ["arc", "Anna", "Arc: [[Anna]]", false, ["Arrival", "The reading"]],
      ["theme", "Salt on the wind", "Theme: Salt on the wind", true, ["Dinner"]],
      ["subplot", "The letter", "Subplot: The letter", true, ["Arrival", "The reading"]],
    ]);
    expect(validateProposals("junk", brief)).toEqual([]);
    expect(validateProposals({ columns: Array.from({ length: 12 }, (_, i) => ({ kind: "theme", name: `T${i}`, why: "", scenes: ["Dinner"] })) }, brief)).toHaveLength(8);
  });
});
