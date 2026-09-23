import { describe, it, expect } from "vitest";
import { Menu, WorkspaceLeaf } from "obsidian";
import { PLOT_GRID_VIEW_TYPE, PlotGridView, ROW_CHUNK, actOf, type PlotGridSource } from "../../../src/infrastructure/obsidian/views/PlotGridView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { buildPlotGrid } from "../../../src/domain/plot/PlotGrid";
import { buildThreads } from "../../../src/domain/threads/BuildThreads";
import { addThread, appendThreadItems, parseStoryThreads, removeThread, removeThreadItem, renameScaleWord, renameThread, setThreadScale, setThreadSummary } from "../../../src/domain/threads/StoryThreadsNote";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putGridReading, putReading, type GridReading, type StoryMapFile } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_PLOT_GRID, DEFAULT_STORY_MAP, type PlotGridSettings } from "../../../src/domain/settings/Settings";
import { parseOutline, serializeOutlineNote } from "../../../src/domain/plot/Outline";
import { relinkThreadItems } from "../../../src/domain/threads/StoryThreadsNote";
import { planScaffold } from "../../../src/domain/plot/Scaffold";
import { BUILT_IN_TEMPLATES } from "../../../src/domain/plot/BuiltInTemplates";
import { planApply, serializeTemplate } from "../../../src/domain/plot/Templates";
import { appendOutline } from "../../../src/domain/plot/Outline";
import { parseSnapshot, snapshotNote } from "../../../src/domain/plot/Snapshot";

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

