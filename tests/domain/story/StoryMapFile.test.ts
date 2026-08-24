import { describe, it, expect } from "vitest";
import { EMPTY_STORY_MAP_FILE, normalizeStoryMapFile, parseStoryMapNote, putReading, renameReadings, serializeStoryMapNote, type SceneReading } from "../../../src/domain/story/StoryMapFile";

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
    expect(md.startsWith("---\ncreative-writer: false\ncreative-writer-storymap: 1\n---")).toBe(true);
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
  it("follows a note rename", () => {
    const a = putReading(EMPTY_STORY_MAP_FILE, reading);
    expect(renameReadings(a, "Chapters/One.md", "Chapters/1.md").readings[0]!.scene.path).toBe("Chapters/1.md");
    expect(renameReadings(a, "nope.md", "x.md")).toBe(a);
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
