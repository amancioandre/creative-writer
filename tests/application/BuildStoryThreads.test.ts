import { describe, it, expect } from "vitest";
import { BuildStoryMap } from "../../src/application/use-cases/BuildStoryMap";
import { BuildStoryThreads } from "../../src/application/use-cases/BuildStoryThreads";
import { EditStoryThread } from "../../src/application/use-cases/EditStoryThread";
import type { ProjectSpec } from "../../src/domain/progress/Project";
import { splitScenes } from "../../src/domain/text/Scenes";
import { textHash } from "../../src/domain/story/StoryGraph";
import { EMPTY_STORY_MAP_FILE, putFactReading, type StoryMapFile } from "../../src/domain/story/StoryMapFile";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 100, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const one = `# Camp\nMarta woke before Ilse at the gate. Her green eyes were open.\n\n# Creek\nIlse found the creek alone.\n`;
const two = `# Return\nMarta came back to Ilse, whose grey eyes had not changed.\n`;
const notes = {
  projects: () => [novel],
  notes: async () => [
    { path: "Novel/Characters/Marta Kovács.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/Characters/Ilse.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: [] },
    { path: "Novel/One.md", frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(one) },
    { path: "Novel/Two.md", frontmatter: { "story-order": 1 }, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(two) },
  ],
};
const camp = splitScenes(one)[0]!, ret = splitScenes(two)[0]!;
const facts = putFactReading(putFactReading(EMPTY_STORY_MAP_FILE,
  { scene: { path: "Novel/One.md", title: "Camp", line: 0 }, hash: textHash(camp.prose), model: "m", rulebook: "r", facts: [{ subject: "Ilse", attribute: "eye colour", value: "green", evidence: "green eyes" }] }),
  { scene: { path: "Novel/Two.md", title: "Return", line: 0 }, hash: "stale", model: "m", rulebook: "r", facts: [{ subject: "Ilse", attribute: "eye colour", value: "grey", evidence: "grey eyes" }] });
void ret;

function storyRepo(initial: StoryMapFile) {
  let file = initial;
  return { load: async () => file, save: async (_p: ProjectSpec, f: StoryMapFile) => { file = f; }, update: async (_p: ProjectSpec, change: (f: StoryMapFile) => StoryMapFile) => { file = change(file); return file; }, get file() { return file; } };
}
function threadsRepo(initial = "") {
  let md = initial;
  return { load: async () => md, update: async (_p: ProjectSpec, change: (m: string) => string) => { md = change(md); return md; }, get md() { return md; } };
}

describe("BuildStoryThreads", () => {
  it("composes the graph, the facts and the writer's note, marking fact readings stale where the prose moved on", async () => {
    const story = storyRepo(facts);
    const mine = threadsRepo("## Gate\n- [[One#Camp]] — planted\n- [[Two#Return]] — paid\n");
    const uc = new BuildStoryThreads(new BuildStoryMap(notes, story), notes, story, mine);
    const model = await uc.execute(novel);
    // story-order puts Two first.
    expect(model.scenes.map((s) => s.ref.title)).toEqual(["Return", "Camp", "Creek"]);
    expect(model.threads.filter((t) => t.kind === "writer")[0]!.refs.map((r) => r.index)).toEqual([0, 1]);
    const fact = model.threads.find((t) => t.kind === "fact")!;
    expect(fact.stale).toBe(true);
    expect(model.contradictions).toHaveLength(1);
    expect(model.contradictions[0]!.stale).toBe(true);
    expect(model.factsRead).toBe(2);

    await uc.dismiss(novel, model.contradictions[0]!.key);
    expect((await uc.execute(novel)).contradictions[0]!.dismissed).toBe(true);
    await uc.undismiss(novel, model.contradictions[0]!.key);
    expect((await uc.execute(novel)).contradictions[0]!.dismissed).toBe(false);
    expect(story.file.readings).toEqual([]);
  });

  it("edits the writer's note through the repository, ignoring empty names", async () => {
    const mine = threadsRepo();
    const edit = new EditStoryThread(mine);
    await edit.addRef(novel, "Gate", "One#Camp", "planted");
    await edit.addRef(novel, "Gate", "Two#Return", "");
    expect(mine.md).toBe("## Gate\n- [[One#Camp]] — planted\n- [[Two#Return]]\n");
    await edit.rename(novel, "Gate", "The gate");
    await edit.removeRef(novel, "The gate", "One#Camp");
    expect(mine.md).toBe("## The gate\n- [[Two#Return]]\n");
    await edit.addRef(novel, " ", "One#Camp", "x");
    await edit.addRef(novel, "X", "", "x");
    expect(mine.md).toBe("## The gate\n- [[Two#Return]]\n");
  });
});
