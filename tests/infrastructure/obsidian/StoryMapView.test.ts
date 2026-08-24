import { describe, it, expect } from "vitest";
import { WorkspaceLeaf, Setting } from "obsidian";
import { STORY_MAP_VIEW_TYPE, StoryMapView, edgeSummary, type StoryMapSource } from "../../../src/infrastructure/obsidian/views/StoryMapView";
import { buildStoryGraph, type ProjectNote, type ProjectRelation } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading, type Layout } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import type { ProjectSpec } from "../../../src/domain/progress/Project";
import { DEFAULT_STORY_MAP, type StoryMapSettings } from "../../../src/domain/settings/Settings";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novel/Project.md", ignoredNames: [] };
const one = `# Camp\nMarta woke before Ilse at the gate of Lisbon. Zsófi was there, as Zsófi always was, and Zsófi sang.\n\n# Creek\nIlse found the creek alone.\n`;
const note = (path: string, body: string, extra: Partial<ProjectNote> = {}): ProjectNote => ({ path, frontmatter: {}, links: [], bookmarked: false, bookmarkedHeadings: [], scenes: splitScenes(body), ...extra });
const notes = [
  note("Novel/Characters/Marta Kovács.md", "", { links: ["Novel/Characters/Ilse.md"] }),
  note("Novel/Characters/Ilse.md", "", { bookmarked: true }),
  note("Novel/Places/Lisbon.md", ""),
  note("Novel/One.md", one),
];
const camp = splitScenes(one)[0]!;
const file = putReading(EMPTY_STORY_MAP_FILE, {
  scene: { path: "Novel/One.md", title: "Camp", line: 0 }, hash: textHash(camp.prose), model: "m",
  relations: [{ from: "Marta", to: "Ilse", label: "sister", evidence: "x" }],
  references: [{ name: "Orpheus", kind: "myth", about: "Marta", note: "looks back", evidence: "x" }],
  events: [{ summary: "Dawn", participants: [], evidence: "x" }],
});

function source(overrides: Partial<StoryMapSource> = {}) {
  const calls = { opened: [] as string[], revealed: [] as string[], promoted: [] as string[], ignored: [] as string[], aliased: [] as string[], relations: [] as string[], renamed: [] as string[], removed: [] as string[], layouts: [] as Layout[], timeline: 0 };
  let settings: StoryMapSettings = DEFAULT_STORY_MAP;
  // Relations written through the source show up in the next build, as they would from the vault.
  const authored: ProjectRelation[] = [];
  const src: StoryMapSource = {
    projects: () => [novel],
    activeProject: () => novel,
    activeNotePath: () => "Novel/One.md",
    build: async () => buildStoryGraph("Novel", notes.map((n) => (n.path === "Novel/Characters/Marta Kovács.md" ? { ...n, relations: authored } : n)), file),
    openNote: (p) => { calls.opened.push(p); },
    reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); },
    promote: async (_p, name, kind) => { calls.promoted.push(`${kind}:${name}`); return `Novel/${name}.md`; },
    ignore: async (_p, name) => { calls.ignored.push(name); },
    unignore: async (_p, name) => { calls.ignored = calls.ignored.filter((n) => n !== name); },
    alias: async (_p, path, name) => { calls.aliased.push(`${path}+${name}`); },
    setRelation: async (from, to, label, previous) => {
      calls.relations.push(`${from} -> ${to}: ${label}${previous !== undefined ? ` (was ${previous})` : ""}`);
      const i = authored.findIndex((r) => r.targetPath === to && (previous === undefined || r.label === previous));
      const rel = { target: to, targetPath: to, label, line: 3 };
      if (i >= 0) authored[i] = rel; else authored.push(rel);
    },
    removeRelation: async (from, to, label) => { calls.relations.push(`${from} -x ${to}: ${label}`); const i = authored.findIndex((r) => r.targetPath === to && r.label === label); if (i >= 0) authored.splice(i, 1); },
    rename: async (path, name) => { calls.renamed.push(`${path} -> ${name}`); return `Novel/Characters/${name}.md`; },
    remove: async (path) => { calls.removed.push(path); },
    loadLayout: async () => ({}),
    saveLayout: async (_p, layout) => { calls.layouts.push(layout); },
    analyse: async () => { throw new Error("no model"); },
    settings: () => settings,
    updateSettings: (next) => { settings = next; },
    openTimeline: () => { calls.timeline++; },
    ...overrides,
  };
  return { src, calls, settings: () => settings };
}

