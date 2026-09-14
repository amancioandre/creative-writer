import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { PLOT_GRID_VIEW_TYPE, PlotGridView, actOf, type PlotGridSource } from "../../../src/infrastructure/obsidian/views/PlotGridView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { addThread, appendThreadItems, parseStoryThreads, removeThread, removeThreadItem } from "../../../src/domain/threads/StoryThreadsNote";
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
  const calls = { opened: [] as string[], revealed: [] as string[], jumps: [] as string[], writes: [] as string[] };
  // The threads note as a string the writes edit, so the grid reads back what it wrote.
  let md = threads;
  const src: PlotGridSource = {
    projects: () => [novel], activeProject: () => novel,
    build: async () => grid(md),
    openNote: (p) => { calls.opened.push(p); }, reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); }, jumpTo: (to) => { calls.jumps.push(to); },
    settings: () => DEFAULT_STORY_MAP,
    threadsNotePath: () => "Novel/Story threads.md",
    addStops: async (_p, thread, stops) => { calls.writes.push(`add ${thread}: ${stops.map((s) => `${s.link} ${s.role ?? ""} ${s.quote ?? ""} ${s.note}`).join(" | ")}`); md = appendThreadItems(md, thread, stops); },
    removeFromThread: async (_p, thread, link) => { calls.writes.push(`remove ${thread}: ${link}`); md = removeThreadItem(md, thread, link); },
    addThread: async (_p, name) => { calls.writes.push(`thread ${name}`); md = addThread(md, name); },
    removeThread: async (_p, name) => { calls.writes.push(`delete ${name}`); md = removeThread(md, name); },
    ...overrides,
  };
  return { v: new PlotGridView(new WorkspaceLeaf(), src), calls, note: () => md };
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
    expect(calls.revealed).toEqual([]);
    gate[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "o", bubbles: true }));
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

  it("selects a cell with a click, moves with the arrows, and the side column follows", async () => {
    const { v } = open();
    await v.onOpen();
    const el = v.contentEl;
    const first = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="0"]')!;
    first.click();
    expect(first.classList.contains("is-selected")).toBe(true);
    expect(el.querySelector(".czm-map-section-pg-cell .czm-map-section-value")?.textContent).toBe("The gate · Camp");
    expect(el.querySelector(".czm-pg-state")?.textContent).toContain("verified");
    expect((el.querySelector(".czm-pg-role-select") as HTMLSelectElement).value).toBe("plant");
    expect((el.querySelector(".czm-pg-quote") as HTMLInputElement).value).toBe("gate of Lisbon");
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(el.querySelector('.czm-pg-cell[data-col="1"][data-row="1"]')?.classList.contains("is-selected")).toBe(true);
    expect(el.querySelector(".czm-pg-state")?.textContent).toBe("empty");
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="1"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(el.querySelector('.czm-pg-cell[data-col="0"][data-row="1"]')?.classList.contains("is-selected")).toBe(true);
    // An arc column offers the arc roles too.
    expect([...el.querySelectorAll(".czm-pg-role-select option")].map((o) => (o as HTMLOptionElement).value)).toEqual(["plant", "touch", "payoff", "reversal", "want", "lie", "turn", "truth"]);
  });

  it("writes a cell typed in place as a stop line, keeping the role and quote, with undo", async () => {
    const { v, calls, note } = open();
    await v.onOpen();
    const el = v.contentEl;
    const cell = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="1"]')!;
    cell.click();
    cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const field = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    expect(field).not.toBeNull();
    field.value = "Ilse washes in it";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toEqual(["add Subplot: The gate: One#Creek   Ilse washes in it"]);
    expect(note()).toContain("- [[One#Creek]] — Ilse washes in it");
    expect(el.querySelector('.czm-pg-cell[data-col="1"][data-row="1"] .czm-pg-cell-text')?.textContent).toBe("Ilse washes in it");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Written: The gate at Creek");
    (el.querySelector(".czm-map-status button") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).not.toContain("Ilse washes in it");
    // Editing a stop that has a role and a quote keeps both.
    const verified = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="0"]')!;
    verified.click(); verified.click();
    const f2 = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    f2.value = "planted, and noticed";
    f2.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain('- [[One#Camp]] — plant: "gate of Lisbon" planted, and noticed');
    // Escape leaves the note alone.
    const again = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="0"]')!;
    again.click(); again.click();
    const f3 = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    f3.value = "thrown away";
    f3.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).not.toContain("thrown away");
  });

  it("the side column saves role, anchor and note, removes a stop, and adds and deletes columns", async () => {
    const { v, calls, note } = open();
    await v.onOpen();
    const el = v.contentEl;
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="2"]')!.click();
    (el.querySelector(".czm-pg-role-select") as HTMLSelectElement).value = "payoff";
    (el.querySelector(".czm-pg-quote") as HTMLInputElement).value = "closes";
    (el.querySelector(".czm-pg-note-field") as HTMLTextAreaElement).value = "the gate closes on her";
    (el.querySelector(".czm-pg-save") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain('- [[One#Later]] — payoff: "closes" the gate closes on her');
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="2"]')!.click();
    (el.querySelector(".czm-pg-remove") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).not.toContain("[[One#Later]]");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Later taken out of “The gate”");
    // Delete on a selected cell removes its stop too; a new column is a heading; a deleted column takes its stops and can come back.
    const camp = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="0"]')!;
    camp.click();
    camp.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).not.toContain("[[One#Camp]] — plant");
    const input = el.querySelector(".czm-pg-new-name") as HTMLInputElement;
    input.value = "Theme: Salt";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain("## Theme: Salt");
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["Ilse", "Salt", "The gate"]);
    const del = el.querySelector<HTMLElement>('.czm-pg-col-delete[aria-label="Delete column Ilse"]')!;
    del.click();
    expect(del.textContent).toBe("Delete?");
    del.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).not.toContain("## Arc: [[Ilse]]");
    expect(calls.writes.at(-1)).toBe("delete Arc: [[Ilse]]");
    (el.querySelector(".czm-map-status button") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain("## Arc: [[Ilse]]\n- [[One#Camp]] — want: \"woke before Ilse\" to be first");
  });

  it("reads a note's folder below the project as its act", () => {
    expect(actOf("Novel/Part one/One.md", "Novel/")).toBe("Part one");
    expect(actOf("Novel/One.md", "Novel/")).toBe("");
    expect(actOf("Elsewhere/A/B/c.md", "Novel/")).toBe("Elsewhere · A · B");
  });
});
