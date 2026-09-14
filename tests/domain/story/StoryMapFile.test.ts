import { describe, it, expect } from "vitest";
import { EMPTY_STORY_MAP_FILE, dismissContradiction, normalizeStoryMapFile, parseStoryMapNote, putFactReading, putReading, renameReadings, serializeStoryMapNote, setLayout, undismissContradiction, type FactReading, type SceneReading, putIntent, putSemanticEchoes } from "../../../src/domain/story/StoryMapFile";

const reading: SceneReading = {
  scene: { path: "Chapters/One.md", title: "Camp", line: 3 },
  hash: "abc",
  model: "ollama:x",
  relations: [{ from: "Marta", to: "Ilse", label: "sister", evidence: "her sister" }],
  references: [{ name: "Orpheus", kind: "myth", about: "Marta", note: "looks back", evidence: "she looked back" }],
  events: [{ summary: "They leave", participants: ["Marta"], evidence: "they left" }],
};

describe("StoryMapFile", () => {
  it("round-trips through the markdown note", () => {
    const file = putReading(EMPTY_STORY_MAP_FILE, reading);
    const md = serializeStoryMapNote(file, "Novel");
    expect(md.startsWith("---\ncreative-writer: false\ncreative-writer-storymap: 4\n---")).toBe(true);
    expect(md).toContain("Story map data for **Novel**");
    expect(parseStoryMapNote(md)).toEqual(file);
  });
  it("is empty for a note without a block or with bad JSON", () => {
    expect(parseStoryMapNote("just words")).toEqual(EMPTY_STORY_MAP_FILE);
    expect(parseStoryMapNote("```json\n{oops\n```")).toEqual(EMPTY_STORY_MAP_FILE);
  });
  it("replaces a reading of the same scene", () => {
    const a = putReading(EMPTY_STORY_MAP_FILE, reading);
    const b = putReading(a, { ...reading, hash: "def" });
    expect(b.readings).toHaveLength(1);
    expect(b.readings[0]!.hash).toBe("def");
    const c = putReading(b, { ...reading, scene: { ...reading.scene, title: "Creek" } });
    expect(c.readings).toHaveLength(2);
  });
  it("follows a note rename, for readings and for layout", () => {
    const a = setLayout(putReading(EMPTY_STORY_MAP_FILE, reading), { "Chapters/One.md": { x: 1, y: 2 }, "Characters/Ilse.md": { x: 3, y: 4 } });
    const b = renameReadings(a, "Chapters/One.md", "Chapters/1.md");
    expect(b.readings[0]!.scene.path).toBe("Chapters/1.md");
    expect(b.layout).toEqual({ "Chapters/1.md": { x: 1, y: 2 }, "Characters/Ilse.md": { x: 3, y: 4 } });
    expect(renameReadings(a, "nope.md", "x.md")).toBe(a);
    expect(renameReadings(a, "Characters/Ilse.md", "Characters/Ilsa.md").layout["Characters/Ilsa.md"]).toEqual({ x: 3, y: 4 });
    const withFacts = putFactReading(EMPTY_STORY_MAP_FILE, factReading);
    expect(renameReadings(withFacts, "Chapters/One.md", "Chapters/1.md").facts[0]!.scene.path).toBe("Chapters/1.md");
  });

  const factReading: FactReading = {
    scene: { path: "Chapters/One.md", title: "Camp", line: 3 }, hash: "abc", model: "ollama:x", rulebook: "v1",
    facts: [{ subject: "Ilse", attribute: "eye colour", value: "green", evidence: "her green eyes" }],
  };

  it("keeps fact readings in their own list so a relation re-read cannot clobber them, and round-trips them", () => {
    const a = putFactReading(putReading(EMPTY_STORY_MAP_FILE, reading), factReading);
    const b = putReading(a, { ...reading, hash: "def" });
    expect(b.facts).toEqual([factReading]);
    const c = putFactReading(b, { ...factReading, hash: "ghi" });
    expect(c.facts).toHaveLength(1);
    expect(c.facts[0]!.hash).toBe("ghi");
    expect(c.readings[0]!.hash).toBe("def");
    expect(parseStoryMapNote(serializeStoryMapNote(c, "Novel"))).toEqual(c);
  });

  it("loads a version 1 note as version 4 with nothing dismissed, no facts, no intents, no echoes and no grid readings", () => {
    const v1 = { version: 1, readings: [reading], layout: {} };
    const f = normalizeStoryMapFile(v1);
    expect(f.version).toBe(4);
    expect(f.grid).toEqual([]);
    expect(f.readings).toEqual([reading]);
    expect(f.facts).toEqual([]);
    expect(f.dismissed).toEqual([]);
    expect(f.intents).toEqual([]);
    expect(f.echoes).toEqual([]);
  });

  it("keeps intent verdicts by key and semantic echo pairs, round-trips them, replaces on re-read, drops junk, and follows a rename", () => {
    const intent = { key: "k1", verdict: "reversal" as const, reason: "dyed", confidence: 0.8, model: "m", rulebook: "r" };
    const echo = { a: { path: "One.md", title: "Camp", line: 0 }, b: { path: "Two.md", title: "Return", line: 0 }, hashA: "h1", hashB: "h2", quoteA: "The lamp guttered.", quoteB: "The lamp failed.", score: 0.91, model: "e" };
    let f = putSemanticEchoes(putIntent(EMPTY_STORY_MAP_FILE, intent), [echo]);
    expect(parseStoryMapNote(serializeStoryMapNote(f, "Novel"))).toEqual(f);
    f = putIntent(f, { ...intent, verdict: "same" });
    expect(f.intents).toEqual([{ ...intent, verdict: "same" }]);
    f = putSemanticEchoes(f, []);
    expect(f.echoes).toEqual([]);
    const junk = normalizeStoryMapFile({ intents: [{ key: "a", verdict: "maybe" }, { key: "b", verdict: "error", confidence: 7 }, { key: "b", verdict: "same" }, { verdict: "same" }], echoes: [{ a: { path: "x.md" }, b: { path: "y.md" }, quoteA: "q", quoteB: "" }, { a: { path: "x.md" }, b: { path: "y.md" }, quoteA: "q", quoteB: "r", score: "high" }] });
    expect(junk.intents).toEqual([{ key: "b", verdict: "error", reason: "", confidence: 1, model: "", rulebook: "" }]);
    expect(junk.echoes).toEqual([{ a: { path: "x.md", title: "", line: 0 }, b: { path: "y.md", title: "", line: 0 }, hashA: "", hashB: "", quoteA: "q", quoteB: "r", score: 0, model: "" }]);
    const moved = renameReadings(putSemanticEchoes(EMPTY_STORY_MAP_FILE, [echo]), "Two.md", "Three.md");
    expect(moved.echoes[0]!.b.path).toBe("Three.md");
    expect(moved.echoes[0]!.a.path).toBe("One.md");
  });

  it("dismisses and restores a contradiction idempotently, dropping junk keys on load", () => {
    const a = dismissContradiction(EMPTY_STORY_MAP_FILE, "k1");
    expect(dismissContradiction(a, "k1")).toBe(a);
    expect(a.dismissed).toEqual(["k1"]);
    const b = undismissContradiction(a, "k1");
    expect(b.dismissed).toEqual([]);
    expect(undismissContradiction(b, "k1")).toBe(b);
    expect(normalizeStoryMapFile({ dismissed: ["a", "a", 3, ""], facts: [{ scene: { path: "x.md" }, hash: "h", facts: [{ subject: "A", attribute: "b", value: "c" }, { subject: "A", attribute: "b", value: "c", evidence: "e" }] }, { hash: "h" }] })).toMatchObject({
      dismissed: ["a"],
      facts: [{ scene: { path: "x.md", title: "", line: 0 }, hash: "h", model: "", rulebook: "", facts: [{ subject: "A", attribute: "b", value: "c", evidence: "e" }] }],
    });
  });
  it("keeps hand-placed layout beside the readings, rounded, and drops junk", () => {
    const a = setLayout(putReading(EMPTY_STORY_MAP_FILE, reading), { "Characters/Ilse.md": { x: 10.6, y: -3.2 } });
    expect(a.layout).toEqual({ "Characters/Ilse.md": { x: 11, y: -3 } });
    expect(parseStoryMapNote(serializeStoryMapNote(a, "Novel"))).toEqual(a);
    expect(putReading(a, { ...reading, hash: "z" }).layout).toEqual(a.layout);
    expect(normalizeStoryMapFile({ layout: { ok: { x: 1, y: 2 }, bad: { x: "1" }, worse: 3, nan: { x: NaN, y: 1 } } }).layout).toEqual({ ok: { x: 1, y: 2 } });
  });
  it("normalises junk defensively", () => {
    const f = normalizeStoryMapFile({ readings: [{ scene: { path: "a.md" }, hash: "h", relations: [{ from: "A" }, { from: "A", to: "B" }], references: [{ name: "X", kind: "weird" }], events: [{ summary: "s", participants: ["p", 3] }] }, 42, { scene: {} }] });
    expect(f.readings).toHaveLength(1);
    const r = f.readings[0]!;
    expect(r.scene).toEqual({ path: "a.md", title: "", line: 0 });
    expect(r.relations).toEqual([{ from: "A", to: "B", label: "", evidence: "" }]);
    expect(r.references[0]!.kind).toBe("other");
    expect(r.events[0]!.participants).toEqual(["p"]);
    expect(normalizeStoryMapFile(null)).toEqual(EMPTY_STORY_MAP_FILE);
  });
});