function open(overrides: Partial<PlotGridSource> = {}, threads = threadsNote, setup: { notes?: ProjectNote[]; outline?: string; snapshots?: { path: string; day: string; label: string }[]; snapshotText?: Record<string, string> } = {}) {
  const calls = { opened: [] as string[], revealed: [] as string[], jumps: [] as string[], writes: [] as string[] };
  // The threads note as a string the writes edit, so the grid reads back what it wrote; the outline note the same.
  let md = threads;
  let outline = setup.outline ?? "";
  const snaps = setup.snapshots ?? [];
  const snapshotText = setup.snapshotText ?? {};
  const notes = setup.notes ?? allNotes;
  let prefs: PlotGridSettings = DEFAULT_PLOT_GRID;
  let spec: ProjectSpec = novel;
  let map: StoryMapFile = file;
  const hashes = new Map(notes.flatMap((n) => n.scenes.map((s) => [`${n.path}#${s.title}`, textHash(s.prose)] as const)));
  const src: PlotGridSource = {
    projects: () => [spec], activeProject: () => spec,
    build: async () => buildPlotGrid(buildStoryGraph("Novel", notes, map), buildThreads(buildStoryGraph("Novel", notes, map), map, parseStoryThreads(md), new Set(), undefined, (p) => notes.find((n) => n.path === p)?.text), { pov: spec.plotPov, time: spec.plotTime, theme: spec.plotTheme, beats: spec.plotBeats, order: spec.plotOrder }, { readings: map.grid, hashes }, outline ? { path: "Novel/Outline.md", outline: parseOutline(outline) } : null),
    outlinePath: () => "Novel/Outline.md",
    updateOutline: async (_p, change) => { const before = outline; outline = change(before.trim() ? before : serializeOutlineNote("Novel")); calls.writes.push(`outline ${outline === before ? "unchanged" : "written"}`); return { before, after: outline }; },
    relinkStops: async (_p, from, to) => { calls.writes.push(`relink ${from} → ${to}`); const r = relinkThreadItems(md, from, to); md = r.markdown; return r.changed; },
    snapshots: async () => snaps,
    readSnapshot: async (path) => { calls.writes.push(`read ${path}`); return parseSnapshot(snapshotText[path] ?? ""); },
    templates: async () => BUILT_IN_TEMPLATES,
    templatesFolder: () => "Creative Writer/Templates",
    planTemplate: async (_p, template, choices, cast) => planApply(template, choices, { existing: parseStoryThreads(md).map((t) => t.name), cast }),
    applyTemplate: async (_p, plan) => {
      const before = { md, outline, spec };
      const added: string[] = [];
      for (const h of plan.headings) { const next = addThread(md, h); if (next !== md) added.push(h); md = next; }
      if (plan.structure) outline = appendOutline(outline.trim() ? outline : serializeOutlineNote("Novel"), plan.structure);
      spec = { ...spec, ...(plan.jobs.time ? { plotTime: plan.jobs.time } : {}), ...(plan.jobs.pov ? { plotPov: plan.jobs.pov } : {}), ...(plan.jobs.theme ? { plotTheme: plan.jobs.theme } : {}), ...(plan.jobs.beats ? { plotBeats: plan.jobs.beats } : {}) };
      calls.writes.push(`apply: ${added.join(" | ")}${plan.structure ? " +rows" : ""} jobs=${Object.keys(plan.jobs).join(",")}`);
      return { plan, added, beatStops: plan.structure && plan.jobs.beats ? plan.scenes : 0, undo: async () => { calls.writes.push("unapply"); md = before.md; outline = before.outline; spec = before.spec; } };
    },
    saveTemplate: async (_p, name, parts) => { calls.writes.push(`save ${name} ${parts.columns ? "columns" : ""} ${parts.rows ? "rows" : ""}`.trim()); return `Creative Writer/Templates/${name}.md`; },
    scaffoldPreview: async (_p, shape) => (outline ? planScaffold(parseOutline(outline), { folder: "Novel/", shape, outlineName: "Outline", existing: () => null }) : null),
    scaffold: async (_p, shape) => {
      const plan = planScaffold(parseOutline(outline), { folder: "Novel/", shape, outlineName: "Outline", existing: () => null });
      calls.writes.push(`build ${shape}: ${plan.files.map((f) => f.path).join(", ")}`);
      const before = { md, outline };
      for (const r of plan.relinks) md = relinkThreadItems(md, r.from, r.to).markdown;
      outline = `---\ncreative-writer-outline-built: 2026-09-22\n---\n${outline.replace(/^---[\s\S]*?---\n/, "")}`;
      return { plan, relinked: plan.relinks.length, day: "2026-09-22", undo: async () => { calls.writes.push("unbuild"); md = before.md; outline = before.outline; } };
    },
    readColumn: async (_p, column, signal, onProgress) => {
      calls.writes.push(`read ${column.heading.name}`);
      const targets = column.cells.map((c, i) => [c, i] as const).filter(([c]) => !c.stop);
      let n = 0;
      for (const [, i] of targets) {
        if (signal.aborted) break;
        const scene = column.cells.length ? grid(md).rows[i]!.scene : { path: "", title: "", line: 0 };
        onProgress({ done: ++n, total: targets.length, scene, skipped: false });
        const reading: GridReading = { scene, hash: hashes.get(`${scene.path}#${scene.title}`) ?? "", column: column.heading.heading, model: "test", rulebook: "t", kind: "reading", text: `the model read ${scene.title}`, role: null, keyword: column.scale ? column.scale[column.scale.length - 1]! : null, evidence: "Lisbon", state: "open" };
        map = putGridReading(map, reading);
        await new Promise((r) => setTimeout(r, 5));
      }
      return n;
    },
    checkColumn: async (_p, column) => { calls.writes.push(`check ${column.heading.name}`); return 0; },
    dismissReading: async (_p, scene, column) => { calls.writes.push(`dismiss ${column} at ${scene.title}`); map = { ...map, grid: map.grid.map((r) => (r.scene.title === scene.title && r.column === column ? { ...r, state: "dismissed" } : r)) }; },
    dismissColumnReadings: async () => undefined,
    modelLabel: () => "Ollama · test",
    proposeColumns: async () => { calls.writes.push("propose"); return calls.writes.includes("readProject") || !overrides.readProject ? { scenesRead: 3, proposals: [{ kind: "arc", name: "Marta Kovács", why: "The elder sister.", scenes: ["Camp", "Return"], heading: "Arc: [[Marta Kovács]]", existing: false }, { kind: "subplot", name: "The gate", why: "", scenes: ["Camp"], heading: "Subplot: The gate", existing: true }, { kind: "theme", name: "Salt", why: "Pressure.", scenes: ["Creek"], heading: "Theme: Salt", existing: false }] } : { needsReading: true, canRead: true }; },
    readProject: async () => { calls.writes.push("readProject"); return 3; },
    renameThread: async (_p, from, to) => { calls.writes.push(`rename ${from} → ${to}`); md = renameThread(md, from, to); },
    setScale: async (_p, thread, words) => { calls.writes.push(`scale ${thread}: ${words ? words.join(", ") : "none"}`); md = setThreadScale(md, thread, words); },
    setSummary: async (_p, thread, text) => { calls.writes.push(`summary ${thread}: ${text ?? "none"}`); md = setThreadSummary(md, thread, text); },
    renameScaleWord: async (_p, thread, from, to) => { calls.writes.push(`reword ${thread}: ${from} → ${to}`); const r = renameScaleWord(md, thread, from, to); md = r.markdown; return r.changed; },
    setProjectKey: async (_p, key, value) => { calls.writes.push(`${key}=${value ?? ""}`); if (key === "plot-order") { spec = { ...spec, plotOrder: value ? value.split(",").map((x) => x.trim()) : undefined }; return; } const k = key === "plot-pov" ? "plotPov" : key === "plot-time" ? "plotTime" : key === "plot-beats" ? "plotBeats" : "plotTheme"; spec = { ...spec, [k]: value ?? undefined }; },
    gridSettings: () => prefs,
    updateGridSettings: (next) => { prefs = next; },
    sentences: async (_p, scene) => { calls.writes.push(`sentences ${scene.title}`); return scene.title === "Camp" ? ["Marta woke before Ilse at the gate of Lisbon."] : scene.title === "Return" ? ["Marta came back to Lisbon.", "The gate of Lisbon was shut."] : []; },
    snapshot: async () => { calls.writes.push("snapshot"); return "Novel/Plot grid · 2026-09-13.md"; },
    exportGrid: async () => { calls.writes.push("export"); return "Novel/Plot grid.md"; },
    openNote: (p) => { calls.opened.push(p); }, reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); }, jumpTo: (to) => { calls.jumps.push(to); },
    settings: () => DEFAULT_STORY_MAP,
    threadsNotePath: () => "Novel/Story threads.md",
    addStops: async (_p, thread, stops) => { calls.writes.push(`add ${thread}: ${stops.map((s) => `${s.link} ${s.role ?? ""} ${s.quote ?? ""} ${s.note}`).join(" | ")}`); md = appendThreadItems(md, thread, stops); },
    removeFromThread: async (_p, thread, link) => { calls.writes.push(`remove ${thread}: ${link}`); md = removeThreadItem(md, thread, link); },
    addThread: async (_p, name) => { calls.writes.push(`thread ${name}`); md = addThread(md, name); },
    removeThread: async (_p, name) => { calls.writes.push(`delete ${name}`); md = removeThread(md, name); },
    ...overrides,
  };
  return { v: new PlotGridView(new WorkspaceLeaf(), src), calls, note: () => md, prefs: () => prefs, outline: () => outline };
}
const allNotes = notes;
const tick = () => new Promise((r) => setTimeout(r, 20));

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
    const castHead = el.querySelector(".czm-pg-group-cast .czm-pg-cast-toggle") as HTMLElement;
    expect(castHead.querySelector(".czm-pg-group-caret")?.getAttribute("data-icon")).toBe("chevron-right");
    castHead.click();
    expect(el.querySelector(".czm-pg-group-cast .czm-pg-group-caret")?.getAttribute("data-icon")).toBe("chevron-down");
    expect(el.querySelector(".czm-pg-group-cast")?.textContent).toBe("Cast3");
    expect(el.querySelector("thead th.czm-pg-fold-cast")).toBeNull();
    expect(el.querySelector(".czm-pg-group-cast")?.getAttribute("colspan")).toBe("3");
    expect([...el.querySelectorAll("thead .czm-pg-cast-name span")].map((s) => s.textContent)).toEqual(["Ilse", "Marta Kovács", "Lisbon"]);
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
    const del = el.querySelector<HTMLElement>('.czm-pg-col-delete[aria-label^="Delete column Ilse"]')!;
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

  it("folds a group from its header caret into one narrow column with a line down the rows, hides and shows a column, and remembers both in the settings", async () => {
    const { v, prefs } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect([...el.querySelectorAll(".czm-pg-groups .czm-pg-group")].map((g) => [g.className.replace(/\s*is-folded/, "").split(" ")[1], g.getAttribute("colspan"), g.textContent])).toEqual([["czm-pg-group-arc", "1", "Arcs1"], ["czm-pg-group-subplot", "1", "Subplots1"], ["czm-pg-group-cast", "1", ""]]);
    expect(el.querySelector("thead th.czm-pg-fold-cast .czm-pg-fold-name")?.textContent).toBe("Cast · 3");
    expect(el.querySelector(".czm-pg-pill")).toBeNull();
    const arcs = el.querySelector(".czm-pg-group-arc .czm-pg-group-toggle") as HTMLElement;
    expect(arcs.getAttribute("aria-expanded")).toBe("true");
    expect(arcs.querySelector(".czm-pg-group-caret")?.getAttribute("data-icon")).toBe("chevron-down");
    arcs.click();
    expect(prefs().folded.arc).toBe(true);
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent)).toEqual(["The gate"]);
    const foldedHead = el.querySelector(".czm-pg-group-arc.is-folded .czm-pg-group-toggle")!;
    expect(foldedHead.querySelector(".czm-pg-group-caret")?.getAttribute("data-icon")).toBe("chevron-right");
    expect(el.querySelector("thead th.czm-pg-fold.czm-pg-kind-arc .czm-pg-fold-name")?.textContent).toBe("Arcs · 1");
    expect(el.querySelectorAll("tbody .czm-pg-scene .czm-pg-fold-td.czm-pg-kind-arc")).toHaveLength(4);
    expect([...el.querySelectorAll(".czm-pg-groups .czm-pg-group")].map((g) => g.textContent)).toEqual(["", "Subplots1", ""]);
    expect(el.querySelector(".czm-pg-group-arc.is-folded .czm-pg-group-toggle")?.getAttribute("aria-label")).toBe("Arcs: 1, folded, click to show");
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toContain("1 column · 1 in 1 folded group");
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
    expect(Menu.last!.items.map((i) => i.title.replace(/Plot grid:.*$/, ""))).toEqual(["Rename…", "Add a summary…", "Move the threads left", "Move the threads right", "Kind: arc", "Kind: theme", "Kind: subplot", "Kind: free thread", "Use as POV", "Use as Time", "Use as Plot point", "Use as Main theme", "Read this column with the model…", "Check this column against the draft…", "Dismiss all readings", "Set scale…", "Gauge this column", "Freeze up to here", "Hide column", "Delete column…"]);
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
    (el.querySelector(".czm-pg-job[aria-pressed]") as HTMLElement).parentElement!.querySelectorAll<HTMLElement>(".czm-pg-job")[3]!.click();
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

  it("proposes columns into the side column with a tick each, adds the ticked ones as headings, and undoes", async () => {
    const { v, calls, note } = open();
    await v.onOpen();
    const el = v.contentEl;
    v.run("propose-columns");
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toContain("propose");
    const rows = [...el.querySelectorAll(".czm-pg-proposal")];
    expect(rows.map((r) => r.querySelector(".czm-pg-proposal-name")?.textContent)).toEqual(["Marta Kovács", "The gate", "Salt"]);
    expect(rows[1]!.classList.contains("is-existing")).toBe(true);
    expect((rows[1]!.querySelector("input") as HTMLInputElement).disabled).toBe(true);
    expect(el.querySelector(".czm-pg-proposals-add")?.textContent).toBe("Add 2 columns");
    const salt = rows[2]!.querySelector("input") as HTMLInputElement;
    salt.checked = false; salt.dispatchEvent(new Event("change"));
    expect(el.querySelector(".czm-pg-proposals-add")?.textContent).toBe("Add 1 column");
    (el.querySelector(".czm-pg-proposals-add") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).toContain("## Arc: [[Marta Kovács]]");
    expect(note()).not.toContain("## Theme: Salt");
    expect(el.querySelector(".czm-pg-proposal")).toBeNull();
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("1 column written to Story threads.md: Marta Kovács");
    (el.querySelector(".czm-map-status button") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(note()).not.toContain("## Arc: [[Marta Kovács]]");
  });

  it("with nothing read yet, proposing offers to read the project first, then proposes", async () => {
    const { v, calls } = open({ readProject: async () => { calls.writes.push("readProject"); return 3; } });
    await v.onOpen();
    const el = v.contentEl;
    v.run("propose-columns");
    await new Promise((r) => setTimeout(r, 20));
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("no scene has been read");
    (el.querySelector(".czm-status-action") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 40));
    expect(calls.writes.filter((w) => w === "propose")).toHaveLength(2);
    expect(calls.writes).toContain("readProject");
    expect(el.querySelectorAll(".czm-pg-proposal")).toHaveLength(3);
  });

  it("draws a long manuscript a chunk at a time, and draws up to a cell the keyboard asks for", async () => {
    const chapters = Array.from({ length: 30 }, (_, c) => note(`Novel/Ch ${String(c + 1).padStart(2, "0")}.md`, Array.from({ length: 5 }, (_, i) => `# Scene ${c + 1}.${i + 1}\nMarta and Ilse walked on through the salt wind of Lisbon.\n`).join("\n")));
    const big = [notes[0]!, notes[1]!, notes[2]!, ...chapters];
    const { v } = open({ build: async () => buildPlotGrid(buildStoryGraph("Novel", big, file), buildThreads(buildStoryGraph("Novel", big, file), file, parseStoryThreads("## Subplot: Salt\n- [[Ch 30#Scene 30.5]] — the end\n"), new Set()), {}) });
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toContain("150 scenes");
    expect(el.querySelectorAll(".czm-pg-scene")).toHaveLength(ROW_CHUNK);
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.click();
    el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="0"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    v.run("next-issue");
    // Nothing is broken, so the selection stays; PageDown ten at a time reaches past the first chunk and draws it.
    for (let i = 0; i < 7; i++) el.querySelector<HTMLElement>(".czm-pg-cell.is-selected")!.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true }));
    expect(el.querySelector(".czm-pg-cell.is-selected")?.getAttribute("data-row")).toBe("70");
    expect(el.querySelectorAll(".czm-pg-scene").length).toBeGreaterThanOrEqual(71);
  });

  it("exports the grid as an undated note", async () => {
    const { v, calls } = open();
    await v.onOpen();
    v.run("export");
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toContain("export");
    expect(v.contentEl.querySelector(".czm-map-status")?.textContent).toBe("Wrote Plot grid.mdOpen");
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

  describe("the outline: rows before the chapters exist", () => {
    const cast = notes.slice(0, 3);
    const planned = `# Act I\n## The perfect record\n### 1 Gainesville courtroom\n<!-- Kevin wins a case he knows he should lose -->\n### 4 The recess bathroom\n## The offer\n### 12 The New York invitation\n`;

    it("starts the outline from the empty state: New scene writes Outline.md and opens the row's name for typing", async () => {
      const { v, calls, outline } = open({}, "## Subplot: The Cullen trial\n", { notes: cast });
      await v.onOpen();
      const el = v.contentEl;
      expect(el.textContent).toContain("No scenes yet");
      expect(el.textContent).toContain("No outline yet");
      (el.querySelector(".czm-pg-fix-scene") as HTMLElement).click();
      await tick();
      expect(outline()).toMatch(/^---\ncreative-writer: false\ncreative-writer-outline: 1\n---\n/);
      expect(outline()).toMatch(/## Chapter 1\n### New scene\n$/);
      expect(el.querySelector(".czm-pg-note.is-outline .czm-pg-group-name")?.textContent).toBe("Chapter 1");
      expect(el.querySelector(".czm-pg-note.is-outline .czm-pg-note-total")?.textContent).toBe("1 scene · outline · no note yet");
      expect(el.querySelector(".czm-map-status")?.textContent).toContain("New scene written to Outline.md");
      // The new row opens for its name; Enter saves it, and the threads note is relinked so a stop would follow.
      const field = el.querySelector(".czm-pg-row-rename") as HTMLInputElement;
      expect(field?.value).toBe("New scene");
      field.value = "1 Gainesville courtroom";
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await tick();
      expect(outline()).toContain("### 1 Gainesville courtroom");
      expect(calls.writes).toContain("relink Outline#New scene → Outline#1 Gainesville courtroom");
      expect(el.querySelector(".czm-pg-scene.is-outline .czm-map-row-name")?.textContent).toBe("1 Gainesville courtroom");
      expect(el.querySelector(".czm-map-section-pg-rows .czm-map-section-value")?.textContent).toContain("1 planned scene");
    });

    it("groups planned rows under their chapter and act, shows the logline in the Plot column, and a stop typed there links the outline", async () => {
      const { v, note } = open({}, "## Subplot: The Cullen trial\n", { notes: cast, outline: planned });
      await v.onOpen();
      const el = v.contentEl;
      expect([...el.querySelectorAll(".czm-pg-act th")].map((th) => th.textContent)).toEqual(["Act Ioutline · no folder yet"]);
      expect([...el.querySelectorAll(".czm-pg-note .czm-pg-group-name")].map((x) => x.textContent)).toEqual(["The perfect record", "The offer"]);
      expect([...el.querySelectorAll(".czm-pg-scene .czm-map-row-name")].map((x) => x.textContent)).toEqual(["1 Gainesville courtroom", "4 The recess bathroom", "12 The New York invitation"]);
      expect(el.querySelector(".czm-pg-plot.is-logline")?.textContent).toBe("Kevin wins a case he knows he should lose");
      const cell = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="1"]')!;
      cell.click(); cell.click();
      const f = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
      f.value = "the file lands on his desk";
      f.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await tick();
      expect(note()).toContain("- [[Outline#4 The recess bathroom]] — the file lands on his desk");
      expect(el.querySelector('.czm-pg-cell[data-col="0"][data-row="1"]')?.classList.contains("is-plan")).toBe(true);
    });

    it("the row menu adds a scene below, moves, deletes, and every write has an undo that puts the note back whole", async () => {
      const { v, outline } = open({}, "", { notes: cast, outline: planned });
      await v.onOpen();
      const el = v.contentEl;
      const titles = () => Menu.last!.items.map((m) => m.title.replace(/Plot grid:.*$/, ""));
      const pick = (title: string) => Menu.last!.items.find((m) => m.title.startsWith(title))!.cb();
      const rowMenu = (i: number) => { (el.querySelector(`.czm-pg-scene[data-row="${i}"] .czm-pg-row-more`) as HTMLElement).click(); return titles(); };
      expect(rowMenu(0)).toEqual(["New scene below", "New chapter below", "New act", "Rename…", "Logline…", "Move up", "Move down", "Delete scene"]);
      pick("Move down"); await tick();
      expect(parseOutline(outline()).acts[0]!.chapters[0]!.scenes.map((s) => s.title)).toEqual(["4 The recess bathroom", "1 Gainesville courtroom"]);
      (el.querySelector(".czm-map-status button") as HTMLElement).click(); await tick();
      expect(outline()).toBe(planned);
      rowMenu(2); pick("Delete scene"); await tick();
      expect(parseOutline(outline()).scenes).toBe(2);
      expect(el.querySelector(".czm-map-status")?.textContent).toContain("Deleted “12 The New York invitation”");
      (el.querySelector(".czm-map-status button") as HTMLElement).click(); await tick();
      expect(outline()).toBe(planned);
      rowMenu(1); pick("New scene below"); await tick();
      expect(parseOutline(outline()).acts[0]!.chapters[0]!.scenes.map((s) => s.title)).toEqual(["1 Gainesville courtroom", "4 The recess bathroom", "New scene"]);
      (el.querySelector(".czm-pg-row-rename") as HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      rowMenu(0); pick("New chapter below"); await tick();
      expect(parseOutline(outline()).acts[0]!.chapters.map((c) => c.title)).toEqual(["The perfect record", "New chapter", "The offer"]);
      (el.querySelector(".czm-pg-row-rename") as HTMLInputElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      // A chapter's own menu, from its header row.
      (el.querySelectorAll(".czm-pg-note .czm-pg-row-more")[1] as HTMLElement).click();
      expect(titles()).toEqual(["New chapter below", "Rename chapter…", "Move chapter up", "Move chapter down", "Delete chapter and its scenes"]);
      pick("Delete chapter and its scenes"); await tick();
      expect(parseOutline(outline()).acts[0]!.chapters.map((c) => c.title)).toEqual(["The perfect record", "The offer"]);
    });

    it("writes the logline as a comment under the heading and reads it back into the Plot column", async () => {
      const { v, outline } = open({}, "", { notes: cast, outline: planned });
      await v.onOpen();
      const el = v.contentEl;
      const plot = el.querySelectorAll<HTMLElement>(".czm-pg-plot.is-logline")[1]!;
      plot.click();
      const f = el.querySelector(".czm-pg-logline-field") as HTMLTextAreaElement;
      f.value = "Kevin sees the truth on Gettys' face -- and goes on";
      f.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await tick();
      expect(outline()).toContain("### 4 The recess bathroom\n<!-- Kevin sees the truth on Gettys' face – and goes on -->");
      expect(el.querySelectorAll(".czm-pg-plot.is-logline")[1]!.textContent).toBe("Kevin sees the truth on Gettys' face – and goes on");
    });

    it("the build sheet previews the tree, offers the shape, builds with undo, and reports what it wrote", async () => {
      const { v, calls, note, outline } = open({}, "## Subplot: The Cullen trial\n- [[Outline#1 Gainesville courtroom]] — the file lands\n", { notes: cast, outline: planned });
      await v.onOpen();
      const el = v.contentEl;
      (el.querySelector(".czm-pg-outline-build") as HTMLElement).click();
      await tick();
      const sheet = el.querySelector(".czm-map-section-pg-build")!;
      expect(sheet.querySelector(".czm-pg-build-tree")?.textContent).toBe("Act I/\n  The perfect record.md  story-order 1\n    ## 1 Gainesville courtroom\n    ## 4 The recess bathroom\n  The offer.md  story-order 2\n    ## 12 The New York invitation");
      expect(sheet.textContent).toContain("create 2 notes in 1 folder");
      const choose = (value: string) => { const r = el.querySelector(`.czm-map-section-pg-build input[value="${value}"]`) as HTMLInputElement; r.checked = true; r.dispatchEvent(new Event("change")); };
      choose("one-note");
      await tick();
      expect(el.querySelector(".czm-map-section-pg-build .czm-pg-build-tree")?.textContent).toContain("Draft.md  story-order 1");
      choose("chapters");
      await tick();
      (el.querySelector(".czm-pg-build-go") as HTMLButtonElement).click();
      await tick();
      expect(calls.writes.at(-1)).toBe("build chapters: Novel/Act I/The perfect record.md, Novel/Act I/The offer.md");
      expect(note()).toContain("- [[The perfect record#1 Gainesville courtroom]] — the file lands");
      expect(el.querySelector(".czm-map-status")?.textContent).toContain("Built 2 notes in 1 folder, 3 scenes, 3 stops relinked");
      expect(el.querySelector(".czm-map-section-pg-build")).toBeNull();
      expect(el.querySelector(".czm-pg-outline")?.textContent).toContain("Built on 2026-09-22");
      (el.querySelector(".czm-map-status button") as HTMLElement).click();
      await tick();
      expect(calls.writes.at(-1)).toBe("unbuild");
      expect(outline()).toBe(planned);
      expect(el.querySelectorAll(".czm-pg-scene")).toHaveLength(3);
    });

    it("a built outline draws no rows and the Rows section says so", async () => {
      const { v } = open({}, "", { notes: cast, outline: `---\ncreative-writer-outline-built: 2026-09-22\n---\n${planned}` });
      await v.onOpen();
      expect(v.contentEl.querySelectorAll(".czm-pg-scene")).toHaveLength(0);
      expect(v.contentEl.textContent).toContain("The outline was built on 2026-09-22");
      expect(v.contentEl.querySelector(".czm-pg-outline")?.textContent).toContain("Built on 2026-09-22, Outline.md kept");
    });
  });
});

describe("the frozen block", () => {
  it("puts the word count under the scene name, freezes Scene and Plot, and freezes further from a column's menu, remembered per project", async () => {
    const { v, prefs } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-pg-col-words")).toBeNull();
    expect(el.querySelector('.czm-pg-scene[data-row="0"] .czm-pg-scene-words')?.textContent).toBe("9 words");
    expect(el.querySelector('.czm-pg-scene[data-row="2"] .czm-pg-scene-words')).toBeNull(); // an outline row has no count
    expect([...el.querySelectorAll("thead tr:not(.czm-pg-groups) th.is-frozen")].map((t) => t.getAttribute("data-fcol"))).toEqual(["0", "1"]);
    expect(el.querySelector("thead th.czm-pg-col-plot")?.classList.contains("is-frozen-edge")).toBe(true);
    expect(el.querySelector('.czm-pg-scene[data-row="0"] .czm-pg-plot')?.classList.contains("is-frozen")).toBe(true);
    (el.querySelector(".czm-pg-col-thread .czm-pg-col-more") as HTMLElement).click();
    Menu.last!.items.find((i) => i.title.startsWith("Freeze up to here"))!.cb();
    expect(prefs().frozen).toEqual({ "Novel/": "Arc: [[Ilse]]" });
    expect([...el.querySelectorAll("thead tr:not(.czm-pg-groups) th.is-frozen")].map((t) => t.getAttribute("data-fcol"))).toEqual(["0", "1", "2"]);
    expect(el.querySelector('.czm-pg-scene[data-row="0"] .czm-pg-cell-td.is-frozen')?.getAttribute("data-fcol")).toBe("2");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Frozen up to “Ilse”");
    (el.querySelector(".czm-pg-col-thread .czm-pg-col-more") as HTMLElement).click();
    const item = Menu.last!.items.find((i) => i.title.startsWith("Freeze up to here"))!;
    expect(item.checked).toBe(true);
    item.cb();
    expect(prefs().frozen).toEqual({});
    expect([...el.querySelectorAll("thead tr:not(.czm-pg-groups) th.is-frozen")]).toHaveLength(2);
  });

  describe("templates", () => {
    const cast = notes.slice(0, 3);
    const settle = () => new Promise((r) => setTimeout(r, 40));

    it("offers a template from the empty state, previews Story analysis columns only with arcs bound, applies with jobs, and undoes", async () => {
      const { v, calls, note, outline } = open({}, "", { notes: cast });
      await v.onOpen();
      const el = v.contentEl;
      (el.querySelector(".czm-pg-fix-template") as HTMLElement).click();
      await settle();
      const sheet = el.querySelector(".czm-map-section-pg-template")!;
      expect([...sheet.querySelectorAll(".czm-pg-template-name")].map((x) => x.textContent)).toEqual(["Three acts", "Save the Cat", "Hero's journey", "An arc per character", "Story analysis"]);
      const pick = (i: number) => { const r = sheet.querySelectorAll<HTMLInputElement>('input[name="czm-pg-template"]')[i]!; r.checked = true; r.dispatchEvent(new Event("change")); };
      pick(4);
      await settle();
      const analysis = el.querySelector(".czm-map-section-pg-template")!;
      const parts = [...analysis.querySelectorAll<HTMLInputElement>(".czm-pg-template-part input")];
      expect(parts.map((p) => [p.disabled, p.checked])).toEqual([[true, false], [false, true]]);
      const binds = analysis.querySelectorAll<HTMLSelectElement>(".czm-pg-template-bind");
      expect(binds).toHaveLength(2);
      expect([...binds[0]!.options].map((o) => o.text)).toEqual(["Character A (as written)", "Ilse", "Marta Kovács"]);
      binds[0]!.value = "Marta Kovács"; binds[0]!.dispatchEvent(new Event("change"));
      await settle();
      const rename = el.querySelector<HTMLInputElement>('.czm-pg-template-rename[aria-label="Theme: Major theme: name"]')!;
      rename.value = "Vanity"; rename.dispatchEvent(new Event("change"));
      await settle();
      const tree = el.querySelector(".czm-map-section-pg-template .czm-pg-build-tree")!.textContent!;
      expect(tree).toContain("## Arc: [[Marta Kovács]]");
      expect(tree).toContain("## Theme: Vanity");
      expect(tree).toContain("## Arc: Character B");
      expect(tree).toContain("Project note · time: Time · POV: POV · main theme: Theme: Vanity · plot point: Plot point");
      (el.querySelector(".czm-pg-template-go") as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 400));
      expect(calls.writes.at(-1)).toBe("apply: Chapter number | Time | POV | Plot point | Main plot | Theme: Vanity | Subplot: Subplot 1 | Subplot: Subplot 2 | Arc: [[Marta Kovács]] | Arc: Character B jobs=time,pov,theme,beats");
      expect(note()).toContain("## Theme: Vanity");
      expect(outline()).toBe("");
      expect(el.querySelector(".czm-map-status")?.textContent).toContain("Applied Story analysis: 10 columns, 4 jobs set");
      expect([...el.querySelectorAll(".czm-map-section-pg-columns .czm-pg-side-job")].map((x) => x.textContent)).toEqual(["time", "pov", "plot point", "main theme"]);
      expect(el.querySelector(".czm-map-section-pg-template")).toBeNull();
      (el.querySelector(".czm-map-status button") as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 400));
      expect(calls.writes.at(-1)).toBe("unapply");
      expect(note()).toBe("");
    });

    it("applies Save the Cat's rows and columns to an empty project, then saves the grid as a template", async () => {
      const { v, calls, outline, note } = open({}, "", { notes: cast });
      await v.onOpen();
      const el = v.contentEl;
      v.run("start-template");
      await settle();
      const sheet = el.querySelector(".czm-map-section-pg-template")!;
      const r = sheet.querySelectorAll<HTMLInputElement>('input[name="czm-pg-template"]')[1]!; r.checked = true; r.dispatchEvent(new Event("change"));
      await settle();
      expect(el.querySelector(".czm-map-section-pg-template .czm-pg-build-tree")!.textContent).toContain("Outline.md · 15 scenes");
      (el.querySelector(".czm-pg-template-go") as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 400));
      expect(parseOutline(outline()).scenes).toBe(15);
      expect(note()).toContain("## Subplot: B story");
      expect(el.querySelectorAll(".czm-pg-scene")).toHaveLength(15);
      expect([...el.querySelectorAll(".czm-pg-act th .czm-pg-group-name")].map((x) => x.textContent)).toEqual(["Act I", "Act II", "Act III"]);
      expect(el.querySelector(".czm-map-status")?.textContent).toContain("Applied Save the Cat: 15 scenes in 3 acts, 3 columns, 2 jobs set, 15 plot points filled");
      v.run("save-template");
      await settle();
      const field = el.querySelector(".czm-pg-save-name") as HTMLInputElement;
      field.value = "Noir in five moves"; field.dispatchEvent(new Event("input"));
      (el.querySelector(".czm-pg-save-go") as HTMLButtonElement).click();
      await settle();
      expect(calls.writes.at(-1)).toBe("save Noir in five moves columns rows");
      expect(el.querySelector(".czm-map-status")?.textContent).toContain("Saved Creative Writer/Templates/Noir in five moves.md");
    });
  });
});

