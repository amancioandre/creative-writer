import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { STORY_TIMELINE_VIEW_TYPE, StoryTimelineView, type StoryTimelineSource } from "../../../src/infrastructure/obsidian/views/StoryTimelineView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_STORY_MAP } from "../../../src/domain/settings/Settings";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const one = `# Camp\nMarta woke before Ilse at the gate of Lisbon.\n\n# Creek\nIlse found the creek alone.\n`;
const two = `# Return\nMarta came back to Lisbon.\n`;
const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), ...extra });
const notes = [note("Novel/Characters/Marta Kovács.md", ""), note("Novel/Characters/Ilse.md", ""), note("Novel/Places/Lisbon.md", ""), note("Novel/One.md", one, { bookmarkedHeadings: ["Creek"] }), note("Novel/Two.md", two)];
const file = putReading(EMPTY_STORY_MAP_FILE, { scene: { path: "Novel/One.md", title: "Camp", line: 0 }, hash: textHash(splitScenes(one)[0]!.prose), model: "m", relations: [], references: [], events: [{ summary: "Dawn walk", participants: [], evidence: "x" }] });

function open(overrides: Partial<StoryTimelineSource> = {}) {
  const calls = { opened: [] as string[], revealed: [] as string[] };
  const src: StoryTimelineSource = {
    projects: () => [novel], activeProject: () => novel,
    build: async () => buildStoryGraph("Novel", notes, file),
    openNote: (p) => { calls.opened.push(p); }, reveal: (r) => { calls.revealed.push(r.title); },
    settings: () => DEFAULT_STORY_MAP,
    ...overrides,
  };
  return { v: new StoryTimelineView(new WorkspaceLeaf(), src), calls };
}

describe("StoryTimelineView", () => {
  it("has a stable type and title", async () => {
    const { v } = open();
    await v.onOpen();
    expect(v.getViewType()).toBe(STORY_TIMELINE_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Story timeline");
  });

  it("lists scenes grouped by note with the cast across the top", async () => {
    const { v, calls } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect([...el.querySelectorAll(".czm-tl-col span")].map((s) => s.textContent)).toEqual(["Ilse", "Marta Kovács", "Lisbon"]);
    expect([...el.querySelectorAll(".czm-tl-note th")].map((s) => s.textContent)).toEqual(["One", "Two"]);
    const scenes = el.querySelectorAll(".czm-tl-scene");
    expect(scenes).toHaveLength(3);
    expect(scenes[0]!.querySelectorAll(".czm-tl-dot.is-on")).toHaveLength(3);
    expect(scenes[1]!.textContent).toContain("★ Creek");
    expect(scenes[0]!.querySelector(".czm-tl-events")?.textContent).toBe("Dawn walk");
    (scenes[2]!.querySelector("th") as HTMLElement).click();
    expect(calls.revealed).toEqual(["Return"]);
    (el.querySelector(".czm-tl-col span") as HTMLElement).click();
    expect(calls.opened).toEqual(["Novel/Characters/Ilse.md"]);
  });

  it("filters the cast", async () => {
    const { v } = open();
    await v.onOpen();
    const search = v.contentEl.querySelector(".czm-map-search") as HTMLInputElement;
    search.value = "lis";
    search.dispatchEvent(new Event("input"));
    expect([...v.contentEl.querySelectorAll(".czm-tl-col span")].map((s) => s.textContent)).toEqual(["Lisbon"]);
  });

  it("explains an empty project", async () => {
    const { v } = open({ projects: () => [], activeProject: () => null });
    await v.onOpen();
    expect(v.contentEl.textContent).toContain("No project yet");
  });
});
