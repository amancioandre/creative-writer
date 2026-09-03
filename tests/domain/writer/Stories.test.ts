import { describe, it, expect } from "vitest";
import { type WriterNote, buildBoard } from "../../../src/domain/writer/Board";
import { EMPTY_WRITER_FILE } from "../../../src/domain/writer/WriterFile";
import { type StoryFacts, blendFingerprints, ideasOf, inferStage, linkTarget, parseReading, parseStage, storyCard } from "../../../src/domain/writer/Stories";
import { STORY_W, layoutStories } from "../../../src/domain/writer/Layout";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { lastWorkedOn } from "../../../src/domain/progress/Project";

const spec = (name: string, target = 0): ProjectSpec => ({ name, notePath: `storytelling/${name}/${name}.md`, scope: `storytelling/${name}/`, targetWords: target, deadline: null, dailyWords: 0, ignoredNames: [] });
const facts = (over: Partial<StoryFacts> = {}): StoryFacts => ({ spec: spec("Bear"), frontmatter: {}, words: 0, hasProse: false, cast: 0, lastWorked: null, idea: null, voice: null, fingerprint: null, ...over });

describe("Stories", () => {
  it("parses only settable stages and infers the rest from prose and the target", () => {
    expect(parseStage(" Drafting ")).toBe("drafting");
    expect(parseStage("idea")).toBeNull();
    expect(parseStage(3)).toBeNull();
    expect(inferStage(null, false, 0, 0)).toBe("development");
    expect(inferStage(null, true, 10, 0)).toBe("drafting");
    expect(inferStage(null, true, 500, 400)).toBe("finished");
    expect(inferStage("shelved", true, 500, 400)).toBe("shelved");
  });
  it("reads a link target from front matter in every shape", () => {
    expect(linkTarget("[[Idea]]")).toBe("Idea");
    expect(linkTarget(" [[notes/Idea#Top|shown]] ")).toBe("notes/Idea");
    expect(linkTarget("Plain")).toBe("Plain");
    expect(linkTarget("")).toBeNull();
    expect(linkTarget(3)).toBeNull();
  });
  it("makes a story card from facts, declared stage winning", () => {
    const card = storyCard(facts({ spec: spec("Bear", 100), frontmatter: { "writing-stage": "revising", "writing-premise": " A man hunts. " }, words: 120, hasProse: true, cast: 3, lastWorked: "2026-09-01", idea: "i.md", voice: "v.md" }));
    expect(card).toMatchObject({ stage: "revising", declared: true, premise: "A man hunts.", words: 120, target: 100, cast: 3, lastWorked: "2026-09-01", idea: "i.md", voice: "v.md" });
    expect(storyCard(facts({ spec: spec("Bear", 100), words: 120, hasProse: true })).stage).toBe("finished");
    expect(storyCard(facts({ frontmatter: { "writing-stage": "nope" } })).declared).toBe(false);
  });
  it("lists as ideas the premise cards that have no story and are claimed by none", () => {
    const note = (path: string, tags: string[], story: string | null = null): WriterNote => ({ path, title: path, tags, links: [], excerpt: "", story });
    const board = buildBoard([note("a.md", ["#writer/premise"]), note("b.md", ["#writer/premise"], "storytelling/B/B.md"), note("c.md", ["#writer/premise"]), note("d.md", ["#writer/theme"]), note("e.md", ["#writer/premise"], "gone.md")], EMPTY_WRITER_FILE);
    const stories = [storyCard(facts({ spec: spec("B") })), storyCard(facts({ spec: spec("C"), idea: "c.md" }))];
    expect(ideasOf(board, stories).map((c) => c.path)).toEqual(["a.md", "e.md"]);
  });
  it("finds the last day a project's notes changed", () => {
    const log = { counts: {}, days: {
      "2026-08-01": { added: 5, removed: 0, files: { "storytelling/Bear/One.md": { added: 5, removed: 0 } } },
      "2026-08-09": { added: 0, removed: 2, files: { "storytelling/Bear/Two.md": { added: 0, removed: 2 }, "other.md": { added: 0, removed: 0 } } },
      "2026-08-20": { added: 9, removed: 0, files: { "elsewhere.md": { added: 9, removed: 0 } } },
    } };
    expect(lastWorkedOn(log, spec("Bear"))).toBe("2026-08-09");
    expect(lastWorkedOn(log, spec("Horse"))).toBeNull();
  });
  it("lays the band out above the board: story cards in a row, pills on a line below", () => {
    const row = { stories: [storyCard(facts({ spec: spec("Bear") })), storyCard(facts({ spec: spec("Horse") }))], ideas: [{ path: "i.md", title: "An idea", story: null, reading: null, groups: ["premise"], tagGroups: ["premise"], excerpt: "", position: null }], unfiled: ["storytelling/Loose"], uses: new Map() };
    const band = layoutStories(row, 0);
    expect(band.rect.y + band.rect.h).toBeLessThan(0);
    expect(band.stories.map((s) => s.story.spec.name)).toEqual(["Bear", "Horse"]);
    expect(band.stories[1]!.x).toBe(band.stories[0]!.x + STORY_W + 12);
    expect(band.ideas[0]!.label).toBe("An idea");
    expect(band.unfiled[0]!.label).toBe("Loose");
    expect(band.unfiled[0]!.x).toBeGreaterThan(band.ideas[0]!.x + band.ideas[0]!.w);
    expect(band.ideas[0]!.y).toBeGreaterThan(band.stories[0]!.y);
    const empty = layoutStories({ stories: [], ideas: [], unfiled: [], uses: new Map() }, 0);
    expect(empty.stories).toEqual([]);
    expect(empty.rect.h).toBeGreaterThan(0);
  });
  it("parses reading statuses and blends fingerprints by words", () => {
    expect(parseReading(" To Read ")).toBe("to-read");
    expect(parseReading("READ")).toBe("read");
    expect(parseReading("later")).toBeNull();
    expect(blendFingerprints([null, { words: 0, ease: 1, grade: 1, variety: 1, dialogue: 1 }])).toBeNull();
    const b = blendFingerprints([{ words: 100, ease: 80, grade: 4, variety: null, dialogue: 0.2 }, { words: 300, ease: 40, grade: 8, variety: 0.5, dialogue: 0 }, null]);
    expect(b).toEqual({ words: 400, ease: 50, grade: 7, variety: 0.5, dialogue: 0.05 });
  });
});