describe("gaps", () => {
  it("counts findings into the state line and a side section, and Show selects the first cell of the finding", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => `# S${i + 1}\nMarta walked in.\n`).join("\n");
    const long = [note("Novel/Characters/Marta Kovács.md", ""), note("Novel/Characters/Ilse.md", ""), note("Novel/Part one/Long.md", ten)];
    const { v } = open({}, "## Arc: [[Marta Kovács]]\n- [[Long#S1]] — want: \"walked\" in\n\n## Theme: Salt\n- [[Long#S1]] — a\n", { notes: long });
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toContain("3 gaps");
    const texts = [...el.querySelectorAll(".czm-pg-gap-text")].map((x) => x.textContent);
    expect(texts).toEqual(["Marta Kovács has a stop in 1 of 10 written scenes.", "Marta Kovács is on the page in 9 scenes in a row, S2 to S10, and the arc has no stop there.", "Salt has a stop in 1 of 10 written scenes."]);
    (el.querySelectorAll(".czm-pg-gap-show")[1] as HTMLElement).click();
    expect(el.querySelector(".czm-pg-cell.is-selected")?.getAttribute("data-row")).toBe("1");
    expect(el.querySelector(".czm-pg-cell.is-selected")?.getAttribute("data-col")).toBe("0");
  });
});

