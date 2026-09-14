import { describe, it, expect } from "vitest";
import { Menu, WorkspaceLeaf } from "obsidian";
import { PLOT_GRID_VIEW_TYPE, PlotGridView, actOf, type PlotGridSource } from "../../../src/infrastructure/obsidian/views/PlotGridView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { addThread, appendThreadItems, parseStoryThreads, removeThread, removeThreadItem, renameThread } from "../../../src/domain/threads/StoryThreadsNote";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putGridReading, putReading, type GridReading, type StoryMapFile } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_PLOT_GRID, DEFAULT_STORY_MAP, type PlotGridSettings } from "../../../src/domain/settings/Settings";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const one = `# Camp\nMarta woke before Ilse at the gate of Lisbon.\n\n# Creek\nIlse found the creek alone.\n\n# Later\n`;
const two = `# Return\nMarta came back to Lisbon. The gate of Lisbon was shut.\n`;
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
  let prefs: PlotGridSettings = DEFAULT_PLOT_GRID;
  let spec: ProjectSpec = novel;
  let map: StoryMapFile = file;
  const hashes = new Map(notes.flatMap((n) => n.scenes.map((s) => [`${n.path}#${s.title}`, textHash(s.prose)] as const)));
  const src: PlotGridSource = {
    projects: () => [spec], activeProject: () => spec,
    build: async () => buildPlotGrid(buildStoryGraph("Novel", notes, map), buildThreads(buildStoryGraph("Novel", notes, map), map, parseStoryThreads(md), new Set(), undefined, (p) => notes.find((n) => n.path === p)?.text), { pov: spec.plotPov, time: spec.plotTime, theme: spec.plotTheme }, { readings: map.grid, hashes }),
    readColumn: async (_p, column, signal, onProgress) => {
      calls.writes.push(`read ${column.heading.name}`);
      const targets = column.cells.map((c, i) => [c, i] as const).filter(([c]) => !c.stop);
      let n = 0;
      for (const [, i] of targets) {
        if (signal.aborted) break;
        const scene = column.cells.length ? grid(md).rows[i]!.scene : { path: "", title: "", line: 0 };
        onProgress({ done: ++n, total: targets.length, scene, skipped: false });
        const reading: GridReading = { scene, hash: hashes.get(`${scene.path}#${scene.title}`) ?? "", column: column.heading.heading, model: "test", rulebook: "t", kind: "reading", text: `the model read ${scene.title}`, role: null, evidence: "Lisbon", state: "open" };
        map = putGridReading(map, reading);
        await new Promise((r) => setTimeout(r, 5));
      }
      return n;
    },
    checkColumn: async (_p, column) => { calls.writes.push(`check ${column.heading.name}`); return 0; },
    dismissReading: async (_p, scene, column) => { calls.writes.push(`dismiss ${column} at ${scene.title}`); map = { ...map, grid: map.grid.map((r) => (r.scene.title === scene.title && r.column === column ? { ...r, state: "dismissed" } : r)) }; },
    dismissColumnReadings: async () => undefined,
    modelLabel: () => "Ollama · test",
    renameThread: async (_p, from, to) => { calls.writes.push(`rename ${from} → ${to}`); md = renameThread(md, from, to); },
    setProjectKey: async (_p, key, value) => { calls.writes.push(`${key}=${value ?? ""}`); const k = key === "plot-pov" ? "plotPov" : key === "plot-time" ? "plotTime" : "plotTheme"; spec = { ...spec, [k]: value ?? undefined }; },
    gridSettings: () => prefs,
    updateGridSettings: (next) => { prefs = next; },
    sentences: async (_p, scene) => { calls.writes.push(`sentences ${scene.title}`); return scene.title === "Camp" ? ["Marta woke before Ilse at the gate of Lisbon."] : scene.title === "Return" ? ["Marta came back to Lisbon.", "The gate of Lisbon was shut."] : []; },
    snapshot: async () => { calls.writes.push("snapshot"); return "Novel/Plot grid · 2026-09-13.md"; },
    openNote: (p) => { calls.opened.push(p); }, reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); }, jumpTo: (to) => { calls.jumps.push(to); },
    settings: () => DEFAULT_STORY_MAP,
    threadsNotePath: () => "Novel/Story threads.md",
    addStops: async (_p, thread, stops) => { calls.writes.push(`add ${thread}: ${stops.map((s) => `${s.link} ${s.role ?? ""} ${s.quote ?? ""} ${s.note}`).join(" | ")}`); md = appendThreadItems(md, thread, stops); },
    removeFromThread: async (_p, thread, link) => { calls.writes.push(`remove ${thread}: ${link}`); md = removeThreadItem(md, thread, link); },
    addThread: async (_p, name) => { calls.writes.push(`thread ${name}`); md = addThread(md, name); },
    removeThread: async (_p, name) => { calls.writes.push(`delete ${name}`); md = removeThread(md, name); },
    ...overrides,
  };
  return { v: new PlotGridView(new WorkspaceLeaf(), src), calls, note: () => md, prefs: () => prefs };
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
    expect([...el.querySelectorAll(".czm-pg-note-total")].map((s) => s.textContent)).toEqual(["3 scenes · 14 words · 3 of the cast", "1 scene · 11 words · 2 of the cast"]);
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

  it("folds a group from its pill, hides and shows a column, and remembers both in the settings", async () => {
    const { v, prefs } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect([...el.querySelectorAll(".czm-pg-pill")].map((p) => p.textContent)).toEqual(["Arcs1", "Subplots1", "Cast3 folded"]);
    (el.querySelector(".czm-pg-pill") as HTMLElement).click();
    expect(prefs().folded.arc).toBe(true);
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["The gate"]);
    expect(el.querySelector(".czm-pg-pill")?.textContent).toBe("Arcs1 folded");
    v.run("fold-arcs");
    expect(prefs().folded.arc).toBe(false);
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="0"]')!.click();
    v.run("hide-column");
    expect(prefs().hidden["Novel/"]).toEqual(["Subplot: The gate"]);
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["Ilse"]);
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toContain("1 hidden");
    (el.querySelector(".czm-shell-reset") as HTMLElement).click();
    expect(prefs().hidden["Novel/"]).toEqual([]);
    expect(el.querySelectorAll(".czm-pg-col-thread")).toHaveLength(2);
    v.run("toggle-unmoved");
    expect(prefs().unmoved).toBe(false);
    expect(el.querySelector(".czm-pg-cell.is-unmoved")).toBeNull();
  });

  it("gives a column a job in the project note, draws POV and Time in the derived block, and renames a heading", async () => {
    const { v, calls, note } = open({}, threadsNote + "\n## When\n- [[One#Camp]] — day 1\n\n## Eyes\n- [[One#Camp]] — Marta Kovács\n- [[One#Creek]] — Ilse\n");
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-pg-theme-label")?.textContent).toContain("No main theme yet");
    // The header's ⋯ opens the column menu; a job row writes the key and the rebuild reads it back.
    const eyes = [...el.querySelectorAll(".czm-pg-col-thread")].find((th) => th.querySelector(".czm-pg-col-title")?.textContent === "Eyes")!;
    (eyes.querySelector(".czm-pg-col-more") as HTMLElement).click();
    expect(Menu.last!.items.map((i) => i.title.replace(/Plot grid:.*$/, ""))).toEqual(["Rename…", "Kind: arc", "Kind: theme", "Kind: subplot", "Kind: free thread", "Use as POV", "Use as Time", "Use as Main theme", "Read this column with the model…", "Check this column against the draft…", "Dismiss all readings", "Hide column", "Delete column…"]);
    Menu.last!.items.find((i) => i.title === "Use as POV")!.cb();
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.writes).toContain("plot-pov=Eyes");
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["Eyes", "Ilse", "The gate", "When"]);
    expect(el.querySelector(".czm-pg-special-pov .czm-pg-col-count")?.textContent).toBe("pov · 2 of 4");
    expect(el.querySelector('.czm-pg-scene[data-row="0"] .czm-pg-scene-head')?.classList.contains("has-pov")).toBe(true);
    expect(el.querySelector('.czm-pg-cell[data-col="0"][data-row="0"] .czm-pg-pov-dot')).not.toBeNull();
    // Time and the main theme by the side column's job buttons; the eyebrow names the theme.
    const when = [...el.querySelectorAll(".czm-pg-col-thread")].find((th) => th.querySelector(".czm-pg-col-title")?.textContent === "When")!;
    (when.querySelector(".czm-pg-col-name") as HTMLElement).click();
    (el.querySelector(".czm-pg-job[aria-pressed]") as HTMLElement).parentElement!.querySelectorAll<HTMLElement>(".czm-pg-job")[1]!.click();
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.writes).toContain("plot-time=When");
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["When", "Eyes", "Ilse", "The gate"]);
    const input = el.querySelector(".czm-pg-new-name") as HTMLInputElement;
    input.value = "Theme: Debt";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector(".czm-pg-job[aria-pressed]") as HTMLElement).parentElement!.querySelectorAll<HTMLElement>(".czm-pg-job")[2]!.click();
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.writes).toContain("plot-theme=Theme: Debt");
    expect(el.querySelector(".czm-pg-theme-name")?.textContent).toBe("Debt");
    // Rename from the side column keeps the job; the kind select rewrites the prefix.
    const rename = el.querySelector(".czm-pg-rename") as HTMLInputElement;
    rename.value = "Theme: What we owe";
    rename.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain("## Theme: What we owe");
    expect(calls.writes).toContain("plot-theme=Theme: What we owe");
    const kind = el.querySelector(".czm-pg-kind-select") as HTMLSelectElement;
    kind.value = "subplot"; kind.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain("## Subplot: What we owe");
  });

  it("audit view draws every cell by its state and the headers by their counts; n and p walk the broken anchors", async () => {
    const { v } = open();
    await v.onOpen();
    const el = v.contentEl;
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.click();
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
    expect(el.querySelector(".czm-pg")?.classList.contains("is-audit")).toBe(true);
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toBe("8 cells · 5 filled · 3 verified · 1 broken");
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-count")].map((s) => s.textContent)).toEqual(["2 of 4 · 2 ◆", "3 of 4 · 1 ◆ · 1 ◈"]);
    expect([...el.querySelectorAll('.czm-pg-cell[data-col="1"] .czm-pg-state-glyph')].map((g) => g.textContent)).toEqual(["◆", "◇", "◈"]);
    expect(el.querySelectorAll(".czm-pg-key-state")).toHaveLength(3);
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    expect(el.querySelector(".czm-pg-cell.is-selected")?.getAttribute("data-row")).toBe("3");
    expect(el.querySelector(".czm-pg-cell.is-selected")?.classList.contains("is-broken")).toBe(true);
    el.querySelector<HTMLElement>(".czm-pg-cell.is-selected")!.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    expect(el.querySelector(".czm-pg-cell.is-selected")?.getAttribute("data-row")).toBe("3");
    v.run("audit");
    expect(el.querySelector(".czm-pg")?.classList.contains("is-audit")).toBe(false);
  });

  it('" opens the anchor picker with the near matches of a lost quote first, and Enter re-anchors the stop', async () => {
    const { v, calls, note } = open();
    await v.onOpen();
    const el = v.contentEl;
    const broken = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="3"]')!;
    broken.click();
    broken.dispatchEvent(new KeyboardEvent("keydown", { key: '"', bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toContain("sentences Return");
    const rows = [...el.querySelectorAll(".czm-pg-picker-row")];
    expect(rows.map((r) => r.querySelector(".czm-pg-picker-text")?.textContent)).toEqual(["The gate of Lisbon was shut.", "Marta came back to Lisbon."]);
    expect(rows[0]!.classList.contains("is-near")).toBe(true);
    rows[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain('- [[Two#Return]] — payoff: "The gate of Lisbon was shut." broken anchor');
    expect(el.querySelector('.czm-pg-cell[data-col="1"][data-row="3"]')?.classList.contains("is-verified")).toBe(true);
    // An outline scene has nothing to pick from, and says so.
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="2"]')!.click();
    v.run("anchor");
    await new Promise((r) => setTimeout(r, 20));
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("No prose under this heading yet");
  });

  it("snapshots the grid and says where it wrote", async () => {
    const { v, calls } = open();
    await v.onOpen();
    v.run("snapshot");
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toContain("snapshot");
    expect(v.contentEl.querySelector(".czm-map-status")?.textContent).toBe("Wrote Plot grid · 2026-09-13.mdOpen");
    (v.contentEl.querySelector(".czm-status-action") as HTMLElement).click();
    expect(calls.opened).toEqual(["Novel/Plot grid · 2026-09-13.md"]);
  });

  it("a reading is a note in the empty cell, the placeholder while typing, and never the text the writer saves", async () => {
    const { v, calls, note } = open();
    await v.onOpen();
    const el = v.contentEl;
    // Read the gate column: the model leaves readings in its empty cell; the state line counts them.
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="0"]')!.click();
    v.run("read-column");
    await new Promise((r) => setTimeout(r, 60));
    expect(calls.writes).toContain("read The gate");
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toContain("1 reading awaiting you");
    const cell = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="1"]')!;
    expect(cell.classList.contains("has-reading")).toBe(true);
    expect(cell.querySelector(".czm-pg-reading-glyph")).not.toBeNull();
    expect(cell.querySelector(".czm-pg-cell-text")).toBeNull();
    // Selecting it shows the reading in the side column, with the quote and the model.
    cell.click();
    expect(el.querySelector(".czm-pg-reading-text")?.textContent).toBe("the model read Creek");
    expect(el.querySelector(".czm-pg-reading-quote")?.textContent).toBe("“Lisbon”");
    // Editing: the reading is the placeholder, not the value.
    cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const field = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    expect(field.value).toBe("");
    expect(field.placeholder).toBe("the model read Creek");
    field.value = "Ilse washes her eyes in it";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain("- [[One#Creek]] — Ilse washes her eyes in it");
    expect(note()).not.toContain("the model read");
    // Writing the cell answered the reading; the walk finds nothing left.
    expect(el.querySelector(".czm-shell-state-text")?.textContent).not.toContain("awaiting");
    expect(el.querySelector('.czm-pg-cell[data-col="1"][data-row="1"]')?.classList.contains("has-reading")).toBe(false);
  });

  it("n walks to a reading, x dismisses it, and Stop ends a pass with what landed kept", async () => {
    const { v, calls } = open();
    await v.onOpen();
    const el = v.contentEl;
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.click();
    v.run("read-column");
    await new Promise((r) => setTimeout(r, 60));
    expect(calls.writes).toContain("read Ilse");
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    const found = el.querySelector(".czm-pg-cell.is-selected")!;
    expect(found.classList.contains("has-reading")).toBe(true);
    found.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes.some((w) => w.startsWith("dismiss Arc: [[Ilse]] at"))).toBe(true);
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Reading dismissed");
    // A pass in flight shows Stop in the head; Stop aborts it.
    const p = v.run("read-all");
    expect(el.querySelector(".czm-pg-stop")).not.toBeNull();
    (el.querySelector(".czm-pg-stop") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 80));
    void p;
    expect(el.querySelector(".czm-pg-stop")).toBeNull();
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Stopped after");
  });

  it("lists its keys behind ? and closes the list again", async () => {
    const { v } = open();
    await v.onOpen();
    const el = v.contentEl;
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.click();
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    expect(el.querySelector(".czm-pg-help")?.classList.contains("is-open")).toBe(true);
    expect(el.querySelectorAll(".czm-pg-help tr")).toHaveLength(12);
    (el.querySelector(".czm-writer-help-close") as HTMLElement).click();
    expect(el.querySelector(".czm-pg-help")?.classList.contains("is-open")).toBe(false);
  });

  it("reads a note's folder below the project as its act", () => {
    expect(actOf("Novel/Part one/One.md", "Novel/")).toBe("Part one");
    expect(actOf("Novel/One.md", "Novel/")).toBe("");
    expect(actOf("Elsewhere/A/B/c.md", "Novel/")).toBe("Elsewhere · A · B");
  });
});
