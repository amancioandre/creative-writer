import { describe, it, expect } from "vitest";
import { validateReading } from "../../../src/domain/story/SceneReading";

const text = "Marta took Ilse's hand at the gate. \"We go down,\" she said, and did not look back. The dog stayed.";
const present = ["Marta Kovács", "Ilse", "The Gate"];

describe("validateReading", () => {
  it("keeps relations between present names with quoted evidence, canonicalising names", () => {
    const r = validateReading({ relations: [{ from: "marta", to: "ilse", label: "sister", evidence: "took Ilse's hand" }] }, text, present);
    expect(r.relations).toEqual([{ from: "Marta Kovács", to: "Ilse", label: "sister", evidence: "took Ilse's hand" }]);
  });
  it("drops unknown names, self-relations, unquoted evidence, missing labels and duplicates", () => {
    const r = validateReading({
      relations: [
        { from: "Marta", to: "Cousin Pál", label: "cousin", evidence: "took Ilse's hand" },
        { from: "Marta", to: "Marta", label: "self", evidence: "took Ilse's hand" },
        { from: "Marta", to: "Ilse", label: "sister", evidence: "not in the text" },
        { from: "Marta", to: "Ilse", label: "", evidence: "took Ilse's hand" },
        { from: "Ilse", to: "Marta", label: "Sister", evidence: "took Ilse's hand" },
        { from: "Marta", to: "Ilse", label: "sister", evidence: "at the gate" },
      ],
    }, text, present);
    expect(r.relations).toHaveLength(1);
  });
  it("keeps references and events; about/participants must be present names", () => {
    const r = validateReading({
      references: [{ name: "Orpheus", kind: "myth", about: "Marta", note: "no looking back", evidence: "did not look back" }, { name: "X", kind: "myth", evidence: "nope" }],
      events: [{ summary: "Descent begins", participants: ["Marta", "Ilse", "Ghost"], evidence: "We go down" }, { summary: "", evidence: "We go down" }],
    }, text, present);
    expect(r.references).toEqual([{ name: "Orpheus", kind: "myth", about: "Marta Kovács", note: "no looking back", evidence: "did not look back" }]);
    expect(r.events).toEqual([{ summary: "Descent begins", participants: ["Marta Kovács", "Ilse"], evidence: "We go down" }]);
  });
  it("tolerates garbage", () => {
    expect(validateReading(null, text, present)).toEqual({ relations: [], references: [], events: [] });
    expect(validateReading({ relations: [1, "x"], references: "no", events: [{}] }, text, present)).toEqual({ relations: [], references: [], events: [] });
  });
});