async function open(overrides: Partial<StoryMapSource> = {}) {
  Setting.created = [];
  const s = source(overrides);
  const v = new StoryMapView(new WorkspaceLeaf(), s.src);
  await v.onOpen();
  return { v, calls: s.calls, el: v.contentEl, settings: s.settings };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const clickNode = (el: HTMLElement, id: string) => {
  const g = el.querySelector<SVGGElement>(`.czm-node[data-id="${id}"]`)!;
  g.dispatchEvent(new MouseEvent("pointerdown", { clientX: 0, clientY: 0, bubbles: true }));
  g.dispatchEvent(new MouseEvent("pointerup", { clientX: 0, clientY: 0, bubbles: true }));
};
const setting = (cls: string) => Setting.created.find((s) => s.settingEl.classList.contains(cls))!;

describe("StoryMapView", () => {
  it("has a stable type and names the project", async () => {
    const { v } = await open();
    expect(v.getViewType()).toBe(STORY_MAP_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Story map · Novel");
    expect(v.getIcon()).toBeTruthy();
  });

  it("renders nodes and edges with kind colours, notes hidden by default", async () => {
    const { el } = await open();
    const nodes = [...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"));
    expect(nodes).toContain("Novel/Characters/Marta Kovács.md");
    expect(nodes).toContain("name:zsofi");
    expect(nodes).toContain("ref:orpheus");
    expect(nodes).not.toContain("Novel/One.md");
    expect(el.querySelector<SVGGElement>('.czm-node[data-id="Novel/Places/Lisbon.md"]')!.style.getPropertyValue("--czm-kind")).toBe(DEFAULT_STORY_MAP.colors.location);
    expect(el.querySelector(".czm-node.is-bookmarked .czm-node-star")).not.toBeNull();
    expect(el.querySelectorAll(".czm-edge-relationship")).toHaveLength(1);
    expect(el.querySelectorAll(".czm-edge-reference")).toHaveLength(1);
    expect(el.querySelector(".czm-map-panel.is-open")).not.toBeNull();
  });

  it("opens a card beside a clicked node with actions and lists; dims non-neighbours", async () => {
    const { el, calls } = await open();
    clickNode(el, "Novel/Characters/Marta Kovács.md");
    expect(el.querySelector(".czm-node.is-selected")?.getAttribute("data-id")).toBe("Novel/Characters/Marta Kovács.md");
    const ilseLisbon = el.querySelector('.czm-edge[data-from="Novel/Characters/Ilse.md"][data-to="Novel/Places/Lisbon.md"]');
    expect(ilseLisbon?.classList.contains("is-dim")).toBe(true);
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-map-card-name")?.textContent).toBe("Marta Kovács");
    expect(card.textContent).toContain("Appears in");
    (card.querySelector(".czm-map-row") as HTMLElement).click();
    expect(calls.revealed).toEqual(["Camp@0"]);
    (card.querySelector(".czm-act-open") as HTMLElement).click();
    expect(calls.opened).toEqual(["Novel/Characters/Marta Kovács.md"]);
    (card.querySelector(".czm-act-pin") as HTMLElement).click();
    expect(el.querySelector(".czm-node.is-selected")?.classList.contains("is-pinned")).toBe(true);
    (el.querySelector(".czm-map-card-close") as HTMLElement).click();
    expect(el.querySelector(".czm-map-card.is-open")).toBeNull();
  });

  it("focuses on a node's neighbourhood and back", async () => {
    const { el } = await open();
    clickNode(el, "Novel/Characters/Ilse.md");
    (el.querySelector(".czm-act-focus") as HTMLElement).click();
    const ids = [...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"));
    expect(ids).not.toContain("ref:orpheus");
    expect(ids).toContain("Novel/Characters/Marta Kovács.md");
    (el.querySelector(".czm-map-unfocus") as HTMLElement).click();
    expect([...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"))).toContain("ref:orpheus");
  });

  it("selects an edge and shows its evidence and endpoints", async () => {
    const { el } = await open();
    (el.querySelector(".czm-edge-relationship") as SVGLineElement).dispatchEvent(new MouseEvent("click"));
    const card = el.querySelector(".czm-map-card.is-open")!;
    expect(card.querySelector(".czm-map-card-name")?.textContent).toContain("Marta Kovács");
    expect(card.textContent).toContain("sister");
    expect(card.textContent).toContain("Seen in");
    (card.querySelector(".czm-act-end") as HTMLElement).click();
    expect(el.querySelector(".czm-node.is-selected")).not.toBeNull();
  });

  it("filters by layer and kind through the panel toggles and persists the choice", async () => {
    const { el, settings } = await open();
    setting("czm-set-layer-external").toggle!.onChangeCb(false);
    expect(el.querySelectorAll(".czm-edge-reference")).toHaveLength(0);
    setting("czm-set-kind-candidate").toggle!.onChangeCb(false);
    expect([...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"))).not.toContain("name:zsofi");
    await new Promise((r) => setTimeout(r, 450));
    expect(settings().layers.external).toBe(false);
    expect(settings().kinds.candidate).toBe(false);
  });

  it("recolours a kind and changes forces", async () => {
    const { el, settings } = await open();
    setting("czm-set-kind-character").color!.onChangeCb("#ff0000");
    expect(el.querySelector<SVGGElement>('.czm-node[data-id="Novel/Characters/Ilse.md"]')!.style.getPropertyValue("--czm-kind")).toBe("#ff0000");
    setting("czm-set-force-repulsion").slider!.onChangeCb(3);
    await new Promise((r) => setTimeout(r, 450));
    expect(settings().colors.character).toBe("#ff0000");
    expect(settings().forces.repulsion).toBe(3);
  });

  it("scales nodes, edges and labels from the Display section", async () => {
    const { el, settings } = await open();
    const r = () => Number(el.querySelector<SVGCircleElement>('.czm-node[data-id="Novel/Characters/Ilse.md"] circle')!.getAttribute("r"));
    const w = () => Number(el.querySelector<SVGLineElement>(".czm-edge")!.getAttribute("stroke-width"));
    const r0 = r(), w0 = w();
    setting("czm-set-display-nodeSize").slider!.onChangeCb(2);
    expect(r()).toBeCloseTo(r0 * 2, 0);
    setting("czm-set-display-edgeWidth").slider!.onChangeCb(3);
    expect(w()).toBeCloseTo(w0 * 3, 0);
    setting("czm-set-display-labelSize").slider!.onChangeCb(0);
    expect(el.querySelector("svg > g")!.classList.contains("czm-no-labels")).toBe(true);
    await new Promise((r) => setTimeout(r, 450));
    expect(settings().display).toEqual({ nodeSize: 2, edgeWidth: 3, edgeOpacity: 0.55, labelSize: 0 });
  });

  it("searches, pans, zooms and fits", async () => {
    const { el, v } = await open();
    const search = el.querySelector(".czm-map-search") as HTMLInputElement;
    search.value = "lisbon";
    search.dispatchEvent(new Event("input"));
    const ids = [...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"));
    expect(ids).toContain("Novel/Places/Lisbon.md");
    expect(ids).not.toContain("ref:orpheus");
    const svg = el.querySelector("svg")!;
    const g = el.querySelector("svg > g")!;
    const before = g.getAttribute("transform");
    svg.dispatchEvent(new MouseEvent("pointerdown", { clientX: 10, clientY: 10, bubbles: true }));
    svg.dispatchEvent(new MouseEvent("pointermove", { clientX: 60, clientY: 40, bubbles: true }));
    svg.dispatchEvent(new MouseEvent("pointerup", { clientX: 60, clientY: 40, bubbles: true }));
    expect(g.getAttribute("transform")).not.toBe(before);
    v.zoomAt(0, 0, 2);
    expect(g.getAttribute("transform")).toContain("scale(");
    (el.querySelector(".czm-map-fit") as HTMLElement).click();
    expect(g.getAttribute("transform")).toBeTruthy();
  });

  it("offers every exit for a candidate: five kinds, alias of an existing entity, not a name", async () => {
    const { el, calls } = await open();
    const select = () => el.querySelector<SVGGElement>('.czm-node[data-id="name:zsofi"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    select();
    const card = el.querySelector(".czm-map-card")!;
    expect(card.textContent).toContain("No note yet");
    expect([...card.querySelectorAll(".czm-map-exits button")].map((b) => b.textContent)).toEqual(["Character", "Place", "Item", "Faction", "Event"]);
    (card.querySelector(".czm-act-item") as HTMLElement).click();
    await tick();
    expect(calls.promoted).toEqual(["item:Zsófi"]);
    select();
    const target = el.querySelector(".czm-act-alias-target") as HTMLSelectElement;
    expect([...target.options].map((o) => o.textContent)).toContain("Marta Kovács (characters)");
    target.value = "Novel/Characters/Marta Kovács.md";
    target.dispatchEvent(new Event("change"));
    (el.querySelector(".czm-act-alias") as HTMLElement).click();
    await tick();
    expect(calls.aliased).toEqual(["Novel/Characters/Marta Kovács.md+Zsófi"]);
    select();
    (el.querySelector(".czm-act-ignore") as HTMLElement).click();
    await tick();
    expect(calls.ignored).toEqual(["Zsófi"]);
  });

  it("lists ignored names in the panel with a way back", async () => {
    const { el, calls } = await open({ projects: () => [{ ...novel, ignoredNames: ["LOW", "POV"] }], activeProject: () => ({ ...novel, ignoredNames: ["LOW", "POV"] }) });
    const rows = Setting.created.filter((s) => s.settingEl.classList.contains("czm-set-ignored"));
    expect(rows.map((r) => r.name)).toEqual(["LOW", "POV"]);
    rows[0]!.button!.buttonEl.click();
    await tick();
    expect(calls.ignored).toEqual([]);
    expect(el.querySelector(".czm-map-panel")).not.toBeNull();
  });

  it("explains when there is no project", async () => {
    const { el } = await open({ projects: () => [], activeProject: () => null });
    expect(el.querySelector(".czm-map-empty")?.textContent).toContain("No project yet");
  });

  it("reads a single note from its card, the project from the panel, and opens the timeline", async () => {
    const paths: (string | null)[] = [];
    const { el, calls } = await open({ analyse: async (_p, path, _g, _s, onProgress) => { paths.push(path); onProgress({ done: 1, total: 1, scene: { path: "Novel/One.md", title: "Camp", line: 0 }, skipped: false }); return 1; } });
    setting("czm-set-kind-note").toggle!.onChangeCb(true);
    el.querySelector<SVGGElement>('.czm-node[data-id="Novel/One.md"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    (el.querySelector(".czm-map-analyse-note") as HTMLElement).click();
    await tick(); await tick();
    (el.querySelector(".czm-map-analyse") as HTMLElement).click();
    await tick(); await tick();
    expect(paths).toEqual(["Novel/One.md", null]);
    expect(el.querySelector(".czm-map-status")!.textContent).toContain("Read 1 scene");
    (el.querySelector(".czm-map-timeline-btn") as HTMLElement).click();
    expect(calls.timeline).toBe(1);
  });

  it("shows the model's own message when no model is configured", async () => {
    const { el } = await open();
    (el.querySelector(".czm-map-analyse") as HTMLButtonElement).click();
    await tick(); await tick();
    expect(el.querySelector(".czm-map-status")!.textContent).toContain("no model");
  });

  it("summarises edges", () => {
    const base = { from: "a", to: "b", layer: "internal" as const, source: "extracted" as const, weight: 2, label: "", evidence: [], stale: false, conflict: [] };
    expect(edgeSummary({ ...base, kind: "co-occurrence" })).toBe("2 scenes together");
    expect(edgeSummary({ ...base, kind: "relationship", label: "rival" })).toBe("rival");
    expect(edgeSummary({ ...base, kind: "link" })).toBe("linked");
    expect(edgeSummary({ ...base, kind: "reference" })).toBe("reference");
    expect(edgeSummary({ ...base, kind: "appearance" })).toBe("appears · 2");
    expect(edgeSummary({ ...base, kind: "authored", label: "sister" })).toBe("sister · yours");
    expect(edgeSummary({ ...base, kind: "authored" })).toBe("related · yours");
  });

  describe("drawing by hand", () => {
    const marta = "Novel/Characters/Marta Kovács.md", ilse = "Novel/Characters/Ilse.md", lisbon = "Novel/Places/Lisbon.md";

    it("adds a node from a double-click on the background: name, kind, note created, placed and pinned there", async () => {
      const { el, calls } = await open();
      const svg = el.querySelector("svg")!;
      svg.dispatchEvent(new MouseEvent("dblclick", { clientX: 120, clientY: 80, bubbles: true }));
      const form = el.querySelector(".czm-map-new.is-open")!;
      expect(form).not.toBeNull();
      const input = form.querySelector(".czm-map-new-name") as HTMLInputElement;
      input.value = "The Guild";
      (form.querySelector(".czm-act-faction") as HTMLElement).click();
      await tick(); await tick();
      expect(calls.promoted).toEqual(["faction:The Guild"]);
      expect(el.querySelector(".czm-map-new.is-open")).toBeNull();
      // The panel's Add button opens the same form; Esc closes it.
      (el.querySelector(".czm-map-add") as HTMLElement).click();
      expect(el.querySelector(".czm-map-new.is-open")).not.toBeNull();
      el.querySelector<HTMLElement>(".czm-map")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(el.querySelector(".czm-map-new.is-open")).toBeNull();
    });

    it("connects two nodes from the card: link mode, a label form, a relationship written into the first note", async () => {
      const { el, calls } = await open();
      clickNode(el, marta);
      (el.querySelector(".czm-act-connect") as HTMLElement).click();
      expect(el.querySelector(".czm-map")!.classList.contains("is-linking")).toBe(true);
      expect(el.querySelector(".czm-map-status")!.textContent).toContain("Connecting Marta Kovács");
      clickNode(el, lisbon);
      const card = el.querySelector(".czm-map-card.is-open")!;
      expect(card.querySelector(".czm-map-card-name")?.textContent).toBe("Marta Kovács — Lisbon");
      const input = card.querySelector(".czm-map-label-input") as HTMLInputElement;
      input.value = "born in";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await tick(); await tick(); await tick();
      expect(calls.relations).toEqual([`${marta} -> ${lisbon}: born in`]);
      const line = el.querySelector(".czm-edge-authored")!;
      expect(line.getAttribute("data-from")).toBe(marta);
      expect(line.getAttribute("data-to")).toBe(lisbon);
      expect(el.querySelector(".czm-map")!.classList.contains("is-linking")).toBe(false);
      // The new edge is selected, with its own card.
      expect(el.querySelector(".czm-edge.is-selected")?.classList.contains("czm-edge-authored")).toBe(true);
      expect(el.querySelector(".czm-map-card.is-open")!.textContent).toContain("born in · yours");
    });

    it("starts link mode with shift-click, cancels with Esc, and refuses ends without a note", async () => {
      const { el } = await open();
      const g = el.querySelector<SVGGElement>(`.czm-node[data-id="${marta}"]`)!;
      g.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
      g.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, shiftKey: true }));
      expect(el.querySelector(".czm-map")!.classList.contains("is-linking")).toBe(true);
      clickNode(el, "name:zsofi");
      expect(el.querySelector(".czm-map-status")!.textContent).toContain("no note yet");
      expect(el.querySelector(".czm-map")!.classList.contains("is-linking")).toBe(true);
      el.querySelector<HTMLElement>(".czm-map")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(el.querySelector(".czm-map")!.classList.contains("is-linking")).toBe(false);
    });

    it("relabels and removes an authored relationship from its card", async () => {
      const { el: v, calls } = await open();
      clickNode(v, marta);
      (v.querySelector(".czm-act-connect") as HTMLElement).click();
      clickNode(v, ilse);
      const input = v.querySelector(".czm-map-label-input") as HTMLInputElement;
      input.value = "sister";
      (v.querySelector(".czm-act-save-label") as HTMLElement).click();
      await tick(); await tick(); await tick();
      const card = v.querySelector(".czm-map-card.is-open")!;
      expect(card.textContent).toContain("written in Marta Kovács's note");
      expect(card.textContent).toContain("Written in");
      const relabel = card.querySelector(".czm-map-label-input") as HTMLInputElement;
      relabel.value = "half-sister";
      (card.querySelector(".czm-act-save-label") as HTMLElement).click();
      await tick(); await tick(); await tick();
      expect(calls.relations.at(-1)).toBe(`${marta} -> ${ilse}: half-sister (was sister)`);
      (v.querySelector(".czm-act-remove-relation") as HTMLElement).click();
      await tick(); await tick(); await tick();
      expect(calls.relations.at(-1)).toBe(`${marta} -x ${ilse}: half-sister`);
      expect(v.querySelectorAll(".czm-edge-authored")).toHaveLength(0);
    });

    it("shows a disagreement between the writer and the model on both edges, and lets either side be adopted", async () => {
      const { el, calls } = await open();
      clickNode(el, marta);
      (el.querySelector(".czm-act-connect") as HTMLElement).click();
      clickNode(el, ilse);
      (el.querySelector(".czm-map-label-input") as HTMLInputElement).value = "rival";
      (el.querySelector(".czm-act-save-label") as HTMLElement).click();
      await tick(); await tick(); await tick();
      expect(el.querySelectorAll(".czm-edge.is-conflict")).toHaveLength(2);
      const mine = el.querySelector(".czm-map-card.is-open")!;
      expect(mine.querySelector(".czm-map-conflict-text")!.textContent).toContain("you wrote “rival”; the model read the prose as “sister”");
      (mine.querySelector(".czm-map-conflict .czm-act-adopt") as HTMLElement).click();
      await tick(); await tick(); await tick();
      expect(calls.relations.at(-1)).toBe(`${marta} -> ${ilse}: sister (was rival)`);
      expect(el.querySelectorAll(".czm-edge.is-conflict")).toHaveLength(0);
      // From the model's side, now that the two agree: nothing to write down, nothing to replace.
      (el.querySelector(".czm-edge-relationship") as SVGLineElement).dispatchEvent(new MouseEvent("click"));
      expect(el.querySelector(".czm-map-card .czm-act-adopt")).toBeNull();
      expect(el.querySelector(".czm-map-card .czm-map-conflict")).toBeNull();
    });

    it("offers, on the model's edge, to replace what the writer wrote when they disagree", async () => {
      const { el, calls } = await open();
      clickNode(el, marta);
      (el.querySelector(".czm-act-connect") as HTMLElement).click();
      clickNode(el, ilse);
      (el.querySelector(".czm-map-label-input") as HTMLInputElement).value = "rival";
      (el.querySelector(".czm-act-save-label") as HTMLElement).click();
      await tick(); await tick(); await tick();
      (el.querySelector(".czm-edge-relationship") as SVGLineElement).dispatchEvent(new MouseEvent("click"));
      const card = el.querySelector(".czm-map-card.is-open")!;
      expect(card.querySelector(".czm-map-conflict-text")!.textContent).toContain("the model read this as “sister”; you wrote “rival”");
      (card.querySelector(".czm-map-conflict .czm-act-adopt") as HTMLElement).click();
      await tick(); await tick(); await tick();
      expect(calls.relations.at(-1)).toBe(`${marta} -> ${ilse}: sister (was rival)`);
    });

    it("writes the model's reading down as a relationship of the writer's own", async () => {
      const { el, calls } = await open();
      (el.querySelector(".czm-edge-relationship") as SVGLineElement).dispatchEvent(new MouseEvent("click"));
      (el.querySelector(".czm-map-card .czm-act-adopt") as HTMLElement).click();
      await tick(); await tick(); await tick();
      expect(calls.relations).toEqual([`${marta} -> ${ilse}: sister`]);
      expect(el.querySelectorAll(".czm-edge-authored")).toHaveLength(1);
      expect(el.querySelectorAll(".czm-edge.is-conflict")).toHaveLength(0);
    });

    it("renames and deletes a note from its card, the delete needing a second click", async () => {
      const { el, calls } = await open();
      clickNode(el, ilse);
      (el.querySelector(".czm-act-rename") as HTMLElement).click();
      const input = el.querySelector(".czm-map-rename") as HTMLInputElement;
      input.value = "Ilsa";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await tick(); await tick(); await tick();
      expect(calls.renamed).toEqual([`${ilse} -> Ilsa`]);
      clickNode(el, lisbon);
      const del = el.querySelector(".czm-act-delete") as HTMLElement;
      del.click();
      expect(del.textContent).toBe("Delete note?");
      expect(calls.removed).toEqual([]);
      del.click();
      await tick(); await tick(); await tick();
      expect(calls.removed).toEqual([lisbon]);
    });

    it("remembers hand-placed nodes: a drag pins and saves, Shake forgets", async () => {
      const layouts: Layout[] = [];
      const { el, v } = await open({ loadLayout: async () => ({ [ilse]: { x: 300, y: 300 }, "Novel/Gone.md": { x: 1, y: 1 } }), saveLayout: async (_p, l) => { layouts.push(l); } });
      // A remembered node starts where it was left, pinned.
      expect(el.querySelector(`.czm-node[data-id="${ilse}"]`)!.classList.contains("is-pinned")).toBe(true);
      expect(el.querySelector(`.czm-node[data-id="${ilse}"]`)!.getAttribute("transform")).toBe("translate(300.0 300.0)");
      const g = el.querySelector<SVGGElement>(`.czm-node[data-id="${marta}"]`)!;
      g.dispatchEvent(new MouseEvent("pointerdown", { clientX: 0, clientY: 0, bubbles: true }));
      g.dispatchEvent(new MouseEvent("pointermove", { clientX: 50, clientY: 50, bubbles: true }));
      g.dispatchEvent(new MouseEvent("pointerup", { clientX: 50, clientY: 50, bubbles: true }));
      expect(g.classList.contains("is-pinned")).toBe(true);
      await new Promise((r) => setTimeout(r, 900));
      expect(layouts).toHaveLength(1);
      expect(Object.keys(layouts[0]!).sort()).toEqual([ilse, marta, "Novel/Gone.md"].sort());
      (el.querySelector(".czm-map-shake") as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 900));
      expect(Object.keys(layouts.at(-1)!)).toEqual(["Novel/Gone.md"]);
      await v.onClose();
    });
  });
});
