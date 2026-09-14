import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { PLOT_GRID_VIEW_TYPE, PlotGridView, actOf, type PlotGridSource } from "../../../src/infrastructure/obsidian/views/PlotGridView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { parseStoryThreads } from "../../../src/domain/threads/StoryThreadsNote";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_STORY_MAP } from "../../../src/domain/settings/Settings";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const one = `# Camp\nMarta woke before Ilse at the gate of Lisbon.\n\n# Creek\nIlse found the creek alone.\n\n# Later\n`;
const two = `# Return\nMarta came back to Lisbon.\n`;
const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), text: body, ...extra });
const notes = [note("Novel/Characters/Marta Kovács.md", ""), note("Novel/Characters/Ilse.md", ""), note("Novel/Places/Lisbon.md", ""), note("Novel/Part one/One.md", one, { bookmarkedHeadings: ["Creek"] }), note("Novel/Part two/Two.md", two)];
const file = putReading(EMPTY_STORY_MAP_FILE, { scene: { path: "Novel/Part one/One.md", title: "Camp", line: 0 }, hash: textHash(splitScenes(one)[0]!.prose), model: "m", relations: [], references: [], events: [{ summary: "Dawn walk", participants: [], evidence: "x" }] });
const threadsNote = `## Arc: [[Ilse]]
- [[One#Camp]] — want: "woke before Ilse" to be first
- [[Two#Return]] — truth: "came back" she stays

## Subplot: The gate
- [[One#Camp]] — plant: "gate of Lisbon" planted
- [[One#Later]] — the gate closes
- [[Two#Return]] — payoff: "the gate of nowhere" broken anchor
`;

function grid(threads = threadsNote) {
  const graph = buildStoryGraph("Novel", notes, file);
  const model = buildThreads(graph, file, parseStoryThreads(threads), new Set(), undefined, (p) => notes.find((n) => n.path === p)?.text);
  return buildPlotGrid(graph, model);
}

function open(overrides: Partial<PlotGridSource> = {}, threads = threadsNote) {
  const calls = { opened: [] as string[], revealed: [] as string[], jumps: [] as string[] };
  const src: PlotGridSource = {
    projects: () => [novel], activeProject: () => novel,
    build: async () => grid(threads),
    openNote: (p) => { calls.opened.push(p); }, reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); }, jumpTo: (to) => { calls.jumps.push(to); },
    settings: () => DEFAULT_STORY_MAP,
    threadsNotePath: () => "Novel/Story threads.md",
    ...overrides,
  };
  return { v: new PlotGridView(new WorkspaceLeaf(), src), calls };
}

/** The search field redraws once typing pauses. */
const settle = () => new Promise((r) => setTimeout(r, 150));