describe("actions that put something in a folded section", () => {
  it("New column unfolds the Columns section and remembers it open", async () => {
    const { v, prefs } = open({ gridSettings: () => ({ ...DEFAULT_PLOT_GRID, sections: { "pg-column": false, "pg-columns": false } }) });
    let saved: PlotGridSettings | null = null;
    const src = (v as unknown as { source: PlotGridSource }).source;
    src.updateGridSettings = (next) => { saved = next; };
    await v.onOpen();
    const el = v.contentEl;
    v.run("new-column");
    expect(el.querySelector<HTMLDetailsElement>("details.czm-map-section-pg-columns")!.open).toBe(true);
    void prefs;
  });
});

describe("renaming a column in place", () => {
  it("Rename… puts the heading in a field in the column's own header; Enter writes it, Escape puts it back; a double click does the same", async () => {
    const { v, calls } = open();
    await v.onOpen();
    const el = v.contentEl;
    (el.querySelector(".czm-pg-col-thread .czm-pg-col-more") as HTMLElement).click();
    Menu.last!.items.find((i) => i.title === "Rename…")!.cb();
    const field = el.querySelector("thead th.czm-pg-col-thread .czm-pg-row-rename") as HTMLInputElement;
    expect(field?.value).toBe("Arc: [[Ilse]]");
    field.value = "Arc: [[Ilse]] · the sister";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toContain("rename Arc: [[Ilse]] → Arc: [[Ilse]] · the sister");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("is now “Arc: [[Ilse]] · the sister”");
    const name = el.querySelectorAll<HTMLElement>("thead th.czm-pg-col-thread .czm-pg-col-name")[1]!;
    name.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const again = el.querySelector("thead th.czm-pg-col-thread .czm-pg-row-rename") as HTMLInputElement;
    expect(again?.value).toBe("Subplot: The gate");
    again.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(el.querySelector(".czm-pg-row-rename")).toBeNull();
    expect(calls.writes.filter((w) => w.startsWith("rename"))).toHaveLength(1);
  });
});

