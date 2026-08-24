import { describe, it, expect } from "vitest";
import { contradictionKey, factThreads, validateFacts } from "../../../src/domain/threads/Facts";
import type { FactReading } from "../../../src/domain/story/StoryMapFile";

const text = "Ilse turned her green eyes on Marta. Marta was twenty-seven and came from Bremen. Ilse was tall.";

describe("validateFacts", () => {
  it("keeps facts about known names with quotes that are really in the scene, canonicalising the subject", () => {
    const facts = validateFacts({ facts: [
      { subject: "Ilse", attribute: "eye colour", value: "green", evidence: "her green eyes" },
      { subject: "Marta", attribute: "age", value: "27", evidence: "Marta was twenty-seven" },
      { subject: "Ghost", attribute: "age", value: "9", evidence: "Marta was twenty-seven" },
      { subject: "Marta", attribute: "hometown", value: "Bremen", evidence: "she came from Bremen in the north" },
      { subject: "Ilse", attribute: "Eye color", value: "Green eyes", evidence: "her green eyes" },
      { subject: "Ilse", attribute: "", value: "x", evidence: "her green eyes" },
      { subject: "Ilse", attribute: "height", value: "", evidence: "Ilse was tall" },
    ] }, text, ["Ilse", "Marta Kovács"]);
    expect(facts).toEqual([
      { subject: "Ilse", attribute: "eye colour", value: "green", evidence: "her green eyes" },
      { subject: "Marta Kovács", attribute: "age", value: "27", evidence: "Marta was twenty-seven" },
    ]);
  });

  it("keeps different attributes apart — 'eyes' and 'eye colour' are not merged, so 'hair: long' never fights 'hair colour: brown'", () => {
    const facts = validateFacts({ facts: [
      { subject: "Ilse", attribute: "eyes", value: "green", evidence: "her green eyes" },
      { subject: "Ilse", attribute: "eye colour", value: "green", evidence: "her green eyes" },
    ] }, text, ["Ilse"]);
    expect(facts).toHaveLength(2);
  });

  it("caps the list and tolerates junk", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ subject: "Ilse", attribute: `attr ${i}`, value: "v", evidence: "green eyes" }));
    expect(validateFacts({ facts: many }, text, ["Ilse"])).toHaveLength(15);
    expect(validateFacts(null, text, ["Ilse"])).toEqual([]);
    expect(validateFacts({ facts: [3, null, "x"] }, text, ["Ilse"])).toEqual([]);
  });
});

const scene = (title: string, path = "Novel/One.md") => ({ path, title, line: 0 });
const reading = (title: string, facts: FactReading["facts"], path?: string): FactReading => ({ scene: scene(title, path), hash: "h", model: "m", rulebook: "r", facts });
const eyes = (value: string, evidence = `her ${value} eyes`) => ({ subject: "Ilse", attribute: "eye colour", value, evidence });
const index = new Map([["Novel/One.md#Camp", 0], ["Novel/One.md#Creek", 1], ["Novel/Two.md#Return", 2]]);
const run = (readings: FactReading[], dismissed: string[] = [], stale: string[] = []) => factThreads({ readings, sceneIndex: index, stale: new Set(stale), dismissed: new Set(dismissed) });

describe("factThreads", () => {
  it("flags a different value in two scenes, with both quotes, and threads the fact through them", () => {
    const { threads, contradictions } = run([reading("Camp", [eyes("green")]), reading("Return", [{ ...eyes("grey"), attribute: "Eye Colors" }], "Novel/Two.md")]);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ id: "fact:ilse|eye colour", kind: "fact", source: "model", label: "Ilse · eye colour", stale: false });
    expect(threads[0]!.refs.map((r) => [r.index, r.value])).toEqual([[0, "green"], [2, "grey"]]);
    expect(contradictions).toHaveLength(1);
    const c = contradictions[0]!;
    expect(c.a.evidence).toBe("her green eyes");
    expect(c.b.evidence).toBe("her grey eyes");
    expect(c.dismissed).toBe(false);
    expect(c.threadId).toBe(threads[0]!.id);
  });

  it("does not flag the same value, a restatement, or two facts in one scene", () => {
    expect(run([reading("Camp", [eyes("green")]), reading("Creek", [eyes("green eyes")])]).contradictions).toEqual([]);
    expect(run([reading("Camp", [eyes("green"), eyes("grey")])]).contradictions).toEqual([]);
    expect(run([reading("Camp", [eyes("green"), eyes("grey")])]).threads).toEqual([]);
  });

  it("ignores readings of scenes that no longer exist and marks stale ones", () => {
    const { threads, contradictions } = run([reading("Camp", [eyes("green")]), reading("Gone", [eyes("grey")]), reading("Creek", [eyes("blue")])], [], ["Novel/One.md#Creek"]);
    expect(threads[0]!.refs).toHaveLength(2);
    expect(threads[0]!.stale).toBe(true);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]!.stale).toBe(true);
  });

  it("carries the writer's dismissal, keyed stably whichever way the scenes are read", () => {
    const key = contradictionKey("Ilse", "eye colour", { scene: scene("Camp"), value: "green" }, { scene: scene("Creek"), value: "grey eyes" });
    expect(key).toBe(contradictionKey("Ilse", "Eye Color", { scene: scene("Creek"), value: "grey" }, { scene: scene("Camp"), value: "Green eyes" }));
    expect(key).toBe("ilse|eye colour|Novel/One.md#Camp|Novel/One.md#Creek|green|grey");
    const forward = run([reading("Camp", [eyes("green")]), reading("Creek", [eyes("grey")])], [key]);
    const backward = run([reading("Creek", [eyes("grey")]), reading("Camp", [eyes("green")])], [key]);
    expect(forward.contradictions[0]!.dismissed).toBe(true);
    expect(backward.contradictions[0]!.key).toBe(key);
    expect(backward.threads[0]!.refs.map((r) => r.index)).toEqual([0, 1]);
  });

  it("threads list-like attributes without ever calling them contradictions", () => {
    const owns = (value: string) => ({ subject: "Ilse", attribute: "owns", value, evidence: "her green eyes" });
    const { threads, contradictions } = run([reading("Camp", [owns("a letter")]), reading("Creek", [owns("a knife")])]);
    expect(threads.map((t) => t.label)).toEqual(["Ilse · owns"]);
    expect(contradictions).toEqual([]);
  });

  it("reports each disagreeing pair once across three scenes", () => {
    const { contradictions } = run([reading("Camp", [eyes("green")]), reading("Creek", [eyes("grey")]), reading("Return", [eyes("green")], "Novel/Two.md")]);
    expect(contradictions.map((c) => [c.a.index, c.b.index])).toEqual([[0, 1], [1, 2]]);
  });
});
