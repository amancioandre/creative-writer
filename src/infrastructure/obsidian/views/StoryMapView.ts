import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { ALL_KINDS, ALL_LAYERS, DEFAULT_FILTER, applyFilter, neighbours, type GraphFilter } from "../../../domain/story/Filter";
import { forceLayout, type Point } from "../../../domain/story/Layout";
import { EMPTY_GRAPH, sceneKey, type Edge, type Entity, type EntityKind, type Layer, type SceneRef, type StoryGraph } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import type { AnalyzeProgress } from "../../../application/use-cases/AnalyzeSceneRelations";

export const STORY_MAP_VIEW_TYPE = "creative-writer-story-map";

export interface StoryMapSource {
  projects(): ProjectSpec[];
  /** The project of the active note, if any. */
  activeProject(): ProjectSpec | null;
  activeNotePath(): string | null;
  build(project: ProjectSpec): Promise<StoryGraph>;
  openNote(path: string): void;
  reveal(ref: SceneRef): void;
  /** Creates an entity note for a candidate name and returns its path. */
  promote(project: ProjectSpec, name: string, kind: EntityKind): Promise<string>;
  /** Runs the model over one note's scenes, or the whole project's when `notePath` is null. Throws with a human message when no local model is configured. */
  analyse(project: ProjectSpec, notePath: string | null, graph: StoryGraph, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
}

const SVG = "http://www.w3.org/2000/svg";
const HEIGHT = 520;
const TIMELINE_COLUMNS = 14;
const LAYER_LABEL: Record<Layer, string> = { explicit: "Links", internal: "Scenes", external: "References" };
const KIND_LABEL: Record<EntityKind, string> = { character: "Characters", location: "Places", item: "Items", faction: "Factions", event: "Events", note: "Notes", candidate: "Unnamed", reference: "Outside" };

type Selection = { kind: "node"; id: string } | { kind: "edge"; edge: Edge } | null;

/**
 * The story map: one force-directed graph of the project with three
 * toggleable layers, a details pane, and a timeline of who is in which
 * scene. Rendered as plain SVG so it works anywhere Obsidian does and
 * needs nothing from the `.canvas` format.
 */
export class StoryMapView extends ItemView {
  private project: ProjectSpec | null = null;
  private graph: StoryGraph = EMPTY_GRAPH;
  private filter: GraphFilter = DEFAULT_FILTER;
  private selection: Selection = null;
  private pinned = new Map<string, Point>();
  private positions = new Map<string, Point>();
  private generation = 0;
  private running: AbortController | null = null;
  private status = "";

  constructor(leaf: WorkspaceLeaf, private readonly source: StoryMapSource) {
    super(leaf);
  }

  getViewType(): string { return STORY_MAP_VIEW_TYPE; }
  getDisplayText(): string { return this.project ? `Story map · ${this.project.name}` : "Story map"; }
  getIcon(): string { return "git-fork"; }

  async onOpen(): Promise<void> {
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async onClose(): Promise<void> {
    this.running?.abort();
  }

  /** Rebuilds the graph for a project (the active note's by default) and redraws. */
  async show(project: ProjectSpec | null, keepSelection = false): Promise<void> {
    const generation = ++this.generation;
    if (!project) {
      this.project = null;
      this.graph = EMPTY_GRAPH;
      this.render();
      return;
    }
    if (this.project?.scope !== project.scope) { this.pinned.clear(); this.selection = null; }
    this.project = project;
    const graph = await this.source.build(project);
    if (generation !== this.generation) return;
    this.graph = graph;
    if (!keepSelection) this.selection = this.selection && this.stillValid(this.selection) ? this.selection : null;
    this.render();
  }

  /** Called by the plugin when notes change; cheap, so no debounce here. */
  async refresh(): Promise<void> {
    if (this.project) await this.show(this.project, true);
  }

  private stillValid(sel: Selection): boolean {
    if (!sel) return false;
    if (sel.kind === "node") return this.graph.entities.some((e) => e.id === sel.id);
    return this.graph.edges.some((e) => e.kind === sel.edge.kind && e.from === sel.edge.from && e.to === sel.edge.to && e.label === sel.edge.label);
  }

  render(): void {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "czm-map" });
    this.renderToolbar(root);
    if (!this.project) {
      root.createEl("p", { text: "No project yet. Add `writing-target: 50000` to a note's front matter and its folder becomes one; typed notes (`type: character`, `type: location`, or a Characters/ Places/ folder) become the cast.", cls: "czm-map-hint" });
      return;
    }
    const shown = applyFilter(this.graph, this.filter);
    const body = root.createDiv({ cls: "czm-map-body" });
    const canvas = body.createDiv({ cls: "czm-map-canvas" });
    const side = body.createDiv({ cls: "czm-map-side" });
    this.renderGraph(canvas, shown);
    this.renderDetails(side, shown);
    this.renderTimeline(root, shown);
    if (this.status) root.createDiv({ text: this.status, cls: "czm-map-status" });
  }

