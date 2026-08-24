import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { STORY_MAP_VIEW_TYPE, StoryMapView, edgeSummary, type StoryMapSource } from "../../../src/infrastructure/obsidian/views/StoryMapView";
import { buildStoryGraph, type ProjectNote } from "../../../src/domain/story/BuildGraph";
import { splitScenes } from "../../../src/domain/text/Scenes";
import { EMPTY_STORY_MAP_FILE, putReading } from "../../../src/domain/story/StoryMapFile";
import { textHash } from "../../../src/domain/story/StoryGraph";
import type { ProjectSpec } from "../../../src/domain/progress/Project";

const novel: ProjectSpec = { name: "Novel", scope: "Novel/", targetWords: 1, deadline: null, dailyWords: 0 };
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
  const calls = { opened: [] as string[], revealed: [] as string[], promoted: [] as string[] };
  const src: StoryMapSource = {
    projects: () => [novel],
    activeProject: () => novel,
    activeNotePath: () => "Novel/One.md",
    build: async () => buildStoryGraph("Novel", notes, file),
    openNote: (p) => { calls.opened.push(p); },
    reveal: (r) => { calls.revealed.push(`${r.title}@${r.line}`); },
    promote: async (_p, name) => { calls.promoted.push(name); return `Novel/${name}.md`; },
    analyse: async () => { throw new Error("no model"); },
    ...overrides,
  };
  return { src, calls };
}

async function open(overrides: Partial<StoryMapSource> = {}) {
  const { src, calls } = source(overrides);
  const v = new StoryMapView(new WorkspaceLeaf(), src);
  await v.onOpen();
  return { v, calls, el: v.contentEl };
}

describe("StoryMapView", () => {
  it("has a stable type and names the project", async () => {
    const { v } = await open();
    expect(v.getViewType()).toBe(STORY_MAP_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Story map · Novel");
    expect(v.getIcon()).toBeTruthy();
  });

  it("renders nodes, edges, legend and the timeline", async () => {
    const { el } = await open();
    const nodes = [...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"));
    expect(nodes).toContain("Novel/Characters/Marta Kovács.md");
    expect(nodes).toContain("name:zsofi");
    expect(nodes).toContain("ref:orpheus");
    expect(nodes).not.toContain("Novel/One.md"); // notes hidden by default
    expect(el.querySelector(".czm-node.is-bookmarked .czm-node-star")).not.toBeNull();
    expect(el.querySelectorAll(".czm-edge-relationship")).toHaveLength(1);
    expect(el.querySelectorAll(".czm-edge-reference")).toHaveLength(1);
    expect(el.textContent).toContain("Characters · 2");
    const rows = el.querySelectorAll(".czm-map-timeline tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelectorAll(".czm-map-dot[aria-label]").length).toBe(4);
    expect((rows[0]!.querySelector("th") as HTMLElement).title).toBe("Dawn");
  });

  it("selects a node on click, dims the rest and lists appearances that reveal on click", async () => {
    const { el, calls } = await open();
    const marta = el.querySelector<SVGGElement>('.czm-node[data-id="Novel/Characters/Marta Kovács.md"]')!;
    marta.dispatchEvent(new MouseEvent("pointerdown", { clientX: 0, clientY: 0, bubbles: true }));
    marta.dispatchEvent(new MouseEvent("pointerup", { clientX: 0, clientY: 0, bubbles: true }));
    expect(el.querySelector(".czm-node.is-selected")?.getAttribute("data-id")).toBe("Novel/Characters/Marta Kovács.md");
    // Marta touches every node here, so no node dims — but the Ilse–Lisbon edge does not touch her.
    expect(el.querySelectorAll(".czm-node.is-dim")).toHaveLength(0);
    const ilseLisbon = el.querySelector('.czm-edge[data-from="Novel/Characters/Ilse.md"][data-to="Novel/Places/Lisbon.md"]');
    expect(ilseLisbon?.classList.contains("is-dim")).toBe(true);
    expect(el.querySelector(".czm-map-detail-name")?.textContent).toBe("Marta Kovács");
    expect(el.textContent).toContain("Appears in 1 scene");
    (el.querySelector(".czm-map-side .czm-map-row") as HTMLElement).click();
    expect(calls.revealed).toEqual(["Camp@0"]);
    (el.querySelector(".czm-map-detail-actions button") as HTMLElement).click();
    expect(calls.opened).toEqual(["Novel/Characters/Marta Kovács.md"]);
  });

  it("selects an edge and shows its evidence", async () => {
    const { el } = await open();
    (el.querySelector(".czm-edge-relationship") as SVGLineElement).dispatchEvent(new MouseEvent("click"));
    expect(el.querySelector(".czm-map-detail-name")?.textContent).toContain("Marta Kovács");
    expect(el.textContent).toContain("sister");
    expect(el.textContent).toContain("Seen in");
  });

  it("filters by layer and kind, and searches", async () => {
    const { el } = await open();
    (el.querySelector(".czm-chip-layer-external") as HTMLElement).click();
    expect(el.querySelectorAll(".czm-edge-reference")).toHaveLength(0);
    (el.querySelector(".czm-chip-kind-candidate") as HTMLElement).click();
    expect([...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"))).not.toContain("name:zsofi");
    const search = el.querySelector(".czm-map-search") as HTMLInputElement;
    search.value = "lisbon";
    search.dispatchEvent(new Event("input"));
    const ids = [...el.querySelectorAll(".czm-node")].map((n) => n.getAttribute("data-id"));
    expect(ids).toContain("Novel/Places/Lisbon.md");
    expect(ids).not.toContain("ref:orpheus");
  });

  it("offers to promote a candidate", async () => {
    const { el, calls } = await open();
    const z = el.querySelector<SVGGElement>('.czm-node[data-id="name:zsofi"]')!;
    z.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(el.textContent).toContain("has no note yet");
    (el.querySelector(".czm-map-detail-actions button") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls.promoted).toEqual(["Zsófi"]);
  });

  it("explains when there is no project", async () => {
    const { el } = await open({ projects: () => [], activeProject: () => null });
    expect(el.textContent).toContain("No project yet");
  });

  it("reads a single note from its node details", async () => {
    const paths: (string | null)[] = [];
    const { el } = await open({ analyse: async (_p, path) => { paths.push(path); return 0; } });
    (el.querySelector(".czm-chip-kind-note") as HTMLElement).click();
    el.querySelector<SVGGElement>('.czm-node[data-id="Novel/One.md"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    (el.querySelector(".czm-map-analyse-note") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(paths).toEqual(["Novel/One.md"]);
  });

  it("runs the model over the whole project from the toolbar and reports progress", async () => {
    let signal: AbortSignal | null = null;
    const { el, v } = await open({
      analyse: async (_p, path, _g, s, onProgress) => {
        expect(path).toBeNull();
        signal = s;
        onProgress({ done: 1, total: 1, scene: { path: "Novel/One.md", title: "Camp", line: 0 }, skipped: false });
        return 1;
      },
    });
    const btn = el.querySelector(".czm-map-analyse") as HTMLButtonElement;
    expect(btn.textContent).toBe("Read project with model");
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(signal).not.toBeNull();
    expect(v.contentEl.textContent).toContain("Read 1 scene");
  });

  it("shows the model's own message when no model is configured", async () => {
    const { el, v } = await open();
    (el.querySelector(".czm-map-analyse") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(v.contentEl.textContent).toContain("no model");
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