describe("a column from a template", () => {
  it("lists the templates' columns grouped by template, leaves out what the grid has, spells arcs per character, and adds one with its job", async () => {
    const { v, calls, note } = open();
    await v.onOpen();
    await new Promise((r) => setTimeout(r, 30));
    const el = v.contentEl;
    const select = el.querySelector(".czm-pg-pick-column") as HTMLSelectElement;
    expect(select.options[0]!.text).toBe("From a template…");
    const groups: [string, string[]][] = [...select.querySelectorAll("optgroup")].map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.text)]);
    expect(groups.find((g) => g[0] === "Story analysis")![1]).toEqual(["Chapter number", "Time · time", "POV · POV", "Plot point · plot point", "Main plot", "Theme: Major theme · main theme", "Subplot: Subplot 1", "Subplot: Subplot 2", "Arc: [[Marta Kovács]]"]);
    expect(groups.find((g) => g[0] === "An arc per character")![1]).toEqual(["Arc: [[Marta Kovács]]", "Theme: Main theme · main theme"]);
    // Ilse's arc already exists, so no template offers it; the gate subplot is there too.
    expect(groups.flatMap((g) => g[1]).some((o) => o.includes("Ilse"))).toBe(false);
    select.value = "Story analysis\u0000Time";
    select.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 400));
    expect(note()).toContain("## Time");
    expect(calls.writes).toContain("thread Time");
    expect(calls.writes).toContain("plot-time=Time");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("it is the Time column");
    const after = el.querySelector(".czm-pg-pick-column") as HTMLSelectElement;
    expect([...after.querySelectorAll("option")].some((o) => o.text.startsWith("Time"))).toBe(false);
  });
});

