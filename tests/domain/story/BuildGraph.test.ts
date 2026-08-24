import { describe, it, expect } from "vitest";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import { looksLikeName } from "../../../src/domain/story/BuildGraph";
import type { PosTagger, TaggedToken } from "../../../src/domain/style/PosTagger";

const chapterOne = `# Camp
Marta woke before Ilse and walked to the gate of Lisbon. Zsófi was there, as Zsófi always was.

# Creek
Ilse found the creek alone. Zsófi watched.
`;
const chapterTwo = `# Return
Marta came back to Lisbon and Zsófi met her. See [[Marta Kovács]].
`;

const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({
  path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), ...extra,
});

const notes: ProjectNote[] = [
  note("Novel/Characters/Marta Kovács.md", "# Marta\nShe is the elder.", { links: ["Novel/Characters/Ilse.md"] }),
  note("Novel/Characters/Ilse.md", "", { bookmarked: true }),
  note("Novel/Places/Lisbon.md", ""),
  note("Novel/Chapters/One.md", chapterOne, { bookmarkedHeadings: ["Creek"] }),
  note("Novel/Chapters/Two.md", chapterTwo, { links: ["Novel/Characters/Marta Kovács.md"] }),
];

describe("buildStoryGraph", () => {
  const g = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE);
  const byName = (n: string) => g.entities.find((e) => e.name === n)!;
  const edge = (kind: string, a: string, b: string) => g.edges.find((e) => e.kind === kind && ((e.from === a && e.to === b) || (e.from === b && e.to === a)));

  it("has typed entities, candidates for recurring unknown names, and chapter notes", () => {
    expect(g.entities.map((e) => [e.name, e.kind])).toEqual([
      ["Ilse", "character"], ["Marta Kovács", "character"], ["Lisbon", "location"],
      ["Zsófi", "candidate"], ["One", "note"], ["Two", "note"],
    ]);
    expect(byName("Ilse").bookmarked).toBe(true);
  });

  it("tracks appearances and mention counts in scene order", () => {
    expect(byName("Marta Kovács").appearances.map((s) => s.title)).toEqual(["Camp", "Return"]);
    expect(byName("Zsófi").mentions).toBe(4);
    expect(byName("Ilse").appearances.map((s) => `${s.path}#${s.title}`)).toEqual(["Novel/Chapters/One.md#Camp", "Novel/Chapters/One.md#Creek"]);
  });

  it("does not treat an entity's own note as a scene", () => {
    expect(byName("Marta Kovács").appearances.some((s) => s.path.includes("Characters"))).toBe(false);
  });

  it("builds explicit link edges only between nodes", () => {
    const link = edge("link", "Novel/Chapters/Two.md", "Novel/Characters/Marta Kovács.md")!;
    expect(link.layer).toBe("explicit");
    expect(link.source).toBe("structure");
    expect(edge("link", "Novel/Characters/Marta Kovács.md", "Novel/Characters/Ilse.md")).toBeDefined();
  });

  it("weights co-occurrence by shared scenes with evidence", () => {
    const mz = edge("co-occurrence", "Novel/Characters/Marta Kovács.md", "name:zsofi")!;
    expect(mz.weight).toBe(2);
    expect(mz.evidence.map((s) => s.title)).toEqual(["Camp", "Return"]);
    expect(edge("co-occurrence", "Novel/Characters/Ilse.md", "Novel/Places/Lisbon.md")!.weight).toBe(1);
    expect(edge("co-occurrence", "Novel/Characters/Marta Kovács.md", "Novel/Characters/Marta Kovács.md")).toBeUndefined();
  });

  it("records appearance edges from entity to chapter", () => {
    expect(edge("appearance", "Novel/Characters/Ilse.md", "Novel/Chapters/One.md")!.weight).toBe(2);
  });

  it("lays out the timeline in path/scene order with presence, words and bookmarks", () => {
    expect(g.timeline.map((r) => [r.scene.title, r.present.length, r.bookmarked])).toEqual([["Camp", 4, false], ["Creek", 2, true], ["Return", 3, false]]);
    expect(g.timeline[0]!.words).toBeGreaterThan(10);
  });

  it("layers model readings and marks stale ones", () => {
    const camp = splitScenes(chapterOne)[0]!;
    const file = putReading(putReading(EMPTY_STORY_MAP_FILE, {
      scene: { path: "Novel/Chapters/One.md", title: "Camp", line: 0 }, hash: textHash(camp.prose), model: "m",
      relations: [{ from: "Marta", to: "Ilse", label: "sister", evidence: "x" }],
      references: [{ name: "Orpheus", kind: "myth", about: "Marta", note: "no looking back", evidence: "x" }],
      events: [{ summary: "Dawn walk", participants: [], evidence: "x" }],
    }), {
      scene: { path: "Novel/Chapters/One.md", title: "Creek", line: 0 }, hash: "old", model: "m",
      relations: [{ from: "Ilse", to: "Zsófi", label: "watched by", evidence: "x" }], references: [], events: [],
    });
    const g2 = buildStoryGraph("Novel", notes, file);
    const rel = g2.edges.find((e) => e.kind === "relationship" && e.label === "sister")!;
    expect(rel.layer).toBe("internal");
    expect(rel.stale).toBe(false);
    expect(g2.edges.find((e) => e.label === "watched by")!.stale).toBe(true);
    const ref = g2.entities.find((e) => e.kind === "reference")!;
    expect(ref.name).toBe("Orpheus");
    const refEdge = g2.edges.find((e) => e.kind === "reference")!;
    expect(refEdge.from).toBe("Novel/Characters/Marta Kovács.md");
    expect(refEdge.label).toBe("myth: no looking back");
    expect(g2.timeline[0]!.events).toEqual(["Dawn walk"]);
  });

  it("leaves prose-less headings out of the timeline", () => {
    const g2 = buildStoryGraph("Novel", [...notes, note("Novel/Outline.md", "# Plan\n- beat one\n- beat two\n\n# Notes\nMarta must fall.")], EMPTY_STORY_MAP_FILE);
    expect(g2.timeline.map((r) => r.scene.title)).toEqual(["Camp", "Creek", "Return", "Notes"]);
  });

  it("ignores readings of scenes that no longer exist and skips the story map note itself", () => {
    const file = putReading(EMPTY_STORY_MAP_FILE, { scene: { path: "gone.md", title: "", line: 0 }, hash: "h", model: "m", relations: [], references: [{ name: "X", kind: "other", about: "", note: "", evidence: "" }], events: [] });
    const g2 = buildStoryGraph("Novel", [...notes, note("Novel/Story map.md", "data")], file);
    expect(g2.entities.some((e) => e.kind === "reference")).toBe(false);
    expect(g2.entities.some((e) => e.name === "Story map")).toBe(false);
  });

  it("is deterministic regardless of note order", () => {
    const g2 = buildStoryGraph("Novel", [...notes].reverse(), EMPTY_STORY_MAP_FILE);
    expect(g2).toEqual(g);
  });

  describe("authored relationships", () => {
    const withRelations = notes.map((n) => (n.path === "Novel/Characters/Marta Kovács.md"
      ? { ...n, relations: [
        { target: "Ilse", targetPath: "Novel/Characters/Ilse.md", label: "sister", line: 4 },
        { target: "Lisbon", targetPath: null, label: "born in", line: 5 },
        { target: "Nobody", targetPath: null, label: "?", line: 6 },
        { target: "Marta Kovács", targetPath: "Novel/Characters/Marta Kovács.md", label: "self", line: 7 },
      ] }
      : n));

    it("become explicit writer edges with the note as evidence, resolved by path or by name; unknown targets and self-links are dropped", () => {
      const g2 = buildStoryGraph("Novel", withRelations, EMPTY_STORY_MAP_FILE);
      const authored = g2.edges.filter((e) => e.kind === "authored");
      expect(authored.map((e) => [e.to, e.label])).toEqual([["Novel/Characters/Ilse.md", "sister"], ["Novel/Places/Lisbon.md", "born in"]]);
      const sister = authored[0]!;
      expect(sister.from).toBe("Novel/Characters/Marta Kovács.md");
      expect(sister.layer).toBe("explicit");
      expect(sister.source).toBe("writer");
      expect(sister.evidence).toEqual([{ path: "Novel/Characters/Marta Kovács.md", title: "Relationships", line: 4 }]);
      expect(sister.conflict).toEqual([]);
    });

    it("flags a pair where the writer and the model disagree, on both edges, and not where they agree", () => {
      const camp = splitScenes(chapterOne)[0]!;
      const file = putReading(EMPTY_STORY_MAP_FILE, {
        scene: { path: "Novel/Chapters/One.md", title: "Camp", line: 0 }, hash: textHash(camp.prose), model: "m",
        relations: [{ from: "Marta", to: "Ilse", label: "Rival", evidence: "x" }, { from: "Marta", to: "Lisbon", label: "Born In", evidence: "x" }],
        references: [], events: [],
      });
      const g2 = buildStoryGraph("Novel", withRelations, file);
      const mine = g2.edges.find((e) => e.kind === "authored" && e.label === "sister")!;
      const theirs = g2.edges.find((e) => e.kind === "relationship" && e.label === "Rival")!;
      expect(mine.conflict).toEqual(["Rival"]);
      expect(theirs.conflict).toEqual(["sister"]);
      expect(g2.edges.find((e) => e.kind === "authored" && e.label === "born in")!.conflict).toEqual([]);
      expect(g2.edges.find((e) => e.kind === "relationship" && e.label === "Born In")!.conflict).toEqual([]);
      expect(g2.edges.filter((e) => e.kind === "co-occurrence").every((e) => e.conflict.length === 0)).toBe(true);
    });
  });
});

