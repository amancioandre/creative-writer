import { describe, it, expect } from "vitest";
import { WorkspaceLeaf, Setting } from "obsidian";
import { STORY_MAP_VIEW_TYPE, StoryMapView, edgeSummary, type StoryMapSource } from "../../../src/infrastructure/obsidian/views/StoryMapView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading } from "../../../src/domain/story/StoryMapFile";
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
  const calls = { opened: [] as string[], revealed: [] as string[], promoted: [] as string[], ignored: [] as string[], aliased: [] as string[], timeline: 0 };
  let settings: StoryMapSettings = DEFAULT_STORY_MAP;
  const src: StoryMapSource = {
    projects: () => [novel],
    activeProject: () => novel,
    activeNotePath: () => "Novel/One.md",
    build: async () => buildStoryGraph("Novel", notes, file),
    openNote: (p) => { calls.opened.push(p); },
    reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); },
    promote: async (_p, name, kind) => { calls.promoted.push(`${kind}:${name}`); return `Novel/${name}.md`; },
    ignore: async (_p, name) => { calls.ignored.push(name); },
    unignore: async (_p, name) => { calls.ignored = calls.ignored.filter((n) => n !== name); },
    alias: async (_p, path, name) => { calls.aliased.push(`${path}+${name}`); },
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
    const base = { from: "a", to: "b", layer: "internal" as const, source: "extracted" as const, weight: 2, label: "", evidence: [], stale: false };
    expect(edgeSummary({ ...base, kind: "co-occurrence" })).toBe("2 scenes together");
    expect(edgeSummary({ ...base, kind: "relationship", label: "rival" })).toBe("rival");
    expect(edgeSummary({ ...base, kind: "link" })).toBe("linked");
    expect(edgeSummary({ ...base, kind: "reference" })).toBe("reference");
    expect(edgeSummary({ ...base, kind: "appearance" })).toBe("appears · 2");
  });
});