  // --- toolbar ---------------------------------------------------------------

  private renderToolbar(root: HTMLElement): void {
    const bar = root.createDiv({ cls: "czm-map-toolbar" });
    const projects = this.source.projects();
    const select = bar.createEl("select", { cls: "dropdown czm-map-project" }) as HTMLSelectElement;
    select.setAttribute("aria-label", "Project");
    for (const p of projects) {
      const opt = select.createEl("option", { text: p.name }) as HTMLOptionElement;
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    select.addEventListener("change", () => void this.show(projects.find((p) => p.scope === select.value) ?? null));

    const search = bar.createEl("input", { cls: "czm-map-search" }) as HTMLInputElement;
    search.type = "search";
    search.placeholder = "Find a name…";
    search.value = this.filter.query;
    search.setAttribute("aria-label", "Find a name");
    search.addEventListener("input", () => { this.filter = { ...this.filter, query: search.value }; this.redraw(); });

    const layers = bar.createDiv({ cls: "czm-map-chips" });
    layers.setAttribute("aria-label", "Layers");
    for (const layer of ALL_LAYERS) this.chip(layers, LAYER_LABEL[layer], this.filter.layers.has(layer), `czm-chip-layer-${layer}`, () => {
      const next = new Set(this.filter.layers);
      if (next.has(layer)) next.delete(layer); else next.add(layer);
      this.filter = { ...this.filter, layers: next };
    });
    const kinds = bar.createDiv({ cls: "czm-map-chips" });
    kinds.setAttribute("aria-label", "Kinds");
    for (const kind of ALL_KINDS) {
      if (!this.graph.entities.some((e) => e.kind === kind)) continue;
      this.chip(kinds, KIND_LABEL[kind], this.filter.kinds.has(kind), `czm-chip-kind-${kind}`, () => {
        const next = new Set(this.filter.kinds);
        if (next.has(kind)) next.delete(kind); else next.add(kind);
        this.filter = { ...this.filter, kinds: next };
      });
    }
    this.chip(kinds, "Hide loners", this.filter.hideIsolated, "czm-chip-isolated", () => { this.filter = { ...this.filter, hideIsolated: !this.filter.hideIsolated }; });

    const actions = bar.createDiv({ cls: "czm-map-actions" });
    if (this.project) {
      const btn = actions.createEl("button", { text: this.running ? "Stop" : "Read project with model", cls: "czm-map-analyse" });
      btn.title = "Asks the local model (Ollama) for relationships, outside references and events in every scene of the project. Scenes already read and unchanged are skipped.";
      btn.addEventListener("click", () => void this.toggleAnalyse(null));
    }
    const relayout = actions.createEl("button", { text: "Re-layout" });
    relayout.addEventListener("click", () => { this.pinned.clear(); this.render(); });
  }

  private chip(parent: HTMLElement, label: string, on: boolean, cls: string, toggle: () => void): void {
    const b = parent.createEl("button", { text: label, cls: `czm-chip ${cls}${on ? " is-on" : ""}` });
    b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () => { toggle(); this.redraw(); });
  }

  /** Redraw after a filter change without rebuilding the graph. */
  private redraw(): void {
    if (this.selection && !this.stillValid(this.selection)) this.selection = null;
    this.render();
  }

  /** The command's entry point: read the active note if there is one, else the whole project; or stop a run in progress. */
  async readActiveNote(): Promise<void> {
    await this.toggleAnalyse(this.source.activeNotePath());
  }