describe("PlotGridView", () => {
  it("keeps the timeline's type string and is called the plot grid", async () => {
    const { v } = open();
    await v.onOpen();
    expect(v.getViewType()).toBe(PLOT_GRID_VIEW_TYPE);
    expect(PLOT_GRID_VIEW_TYPE).toBe("creative-writer-story-timeline");
    expect(v.getDisplayText()).toBe("Plot grid");
    expect(v.contentEl.querySelector('.czm-shell-jump[data-panel="timeline"]')?.getAttribute("aria-label")).toBe("Plot grid (this panel)");
  });

  it("draws scenes down the side under act and chapter bands, threads across the top by kind, the cast folded", async () => {
    const { v, calls } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect([...el.querySelectorAll(".czm-pg-act th")].map((s) => s.textContent)).toEqual(["Part one", "Part two"]);
    expect([...el.querySelectorAll(".czm-pg-note .is-link")].map((s) => s.textContent)).toEqual(["One", "Two"]);
    expect([...el.querySelectorAll(".czm-pg-note-total")].map((s) => s.textContent)).toEqual(["3 scenes · 14 words · 3 of the cast", "1 scene · 5 words · 2 of the cast"]);
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["Ilse", "The gate"]);
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-count")].map((s) => s.textContent)).toEqual(["2 of 4", "3 of 4"]);
    expect(el.querySelector(".czm-pg-col-thread .czm-pg-dot")).not.toBeNull();
    const scenes = el.querySelectorAll(".czm-pg-scene");
    expect(scenes).toHaveLength(4);
    expect(scenes[1]!.textContent).toContain("★ Creek");
    expect(scenes[2]!.classList.contains("is-outline")).toBe(true);
    expect(scenes[2]!.querySelector(".czm-map-row-meta")?.textContent).toBe("outline");
    expect(scenes[0]!.querySelector(".czm-pg-plot")?.textContent).toBe("Dawn walk");
    expect(scenes[0]!.querySelectorAll(".czm-pg-strip-dot.is-on")).toHaveLength(3);
    expect(el.querySelector(".czm-shell-state-text")!.textContent).toBe("4 scenes · 2 columns · 3 in the cast");
    (scenes[3]!.querySelector("th") as HTMLElement).click();
    expect(calls.revealed).toEqual(["Return@0"]);
  });

  it("a cell carries the stop's role glyph and its anchor's state, and opens the scene at the anchor", async () => {
    const { v, calls } = open();
    await v.onOpen();
    const el = v.contentEl;
    const gate = [...el.querySelectorAll(".czm-pg-scene")].map((tr) => tr.querySelectorAll(".czm-pg-cell")[1]!);
    expect(gate.map((c) => c.className)).toEqual(["czm-pg-cell is-verified", "czm-pg-cell is-empty", "czm-pg-cell is-plan", "czm-pg-cell is-broken"]);
    expect(gate[0]!.querySelector(".czm-pg-role")?.textContent).toBe("▶");
    expect(gate[0]!.querySelector(".czm-pg-cell-text")?.textContent).toBe("planted");
    expect((gate[3] as HTMLElement).title).toContain("no longer in the scene");
    const arc = [...el.querySelectorAll(".czm-pg-scene")].map((tr) => tr.querySelectorAll(".czm-pg-cell")[0]!);
    expect(arc[0]!.querySelector(".czm-pg-role")?.textContent).toBe("▸");
    expect(arc[1]!.classList.contains("is-unmoved")).toBe(true);
    expect(arc[1]!.textContent).toBe("present, unmoved");
    (gate[0] as HTMLElement).click();
    expect(calls.revealed).toEqual(["Camp@1"]);
  });

  it("expands the cast into one column per name and back, with the kinds in the key", async () => {
    const { v, calls } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelectorAll(".czm-shell-key-item")).toHaveLength(4);
    (el.querySelector(".czm-pg-cast-toggle") as HTMLElement).click();
    expect([...el.querySelectorAll(".czm-pg-cast-name span")].map((s) => s.textContent)).toEqual(["Ilse", "Marta Kovács", "Lisbon"]);
    expect(el.querySelectorAll(".czm-pg-scene")[0]!.querySelectorAll(".czm-pg-cast-dot.is-on")).toHaveLength(3);
    expect(el.querySelectorAll(".czm-shell-key-item")).toHaveLength(6);
    (el.querySelector(".czm-pg-cast-name .is-link") as HTMLElement).click();
    expect(calls.opened).toEqual(["Novel/Characters/Ilse.md"]);
    v.run("toggle-cast");
    expect(el.querySelector(".czm-pg-cast-name")).toBeNull();
  });

  it("filters columns and cast by the search, and says so", async () => {
    const { v } = open();
    await v.onOpen();
    const search = v.contentEl.querySelector(".czm-map-search") as HTMLInputElement;
    search.value = "gate";
    search.dispatchEvent(new Event("input")); await settle();
    expect([...v.contentEl.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["The gate"]);
    expect(v.contentEl.querySelector(".czm-shell-state-text")!.textContent).toBe("4 scenes · 1 column · 0 in the cast · “gate”");
    search.value = "zzz";
    search.dispatchEvent(new Event("input")); await settle();
    expect(v.contentEl.textContent).toContain("Nothing matches “zzz”");
    (v.contentEl.querySelector(".czm-shell-empty .czm-pg-clear") as HTMLElement).click();
    expect(v.contentEl.querySelectorAll(".czm-pg-col-thread")).toHaveLength(2);
  });

  it("explains an empty project, a project with no columns, and a heading that is almost a kind", async () => {
    const none = open({ projects: () => [], activeProject: () => null });
    await none.v.onOpen();
    expect(none.v.contentEl.textContent).toContain("No project yet");
    const bare = open({}, "");
    await bare.v.onOpen();
    expect(bare.v.contentEl.textContent).toContain("No columns yet");
    (bare.v.contentEl.querySelector(".czm-pg-fix-note") as HTMLElement).click();
    expect(bare.calls.opened).toEqual(["Novel/Story threads.md"]);
    const odd = open({}, "## Arcs: Ilse\n- [[One#Camp]] — x\n");
    await odd.v.onOpen();
    expect(odd.v.contentEl.querySelector(".czm-shell-state-text")!.textContent).toContain("1 heading not read as a kind (Arcs:)");
  });

  it("reads a note's folder below the project as its act", () => {
    expect(actOf("Novel/Part one/One.md", "Novel/")).toBe("Part one");
    expect(actOf("Novel/One.md", "Novel/")).toBe("");
    expect(actOf("Elsewhere/A/B/c.md", "Novel/")).toBe("Elsewhere · A · B");
  });
});
