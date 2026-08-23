import { describe, it, expect } from "vitest";
import { validateMythReport } from "../../../src/domain/myth/MythReport";

const text = "She went down into the cellar where her father had died, carrying the lamp he had left her, and did not come back up until morning.";
const raw = {
  patterns: [{ name: "Katabasis (descent)", evidence: "went down into the cellar", note: "A descent usually demands a return with something changed." }],
  archetypes: [
    { name: "Threshold guardian", character: "the father (absent)", evidence: "where her father had died" },
    { name: "Totally made up", character: "nobody", evidence: "not in the text at all" },
  ],
  summary: "A small descent narrative.",
  next: "What does she bring back up? The scene will feel unfinished until the return costs her something.",
};

describe("validateMythReport", () => {
  it("keeps patterns and archetypes whose evidence is quoted from the text", () => {
    const r = validateMythReport(raw, text);
    expect(r.patterns.map((p) => p.name)).toEqual(["Katabasis (descent)"]);
    expect(r.archetypes.map((a) => a.name)).toEqual(["Threshold guardian"]);
    expect(r.summary).toBe("A small descent narrative.");
    expect(r.next).toMatch(/bring back up/);
  });
  it("quotes are matched loosely (case, quotes, whitespace)", () => {
    const r = validateMythReport({ ...raw, patterns: [{ name: "x", evidence: "WENT   down into the cellar", note: "n" }] }, text);
    expect(r.patterns).toHaveLength(1);
  });
  it("tolerates junk and missing fields", () => {
    const r = validateMythReport({ patterns: "no", archetypes: [null, 1], summary: 3 }, text);
    expect(r).toEqual({ patterns: [], archetypes: [], summary: "", next: "" });
  });
  it("caps list lengths and note sizes", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `p${i}`, evidence: "the lamp", note: "x".repeat(2000) }));
    const r = validateMythReport({ patterns: many, archetypes: [] }, text);
    expect(r.patterns.length).toBeLessThanOrEqual(8);
    expect(r.patterns[0]!.note.length).toBeLessThanOrEqual(600);
  });
  it("isEmpty when nothing survived", () => {
    expect(validateMythReport({}, text).isEmpty).toBe(true);
    expect(validateMythReport(raw, text).isEmpty).toBe(false);
  });
});