describe("dragging blocks", () => {
  it("drops a single column with a job past a group, writes plot-order to the project note with Undo, and Move right nudges a group", async () => {
    const { v, calls } = open({}, "## When\n- [[One#Camp]] — Day 1\n\n## Arc: [[Ilse]]\n- [[One#Camp]] — x\n\n## Subplot: The gate\n- [[One#Camp]] — y\n");
    await v.onOpen();
    const el = v.contentEl;
    // Give When the Time job, so it stands alone as a block.
    (el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-more")[2] as HTMLElement).click();
    Menu.last!.items.find((i) => i.title === "Use as Time")!.cb();
    await new Promise((r) => setTimeout(r, 400));
    const titles = () => [...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-title")].map((s) => s.textContent);
    expect(titles()).toEqual(["When", "Ilse", "The gate"]);
    const heads = () => [...el.querySelectorAll<HTMLElement>("thead th.czm-pg-col-thread")];
    expect(heads().map((h) => h.dataset.block)).toEqual(["When", "arcs", "subplots"]);
    heads()[0]!.dispatchEvent(new Event("dragstart", { bubbles: true }));
    heads()[2]!.dispatchEvent(new MouseEvent("dragover", { bubbles: true, clientX: 10 }));
    expect(heads()[2]!.classList.contains("is-drop-after")).toBe(true);
    heads()[2]!.dispatchEvent(new MouseEvent("drop", { bubbles: true, clientX: 10 }));
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.writes.at(-1)).toBe("plot-order=arcs, themes, subplots, When, threads");
    expect(titles()).toEqual(["Ilse", "The gate", "When"]);
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Moved “When” after the subplots");
    (el.querySelector(".czm-map-status button") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.writes.at(-1)).toBe("plot-order=");
    expect(titles()).toEqual(["When", "Ilse", "The gate"]);
    (el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-more")[1] as HTMLElement).click();
    Menu.last!.items.find((i) => i.title === "Move the arcs right")!.cb();
    await new Promise((r) => setTimeout(r, 400));
    expect(titles()).toEqual(["When", "The gate", "Ilse"]);
    expect(calls.writes.at(-1)).toBe("plot-order=When, themes, subplots, arcs, threads");
  });
});

describe("snapshot tabs", () => {
  it("lists the snapshots as tabs by day and label, opens one read only as a table, and comes back to the grid", async () => {
    const snapshotNoteText = snapshotNote(grid(), novel, "2026-09-13");
    const { v, calls } = open({}, threadsNote, { snapshots: [{ path: "Novel/Plot grid · 2026-09-20 · after the cut.md", day: "2026-09-20", label: "after the cut" }, { path: "Novel/Plot grid · 2026-09-13.md", day: "2026-09-13", label: "" }], snapshotText: { "Novel/Plot grid · 2026-09-13.md": snapshotNoteText, "Novel/Plot grid · 2026-09-20 · after the cut.md": "no table here" } });
    await v.onOpen();
    const el = v.contentEl;
    const tabs = () => [...el.querySelectorAll(".czm-pg-tab")].map((t) => [t.textContent, t.getAttribute("aria-selected")]);
    expect(tabs()).toEqual([["Now", "true"], ["20 Sept · after the cut", "false"], ["13 Sept", "false"]]);
    (el.querySelectorAll(".czm-pg-tab")[2] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.writes).toContain("read Novel/Plot grid · 2026-09-13.md");
    expect(el.querySelector(".czm-shell-state-text")?.textContent).toContain("Snapshot · 13 Sept · read only · 4 scenes · 2 columns");
    expect(el.querySelector(".czm-pg-table.is-snapshot")).not.toBeNull();
    expect([...el.querySelectorAll(".is-snapshot .czm-pg-note th")].map((x) => x.textContent)).toEqual(["One", "Two"]);
    expect([...el.querySelectorAll(".is-snapshot .czm-pg-scene .czm-map-row-name")].map((x) => x.textContent)).toEqual(["Camp", "Creek", "Later", "Return"]);
    expect(el.querySelector('.is-snapshot .czm-pg-scene .czm-pg-cell.is-verified')?.textContent).toBe("want: to be first");
    expect(el.querySelector(".is-snapshot .czm-pg-cell.is-editing")).toBeNull();
    (el.querySelector(".czm-shell-reset") as HTMLElement).click();
    expect(calls.opened).toContain("Novel/Plot grid · 2026-09-13.md");
    (el.querySelectorAll(".czm-pg-tab")[1] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(el.textContent).toContain("This snapshot has no table the grid can read.");
    (el.querySelector(".czm-pg-tab") as HTMLElement).click();
    expect(tabs()[0]).toEqual(["Now", "true"]);
    expect(el.querySelector(".czm-pg-table:not(.is-snapshot)")).not.toBeNull();
  });
});

describe("the value gauge", () => {
  const graded = `## Theme: Should jealousy justify violent acts?
<!-- scale: hate, disgust, indifference, sympathy, love -->
- [[One#Camp]] — love: warm
- [[One#Creek]] — reversal: hate: "found the creek" cold
- [[Two#Return]] — hate: colder

## Arc: [[Ilse]]
<!-- scale: hate, fear, calm, trust, love -->
- [[One#Camp]] — fear: "woke before Ilse" afraid
- [[Two#Return]] — love: home

## Theme: Even
<!-- scale: hate, love -->
- [[One#Camp]] — hate: nothing drawn

## Subplot: The gate
- [[One#Camp]] — plant: "gate of Lisbon" planted
`;

  it("is off until asked, and a column without a scale cannot be gauged", async () => {
    const { v } = open();
    await v.onOpen();
    const el = v.contentEl;
    expect(el.querySelector(".czm-pg-gauge-td")).toBeNull();
    expect(el.querySelector(".czm-map-section-pg-gauge .czm-map-section-value")?.textContent).toBe("off");
    expect(el.querySelector(".czm-map-section-pg-gauge .czm-map-absent")?.textContent).toContain("No column has a scale yet");
    (el.querySelector(".czm-pg-col-thread .czm-pg-col-more") as HTMLElement).click();
    const row = Menu.last!.items.find((i) => i.title.startsWith("Gauge this column"))!;
    expect(row.disabled).toBe(true);
    v.run("gauge-column");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("“Ilse” has no scale yet: Set scale…");
    v.run("toggle-gauge");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("no column has a scale yet");
    expect(el.querySelector(".czm-map-section-pg-gauge .czm-map-section-value")?.textContent).toBe("on · no scale");
  });

  it("draws a lane at the right edge: pipes for the charge, a line for the running total through every row, a diamond where it flips, remembered per project", async () => {
    const { v, prefs } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    v.run("toggle-gauge");
    expect(prefs().gauge).toEqual({ "Novel/": { shown: true, lanes: [], line: "total" } });
    // The first theme with a readable scale is the lane when none is ticked; the even one cannot be.
    const head = el.querySelector(".czm-pg-gauge-head")!;
    expect(head.querySelector(".czm-pg-col-title")?.textContent).toBe("Should jealousy justify violent acts?");
    expect([...head.querySelectorAll(".czm-pg-gauge-word")].map((w) => [w.textContent, w.className.replace("czm-pg-gauge-word ", "")])).toEqual([["hate", "is-neg"], ["disgust", "is-neg"], ["indifference", "is-neutral"], ["sympathy", "is-pos"], ["love", "is-pos"]]);
    expect(head.querySelector(".czm-pg-col-count")?.textContent).toBe("3 of 4 · 1 inversion");
    expect(el.querySelector(".czm-pg-groups .czm-pg-group-gauge")?.textContent).toBe("Gauge");
    const cell = (row: number) => el.querySelector(`.czm-pg-scene[data-row="${row}"] .czm-pg-gauge-td`)!;
    // Camp: love, two pipes to the right; the total starts at +2.
    expect(cell(0).querySelectorAll(".czm-pg-gauge-pipe.is-pos")).toHaveLength(2);
    expect(cell(0).querySelector(".czm-pg-gauge-total")?.textContent).toBe("+2");
    expect(cell(0).getAttribute("aria-label")).toBe("Gauge, Should jealousy justify violent acts? at Camp: love (+2), total +2");
    // Creek: hate, two pipes to the left; the total lands on zero, which holds the sign and is no inversion.
    expect(cell(1).querySelectorAll(".czm-pg-gauge-pipe.is-neg")).toHaveLength(2);
    expect(cell(1).querySelector(".czm-pg-gauge-total")?.textContent).toBe("0");
    expect(cell(1).classList.contains("is-inversion")).toBe(false);
    // Later: nobody has said; the line is dotted through and the total holds.
    expect(cell(2).querySelectorAll(".czm-pg-gauge-pipe")).toHaveLength(0);
    expect(cell(2).querySelectorAll(".czm-pg-gauge-line.is-empty")).toHaveLength(2);
    expect(cell(2).getAttribute("aria-label")).toContain("no word, total 0");
    // Return: hate takes the total to −2: an inversion, hollow because no line marks it.
    expect(cell(3).classList.contains("is-inversion")).toBe(true);
    expect(cell(3).querySelector(".czm-pg-gauge-diamond")?.textContent).toBe("◇");
    expect(cell(3).querySelector(".czm-pg-gauge-diamond")?.classList.contains("is-hollow")).toBe(true);
    expect(cell(3).querySelector(".czm-pg-gauge-label")?.textContent).toBe("inversion");
    expect(cell(3).querySelector(".czm-pg-gauge-rule")).not.toBeNull();
    expect(cell(3).getAttribute("aria-label")).toContain("inversion, no line marks it");
    // Band rows carry the line through, so it runs unbroken from the first scene to the last.
    expect(el.querySelectorAll(".czm-pg-act .czm-pg-gauge-td.is-pass, .czm-pg-note .czm-pg-gauge-td.is-pass").length).toBeGreaterThanOrEqual(3);
    expect(el.querySelector(".czm-shell-state")?.textContent).toContain("gauge: 3 of 4 charged · 1 inversion at 4 Return");
    // The keyword rides the cell as a chip with its charge, the role glyph beside it.
    const camp = el.querySelector('.czm-pg-scene[data-row="0"] .czm-pg-kind-theme .czm-pg-keyword')!;
    expect(camp.textContent).toBe("+2 love");
    expect(camp.classList.contains("is-pos")).toBe(true);
    expect(el.querySelector('.czm-pg-scene[data-row="1"] .czm-pg-kind-theme .czm-pg-cell')?.getAttribute("aria-label")).toBe("Should jealousy justify violent acts? at Creek: reversal, hate, cold");
    expect([...el.querySelectorAll(".czm-pg-key-gauge")].map((k) => k.textContent)).toEqual(["below neutral", "above neutral", "running total · inversion"]);
    v.run("toggle-gauge");
    expect(el.querySelector(".czm-pg-gauge-td")).toBeNull();
    expect(prefs().gauge["Novel/"]!.shown).toBe(false);
  });

  it("the line walks the running total or, scene to scene, each scene's charge, with the turns marked instead of the inversions", async () => {
    const { v, prefs } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    v.run("toggle-gauge");
    const modes = () => [...el.querySelectorAll<HTMLButtonElement>(".czm-pg-gauge-mode")].map((b) => [b.textContent, b.getAttribute("aria-pressed")]);
    expect(modes()).toEqual([["Running total", "true"], ["Scene to scene", "false"]]);
    (el.querySelectorAll(".czm-pg-gauge-mode")[1] as HTMLElement).click();
    expect(prefs().gauge["Novel/"]!.line).toBe("charge");
    expect(modes()).toEqual([["Running total", "false"], ["Scene to scene", "true"]]);
    const cell = (row: number) => el.querySelector(`.czm-pg-scene[data-row="${row}"] .czm-pg-gauge-td`)!;
    // Camp +2, Creek −2 (falls 4), Later nobody, Return −2 (holds): the line stands at the charge, and no move turns the other way.
    expect(cell(0).getAttribute("aria-label")).toBe("Gauge, Should jealousy justify violent acts? at Camp: love (+2)");
    expect(cell(1).getAttribute("aria-label")).toBe("Gauge, Should jealousy justify violent acts? at Creek: hate (−2), falls −4");
    expect(cell(1).querySelector(".czm-pg-gauge-total")?.textContent).toBe("↓4");
    expect(cell(3).getAttribute("aria-label")).toBe("Gauge, Should jealousy justify violent acts? at Return: hate (−2), holds");
    expect(cell(3).classList.contains("is-inversion")).toBe(false);
    expect(el.querySelector(".czm-pg-gauge-head .czm-pg-col-count")?.textContent).toBe("3 of 4 · 0 turns");
    expect(el.querySelector(".czm-shell-state")?.textContent).toContain("gauge: 3 of 4 charged · no turn");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("scene-to-scene turns");
    v.run("gauge-line");
    expect(prefs().gauge["Novel/"]!.line).toBe("total");
    expect(cell(3).classList.contains("is-inversion")).toBe(true);
  });

  it("freezes a group's header with its columns, and splits a group the freeze cuts through, the label on the frozen part", async () => {
    const { v } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    const groups = () => [...el.querySelectorAll(".czm-pg-groups th")].map((t) => [t.textContent, t.getAttribute("colspan"), t.classList.contains("is-frozen") ? t.getAttribute("data-fcol") : null, t.classList.contains("is-continued")]);
    expect(groups()).toEqual([["", "2", "0", false], ["Arcs1", "1", null, false], ["Themes2", "2", null, false], ["Subplots1", "1", null, false], ["", "1", null, false], ["", null, null, false]]);
    // Freeze up to the first theme: the arcs group freezes whole, the themes group splits, the label staying with the frozen column.
    (el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-more")[1] as HTMLElement).click();
    Menu.last!.items.find((i) => i.title.startsWith("Freeze up to here"))!.cb();
    expect(groups()).toEqual([["", "2", "0", false], ["Arcs1", "1", "2", false], ["Themes2", "1", "3", false], ["", "1", null, true], ["Subplots1", "1", null, false], ["", "1", null, false], ["", null, null, false]]);
  });

  it("ticks a second lane from the Gauge section or the column's menu, marks the rows where the lanes disagree, and refuses an even scale", async () => {
    const { v, prefs } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    v.run("toggle-gauge");
    const lanes = [...el.querySelectorAll<HTMLInputElement>(".czm-pg-gauge-lane .czm-pg-gauge-tick")];
    expect(lanes.map((b) => [b.getAttribute("aria-label"), b.checked, b.disabled])).toEqual([["Lane: Ilse", false, false], ["Lane: Should jealousy justify violent acts?", true, false], ["Lane: Even", false, true]]);
    expect(el.querySelector(".czm-pg-gauge-lane.is-problem .czm-pg-gauge-lane-scale")?.textContent).toContain("odd number of words");
    lanes[0]!.checked = true; lanes[0]!.dispatchEvent(new Event("change"));
    expect(prefs().gauge["Novel/"]!.lanes).toEqual(["Theme: Should jealousy justify violent acts?", "Arc: [[Ilse]]"]);
    expect([...el.querySelectorAll(".czm-pg-gauge-head .czm-pg-col-title")].map((t) => t.textContent)).toEqual(["Ilse", "Should jealousy justify violent acts?"]);
    // Ilse fears at Camp while the reader loves, and loves at Return while the reader hates: two disagreements, marked on the scene.
    expect([...el.querySelectorAll(".czm-pg-scene-head .czm-pg-disagree")].map((d) => d.closest(".czm-pg-scene")?.getAttribute("data-row"))).toEqual(["0", "3"]);
    expect(el.querySelector(".czm-shell-state")?.textContent).toContain("2 lanes · 2 disagreements");
    expect([...el.querySelectorAll(".czm-pg-gauge-summary")].map((d) => d.textContent)).toEqual([
      "Ilse: 2 of 4 charged, total ends at +1, leans to love, 1 inversion at 4 Return, no turn",
      "Should jealousy justify violent acts?: 3 of 4 charged, total ends at −2, leans to hate, 1 inversion at 4 Return, no turn",
      "2 disagreements: opposite signs at 1, 4, marked ≠ on the scene.",
    ]);
    // The column's own menu row unticks it again.
    (el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-more")[0] as HTMLElement).click();
    const row = Menu.last!.items.find((i) => i.title.startsWith("Gauge this column"))!;
    expect(row.checked).toBe(true);
    row.cb();
    expect(prefs().gauge["Novel/"]!.lanes).toEqual(["Theme: Should jealousy justify violent acts?"]);
    expect(el.querySelectorAll(".czm-pg-gauge-head")).toHaveLength(1);
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("“Ilse” taken off the gauge");
    v.select({ col: 2, row: 0 });
    v.run("gauge-column");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("cannot be gauged: a scale needs an odd number of words");
  });
});

describe("setting a scale and writing a keyword", () => {
  const graded = `## Theme: Should jealousy justify violent acts?
<!-- scale: hate, disgust, indifference, sympathy, love -->
- [[One#Camp]] — love: warm
- [[One#Creek]] — reversal: hate: "found the creek" cold
- [[One#Later]] — disgust: meh
- [[Two#Return]] — hate: colder

## Subplot: The gate
- [[One#Camp]] — plant: "gate of Lisbon" planted
`;
  const tick = () => new Promise((r) => setTimeout(r, 20));
  const words = (el: HTMLElement) => [...el.querySelectorAll<HTMLInputElement>(".czm-pg-scale-word")];
  const type = (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event("input")); };

  it("Set scale… opens a sheet of five blanks for a column without one, refuses an even count, writes the line with Undo", async () => {
    const { v, note, calls } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    (el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-more")[1] as HTMLElement).click();
    Menu.last!.items.find((i) => i.title.startsWith("Set scale…"))!.cb();
    const sheet = el.querySelector(".czm-map-section-pg-scale")!;
    expect(sheet.querySelector(".czm-map-section-value")?.textContent).toBe("The gate");
    expect(words(el)).toHaveLength(5);
    expect(words(el).map((w) => w.placeholder)).toEqual(["most negative", "", "neutral", "", "most positive"]);
    expect([...sheet.querySelectorAll(".czm-pg-scale-charge")].map((c) => c.textContent)).toEqual(["−2", "−1", "0", "+1", "+2"]);
    expect(sheet.querySelector(".czm-pg-scale-neutral")?.textContent).toBe("neutral");
    const save = sheet.querySelector<HTMLButtonElement>(".czm-pg-scale-save")!;
    expect(save.disabled).toBe(true);
    expect(sheet.querySelector(".czm-pg-scale-problem")?.textContent).toContain("odd number of words");
    ["shut", "ajar", "open"].forEach((w, i) => type(words(el)[i]!, w));
    // Three words is a scale already: blanks are not counted.
    expect(sheet.querySelector(".czm-pg-scale-problem")).toBeNull();
    expect(sheet.querySelector(".czm-pg-scale-line")?.textContent).toBe("<!-- scale: shut, ajar, open -->");
    type(words(el)[3]!, "wide");
    expect(sheet.querySelector(".czm-pg-scale-problem")?.textContent).toContain("odd number of words");
    type(words(el)[4]!, "gone");
    expect(sheet.querySelector(".czm-pg-scale-problem")).toBeNull();
    expect(sheet.querySelector(".czm-pg-scale-line")?.textContent).toBe("<!-- scale: shut, ajar, open, wide, gone -->");
    expect([...sheet.querySelectorAll(".czm-map-absent")].at(-1)?.textContent).toContain("Preview: 0 of 4 cells match");
    expect(save.disabled).toBe(false);
    save.click(); await tick();
    expect(calls.writes.at(-1)).toBe("scale Subplot: The gate: shut, ajar, open, wide, gone");
    expect(note()).toContain("## Subplot: The gate\n<!-- scale: shut, ajar, open, wide, gone -->\n- [[One#Camp]]");
    expect(el.querySelector(".czm-map-section-pg-scale")).toBeNull();
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Scale written for “The gate”: shut · ajar · open · wide · gone");
    (el.querySelector(".czm-map-status button") as HTMLElement).click(); await tick();
    expect(note()).toBe(graded);
  });

  it("a word changed in place is offered as a rename and written into the cells that used it; Remove scale takes the line out", async () => {
    const { v, note } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    v.select({ col: 0, row: 0 });
    v.run("set-scale");
    const sheet = el.querySelector(".czm-map-section-pg-scale")!;
    expect(words(el).map((w) => w.value)).toEqual(["hate", "disgust", "indifference", "sympathy", "love"]);
    type(words(el)[1]!, "revulsion");
    expect(sheet.querySelector(".czm-pg-scale-rename")?.textContent).toBe("Renames disgust → revulsion in 1 cell");
    expect([...sheet.querySelectorAll(".czm-map-absent")].at(-1)?.textContent).toContain("Preview: 4 of 4 cells match · 1 inversion at 3 Later");
    sheet.querySelector<HTMLButtonElement>(".czm-pg-scale-save")!.click(); await tick();
    expect(note()).toContain("<!-- scale: hate, revulsion, indifference, sympathy, love -->");
    expect(note()).toContain("- [[One#Later]] — revulsion: meh");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("1 cell reworded");
    (el.querySelector(".czm-map-status button") as HTMLElement).click(); await tick();
    expect(note()).toBe(graded);
    v.run("set-scale");
    // A word dropped from the list orphans the cells that say it; the sheet says so before Save.
    (el.querySelectorAll(".czm-pg-scale-drop")[1] as HTMLElement).click();
    expect(el.querySelector(".czm-pg-scale-problem")?.textContent).toContain("odd number");
    (el.querySelectorAll(".czm-pg-scale-drop")[0] as HTMLElement).click();
    expect([...el.querySelectorAll(".czm-pg-scale-problem")].map((p) => p.textContent)).toEqual(["2 cells say “hate”, which is no longer on the scale: they will draw nothing until reworded", "1 cell say “disgust”, which is no longer on the scale: they will draw nothing until reworded"]);
    el.querySelector<HTMLButtonElement>(".czm-pg-scale-remove")!.click(); await tick();
    expect(note()).not.toContain("<!-- scale:");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Scale removed from");
  });

  it("the cell editor shows the keyword in front of the note, completes a started word on Tab, offers the scale as chips, and writes what was typed", async () => {
    const { v, note, calls } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    const cell = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="2"]')!;
    cell.click(); cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const field = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    expect(field.value).toBe("disgust: meh");
    expect([...el.querySelectorAll(".czm-pg-scale-chip")].map((c) => c.textContent)).toEqual(["hate", "disgust", "indifference", "sympathy", "love"]);
    field.value = "sym";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(field.value).toBe("sympathy: ");
    field.value = "sympathy: he waits";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick();
    expect(calls.writes.at(-1)).toBe("add Theme: Should jealousy justify violent acts?: One#Later touch  he waits");
    expect(note()).toContain("- [[One#Later]] — sympathy: he waits");
    // A chip puts its word in front, replacing the one there; a note typed with no word takes the stop's word off.
    const again = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="0"][data-row="2"]')!;
    again.click(); again.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const f2 = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    (el.querySelectorAll(".czm-pg-scale-chip")[0] as HTMLElement).click();
    expect(f2.value).toBe("hate: he waits");
    f2.value = "he waits longer";
    f2.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick();
    // The word was shown in the field and is gone from it: the stop loses it. The line keeps its note.
    expect(note()).toContain("- [[One#Later]] — he waits longer");
    expect(note()).not.toContain("sympathy: he waits longer");
    expect(el.querySelector('.czm-pg-cell[data-col="0"][data-row="2"] .czm-pg-keyword')).toBeNull();
    // Tab on a word that is not a start of exactly one scale word finishes the edit as before.
    const third = el.querySelector<HTMLElement>('.czm-pg-cell[data-col="1"][data-row="1"]')!;
    third.click(); third.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const f3 = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    expect(el.querySelector(".czm-pg-scale-chip")).toBeNull();
    f3.value = "Ilse washes";
    f3.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })); await tick();
    expect(note()).toContain("- [[One#Creek]] — Ilse washes");
  });

  it("a reading on a graded column offers its word as the placeholder, in the Cell section and in the editor, and never writes it", async () => {
    const { v, note } = open({}, graded.replace("- [[Two#Return]] — hate: colder\n", ""));
    await v.onOpen();
    const el = v.contentEl;
    // The theme's one empty cell is Return: read the column, the model says love.
    v.select({ col: 0, row: 0 });
    v.run("read-column");
    await tick(); await tick(); await tick();
    const empty = [...el.querySelectorAll<HTMLElement>('.czm-pg-cell[data-col="0"]')].find((c) => c.classList.contains("has-reading"));
    expect(empty).toBeDefined();
    empty!.click();
    expect(el.querySelector(".czm-pg-reading-text")?.textContent).toMatch(/^love: the model read/);
    expect((el.querySelector(".czm-pg-keyword-select") as HTMLSelectElement).value).toBe("");
    expect((el.querySelector(".czm-pg-keyword-select") as HTMLSelectElement).title).toContain("The model offered love");
    empty!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const field = el.querySelector(".czm-pg-editor") as HTMLTextAreaElement;
    expect(field.value).toBe("");
    expect(field.placeholder).toMatch(/^love: the model read/);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
    expect(note()).not.toContain("the model read");
  });

  it("the Cell section has a keyword to pick, n walks to a turn no line marks, and the section says so", async () => {
    const { v, note } = open({}, graded);
    await v.onOpen();
    const el = v.contentEl;
    v.run("toggle-gauge");
    // Camp +2, Creek −2, Later −1: the total flips at Later, where no quote marks it.
    v.run("next-issue");
    expect(v.selected?.row.scene.title).toBe("Later");
    expect(v.selected?.column.heading.name).toBe("Should jealousy justify violent acts?");
    expect(el.querySelector(".czm-pg-turn-unmarked")?.textContent).toContain("No line marks this turn");
    const select = el.querySelector(".czm-pg-keyword-select") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["none", "−2 hate", "−1 disgust", "0 indifference", "+1 sympathy", "+2 love"]);
    expect(select.value).toBe("disgust");
    select.value = "love";
    (el.querySelector(".czm-pg-save") as HTMLElement).click(); await tick();
    expect(note()).toContain("- [[One#Later]] — love: meh");
    v.run("next-issue");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("every turn of the gauge has its line");
  });
});

