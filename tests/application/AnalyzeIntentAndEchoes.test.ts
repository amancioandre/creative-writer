import { describe, it, expect } from "vitest";
import { AnalyzeContradictionIntent, contextOf } from "../../src/application/use-cases/AnalyzeContradictionIntent";
import { AnalyzeProjectEchoes } from "../../src/application/use-cases/AnalyzeProjectEchoes";
import type { IntentAnalyser, IntentRequest } from "../../src/application/ports/IntentAnalyser";
import type { SentenceEmbedder } from "../../src/application/ports/SentenceEmbedder";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { buildStoryGraph } from "../../src/domain/story/BuildGraph";
import { EMPTY_STORY_MAP_FILE, type StoryMapFile } from "../../src/domain/story/StoryMapFile";
import type { Contradiction } from "../../src/domain/threads/Thread";
import { splitScenes } from "../../src/domain/text/Scenes";
import { IntlSentenceSegmenter } from "../../src/infrastructure/segmentation/IntlSentenceSegmenter";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Novel/Novel.md", ignoredNames: [] };
const one = `# Creek\nIlse found the creek alone. She washed her green eyes in it, which is not a thing eyes do.\n\nThe water was cold and the light was going.\n`;
const two = `# Return\nMarta came back with Ilse, whose grey eyes had not changed since the dye. The lamp guttered and the shadows climbed the wall like slow water.\n`;
const notes = { projects: () => [novel], notes: async () => [{ path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(one), text: one }, { path: "Novel/Two.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(two), text: two }] };
function repo(initial: StoryMapFile = EMPTY_STORY_MAP_FILE) {
  let file = initial;
  return { load: async () => file, save: async (_p: ProjectSpec, f: StoryMapFile) => { file = f; }, update: async (_p: ProjectSpec, change: (f: StoryMapFile) => StoryMapFile) => { file = change(file); return file; }, get file() { return file; } };
}
const creek = { path: "Novel/One.md", title: "Creek", line: 0 }, ret = { path: "Novel/Two.md", title: "Return", line: 0 };
const clash: Contradiction = { key: "K", threadId: "fact:ilse|eye colour", subject: "Ilse", attribute: "eye colour", a: { scene: creek, index: 0, note: "green", value: "green", evidence: "her green eyes" }, b: { scene: ret, index: 1, note: "grey", value: "grey", evidence: "grey eyes" }, dismissed: false, stale: false };

describe("AnalyzeContradictionIntent", () => {
  it("shows the model both sides in order with their paragraphs, keeps a valid verdict by key, skips pairs already read, and honours force", async () => {
    const seen: IntentRequest[] = [];
    let verdict: unknown = { verdict: "reversal", reason: "the dye is mentioned", confidence: 0.9 };
    const analyser: IntentAnalyser = { name: "fake", rulebook: "r1", analyse: async (r) => { seen.push(r); return verdict; } };
    const story = repo();
    const uc = new AnalyzeContradictionIntent(notes, story, analyser);
    expect(await uc.execute(novel, [clash, { ...clash, key: "D", dismissed: true }, { ...clash, key: "E", explainedBy: "w" }], new AbortController().signal)).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.first).toEqual({ scene: "Creek", value: "green", evidence: "her green eyes", context: "Ilse found the creek alone. She washed her green eyes in it, which is not a thing eyes do." });
    expect(seen[0]!.second.context).toContain("since the dye");
    expect(story.file.intents).toEqual([{ key: "K", verdict: "reversal", reason: "the dye is mentioned", confidence: 0.9, model: "fake", rulebook: "r1" }]);
    const progress: boolean[] = [];
    expect(await uc.execute(novel, [clash], new AbortController().signal, (p) => progress.push(p.skipped))).toBe(0);
    expect(progress).toEqual([true]);
    verdict = { verdict: "nonsense" };
    expect(await uc.execute(novel, [clash], new AbortController().signal, undefined, true)).toBe(0);
    expect(story.file.intents[0]!.verdict).toBe("reversal");
    expect(await uc.execute(novel, [], new AbortController().signal)).toBe(0);
  });

  it("gives the paragraph around a quote, capped, or the quote alone when it is not there", () => {
    expect(contextOf("First.\n\nSecond has the words here.\n\nThird.", "the words")).toBe("Second has the words here.");
    expect(contextOf("Only one paragraph with the words.", "the words")).toBe("Only one paragraph with the words.");
    expect(contextOf("Nothing.", "the words")).toBe("the words");
    expect(contextOf("", "q")).toBe("q");
    const long = `${"a ".repeat(500)}the words ${"b ".repeat(500)}`;
    const ctx = contextOf(long, "the words");
    expect(ctx.length).toBeLessThanOrEqual(704);
    expect(ctx).toContain("the words");
    expect(ctx.startsWith("…")).toBe(true);
  });
});

describe("AnalyzeProjectEchoes", () => {
  it("embeds the long sentences of every scene in batches, keeps the alike pairs with their scene hashes, and replaces the last run", async () => {
    const embedded: string[][] = [];
    const embedder: SentenceEmbedder = { name: "fake-embed", embed: async (texts) => { embedded.push([...texts]); return texts.map((t) => (t.includes("lamp") || t.includes("water") ? [1, 0.05] : t.includes("green") ? [0, 1] : [0.7, 0.7])); } };
    const story = repo({ ...EMPTY_STORY_MAP_FILE, echoes: [{ a: creek, b: ret, hashA: "x", hashB: "y", quoteA: "old", quoteB: "old", score: 1, model: "old" }] });
    const graph = buildStoryGraph("Novel", await notes.notes(), EMPTY_STORY_MAP_FILE);
    const uc = new AnalyzeProjectEchoes(notes, story, embedder, new IntlSentenceSegmenter("en"));
    const progress: number[] = [];
    const n = await uc.execute(novel, graph, new AbortController().signal, (p) => progress.push(p.done));
    expect(embedded.flat().every((t) => t.split(/\s+/).length >= 8)).toBe(true);
    expect(embedded.flat()).toContain("The water was cold and the light was going.");
    expect(n).toBe(1);
    expect(story.file.echoes).toHaveLength(1);
    expect(story.file.echoes[0]).toMatchObject({ a: creek, b: ret, quoteA: "The water was cold and the light was going.", quoteB: "The lamp guttered and the shadows climbed the wall like slow water.", model: "fake-embed" });
    expect(story.file.echoes[0]!.hashA).not.toBe("");
    expect(progress.at(-1)).toBe(embedded.flat().length);
  });

  it("stops cleanly when aborted and stores nothing", async () => {
    const controller = new AbortController();
    const embedder: SentenceEmbedder = { name: "fake", embed: async (texts) => { controller.abort(); return texts.map(() => [1, 0]); } };
    const story = repo();
    const graph = buildStoryGraph("Novel", await notes.notes(), EMPTY_STORY_MAP_FILE);
    expect(await new AnalyzeProjectEchoes(notes, story, embedder, new IntlSentenceSegmenter("en")).execute(novel, graph, controller.signal)).toBe(0);
    expect(story.file.echoes).toEqual([]);
  });
});
