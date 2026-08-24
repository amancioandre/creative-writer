import { describe, it, expect } from "vitest";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, dismissContradiction, putFactReading } from "../../../src/domain/story/StoryMapFile";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";
import { contradictionKey } from "../../../src/domain/threads/Facts";

const one = `# Camp\nMarta woke before Ilse at the gate of Lisbon. Zsófi was there, as Zsófi always was, and Zsófi sang.\n\n# Creek\nIlse found the creek alone and washed her green eyes in it, which is not a thing eyes do.\n`;
const two = `# Return\nMarta came back to Lisbon with Ilse, whose grey eyes had not changed, and Zsófi met them.\n`;
const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), ...extra });
const notes = [
  note("Novel/Characters/Marta Kovács.md", ""),
  note("Novel/Characters/Ilse.md", ""),
  note("Novel/Places/Lisbon.md", ""),
  note("Novel/One.md", one, { bookmarkedHeadings: ["Creek"] }),
  note("Novel/Two.md", two),
];
const graph = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE);
const camp = { path: "Novel/One.md", title: "Camp", line: 0 }, creek = { path: "Novel/One.md", title: "Creek", line: 3 }, ret = { path: "Novel/Two.md", title: "Return", line: 0 };
const file = putFactReading(putFactReading(EMPTY_STORY_MAP_FILE,
  { scene: creek, hash: "h1", model: "m", rulebook: "r", facts: [{ subject: "Ilse", attribute: "eye colour", value: "green", evidence: "her green eyes" }] }),
  { scene: ret, hash: "h2", model: "m", rulebook: "r", facts: [{ subject: "Ilse", attribute: "eye color", value: "grey eyes", evidence: "grey eyes" }, { subject: "Marta Kovács", attribute: "hometown", value: "Lisbon", evidence: "back to Lisbon" }] });
const writer = parseStoryThreads("## The gate\n- [[One#Camp]] — planted\n- [[Two#Return]] — paid off\n- [[Nine#Nowhere]] — broken\n\n## Lone\n- [[Two]]\n");

describe("buildThreads", () => {
  const model = buildThreads(graph, file, writer, new Set(["Novel/Two.md#Return"]));

  it("lays scenes on a cumulative axis in manuscript order", () => {
    expect(model.scenes.map((s) => [s.ref.title, s.index, s.note, s.bookmarked])).toEqual([["Camp", 0, "Novel/One.md", false], ["Creek", 1, "Novel/One.md", true], ["Return", 2, "Novel/Two.md", false]]);
    expect(model.scenes[1]!.start).toBe(model.scenes[0]!.words);
    expect(model.scenes[2]!.start).toBe(model.scenes[0]!.words + model.scenes[1]!.words);
    expect(model.project).toBe("Novel");
  });

  it("threads recurring entities through their appearances, skipping one-offs", () => {
    const entity = model.threads.filter((t) => t.kind === "entity");
    expect(entity.map((t) => [t.label, t.refs.map((r) => r.index)])).toEqual([
      ["Ilse", [0, 1, 2]], ["Marta Kovács", [0, 2]], ["Lisbon", [0, 2]], ["Zsófi", [0, 2]],
    ]);
    expect(entity[0]).toMatchObject({ id: "entity:Novel/Characters/Ilse.md", entityKind: "character", source: "structure" });
    expect(buildThreads(graph, file, [], new Set(), { minEntityAppearances: 3 }).threads.filter((t) => t.kind === "entity").map((t) => t.label)).toEqual(["Ilse"]);
  });

  it("threads facts, flags the contradiction, and carries staleness from the use case", () => {
    const fact = model.threads.filter((t) => t.kind === "fact");
    expect(fact.map((t) => t.label)).toEqual(["Ilse · eye colour"]);
    expect(fact[0]!.stale).toBe(true);
    expect(model.contradictions).toHaveLength(1);
    expect(model.contradictions[0]).toMatchObject({ subject: "Ilse", a: { index: 1, value: "green" }, b: { index: 2, value: "grey eyes" }, dismissed: false, stale: true });
    expect(model.factsRead).toBe(2);
    const dismissed = buildThreads(graph, dismissContradiction(file, contradictionKey("Ilse", "eye colour", { scene: creek, value: "green" }, { scene: ret, value: "grey eyes" })), [], new Set());
    expect(dismissed.contradictions[0]!.dismissed).toBe(true);
  });

  it("resolves the writer's threads, resolved stops first and broken links last", () => {
    const mine = model.threads.filter((t) => t.kind === "writer");
    expect(mine.map((t) => t.label)).toEqual(["The gate", "Lone"]);
    expect(mine[0]!.refs.map((r) => [r.index, r.note, r.unresolved ?? null])).toEqual([[0, "planted", null], [2, "paid off", null], [-1, "broken", "Nine#Nowhere"]]);
    expect(mine[1]!.refs.map((r) => r.index)).toEqual([2]);
    expect(mine[0]!.id).toBe("writer:the gate");
  });

  it("computes one strip value per scene", () => {
    const by = Object.fromEntries(model.strips.map((s) => [s.id, s.values]));
    expect(by["cast"]).toEqual([4, 1, 4]);
    expect(by["first-appearances"]).toEqual([4, 0, 0]);
    expect(by["threads"]).toEqual([5, 2, 7]); // Return: four entities, the eye-colour fact, and both hand-drawn threads
    expect(by["open-writer-threads"]).toEqual([1, 1, 0]);
    const perK = by["contradictions-per-1k"]!;
    expect(perK[0]).toBe(0);
    expect(perK[1]).toBeGreaterThan(0);
    expect(perK[2]).toBeGreaterThan(0);
    expect(model.strips.find((s) => s.id === "contradictions-per-1k")!.higherIsBetter).toBe(false);
    expect(buildThreads(graph, EMPTY_STORY_MAP_FILE, [], new Set()).strips.every((s) => s.values.length === 3)).toBe(true);
  });

  it("is empty for an empty graph", () => {
    const empty = buildThreads({ project: "P", entities: [], edges: [], timeline: [] }, EMPTY_STORY_MAP_FILE, [], new Set());
    expect(empty).toMatchObject({ project: "P", scenes: [], threads: [], contradictions: [], factsRead: 0 });
    expect(empty.strips.every((s) => s.values.length === 0)).toBe(true);
  });
});