describe("a column's summary", () => {
  const withSummary = `## Arc: [[Ilse]]
<!-- A self-sacrifice arc: she realises she has been vain and chose herself over the love of this life -->
- [[One#Camp]] — want: "woke before Ilse" to be first

## Subplot: The gate
- [[One#Camp]] — plant: "gate of Lisbon" planted
`;
  const tick = () => new Promise((r) => setTimeout(r, 20));

  it("shows the comment under the heading beneath the column's name, whole on hover, and writes one from the Column section with Undo", async () => {
    const { v, note, calls } = open({}, withSummary);
    await v.onOpen();
    const el = v.contentEl;
    const heads = [...el.querySelectorAll(".czm-pg-col-thread")];
    expect(heads[0]!.querySelector(".czm-pg-col-summary")?.textContent).toBe("A self-sacrifice arc: she realises she has been vain and chose herself over the love of this life");
    expect(heads[0]!.querySelector(".czm-pg-col-summary")?.getAttribute("title")).toContain("self-sacrifice");
    expect(heads[0]!.querySelector(".czm-pg-col-title")?.textContent).toBe("Ilse");
    // The gate has none: a faint prompt sits under its name, and a double click on it opens a field there.
    const prompt = heads[1]!.querySelector(".czm-pg-col-summary") as HTMLElement;
    expect(prompt.classList.contains("is-empty")).toBe(true);
    expect(prompt.textContent).toBe("summary…");
    prompt.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const field = heads[1]!.querySelector(".czm-pg-summary-inline") as HTMLTextAreaElement;
    expect(field.value).toBe("");
    field.value = "  The letter nobody collects,\n and who finally does  ";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick();
    expect(calls.writes.at(-1)).toBe("summary Subplot: The gate: The letter nobody collects, and who finally does");
    expect(note()).toContain("## Subplot: The gate\n<!-- The letter nobody collects, and who finally does -->\n- [[One#Camp]]");
    expect([...el.querySelectorAll(".czm-pg-col-thread .czm-pg-col-summary:not(.is-empty)")].map((d) => d.textContent)).toHaveLength(2);
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Summary written for “The gate”");
    (el.querySelector(".czm-map-status button") as HTMLElement).click(); await tick();
    expect(note()).toBe(withSummary);
    // Escape puts the line back; the menu row opens the same field; emptying it takes the line out.
    const ilse = () => el.querySelector(".czm-pg-col-thread .czm-pg-col-summary") as HTMLElement;
    ilse().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const f1 = el.querySelector(".czm-pg-summary-inline") as HTMLTextAreaElement;
    expect(f1.value).toContain("self-sacrifice");
    f1.value = "changed";
    f1.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
    expect(note()).toBe(withSummary);
    (el.querySelector(".czm-pg-col-thread .czm-pg-col-more") as HTMLElement).click();
    Menu.last!.items.find((i) => i.title.startsWith("Summary…"))!.cb();
    const f2 = el.querySelector(".czm-pg-summary-inline") as HTMLTextAreaElement;
    expect(f2.value).toContain("self-sacrifice");
    f2.value = "";
    f2.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick();
    expect(note()).not.toContain("<!--");
    expect(el.querySelector(".czm-map-status")?.textContent).toContain("Summary removed from “Ilse”");
  });

  it("Time, POV and the plot point carry no summary: no prompt in the header, no menu row, no field in the Column section", async () => {
    const { v } = open({}, "## Time\n- [[One#Camp]] — day 1\n\n## Subplot: The gate\n- [[One#Camp]] — planted\n");
    await v.onOpen();
    const el = v.contentEl;
    const timeHead = [...el.querySelectorAll<HTMLElement>(".czm-pg-col-thread")].find((h) => h.querySelector(".czm-pg-col-title")?.textContent === "Time")!;
    (timeHead.querySelector(".czm-pg-col-more") as HTMLElement).click();
    Menu.last!.items.find((i) => i.title === "Use as Time")!.cb();
    await new Promise((r) => setTimeout(r, 400));
    const time = el.querySelector(".czm-pg-special-time")!;
    expect(time.querySelector(".czm-pg-col-summary")).toBeNull();
    expect(el.querySelector(".czm-pg-kind-subplot .czm-pg-col-summary")).not.toBeNull();
    (time.querySelector(".czm-pg-col-more") as HTMLElement).click();
    expect(Menu.last!.items.some((i) => i.title.includes("summary"))).toBe(false);
    expect(el.querySelector(".czm-map-section-pg-column .czm-pg-summary-field")).toBeNull();
  });
});