  private async toggleAnalyse(path: string | null): Promise<void> {
    if (this.running) { this.running.abort(); return; }
    const project = this.project;
    if (!project) return;
    this.running = new AbortController();
    this.status = "Reading…";
    this.render();
    try {
      const n = await this.source.analyse(project, path, this.graph, this.running.signal, (p) => {
        this.status = `${p.skipped ? "Unchanged" : "Read"} ${p.done}/${p.total}: ${basenameOf(p.scene.path)} › ${p.scene.title || "(opening)"}`;
        this.render();
      });
      this.status = n === 0 ? "Nothing new to read — every scene is unchanged since its last reading." : `Read ${n} scene${n === 1 ? "" : "s"}.`;
    } catch (e) {
      this.status = e instanceof Error ? e.message : String(e);
    } finally {
      this.running = null;
      await this.show(project, true);
    }
  }

  // --- graph -----------------------------------------------------------------

  private renderGraph(container: HTMLElement, shown: StoryGraph): void {
    const width = Math.max(320, container.clientWidth || 800);
    const height = HEIGHT;
    this.positions = forceLayout(shown.entities, shown.edges, { width, height, iterations: 200 }, this.pinned);
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "czm-map-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Story map of ${shown.project}: ${shown.entities.length} nodes, ${shown.edges.length} edges`);
    container.appendChild(svg);
    if (shown.entities.length === 0) {
      const t = document.createElementNS(SVG, "text");
      t.setAttribute("x", String(width / 2)); t.setAttribute("y", String(height / 2)); t.setAttribute("text-anchor", "middle");
      t.setAttribute("class", "czm-map-empty");
      t.textContent = this.graph.entities.length === 0 ? "Nothing to map yet — name your characters and places in typed notes, or write until names recur." : "Nothing matches the current filter.";
      svg.appendChild(t);
      return;
    }
    const maxMentions = Math.max(1, ...shown.entities.map((e) => e.mentions));
    const selectedId = this.selection?.kind === "node" ? this.selection.id : null;
    const touching = new Set<string>();
    if (selectedId) for (const e of neighbours(shown, selectedId)) { touching.add(e.from); touching.add(e.to); }

    const edgesG = document.createElementNS(SVG, "g");
    for (const edge of shown.edges) {
      const a = this.positions.get(edge.from), b = this.positions.get(edge.to);
      if (!a || !b) continue;
      const line = document.createElementNS(SVG, "line");
      line.setAttribute("x1", f(a.x)); line.setAttribute("y1", f(a.y)); line.setAttribute("x2", f(b.x)); line.setAttribute("y2", f(b.y));
      const selected = this.selection?.kind === "edge" && sameEdge(this.selection.edge, edge);
      const dim = selectedId !== null && edge.from !== selectedId && edge.to !== selectedId;
      line.setAttribute("class", `czm-edge czm-edge-${edge.kind} czm-layer-${edge.layer}${edge.stale ? " is-stale" : ""}${selected ? " is-selected" : ""}${dim ? " is-dim" : ""}`);
      line.setAttribute("stroke-width", f(1 + Math.min(4, Math.sqrt(edge.weight))));
      line.setAttribute("data-from", edge.from); line.setAttribute("data-to", edge.to);
      const title = document.createElementNS(SVG, "title");
      title.textContent = edgeTitle(edge, shown);
      line.appendChild(title);
      line.addEventListener("click", () => { this.selection = { kind: "edge", edge }; this.render(); });
      edgesG.appendChild(line);
    }
    svg.appendChild(edgesG);

    const nodesG = document.createElementNS(SVG, "g");
    for (const e of shown.entities) {
      const p = this.positions.get(e.id)!;
      const g = document.createElementNS(SVG, "g");
      const dim = selectedId !== null && selectedId !== e.id && !touching.has(e.id);
      g.setAttribute("class", `czm-node czm-node-${e.kind}${selectedId === e.id ? " is-selected" : ""}${dim ? " is-dim" : ""}${e.bookmarked ? " is-bookmarked" : ""}`);
      g.setAttribute("transform", `translate(${f(p.x)} ${f(p.y)})`);
      g.setAttribute("data-id", e.id);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      const r = 5 + 9 * Math.sqrt(e.mentions / maxMentions);
      const circle = document.createElementNS(SVG, "circle");
      circle.setAttribute("r", f(r));
      g.appendChild(circle);
      if (e.bookmarked) {
        const star = document.createElementNS(SVG, "text");
        star.setAttribute("class", "czm-node-star"); star.setAttribute("y", f(-r - 3)); star.setAttribute("text-anchor", "middle");
        star.textContent = "★";
        g.appendChild(star);
      }
      const label = document.createElementNS(SVG, "text");
      label.setAttribute("y", f(r + 12)); label.setAttribute("text-anchor", "middle"); label.setAttribute("class", "czm-node-label");
      label.textContent = e.name;
      g.appendChild(label);
      const title = document.createElementNS(SVG, "title");
      title.textContent = `${e.name} — ${KIND_LABEL[e.kind]}${e.mentions ? `, ${e.mentions} mention${e.mentions === 1 ? "" : "s"} in ${e.appearances.length} scene${e.appearances.length === 1 ? "" : "s"}` : ""}`;
      g.appendChild(title);
      this.attachDrag(g, svg, e.id, width, height);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.selection = { kind: "node", id: e.id }; this.render(); } });
      g.addEventListener("dblclick", () => { if (e.path) this.source.openNote(e.path); });
      nodesG.appendChild(g);
    }
    svg.appendChild(nodesG);
  }

  /** Pointer drag pins a node; a click (no movement) selects it. */
  private attachDrag(g: SVGGElement, svg: SVGSVGElement, id: string, width: number, height: number): void {
    let start: { x: number; y: number; px: number; py: number } | null = null;
    let moved = false;
    const toSvg = (ev: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const sx = rect.width ? width / rect.width : 1, sy = rect.height ? height / rect.height : 1;
      return { x: (ev.clientX - rect.left) * sx, y: (ev.clientY - rect.top) * sy };
    };
    g.addEventListener("pointerdown", (ev) => {
      const p = this.positions.get(id)!;
      const m = toSvg(ev);
      start = { x: m.x, y: m.y, px: p.x, py: p.y };
      moved = false;
      g.setPointerCapture?.(ev.pointerId);
    });
    g.addEventListener("pointermove", (ev) => {
      if (!start) return;
      const m = toSvg(ev);
      const dx = m.x - start.x, dy = m.y - start.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      const np = { x: clamp(start.px + dx, 10, width - 10), y: clamp(start.py + dy, 10, height - 10) };
      this.positions.set(id, np);
      this.pinned.set(id, np);
      g.setAttribute("transform", `translate(${f(np.x)} ${f(np.y)})`);
      svg.querySelectorAll<SVGLineElement>(`line[data-from="${cssEscape(id)}"]`).forEach((l) => { l.setAttribute("x1", f(np.x)); l.setAttribute("y1", f(np.y)); });
      svg.querySelectorAll<SVGLineElement>(`line[data-to="${cssEscape(id)}"]`).forEach((l) => { l.setAttribute("x2", f(np.x)); l.setAttribute("y2", f(np.y)); });
    });
    const end = () => {
      if (!start) return;
      start = null;
      if (!moved) { this.selection = this.selection?.kind === "node" && this.selection.id === id ? null : { kind: "node", id }; this.render(); }
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
  }

  // --- details ---------------------------------------------------------------

  private renderDetails(side: HTMLElement, shown: StoryGraph): void {
    const sel = this.selection;
    if (!sel) {
      side.createEl("p", { text: "Click a node or an edge. Drag to pin, double-click to open the note.", cls: "czm-map-hint" });
      this.renderLegend(side, shown);
      return;
    }
    if (sel.kind === "node") {
      const e = this.graph.entities.find((x) => x.id === sel.id);
      if (!e) return;
      const head = side.createDiv({ cls: "czm-map-detail-head" });
      head.createSpan({ text: e.name, cls: "czm-map-detail-name" });
      head.createSpan({ text: KIND_LABEL[e.kind], cls: `czm-map-kind czm-node-${e.kind}` });
      if (e.aliases.length) side.createDiv({ text: `also ${e.aliases.join(", ")}`, cls: "czm-map-hint" });
      const actions = side.createDiv({ cls: "czm-map-detail-actions" });
      if (e.path) {
        const open = actions.createEl("button", { text: "Open note" });
        open.addEventListener("click", () => this.source.openNote(e.path!));
      }
      if (e.kind === "note" && this.graph.timeline.some((t) => t.scene.path === e.path)) {
        const read = actions.createEl("button", { text: this.running ? "Stop" : "Read this note with model", cls: "czm-map-analyse-note" });
        read.addEventListener("click", () => void this.toggleAnalyse(e.path));
      }
      if (e.kind === "candidate" && this.project) {
        side.createEl("p", { text: `Mentioned ${e.mentions} times but has no note yet.`, cls: "czm-map-hint" });
        for (const kind of ["character", "location"] as const) {
          const b = actions.createEl("button", { text: kind === "character" ? "Make character" : "Make place" });
          b.addEventListener("click", () => void this.promote(e, kind));
        }
      }
      if (e.appearances.length) {
        side.createEl("h4", { text: `Appears in ${e.appearances.length} scene${e.appearances.length === 1 ? "" : "s"}` });
        this.sceneList(side, e.appearances);
      }
      const links = neighbours(shown, e.id);
      if (links.length) {
        side.createEl("h4", { text: "Connected to" });
        const list = side.createDiv({ cls: "czm-map-list" });
        for (const edge of links) {
          const otherId = edge.from === e.id ? edge.to : edge.from;
          const other = this.graph.entities.find((x) => x.id === otherId);
          if (!other) continue;
          const row = list.createDiv({ cls: `czm-map-row czm-layer-${edge.layer}${edge.stale ? " is-stale" : ""}` });
          row.setAttribute("role", "button"); row.setAttribute("tabindex", "0");
          row.createSpan({ text: other.name, cls: "czm-map-row-name" });
          row.createSpan({ text: edgeSummary(edge), cls: "czm-map-row-meta" });
          row.addEventListener("click", () => { this.selection = { kind: "edge", edge }; this.render(); });
        }
      }
      return;
    }
    const edge = sel.edge;
    const a = this.graph.entities.find((x) => x.id === edge.from), b = this.graph.entities.find((x) => x.id === edge.to);
    const head = side.createDiv({ cls: "czm-map-detail-head" });
    head.createSpan({ text: `${a?.name ?? edge.from} — ${b?.name ?? edge.to}`, cls: "czm-map-detail-name" });
    side.createDiv({ text: edgeSummary(edge), cls: `czm-map-kind czm-layer-${edge.layer}` });
    if (edge.stale) side.createEl("p", { text: "The scene has changed since the model read it. Re-read the note to refresh.", cls: "czm-map-warn" });
    if (edge.kind === "link") side.createEl("p", { text: "A link one of these notes makes to the other.", cls: "czm-map-hint" });
    if (edge.evidence.length) {
      side.createEl("h4", { text: edge.kind === "co-occurrence" ? "Share these scenes" : "Seen in" });
      this.sceneList(side, edge.evidence);
    }
  }

  private renderLegend(side: HTMLElement, shown: StoryGraph): void {
    const counts = new Map<EntityKind, number>();
    for (const e of shown.entities) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    if (counts.size === 0) return;
    const legend = side.createDiv({ cls: "czm-map-legend" });
    for (const [kind, n] of counts) {
      const row = legend.createDiv({ cls: "czm-map-legend-row" });
      row.createSpan({ cls: `czm-map-swatch czm-node-${kind}` });
      row.createSpan({ text: `${KIND_LABEL[kind]} · ${n}` });
    }
    const layers = side.createDiv({ cls: "czm-map-legend" });
    for (const layer of ALL_LAYERS) {
      const n = shown.edges.filter((e) => e.layer === layer).length;
      const row = layers.createDiv({ cls: "czm-map-legend-row" });
      row.createSpan({ cls: `czm-map-line czm-layer-${layer}` });
      row.createSpan({ text: `${LAYER_LABEL[layer]} · ${n}` });
    }
    const stale = shown.edges.filter((e) => e.stale).length;
    if (stale) side.createEl("p", { text: `${stale} model edge${stale === 1 ? "" : "s"} dashed: their scenes changed since the last reading.`, cls: "czm-map-hint" });
  }

  private sceneList(parent: HTMLElement, refs: readonly SceneRef[]): void {
    const list = parent.createDiv({ cls: "czm-map-list" });
    for (const ref of refs) {
      const row = list.createDiv({ cls: "czm-map-row" });
      row.setAttribute("role", "button"); row.setAttribute("tabindex", "0");
      row.createSpan({ text: ref.title || "(opening)", cls: "czm-map-row-name" });
      row.createSpan({ text: basenameOf(ref.path), cls: "czm-map-row-meta" });
      row.addEventListener("click", () => this.source.reveal(ref));
      row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") this.source.reveal(ref); });
    }
  }

  private async promote(e: Entity, kind: EntityKind): Promise<void> {
    if (!this.project) return;
    const path = await this.source.promote(this.project, e.name, kind);
    this.selection = { kind: "node", id: path };
    await this.show(this.project, true);
  }

  // --- timeline --------------------------------------------------------------

  private renderTimeline(root: HTMLElement, shown: StoryGraph): void {
    const rows = this.graph.timeline;
    if (rows.length === 0) return;
    const visible = new Set(shown.entities.map((e) => e.id));
    const columns = this.graph.entities
      .filter((e) => visible.has(e.id) && e.appearances.length > 0 && e.kind !== "note" && e.kind !== "reference")
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, TIMELINE_COLUMNS);
    if (columns.length === 0) return;
    root.createEl("h4", { text: "Who is where", cls: "czm-map-h" });
    const wrap = root.createDiv({ cls: "czm-map-timeline-wrap" });
    const table = wrap.createEl("table", { cls: "czm-map-timeline" });
    const thead = table.createEl("thead").createEl("tr");
    thead.createEl("th", { text: "Scene" });
    for (const c of columns) {
      const th = thead.createEl("th", { cls: `czm-map-col czm-node-${c.kind}` });
      th.createSpan({ text: c.name });
      th.title = c.name;
      th.addEventListener("click", () => { this.selection = { kind: "node", id: c.id }; this.render(); });
    }
    const tbody = table.createEl("tbody");
    let lastPath = "";
    for (const row of rows) {
      const tr = tbody.createEl("tr", { cls: row.scene.path !== lastPath ? "is-new-note" : "" });
      lastPath = row.scene.path;
      const th = tr.createEl("th", { cls: "czm-map-scene" });
      th.setAttribute("role", "button"); th.setAttribute("tabindex", "0");
      th.createSpan({ text: `${row.bookmarked ? "★ " : ""}${row.scene.title || "(opening)"}`, cls: "czm-map-row-name" });
      th.createSpan({ text: `${basenameOf(row.scene.path)} · ${row.words} w`, cls: "czm-map-row-meta" });
      if (row.events.length) th.title = row.events.join("\n");
      th.addEventListener("click", () => this.source.reveal(row.scene));
      th.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") this.source.reveal(row.scene); });
      const present = new Set(row.present);
      for (const c of columns) {
        const td = tr.createEl("td", { cls: present.has(c.id) ? `czm-map-dot czm-node-${c.kind}` : "czm-map-dot" });
        if (present.has(c.id)) td.setAttribute("aria-label", `${c.name} in ${row.scene.title || sceneKey(row.scene)}`);
      }
    }
  }
}

function f(n: number): string { return n.toFixed(1); }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
function sameEdge(a: Edge, b: Edge): boolean { return a.kind === b.kind && a.from === b.from && a.to === b.to && a.label === b.label; }
function cssEscape(s: string): string { return s.replace(/["\\]/g, "\\$&"); }

export function edgeSummary(edge: Edge): string {
  switch (edge.kind) {
    case "link": return "linked";
    case "appearance": return `appears · ${edge.weight}`;
    case "co-occurrence": return `${edge.weight} scene${edge.weight === 1 ? "" : "s"} together`;
    case "relationship": return edge.label;
    case "reference": return edge.label || "reference";
  }
}

function edgeTitle(edge: Edge, g: StoryGraph): string {
  const name = (id: string) => g.entities.find((e) => e.id === id)?.name ?? id;
  return `${name(edge.from)} — ${name(edge.to)}: ${edgeSummary(edge)}${edge.stale ? " (stale)" : ""}`;
}