describe("looksLikeName", () => {
  const tags: Record<string, string[]> = { bear: ["Noun", "Singular"], waiting: ["Verb", "Gerund"], better: ["Adjective", "Comparative"], twelve: ["Value", "Cardinal"], vitaliy: ["ProperNoun"], stand: ["Verb", "Infinitive"], disgusting: ["Adjective"], night: ["Noun", "Date"], vancouver: ["ProperNoun"], island: ["Noun"] };
  const tags2: Record<string, string[]> = { ...tags, stand: ["Noun"], disgusting: ["Adjective"] }; // after "the …"
  const tagger: PosTagger = { tag: (t) => {
    const framed = t.startsWith("the ");
    return t.split(/\s+/).map((w, i): TaggedToken => ({ text: w, from: i, to: i + w.length, normal: w.toLowerCase(), lemma: w.toLowerCase(), tags: new Set(w === "the" ? ["Determiner"] : (framed ? tags2 : tags)[w.toLowerCase()] ?? ["Noun"]), sentence: 0 }));
  } };
  it("rejects stop words with or without a tagger", () => {
    expect(looksLikeName("He")).toBe(false);
    expect(looksLikeName("Can")).toBe(false);
    expect(looksLikeName("Bear Hunt Publishing Team")).toBe(true);
    expect(looksLikeName("the")).toBe(false);
  });
  it("uses the tagger to veto verbs, adjectives, gerunds and numbers but keeps nouns and proper nouns", () => {
    expect(looksLikeName("Bear", tagger)).toBe(true);
    expect(looksLikeName("Night", tagger)).toBe(true);
    expect(looksLikeName("Vitaliy", tagger)).toBe(true);
    expect(looksLikeName("Vancouver Island", tagger)).toBe(true);
    expect(looksLikeName("Waiting", tagger)).toBe(false);
    expect(looksLikeName("Better", tagger)).toBe(false);
    expect(looksLikeName("Twelve", tagger)).toBe(false);
    expect(looksLikeName("Stand", tagger)).toBe(false); // stop word
    expect(looksLikeName("Disgusting", tagger)).toBe(false); // adjective even after "the"
  });
  it("honours the writer's ignore list", () => {
    const g = buildStoryGraph("Novel", notes, EMPTY_STORY_MAP_FILE, { candidateMinMentions: 3, ignore: new Set(["zsofi"]) });
    expect(g.entities.some((e) => e.kind === "candidate")).toBe(false);
  });
  it("applies the veto when building candidates", () => {
    const body = "# A\nThen Waiting came, and Waiting stayed, and Waiting left; Bear was near, Bear was here, Bear was there.";
    const g = buildStoryGraph("N", [note("N/One.md", body)], EMPTY_STORY_MAP_FILE, { candidateMinMentions: 3, tagger });
    expect(g.entities.filter((e) => e.kind === "candidate").map((e) => e.name)).toEqual(["Bear"]);
  });
});
