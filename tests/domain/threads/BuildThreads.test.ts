import { describe, it, expect } from "vitest";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, dismissContradiction, putFactReading } from "../../../src/domain/story/StoryMapFile";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";
import { contradictionKey } from "../../../src/domain/threads/Facts";
import { danglingPlants } from "../../../src/domain/threads/BuildThreads";

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

  it("anchors a stop's quote to its line, flags a directed thread and its dangling plants, and keeps a broken anchor visible", () => {
    const text = { "Novel/One.md": one, "Novel/Two.md": two } as Record<string, string>;
    const directed = parseStoryThreads(`## The gate
- [[One#Camp]] — plant: "Zsófi sang"
- [[Two#Return]] — payoff: "had not changed"

## Unkept
- [[One#Creek]] — plant: "washed her green eyes"
- [[Two#Return]] — touch: still waiting

## Broken
- [[One#Camp]] — plant: "never in the scene"
`);
    const m = buildThreads(graph, file, directed, new Set(), undefined, (p) => text[p]);
    const mine = m.threads.filter((t) => t.kind === "writer");
    expect(mine[0]).toMatchObject({ directed: true, dangling: [] });
    expect(mine[0]!.refs.map((r) => [r.role, r.anchor])).toEqual([["plant", { line: 1, ch: 88 }], ["payoff", { line: 1, ch: 53 }]]);
    expect(mine[1]!.directed).toBe(true);
    expect(mine[1]!.dangling.map((r) => r.index)).toEqual([1]);
    expect(mine[2]!.refs[0]!.anchor).toBeNull();
    expect(model.threads.filter((t) => t.kind === "writer").every((t) => !t.directed && t.dangling.length === 0)).toBe(true);
    expect(model.threads.filter((t) => t.kind === "writer")[0]!.refs[0]!.anchor).toBeUndefined();
    // Strips: the kept plant is carried from Camp to Return; the unkept one from Creek, and the broken one from Camp, to the end of the book.
    expect(Object.fromEntries(m.strips.map((s) => [s.id, s.values]))["open-writer-threads"]).toEqual([2, 3, 2]);
  });

  it("threads the echo finder's findings, anchored to their lines, and mutes what the writer has quoted", () => {
    const text = { "Novel/One.md": one, "Novel/Two.md": two } as Record<string, string>;
    const stop = (scene: typeof camp, index: number, from: number, to: number, t: string, sentence: string) => ({ scene, index, paragraph: 0, from, to, text: t, sentence });
    const echoes = {
      groups: [{ key: "surface:zsófi sang", tier: "surface" as const, text: "gate of Lisbon", stops: [stop(camp, 0, 0, 0, "gate of Lisbon", "Marta woke before Ilse at the gate of Lisbon."), stop(ret, 2, 0, 0, "gate of Lisbon", "Never written here.")], scenes: 2, nearest: 2, score: 1 }],
      pairs: [{ key: "lexical:0:0|2:0", tier: "lexical" as const, a: stop(camp, 0, 0, 0, "x", "Zsófi was there, as Zsófi always was, and Zsófi sang."), b: stop(ret, 2, 0, 0, "y", "Marta came back to Lisbon with Ilse, whose grey eyes had not changed, and Zsófi met them."), similarity: 0.7, score: 0.5, distance: 2 }],
    };
    const m = buildThreads(graph, file, [], new Set(), undefined, (p) => text[p], echoes);
    const mine = m.threads.filter((t) => t.kind === "echo");
    expect(mine.map((t) => [t.id, t.label, t.refs.map((r) => r.index)])).toEqual([
      ["echo:surface:zsófi sang", "gate of Lisbon", [0, 2]],
      ["echo:lexical:0:0|2:0", "Zsófi was there, as Zsófi always was,…", [0, 2]],
    ]);
    expect(mine[0]!.refs[0]).toMatchObject({ quote: "gate of Lisbon", note: "Marta woke before Ilse at the gate of Lisbon.", anchor: { line: 1, ch: 30 } });
    expect(mine[0]!.refs[1]!.anchor).toBeNull();
    expect(m.echoes).toEqual(echoes);
    expect(Object.fromEntries(m.strips.map((s) => [s.id, s.values]))["echoes"]).toEqual([2, 0, 2]);
    expect(Object.fromEntries(m.strips.map((s) => [s.id, s.values]))["threads"]).toEqual([4, 2, 5]);
    // A motif the writer wrote down, quoting the phrase, takes the echo out.
    const motif = parseStoryThreads(`## Gate\n- [[One#Camp]] — "the gate of Lisbon"\n`);
    const muted = buildThreads(graph, file, motif, new Set(), undefined, (p) => text[p], echoes);
    expect(muted.threads.filter((t) => t.kind === "echo").map((t) => t.id)).toEqual(["echo:lexical:0:0|2:0"]);
    expect(muted.echoes.groups).toEqual([]);
  });

  it("carries the model's verdict onto a contradiction by its key, as a proposal", () => {
    const key = contradictionKey("Ilse", "eye colour", { scene: creek, value: "green" }, { scene: ret, value: "grey eyes" });
    const read = { ...file, intents: [{ key, verdict: "reversal" as const, reason: "the dye", confidence: 0.8, model: "m", rulebook: "r" }, { key: "other", verdict: "same" as const, reason: "", confidence: 1, model: "m", rulebook: "r" }] };
    const m = buildThreads(graph, read, [], new Set());
    expect(m.contradictions[0]!.intent).toEqual({ verdict: "reversal", reason: "the dye", confidence: 0.8, model: "m" });
    expect(m.contradictions[0]!.explainedBy).toBeUndefined();
    expect(model.contradictions[0]!.intent).toBeUndefined();
    expect(m.semantic).toEqual({ stored: 0, stale: 0 });
  });

  it("names the plants a thread has not kept", () => {
    const plant = (index: number) => ({ scene: camp, index, note: "", role: "plant" as const });
    const payoff = (index: number) => ({ scene: ret, index, note: "", role: "payoff" as const });
    expect(danglingPlants([plant(0), payoff(2)])).toEqual([]);
    expect(danglingPlants([plant(0), plant(1)]).map((r) => r.index)).toEqual([0, 1]);
    expect(danglingPlants([payoff(0), plant(2)]).map((r) => r.index)).toEqual([2]);
    expect(danglingPlants([{ ...plant(-1), index: -1 }])).toEqual([]);
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
