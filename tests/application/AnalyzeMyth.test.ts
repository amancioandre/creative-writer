import { describe, it, expect } from "vitest";
import { AnalyzeMyth } from "../../src/application/use-cases/AnalyzeMyth";
import type { MythAnalyser } from "../../src/application/ports/MythAnalyser";

const text = Array.from({ length: 6 }, () => "She went down into the cellar where her father had died and came back changed.").join(" ");
const fake = (): MythAnalyser & { calls: number } => ({
  name: "fake",
  calls: 0,
  async analyse() { this.calls++; return { patterns: [{ name: "Descent", evidence: "went down into the cellar", note: "n" }], archetypes: [], summary: "s", next: "x" }; },
});

describe("AnalyzeMyth", () => {
  it("returns a validated report and caches by text", async () => {
    const a = fake();
    const uc = new AnalyzeMyth(a);
    const r1 = await uc.execute(text, new AbortController().signal);
    const r2 = await uc.execute(text, new AbortController().signal);
    expect(r1.patterns[0]!.name).toBe("Descent");
    expect(r2).toBe(r1);
    expect(a.calls).toBe(1);
  });
  it("refuses very short input without calling the model", async () => {
    const a = fake();
    await expect(new AnalyzeMyth(a).execute("Too short.", new AbortController().signal)).rejects.toThrow(/at least/);
    expect(a.calls).toBe(0);
  });
});
