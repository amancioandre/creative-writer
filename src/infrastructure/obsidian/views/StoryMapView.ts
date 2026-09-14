import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import { couldNot, StatusLine } from "./StatusLine";
import { PanelShell, type Fix, type PanelId } from "./PanelShell";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { DEFAULT_DISPLAY, DEFAULT_FORCES, DEFAULT_STORY_COLORS, DEFAULT_STORY_MAP, DISPLAY_RANGES, FORCE_RANGES, STORY_KINDS, STORY_LAYERS, type DisplaySettings, type ForceSettings, type StoryEntityKind, type StoryLayer, type StoryMapSettings } from "../../../domain/settings/Settings";
import { applyFilter, explainEmpty, neighbours, type GraphFilter } from "../../../domain/story/Filter";
import { Simulation, type Point } from "../../../domain/story/Simulation";
import { EMPTY_GRAPH, type Edge, type Entity, type EntityKind, type SceneRef, type StoryGraph } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import type { Layout } from "../../../domain/story/StoryMapFile";
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
  /** Remembers, in the project note's front matter, that a name is not a name. */
  ignore(project: ProjectSpec, name: string): Promise<void>;
  unignore(project: ProjectSpec, name: string): Promise<void>;
  /** Adds a name to an existing entity note's `aliases`. */
  alias(project: ProjectSpec, entityPath: string, name: string): Promise<void>;
  /** Writes (or relabels, when `previousLabel` is given) a `## Relationships` line in `fromPath` pointing at `toPath`. */
  setRelation(fromPath: string, toPath: string, label: string, previousLabel?: string): Promise<void>;
  removeRelation(fromPath: string, toPath: string, label: string): Promise<void>;
  /** Renames a note (links follow); returns the new path. */
  rename(path: string, name: string): Promise<string>;
  /** Moves a note to the trash and returns its text as it was, so the deletion can be taken back. */
  remove(path: string): Promise<string>;
  /** Puts a note back at `path` with `text`: recreated when it is gone, rewritten when something is there. */
  restore(path: string, text: string): Promise<void>;
  loadLayout(project: ProjectSpec): Promise<Layout>;
  saveLayout(project: ProjectSpec, layout: Layout): Promise<void>;
  /** Runs the model over one note's scenes, or the whole project's when `notePath` is null. Throws with a human message when no local model is configured. */
  analyse(project: ProjectSpec, notePath: string | null, graph: StoryGraph, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  settings(): StoryMapSettings;
  updateSettings(next: StoryMapSettings): void;
  /** Opens a sibling panel, for the same project where the panel takes one. */
  jumpTo(to: PanelId, project: ProjectSpec | null): void;
}

const SVG = "http://www.w3.org/2000/svg";
export const LAYER_LABEL: Record<StoryLayer, string> = { explicit: "Links", internal: "Scenes", external: "References" };
export const KIND_LABEL: Record<StoryEntityKind, string> = { character: "Characters", location: "Places", item: "Items", faction: "Factions", event: "Events", note: "Notes", candidate: "Unnamed", reference: "Outside" };
const FORCE_LABEL: Record<keyof ForceSettings, string> = { repulsion: "Repulsion", linkDistance: "Link distance", linkStrength: "Link strength", gravity: "Centre pull" };
const DISPLAY_LABEL: Record<keyof DisplaySettings, string> = { nodeSize: "Node size", edgeWidth: "Edge thickness", edgeOpacity: "Edge opacity", labelSize: "Label size" };
const MIN_ZOOM = 0.15, MAX_ZOOM = 5;

type Selection = { kind: "node"; id: string } | { kind: "edge"; edge: Edge } | { kind: "new-edge"; from: string; to: string } | null;
const ENTITY_EXITS: readonly [string, EntityKind, string][] = [["Character", "character", "czm-act-character"], ["Place", "location", "czm-act-place"], ["Item", "item", "czm-act-item"], ["Faction", "faction", "czm-act-faction"], ["Event", "event", "czm-act-event"]];

/**
 * The story map fills its leaf like Obsidian's own graph view: the graph
 * underneath, a floating panel top-right (filters, forces, colours,
 * actions), and a floating card beside whatever is selected. Pan by
 * dragging the background, zoom with the wheel, drag nodes to move them.
 * The simulation runs live and cools to rest.
 */
export class StoryMapView extends ItemView {
  private project: ProjectSpec | null = null;
  private graph: StoryGraph = EMPTY_GRAPH;
  private shown: StoryGraph = EMPTY_GRAPH;
  private selection: Selection = null;
  private focusId: string | null = null;
  private query = "";
  private generation = 0;
  private running: AbortController | null = null;
  private readonly sim = new Simulation(DEFAULT_FORCES, 0, 0);
  private frame: number | null = null;
  private view = { x: 0, y: 0, k: 1 };
  private fitted = false;
  private saveTimer: number | null = null;
  private pendingSettings: StoryMapSettings | null = null;
  /** Hand-placed positions as last loaded or saved; hidden nodes keep theirs. */
  private layout: Layout = {};
  private layoutTimer: number | null = null;
  /** Node a new relationship is being drawn from, while in link mode. */
  private linking: string | null = null;
  /** Where (in graph space) the new-node form was opened. */
  private composerAt: Point | null = null;

  // DOM kept between ticks
  private root!: HTMLElement;
  private svg!: SVGSVGElement;
  private viewport!: SVGGElement;
  private nodeEls = new Map<string, SVGGElement>();
  /** One entry per edge: the path, its inline label (when the edge has one) and its lane among the edges of the same pair (0 when alone). */
  private edgeEls: { el: SVGPathElement; label: SVGTextElement | null; edge: Edge; lane: number }[] = [];
  private rubber!: SVGLineElement;
  private card!: HTMLElement;
  private composer!: HTMLElement;
  private panel!: HTMLElement;
  private status!: StatusLine;
  private shell!: PanelShell;
  private scopeSelect!: HTMLSelectElement;
  private search!: HTMLInputElement;
  private emptyEl: HTMLElement | null = null;
  private filter: GraphFilter = { layers: new Set(), kinds: new Set(), query: "", hideIsolated: false };

  constructor(leaf: WorkspaceLeaf, private readonly source: StoryMapSource) {
    super(leaf);
  }

  getViewType(): string { return STORY_MAP_VIEW_TYPE; }
  getDisplayText(): string { return "Story map"; }
  getIcon(): string { return "git-fork"; }

  async onOpen(): Promise<void> {
    this.mount();
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async onClose(): Promise<void> {
    this.running?.abort();
    this.stopLoop();
    this.flushSettings();
    this.flushLayout();
  }

  private get settings(): StoryMapSettings { return this.pendingSettings ?? this.source.settings(); }

  /** Rebuilds the graph for a project and redraws; positions of surviving nodes are kept. */
  async show(project: ProjectSpec | null, keepSelection = false): Promise<void> {
    const generation = ++this.generation;
    if (this.project?.scope !== project?.scope) { this.selection = null; this.focusId = null; this.fitted = false; this.cancelLink(); this.closeComposer(); this.flushLayout(); this.layout = {}; }
    this.project = project;
    if (!project) { this.graph = EMPTY_GRAPH; this.rebuild(); return; }
    const [graph, layout] = await Promise.all([this.source.build(project), this.source.loadLayout(project)]);
    if (generation !== this.generation) return;
    this.graph = graph;
    this.layout = layout;
    // Nodes the writer placed by hand come back where they were; nodes already on screen keep going.
    for (const [id, p] of Object.entries(layout)) if (!this.sim.position(id)) this.sim.seed(id, p, true);
    if (!keepSelection || !this.stillValid(this.selection)) this.selection = this.stillValid(this.selection) ? this.selection : null;
    this.rebuild(true);
  }

  async refresh(): Promise<void> {
    if (this.project) await this.show(this.project, true);
  }

  private stillValid(sel: Selection): boolean {
    if (!sel) return false;
    if (sel.kind === "node") return this.graph.entities.some((e) => e.id === sel.id);
    if (sel.kind === "new-edge") return this.graph.entities.some((e) => e.id === sel.from) && this.graph.entities.some((e) => e.id === sel.to);
    return this.graph.edges.some((e) => sameEdge(e, sel.edge));
  }

  /** After a refresh, point the selection at the graph's own copy of an edge (with its evidence and conflicts). */
  private selectEdgeLike(kind: Edge["kind"], from: string, to: string, label: string): void {
    const probe = { kind, from, to, label } as Edge;
    const real = this.graph.edges.find((e) => sameEdge(e, probe) || sameEdge(e, { ...probe, from: to, to: from }));
    this.selection = real ? { kind: "edge", edge: real } : { kind: "node", id: from };
  }

  // --- skeleton ----------------------------------------------------------------

  private mount(): void {
    this.contentEl.empty();
    this.contentEl.addClass("czm-map-host");
    this.shell = new PanelShell(this.contentEl, {
      current: "map",
      jump: (to) => this.source.jumpTo(to, this.project),
      side: { isOpen: () => this.settings.panelOpen, onToggle: () => this.saveSettings({ ...this.settings, panelOpen: !this.settings.panelOpen }) },
    });
    this.root = this.shell.main;
    this.root.addClass("czm-map");
    this.scopeSelect = this.shell.scope.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } });
    this.scopeSelect.addEventListener("change", () => void this.show(this.source.projects().find((p) => p.scope === this.scopeSelect.value) ?? null));
    this.search = this.shell.scope.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Find a name…", "aria-label": "Find a name" } });
    this.search.addEventListener("input", () => { this.query = this.search.value; this.rebuild(); });
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", "czm-map-svg");
    this.svg.setAttribute("role", "img");
    this.root.appendChild(this.svg);
    this.viewport = document.createElementNS(SVG, "g");
    this.svg.appendChild(this.viewport);
    this.rubber = document.createElementNS(SVG, "line");
    this.rubber.setAttribute("class", "czm-map-rubber");
    this.svg.appendChild(this.rubber);
    this.attachPanZoom();

    this.panel = this.shell.side;
    this.card = this.root.createDiv({ cls: "czm-map-card" });
    this.composer = this.root.createDiv({ cls: "czm-map-new" });
    this.status = new StatusLine(this.root);
    this.root.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (this.linking) { this.cancelLink(); return; }
      if (this.composerAt) { this.closeComposer(); return; }
      this.select(null);
    });
    this.root.tabIndex = -1;
  }

  /** Recompute the visible subgraph, rebuild SVG elements, restart the simulation. */
  private rebuild(reheat = false): void {
    const s = this.settings;
    const filter: GraphFilter = {
      layers: new Set(STORY_LAYERS.filter((l) => s.layers[l])),
      kinds: new Set(STORY_KINDS.filter((k) => s.kinds[k])),
      query: this.query,
      hideIsolated: s.hideIsolated,
      focusId: this.focusId,
    };
    this.filter = filter;
    this.shown = applyFilter(this.graph, filter);
    this.sim.setForces(s.forces);
    this.sim.setGraph(this.shown.entities, this.shown.edges);
    if (reheat) this.sim.settle(60);
    this.renderGraph();
    this.renderPanel();
    this.renderCard();

    this.startLoop();
    if (!this.fitted) { this.fit(); this.fitted = true; }
  }

  // --- graph ---------------------------------------------------------------------

  private renderGraph(): void {
    this.viewport.replaceChildren();
    this.nodeEls.clear();
    this.edgeEls = [];
    const shown = this.shown;
    this.svg.setAttribute("aria-label", `Story map of ${shown.project}: ${shown.entities.length} nodes, ${shown.edges.length} edges`);
    const colors = this.settings.colors;
    const display = this.settings.display;
    this.viewport.style.setProperty("--czm-edge-opacity", String(display.edgeOpacity));
    this.viewport.style.setProperty("--czm-label-size", `${display.labelSize}px`);
    this.viewport.classList.toggle("czm-no-labels", display.labelSize === 0);
    const edgesG = document.createElementNS(SVG, "g");
    const labelsG = document.createElementNS(SVG, "g");
    // Authored edges paint last, so a hand-drawn line sits on top of whatever the prose or the model says about the same pair.
    const ordered = [...shown.edges].sort((a, b) => Number(a.kind === "authored") - Number(b.kind === "authored"));
    const lanes = edgeLanes(ordered);
    for (const edge of ordered) {
      const lane = lanes.get(edge) ?? 0;
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("class", `czm-edge czm-edge-${edge.kind} czm-layer-${edge.layer}${edge.stale ? " is-stale" : ""}${edge.conflict.length ? " is-conflict" : ""}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-width", f((1 + Math.min(4, Math.sqrt(edge.weight))) * display.edgeWidth));
      path.setAttribute("data-from", edge.from); path.setAttribute("data-to", edge.to);
      const title = document.createElementNS(SVG, "title");
      title.textContent = edgeTitle(edge, shown);
      path.appendChild(title);
      const pick = (ev: Event) => { ev.stopPropagation(); this.select({ kind: "edge", edge }); };
      path.addEventListener("click", pick);
      edgesG.appendChild(path);
      // A labelled edge (a relationship, yours or the model's, or a reference) says what it is on the line itself.
      let label: SVGTextElement | null = null;
      if (edge.label) {
        label = document.createElementNS(SVG, "text");
        label.setAttribute("class", `czm-edge-label czm-edge-label-${edge.kind}`);
        label.setAttribute("text-anchor", "middle");
        label.textContent = edge.label;
        label.addEventListener("click", pick);
        labelsG.appendChild(label);
      }
      this.edgeEls.push({ el: path, label, edge, lane });
    }
    this.viewport.appendChild(edgesG);
    this.viewport.appendChild(labelsG);

    const maxMentions = Math.max(1, ...shown.entities.map((e) => e.mentions));
    const nodesG = document.createElementNS(SVG, "g");
    for (const e of shown.entities) {
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("class", `czm-node czm-node-${e.kind}${e.bookmarked ? " is-bookmarked" : ""}`);
      g.setAttribute("data-id", e.id);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.style.setProperty("--czm-kind", colors[e.kind]);
      const r = (5 + 9 * Math.sqrt(e.mentions / maxMentions)) * display.nodeSize;
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
      this.attachNodeDrag(g, e.id);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); this.select({ kind: "node", id: e.id }); } });
      g.addEventListener("dblclick", (ev) => { ev.stopPropagation(); if (e.path) this.source.openNote(e.path); });
      nodesG.appendChild(g);
      this.nodeEls.set(e.id, g);
    }
    this.viewport.appendChild(nodesG);
    this.emptyEl?.remove();
    this.emptyEl = null;
    if (shown.entities.length === 0) this.emptyEl = this.renderEmpty();
    this.applySelectionClasses();
    this.paint();
  }

  /** Nothing to draw: say why, and offer the one click that changes it. */
  private renderEmpty(): HTMLElement {
    if (!this.project) return this.shell.empty("No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one.");
    if (this.graph.entities.length === 0) return this.shell.empty("Nothing to map yet — double-click here to add a character or place, or write until names recur.", [{ label: "Add a node", cls: "czm-map-add-empty", onClick: () => this.openComposerAtCentre() }]);
    const why = explainEmpty(this.graph, this.filter);
    if (why.length === 0) return this.shell.empty("Nothing matches the current filters.", [{ label: "Reset filters", cls: "czm-map-reset-filters", onClick: () => this.resetFilters() }]);
    const n = (c: number) => `${c} node${c === 1 ? "" : "s"}`;
    const reasons = why.map((w) => w.cause === "query" ? `“${this.query.trim()}” matches nothing`
      : w.cause === "isolated" ? `Hide loners is hiding ${n(w.count)}`
      : w.cause === "kinds" ? `hidden kinds hold ${n(w.count)}`
      : w.cause === "layers" ? `hidden layers would connect ${n(w.count)}`
      : `the focus leaves out ${n(w.count)}`);
    const fixes: Fix[] = why.map((w) => w.cause === "query" ? { label: "Clear search", cls: "czm-map-fix-query", onClick: () => { this.query = ""; this.search.value = ""; this.rebuild(); } }
      : w.cause === "isolated" ? { label: "Show loners", cls: "czm-map-fix-isolated", onClick: () => { this.saveSettings({ ...this.settings, hideIsolated: false }); this.rebuild(); } }
      : w.cause === "kinds" ? { label: "Show all kinds", cls: "czm-map-fix-kinds", onClick: () => { this.saveSettings({ ...this.settings, kinds: Object.fromEntries(STORY_KINDS.map((k) => [k, true])) as Record<StoryEntityKind, boolean> }); this.rebuild(); } }
      : w.cause === "layers" ? { label: "Show all layers", cls: "czm-map-fix-layers", onClick: () => { this.saveSettings({ ...this.settings, layers: Object.fromEntries(STORY_LAYERS.map((l) => [l, true])) as Record<StoryLayer, boolean> }); this.rebuild(); } }
      : { label: "Show all", cls: "czm-map-fix-focus", onClick: () => { this.focusId = null; this.rebuild(); } });
    return this.shell.empty(`Nothing to show: ${reasons.join("; ")}.`, fixes);
  }

  /** Back to the defaults: every layer and kind as shipped, loners shown, no search, no focus. */
  private resetFilters(): void {
    this.saveSettings({ ...this.settings, layers: DEFAULT_STORY_MAP.layers, kinds: DEFAULT_STORY_MAP.kinds, hideIsolated: DEFAULT_STORY_MAP.hideIsolated });
    this.query = ""; this.search.value = ""; this.focusId = null;
    this.rebuild();
  }

  /** How many of the filters differ from the defaults, counting the search and the focus. */
  private filtersOn(): number {
    const s = this.settings;
    return STORY_LAYERS.filter((l) => s.layers[l] !== DEFAULT_STORY_MAP.layers[l]).length
      + STORY_KINDS.filter((k) => s.kinds[k] !== DEFAULT_STORY_MAP.kinds[k]).length
      + (s.hideIsolated !== DEFAULT_STORY_MAP.hideIsolated ? 1 : 0) + (this.query.trim() ? 1 : 0) + (this.focusId ? 1 : 0);
  }

  private openComposerAtCentre(): void {
    const r = this.svg.getBoundingClientRect();
    this.openComposer(this.toWorld(r.left + (r.width || 800) / 2, r.top + (r.height || 600) / 2));
  }

  private paintRubber(): void {
    const from = this.linking ? this.sim.position(this.linking) : undefined;
    this.rubber.classList.toggle("is-open", !!from);
    if (!from) return;
    const a = this.toScreen(from);
    this.rubber.setAttribute("x1", f(a.x)); this.rubber.setAttribute("y1", f(a.y));
    if (!this.rubber.hasAttribute("x2")) { this.rubber.setAttribute("x2", f(a.x)); this.rubber.setAttribute("y2", f(a.y)); }
  }

  /** Move every element to the simulation's current positions. Called per frame. */
  private paint(): void {
    for (const [id, g] of this.nodeEls) {
      const p = this.sim.position(id);
      if (p) g.setAttribute("transform", `translate(${f(p.x)} ${f(p.y)})`);
    }
    for (const { el, label, edge, lane } of this.edgeEls) {
      const a = this.sim.position(edge.from), b = this.sim.position(edge.to);
      if (!a || !b) continue;
      const geo = edgeGeometry(a, b, lane, edge.from < edge.to);
      el.setAttribute("d", geo.d);
      if (label) {
        label.setAttribute("x", f(geo.mid.x)); label.setAttribute("y", f(geo.mid.y));
        label.setAttribute("transform", `rotate(${geo.angle.toFixed(1)} ${f(geo.mid.x)} ${f(geo.mid.y)})`);
      }
    }
    this.viewport.setAttribute("transform", `translate(${f(this.view.x)} ${f(this.view.y)}) scale(${this.view.k.toFixed(3)})`);
    this.placeCard();
    this.placeComposer();
    this.paintRubber();
  }

  private startLoop(): void {
    if (this.frame !== null) return;
    const step = () => {
      const moving = this.sim.tick();
      this.paint();
      this.frame = moving ? window.requestAnimationFrame(step) : null;
    };
    this.frame = window.requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private applySelectionClasses(): void {
    const sel = this.selection;
    const selectedId = sel?.kind === "node" ? sel.id : null;
    const touching = new Set<string>();
    if (selectedId) for (const e of neighbours(this.shown, selectedId)) { touching.add(e.from); touching.add(e.to); }
    for (const [id, g] of this.nodeEls) {
      g.classList.toggle("is-selected", selectedId === id);
      g.classList.toggle("is-dim", selectedId !== null && selectedId !== id && !touching.has(id));
      g.classList.toggle("is-pinned", this.sim.isPinned(id));
    }
    for (const { el, label, edge } of this.edgeEls) {
      const selected = sel?.kind === "edge" && sameEdge(sel.edge, edge);
      const dim = selectedId !== null && edge.from !== selectedId && edge.to !== selectedId;
      el.classList.toggle("is-selected", selected); el.classList.toggle("is-dim", dim);
      label?.classList.toggle("is-selected", selected); label?.classList.toggle("is-dim", dim);
    }
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.applySelectionClasses();
    this.renderCard();
    this.paint();
  }

  // --- navigation ----------------------------------------------------------------

  private toWorld(clientX: number, clientY: number): Point {
    const rect = this.svg.getBoundingClientRect();
    return { x: (clientX - rect.left - this.view.x) / this.view.k, y: (clientY - rect.top - this.view.y) / this.view.k };
  }

  private toScreen(p: Point): Point {
    return { x: p.x * this.view.k + this.view.x, y: p.y * this.view.k + this.view.y };
  }

  private attachPanZoom(): void {
    let pan: { x: number; y: number; vx: number; vy: number } | null = null;
    let moved = false;
    this.svg.addEventListener("pointerdown", (ev) => {
      if ((ev.target as Element | null)?.closest?.(".czm-node, .czm-edge")) return;
      pan = { x: ev.clientX, y: ev.clientY, vx: this.view.x, vy: this.view.y };
      moved = false;
      this.svg.setPointerCapture?.(ev.pointerId);
    });
    this.svg.addEventListener("pointermove", (ev) => {
      if (this.linking) {
        const rect = this.svg.getBoundingClientRect();
        this.rubber.setAttribute("x2", f(ev.clientX - rect.left)); this.rubber.setAttribute("y2", f(ev.clientY - rect.top));
      }
      if (!pan) return;
      const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      this.view = { ...this.view, x: pan.vx + dx, y: pan.vy + dy };
      this.paint();
    });
    const end = () => {
      if (pan && !moved) { if (this.linking) this.cancelLink(); else if (this.composerAt) this.closeComposer(); else this.select(null); }
      pan = null;
    };
    this.svg.addEventListener("pointerup", end);
    this.svg.addEventListener("pointercancel", end);
    this.svg.addEventListener("dblclick", (ev) => {
      if ((ev.target as Element | null)?.closest?.(".czm-node, .czm-edge")) return;
      this.openComposer(this.toWorld(ev.clientX, ev.clientY));
    });
    this.svg.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      this.zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });
  }

  zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = this.svg.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const k = clamp(this.view.k * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = k / this.view.k;
    this.view = { k, x: px - (px - this.view.x) * ratio, y: py - (py - this.view.y) * ratio };
    this.paint();
  }

  /** Zoom and pan so every visible node is on screen. */
  fit(): void {
    const rect = this.svg.getBoundingClientRect();
    const w = rect.width || this.svg.clientWidth || 800, h = rect.height || this.svg.clientHeight || 600;
    const pts = [...this.sim.positions().values()];
    if (pts.length === 0) { this.view = { x: w / 2, y: h / 2, k: 1 }; this.paint(); return; }
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60, minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + 60;
    const k = clamp(Math.min(w / (maxX - minX), h / (maxY - minY), 1.6), MIN_ZOOM, MAX_ZOOM);
    this.view = { k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k };
    this.paint();
  }

  private attachNodeDrag(g: SVGGElement, id: string): void {
    let start: { x: number; y: number } | null = null;
    let moved = false;
    g.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      start = { x: ev.clientX, y: ev.clientY };
      moved = false;
      g.setPointerCapture?.(ev.pointerId);
    });
    g.addEventListener("pointermove", (ev) => {
      if (!start) return;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 3) return;
      moved = true;
      this.sim.drag(id, this.toWorld(ev.clientX, ev.clientY));
      this.startLoop();
      this.paint();
    });
    const end = (ev: PointerEvent) => {
      ev.stopPropagation();
      if (!start) return;
      start = null;
      if (moved) { this.applySelectionClasses(); this.renderCard(); this.queueLayoutSave(); return; }
      if (this.linking) { if (this.linking === id) this.cancelLink(); else this.finishLink(id); return; }
      if (ev.shiftKey) { this.startLink(id); return; }
      this.select(this.selection?.kind === "node" && this.selection.id === id ? null : { kind: "node", id });
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
  }

  // --- drawing: nodes and relationships by hand -------------------------------------

  /** Link mode: the next node clicked becomes the other end of a new relationship. */
  startLink(id: string): void {
    const e = this.graph.entities.find((x) => x.id === id);
    if (!e) return;
    if (!e.path) { this.flash(`${e.name} has no note yet — make one first (What is this? on its card).`); return; }
    this.closeComposer();
    this.linking = id;
    this.selection = { kind: "node", id };
    this.rubber.removeAttribute("x2"); this.rubber.removeAttribute("y2");
    this.root.classList.add("is-linking");
    this.status.hold(`Connecting ${e.name} — click another node, Esc to cancel.`);
    this.applySelectionClasses(); this.renderCard(); this.paint();
  }

  cancelLink(): void {
    if (!this.linking) return;
    this.linking = null;
    this.root.classList.remove("is-linking");
    this.status.clear();
this.renderCard(); this.paint();
  }

  private finishLink(to: string): void {
    const from = this.linking!;
    const target = this.graph.entities.find((x) => x.id === to);
    if (!target?.path) { this.flash(`${target?.name ?? to} has no note yet — make one first.`); return; }
    this.linking = null;
    this.root.classList.remove("is-linking");
    this.status.clear();

    this.select({ kind: "new-edge", from, to });
    this.card.querySelector<HTMLInputElement>(".czm-map-label-input")?.focus();
  }

  private async writeRelation(fromPath: string, toPath: string, label: string, previousLabel?: string): Promise<void> {
    if (!this.project) return;
    try {
      await this.source.setRelation(fromPath, toPath, label, previousLabel);
    } catch (e) { this.status.fail(couldNot("write the relationship", e)); return; }
    await this.show(this.project, true);
    this.selectEdgeLike("authored", fromPath, toPath, label);
    this.select(this.selection);
  }

  private async eraseRelation(edge: Edge): Promise<void> {
    if (!this.project) return;
    const holder = edge.evidence[0]?.path ?? edge.from;
    const other = holder === edge.from ? edge.to : edge.from;
    const project = this.project;
    try { await this.source.removeRelation(holder, other, edge.label); } catch (e) { this.status.fail(couldNot("remove the relationship", e)); return; }
    this.selection = { kind: "node", id: holder };
    await this.show(project, true);
    this.status.undoable(`Relationship “${edge.label}” removed`, async () => {
      await this.source.setRelation(holder, other, edge.label);
      await this.show(project, true);
    });
  }

  /** The floating "new node" form, at a point in graph space. */
  openComposer(at: Point): void {
    if (!this.project) return;
    this.cancelLink();
    this.composerAt = at;
    this.composer.empty();
    this.composer.classList.add("is-open");
    const input = this.composer.createEl("input", { cls: "czm-map-new-name", attr: { type: "text", placeholder: "Name…", "aria-label": "Name of the new node" } });
    const grid = this.composer.createDiv({ cls: "czm-map-exits" });
    const create = (kind: EntityKind) => { const name = input.value.trim(); if (name) void this.createNode(name, kind, at); else input.focus(); };
    for (const [label, kind, cls] of ENTITY_EXITS) {
      const b = grid.createEl("button", { text: label, cls });
      b.style.setProperty("--czm-kind", this.settings.colors[kind]);
      b.addEventListener("click", () => create(kind));
    }
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") create("character"); if (ev.key === "Escape") { ev.stopPropagation(); this.closeComposer(); } });
    const cancel = this.composer.createEl("button", { text: "Cancel", cls: "czm-map-new-cancel" });
    cancel.addEventListener("click", () => this.closeComposer());
    this.placeComposer();
    input.focus();
  }

  closeComposer(): void {
    if (!this.composerAt) return;
    this.composerAt = null;
    this.composer.empty();
    this.composer.classList.remove("is-open");
  }

  private placeComposer(): void {
    if (!this.composerAt) return;
    const s = this.toScreen(this.composerAt);
    const rect = this.svg.getBoundingClientRect();
    const w = rect.width || 800, h = rect.height || 600;
    const cw = this.composer.offsetWidth || 240, ch = this.composer.offsetHeight || 120;
    this.composer.style.left = `${Math.round(clamp(s.x - cw / 2, 8, Math.max(8, w - cw - 8)))}px`;
    this.composer.style.top = `${Math.round(clamp(s.y + 16, 8, Math.max(8, h - ch - 8)))}px`;
  }

  private async createNode(name: string, kind: EntityKind, at: Point): Promise<void> {
    if (!this.project) return;
    this.closeComposer();
    const path = await this.source.promote(this.project, name, kind);
    this.sim.seed(path, at, true);
    this.selection = { kind: "node", id: path };
    await this.show(this.project, true);
    this.queueLayoutSave();
  }

  private async renameNode(e: Entity, name: string): Promise<void> {
    if (!this.project || !e.path || !name.trim() || name.trim() === e.name) return;
    let path: string;
    try { path = await this.source.rename(e.path, name.trim()); } catch (err) { this.status.fail(couldNot(`rename ${e.name}`, err)); return; }
    const p = this.sim.position(e.id);
    if (p) this.sim.seed(path, p, this.sim.isPinned(e.id));
    this.selection = { kind: "node", id: path };
    await this.show(this.project, true);
    this.queueLayoutSave();
  }

  private async deleteNode(e: Entity): Promise<void> {
    if (!this.project || !e.path) return;
    const project = this.project, path = e.path;
    let text: string;
    try { text = await this.source.remove(path); } catch (err) { this.status.fail(couldNot(`delete ${e.name}`, err)); return; }
    this.selection = null;
    await this.show(project, true);
    this.queueLayoutSave();
    // The note is in the trash; Undo writes it back whole, front matter and all.
    this.status.undoable(`${e.name} moved to the trash`, async () => {
      await this.source.restore(path, text);
      await this.show(project, true);
    });
  }

  /** Pinned nodes are the ones worth remembering; the file keeps what it had for nodes not currently shown. */
  private queueLayoutSave(): void {
    if (this.layoutTimer !== null) window.clearTimeout(this.layoutTimer);
    this.layoutTimer = window.setTimeout(() => this.flushLayout(), 800);
  }

  private flushLayout(): void {
    if (this.layoutTimer !== null) { window.clearTimeout(this.layoutTimer); this.layoutTimer = null; }
    if (!this.project || this.graph === EMPTY_GRAPH) return;
    const next: Record<string, Point> = { ...this.layout };
    for (const id of this.nodeEls.keys()) delete next[id];
    for (const [id, p] of this.sim.pinnedPositions()) next[id] = { x: Math.round(p.x), y: Math.round(p.y) };
    if (sameLayout(next, this.layout)) return;
    this.layout = next;
    void this.source.saveLayout(this.project, next);
  }

  private flash(message: string): void {
    this.status.say(message);
  }

  // --- floating panel ------------------------------------------------------------

  /** The head: which project, the search, one line about what is shown, and the tools. */
  private renderHead(): void {
    const projects = this.source.projects();
    this.scopeSelect.empty();
    for (const p of projects) {
      const opt = this.scopeSelect.createEl("option", { text: p.name });
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    if (projects.length === 0) this.scopeSelect.createEl("option", { text: "No projects" });
    if (this.search.value !== this.query) this.search.value = this.query;
    const on = this.filtersOn();
    if (!this.project) this.shell.setState("No project");
    else this.shell.setState(`${this.graph.entities.length} node${this.graph.entities.length === 1 ? "" : "s"} · ${this.shown.entities.length} shown${on ? ` · ${on} filter${on === 1 ? "" : "s"} on` : ""}`, on ? { label: "Reset", cls: "czm-map-reset-filters", onClick: () => this.resetFilters() } : null);
    const tools = this.shell.tools;
    tools.empty();
    const tool = (icon: string, label: string, cls: string, onClick: () => void) => { const b = this.shell.tool(icon, label, onClick); b.addClass(cls); return b; };
    if (this.project) tool("plus", "Add a character, place, item, faction or event as a new note (or double-click the background)", "czm-map-add", () => this.openComposerAtCentre());
    tool("maximize", "Fit the map in the view", "czm-map-fit", () => this.fit());
    if (this.focusId) tool("eye", "Show all: leave the focus on one node", "czm-map-unfocus", () => { this.focusId = null; this.rebuild(); });
    tool("shuffle", "Shake: unpin everything and let the layout settle again", "czm-map-shake", () => {
      // Remember every hand-placed node so the shake can be taken back.
      const held = new Map<string, Point>();
      for (const id of this.nodeEls.keys()) if (this.sim.isPinned(id)) { const p = this.sim.position(id); if (p) held.set(id, p); }
      for (const id of this.nodeEls.keys()) this.sim.pin(id, false);
      this.sim.reheat(); this.applySelectionClasses(); this.startLoop(); this.queueLayoutSave();
      if (held.size) {
        this.status.undoable(`Shaken: ${held.size} hand-placed node${held.size === 1 ? "" : "s"} let go`, async () => {
          for (const [id, p] of held) this.sim.drag(id, p);
          this.applySelectionClasses(); this.startLoop(); this.queueLayoutSave();
        });
      }
    });
  }

  private renderPanel(): void {
    const s = this.settings;
    this.renderHead();
    this.panel.empty();
    this.shell.setSideOpen(s.panelOpen);
    if (!s.panelOpen) return;

    if (this.project) {
      // The one filled button: the expensive, opt-in action, with its cost on the line beneath.
      const read = this.panel.createEl("button", { text: this.running ? "Stop" : "Read project with model", cls: "czm-map-analyse czm-shell-cta mod-cta" });
      read.addEventListener("click", () => void this.toggleAnalyse(null));
      this.panel.createDiv({ text: "Local model (Ollama) reads every scene for relationships, references and events. Unchanged scenes are skipped.", cls: "czm-shell-cta-hint" });
    }

    const section = (title: string, value: string, cls: string, open = true) => this.shell.section(title, value, cls, open);
    const filtersOn = STORY_LAYERS.filter((l) => !s.layers[l]).length + (s.hideIsolated ? 1 : 0);
    const filters = section("Filters", filtersOn ? `${filtersOn} on` : "", "filters");
    for (const layer of STORY_LAYERS) {
      new Setting(filters).setName(LAYER_LABEL[layer]).setClass(`czm-set-layer-${layer}`).addToggle((t) => t.setValue(s.layers[layer]).onChange((v) => { this.saveSettings({ ...this.settings, layers: { ...this.settings.layers, [layer]: v } }); this.rebuild(); }));
    }
    new Setting(filters).setName("Hide loners").setDesc("Nodes with no visible edge.").setClass("czm-set-isolated").addToggle((t) => t.setValue(s.hideIsolated).onChange((v) => { this.saveSettings({ ...this.settings, hideIsolated: v }); this.rebuild(); }));

    const counts = new Map(STORY_KINDS.map((k) => [k, this.graph.entities.filter((e) => e.kind === k).length]));
    const present = STORY_KINDS.filter((k) => (counts.get(k) ?? 0) > 0);
    const shownKinds = present.filter((k) => s.kinds[k]).length;
    const kinds = section("Kinds & colours", present.length ? `${shownKinds} of ${present.length}` : "", "kinds");
    // Only kinds the project has get a row; the rest fold into one line, so the panel is as long as the story.
    for (const kind of present) {
      const n = counts.get(kind) ?? 0;
      const row = new Setting(kinds).setName(`${KIND_LABEL[kind]} · ${n}`).setClass(`czm-set-kind-${kind}`);
      row.addColorPicker((c) => c.setValue(s.colors[kind]).onChange((v) => { this.saveSettings({ ...this.settings, colors: { ...this.settings.colors, [kind]: v } }); this.recolor(); }));
      row.addToggle((t) => t.setValue(s.kinds[kind]).onChange((v) => { this.saveSettings({ ...this.settings, kinds: { ...this.settings.kinds, [kind]: v } }); this.rebuild(); }));
    }
    const absent = STORY_KINDS.filter((k) => !present.includes(k));
    if (absent.length) kinds.createDiv({ text: `Not in this project: ${absent.map((k) => KIND_LABEL[k]).join(", ")}.`, cls: "czm-map-hint czm-map-absent" });
    new Setting(kinds).setName("Reset colours").setClass("czm-set-reset-colors").addButton((b) => b.setButtonText("Reset").onClick(() => { this.saveSettings({ ...this.settings, colors: DEFAULT_STORY_COLORS }); this.renderPanel(); this.recolor(); }));

    if (this.project?.ignoredNames.length) {
      const ignored = section("Ignored names", String(this.project.ignoredNames.length), "ignored", false);
      for (const name of this.project.ignoredNames) {
        new Setting(ignored).setName(name).setClass("czm-set-ignored").addButton((b) => b.setButtonText("Restore").onClick(() => void this.source.unignore(this.project!, name).then(() => this.reloadProject())));
      }
    }

    const displaySec = section("Display", JSON.stringify(s.display) === JSON.stringify(DEFAULT_DISPLAY) ? "" : "custom", "display", false);
    for (const key of Object.keys(DISPLAY_LABEL) as (keyof DisplaySettings)[]) {
      const [min, max, step] = DISPLAY_RANGES[key];
      new Setting(displaySec).setName(DISPLAY_LABEL[key]).setClass(`czm-set-display-${key}`).addSlider((sl) => sl.setLimits(min, max, step).setValue(s.display[key]).onChange((v) => {
        this.saveSettings({ ...this.settings, display: { ...this.settings.display, [key]: v } });
        this.renderGraph();
      }));
    }
    new Setting(displaySec).setName("Reset display").setClass("czm-set-reset-display").addButton((b) => b.setButtonText("Reset").onClick(() => { this.saveSettings({ ...this.settings, display: DEFAULT_DISPLAY }); this.renderPanel(); this.renderGraph(); }));

    const forces = section("Forces", JSON.stringify(s.forces) === JSON.stringify(DEFAULT_FORCES) ? "" : "custom", "forces", false);
    for (const key of Object.keys(FORCE_LABEL) as (keyof ForceSettings)[]) {
      const [min, max, step] = FORCE_RANGES[key];
      new Setting(forces).setName(FORCE_LABEL[key]).setClass(`czm-set-force-${key}`).addSlider((sl) => sl.setLimits(min, max, step).setValue(s.forces[key]).onChange((v) => {
        this.saveSettings({ ...this.settings, forces: { ...this.settings.forces, [key]: v } });
        this.sim.setForces(this.settings.forces);
        this.startLoop();
      }));
    }
    new Setting(forces).setName("Reset forces").setClass("czm-set-reset-forces").addButton((b) => b.setButtonText("Reset").onClick(() => { this.saveSettings({ ...this.settings, forces: DEFAULT_FORCES }); this.sim.setForces(DEFAULT_FORCES); this.renderPanel(); this.startLoop(); }));
  }

  private recolor(): void {
    const colors = this.settings.colors;
    for (const [id, g] of this.nodeEls) {
      const e = this.shown.entities.find((x) => x.id === id);
      if (e) g.style.setProperty("--czm-kind", colors[e.kind]);
    }
    this.renderCard();
  }

  /** Settings changes are frequent (sliders); write them at most every 400 ms. */
  private saveSettings(next: StoryMapSettings): void {
    this.pendingSettings = next;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flushSettings(), 400);
  }

  private flushSettings(): void {
    if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.pendingSettings) { const p = this.pendingSettings; this.pendingSettings = null; this.source.updateSettings(p); }
  }

  // --- floating card -------------------------------------------------------------

  private renderCard(): void {
    const sel = this.selection;
    this.card.empty();
    this.card.classList.toggle("is-open", sel !== null);
    if (!sel) return;
    const close = this.card.createEl("button", { cls: "czm-map-card-close clickable-icon", attr: { "aria-label": "Close" } });
    setIcon(close, "x");
    close.addEventListener("click", () => this.select(null));
    if (sel.kind === "node") this.renderNodeCard(sel.id);
    else if (sel.kind === "new-edge") this.renderNewEdgeCard(sel.from, sel.to);
    else this.renderEdgeCard(sel.edge);
    this.placeCard();
  }

  /** A label form for a relationship just drawn between two nodes. */
  private renderNewEdgeCard(from: string, to: string): void {
    const a = this.graph.entities.find((x) => x.id === from), b = this.graph.entities.find((x) => x.id === to);
    if (!a?.path || !b?.path) return;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: `${a.name} — ${b.name}`, cls: "czm-map-card-name" });
    this.card.createDiv({ text: `Written in ${a.name}'s note under Relationships.`, cls: "czm-map-hint" });
    this.labelForm("", (label) => void this.writeRelation(a.path!, b.path!, label), () => this.select({ kind: "node", id: from }));
  }

  private labelForm(initial: string, save: (label: string) => void, cancel: () => void, saveText = "Save"): void {
    const form = this.card.createDiv({ cls: "czm-map-label" });
    const input = form.createEl("input", { cls: "czm-map-label-input", attr: { type: "text", placeholder: "sister, rival, owes a debt…", "aria-label": "Relationship label" } });
    input.value = initial;
    const ok = form.createEl("button", { text: saveText, cls: "czm-act-save-label" });
    ok.addEventListener("click", () => save(input.value.trim()));
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") save(input.value.trim()); if (ev.key === "Escape") { ev.stopPropagation(); cancel(); } });
    const no = form.createEl("button", { text: "Cancel", cls: "czm-act-cancel-label" });
    no.addEventListener("click", cancel);
  }

  private renderNodeCard(id: string): void {
    const e = this.graph.entities.find((x) => x.id === id);
    if (!e) return;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    const nameEl = head.createSpan({ text: e.name, cls: "czm-map-card-name" });
    const kind = head.createSpan({ text: KIND_LABEL[e.kind], cls: "czm-map-kind" });
    kind.style.color = this.settings.colors[e.kind];
    if (e.aliases.length) this.card.createDiv({ text: `also ${e.aliases.join(", ")}`, cls: "czm-map-hint" });
    if (e.mentions) this.card.createDiv({ text: `${e.mentions} mention${e.mentions === 1 ? "" : "s"} in ${e.appearances.length} scene${e.appearances.length === 1 ? "" : "s"}`, cls: "czm-map-hint" });
    if (e.kind === "candidate") this.card.createDiv({ text: "No note yet — make one and it becomes part of the cast.", cls: "czm-map-hint" });
    if (this.linking === e.id) this.card.createDiv({ text: "Click another node to connect, or Esc.", cls: "czm-map-hint czm-map-linking" });

    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    const btn = (text: string, cls: string, onClick: () => void) => { const b = actions.createEl("button", { text, cls }); b.addEventListener("click", onClick); return b; };
    if (e.path) btn("Open note", "czm-act-open", () => this.source.openNote(e.path!));
    if (e.kind === "note" && this.graph.timeline.some((t) => t.scene.path === e.path)) btn(this.running ? "Stop" : "Read with model", "czm-map-analyse-note", () => void this.toggleAnalyse(e.path));
    btn(this.focusId === e.id ? "Show all" : "Focus", "czm-act-focus", () => { this.focusId = this.focusId === e.id ? null : e.id; this.rebuild(); });
    btn(this.sim.isPinned(e.id) ? "Unpin" : "Pin", "czm-act-pin", () => { this.sim.pin(e.id, !this.sim.isPinned(e.id)); this.applySelectionClasses(); this.renderCard(); this.startLoop(); this.queueLayoutSave(); });
    if (e.path && this.project) {
      btn(this.linking === e.id ? "Stop connecting" : "Connect…", "czm-act-connect", () => (this.linking === e.id ? this.cancelLink() : this.startLink(e.id)));
      if (e.kind !== "note") {
        btn("Rename", "czm-act-rename", () => {
          const input = createEl("input", { cls: "czm-map-rename", attr: { type: "text", "aria-label": "New name" } });
          input.value = e.name;
          nameEl.replaceWith(input);
          input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") void this.renameNode(e, input.value); if (ev.key === "Escape") { ev.stopPropagation(); this.renderCard(); } });
          input.addEventListener("blur", () => { if (input.isConnected && input.value.trim() === e.name) this.renderCard(); });
          input.focus(); input.select();
        });
        const del = btn("Delete", "czm-act-delete", () => {
          del.setText("Delete note?"); del.classList.add("is-armed");
          del.onclick = () => void this.deleteNode(e);
          // Disarm after a moment, so a click that comes later is a fresh question, not a deletion.
          window.setTimeout(() => { if (del.isConnected) { del.setText("Delete"); del.classList.remove("is-armed"); del.onclick = null; } }, 5000);
        });
      }
    }
    if (e.kind === "candidate" && this.project) this.renderCandidateExits(e);

    if (e.appearances.length) {
      this.card.createEl("h4", { text: "Appears in" });
      this.sceneList(this.card, e.appearances);
    }
    const links = neighbours(this.shown, e.id);
    if (links.length) {
      this.card.createEl("h4", { text: "Connected to" });
      const list = this.card.createDiv({ cls: "czm-map-list" });
      for (const edge of links) {
        const otherId = edge.from === e.id ? edge.to : edge.from;
        const other = this.graph.entities.find((x) => x.id === otherId);
        if (!other) continue;
        const row = list.createDiv({ cls: `czm-map-row czm-layer-${edge.layer}${edge.stale ? " is-stale" : ""}`, attr: { role: "button", tabindex: "0" } });
        row.createSpan({ text: other.name, cls: "czm-map-row-name" });
        row.createSpan({ text: edgeSummary(edge), cls: "czm-map-row-meta" });
        row.addEventListener("click", () => this.select({ kind: "edge", edge }));
      }
    }
  }

  /** Every way out of "unknown name": a typed note of each kind, an alias of something that exists, or not a name at all. */
  private renderCandidateExits(e: Entity): void {
    this.card.createEl("h4", { text: "What is this?" });
    const grid = this.card.createDiv({ cls: "czm-map-exits" });
    for (const [label, kind, cls] of ENTITY_EXITS) {
      const b = grid.createEl("button", { text: label, cls });
      b.style.setProperty("--czm-kind", this.settings.colors[kind]);
      b.addEventListener("click", () => void this.promote(e, kind));
    }
    const targets = this.graph.entities.filter((x) => x.path && x.kind !== "note" && x.kind !== "candidate" && x.kind !== "reference");
    if (targets.length) {
      const row = this.card.createDiv({ cls: "czm-map-alias" });
      const select = row.createEl("select", { cls: "dropdown czm-act-alias-target", attr: { "aria-label": "Alias of" } });
      select.createEl("option", { text: "Alias of…", attr: { value: "" } });
      for (const t of targets) { const o = select.createEl("option", { text: `${t.name} (${KIND_LABEL[t.kind].toLowerCase()})` }); o.value = t.path!; }
      const apply = row.createEl("button", { text: "Apply", cls: "czm-act-alias" });
      apply.disabled = true;
      select.addEventListener("change", () => { apply.disabled = !select.value; });
      apply.addEventListener("click", () => void this.aliasTo(e, select.value));
    }
    const no = this.card.createEl("button", { text: "Not a name", cls: "czm-act-ignore" });
    no.title = "Written to the project note as story-ignore; undo from the panel's Ignored names section.";
    no.addEventListener("click", () => void this.ignore(e));
  }

  private renderEdgeCard(edge: Edge): void {
    const a = this.graph.entities.find((x) => x.id === edge.from), b = this.graph.entities.find((x) => x.id === edge.to);
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: `${a?.name ?? edge.from} — ${b?.name ?? edge.to}`, cls: "czm-map-card-name" });
    this.card.createDiv({ text: edgeSummary(edge), cls: `czm-map-kind czm-layer-${edge.layer}${edge.kind === "authored" ? " czm-authored" : ""}` });
    if (edge.stale) this.card.createEl("p", { text: "The scene changed since the model read it — re-read to refresh.", cls: "czm-map-warn" });
    if (edge.kind === "link") this.card.createEl("p", { text: "A link one of these notes makes to the other.", cls: "czm-map-hint" });
    const holder = edge.kind === "authored" ? edge.evidence[0]?.path ?? edge.from : null;
    const holderEntity = holder ? this.graph.entities.find((x) => x.id === holder) : null;
    if (holder) this.card.createEl("p", { text: `You drew this — it is written in ${holderEntity?.name ?? basenameOf(holder)}'s note under Relationships.`, cls: "czm-map-hint" });
    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    for (const end of [a, b]) if (end) {
      const btn = actions.createEl("button", { text: end.name, cls: "czm-act-end" });
      btn.addEventListener("click", () => this.select({ kind: "node", id: end.id }));
    }
    if (holder && this.project) {
      const other = holder === edge.from ? edge.to : edge.from;
      const remove = actions.createEl("button", { text: "Remove", cls: "czm-act-remove-relation" });
      remove.addEventListener("click", () => void this.eraseRelation(edge));
      this.labelForm(edge.label, (label) => { if (label !== edge.label) void this.writeRelation(holder, other, label, edge.label); else this.renderCard(); }, () => this.renderCard(), "Relabel");
    }
    if (edge.kind === "relationship" && a?.path && b?.path && this.project) {
      const authored = this.graph.edges.find((x) => x.kind === "authored" && ((x.from === edge.from && x.to === edge.to) || (x.from === edge.to && x.to === edge.from)));
      if (!authored) {
        const take = actions.createEl("button", { text: "Write down", cls: "czm-act-adopt" });
        take.title = `Keep the model's reading in ${a.name}'s note as a relationship of your own.`;
        take.addEventListener("click", () => void this.writeRelation(a.path!, b.path!, edge.label));
      }
    }
    this.renderConflict(edge, a, b);
    if (edge.evidence.length) {
      this.card.createEl("h4", { text: edge.kind === "co-occurrence" ? "Share these scenes" : edge.kind === "authored" ? "Written in" : "Seen in" });
      this.sceneList(this.card, edge.evidence);
    }
  }

  /**
   * The writer and the model disagree about this pair. Say so plainly, show
   * both readings, and offer to take the other side's label — never
   * silently pick one.
   */
  private renderConflict(edge: Edge, a: Entity | undefined, b: Entity | undefined): void {
    if (!edge.conflict.length || !this.project) return;
    const box = this.card.createDiv({ cls: "czm-map-conflict" });
    const authored = edge.kind === "authored" ? edge : this.graph.edges.find((x) => x.kind === "authored" && ((x.from === edge.from && x.to === edge.to) || (x.from === edge.to && x.to === edge.from)));
    const holder = authored?.evidence[0]?.path ?? authored?.from ?? a?.path ?? null;
    const other = holder ? (holder === edge.from ? edge.to : edge.from) : null;
    if (edge.kind === "authored") {
      box.createDiv({ text: `Disagreement: you wrote “${edge.label || "related"}”; the model read the prose as ${edge.conflict.map((c) => `“${c}”`).join(", ")}.`, cls: "czm-map-conflict-text" });
      box.createDiv({ text: "Yours stays until you change it. The model's edge is drawn underneath, dashed.", cls: "czm-map-hint" });
      for (const c of edge.conflict) {
        const adopt = box.createEl("button", { text: `Use “${c}”`, cls: "czm-act-adopt" });
        adopt.addEventListener("click", () => void this.writeRelation(holder!, other!, c, edge.label));
      }
    } else {
      box.createDiv({ text: `Disagreement: the model read this as “${edge.label}”; you wrote ${edge.conflict.map((c) => `“${c}”`).join(", ")}.`, cls: "czm-map-conflict-text" });
      box.createDiv({ text: "Your version is the one drawn on top; this reading is dashed underneath.", cls: "czm-map-hint" });
      if (holder && other && authored) {
        const replace = box.createEl("button", { text: `Replace mine with “${edge.label}”`, cls: "czm-act-adopt" });
        replace.addEventListener("click", () => void this.writeRelation(holder, other, edge.label, authored.label));
      }
    }
    void b;
  }

  private sceneList(parent: HTMLElement, refs: readonly SceneRef[]): void {
    const list = parent.createDiv({ cls: "czm-map-list" });
    const shown = refs.slice(0, 8);
    for (const ref of shown) {
      const row = list.createDiv({ cls: "czm-map-row", attr: { role: "button", tabindex: "0" } });
      row.createSpan({ text: ref.title || "(opening)", cls: "czm-map-row-name" });
      row.createSpan({ text: basenameOf(ref.path), cls: "czm-map-row-meta" });
      row.addEventListener("click", () => this.source.reveal(ref));
      row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") this.source.reveal(ref); });
    }
    if (refs.length > shown.length) list.createDiv({ text: `+${refs.length - shown.length} more — see the timeline`, cls: "czm-map-hint" });
  }

  /** Put the card beside its subject, inside the leaf. */
  private placeCard(): void {
    const sel = this.selection;
    if (!sel || !this.card.classList.contains("is-open")) return;
    const rect = this.svg.getBoundingClientRect();
    const w = rect.width || 800, h = rect.height || 600;
    let anchor: Point | undefined;
    if (sel.kind === "node") anchor = this.sim.position(sel.id);
    else {
      const [fromId, toId] = sel.kind === "edge" ? [sel.edge.from, sel.edge.to] : [sel.from, sel.to];
      const a = this.sim.position(fromId), b = this.sim.position(toId);
      if (a && b) anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    if (!anchor) return;
    const s = this.toScreen(anchor);
    const cw = this.card.offsetWidth || 260, ch = this.card.offsetHeight || 200;
    let x = s.x + 24, y = s.y - 20;
    if (x + cw > w - 8) x = s.x - cw - 24;
    if (x < 8) x = 8;
    if (y + ch > h - 8) y = h - ch - 8;
    if (y < 8) y = 8;
    this.card.style.left = `${Math.round(x)}px`;
    this.card.style.top = `${Math.round(y)}px`;
  }

  // --- model -----------------------------------------------------------------------

  async readActiveNote(): Promise<void> {
    await this.toggleAnalyse(this.source.activeNotePath());
  }

  private async toggleAnalyse(path: string | null): Promise<void> {
    if (this.running) { this.running.abort(); return; }
    const project = this.project;
    if (!project) return;
    this.running = new AbortController();
    this.status.hold("Reading…");
this.renderPanel(); this.renderCard();
    try {
      const n = await this.source.analyse(project, path, this.graph, this.running.signal, (p) => {
        this.status.hold(`${p.skipped ? "Unchanged" : "Read"} ${p.done}/${p.total}: ${basenameOf(p.scene.path)} › ${p.scene.title || "(opening)"}`);

      });
      this.status.hold(n === 0 ? "Nothing new to read — every scene is unchanged since its last reading." : `Read ${n} scene${n === 1 ? "" : "s"}.`);
    } catch (e) {
      this.status.fail(couldNot("read the project", e));
    } finally {
      this.running = null;
      await this.show(project, true);
    }
  }

  private async promote(e: Entity, kind: EntityKind): Promise<void> {
    if (!this.project) return;
    const path = await this.source.promote(this.project, e.name, kind);
    this.selection = { kind: "node", id: path };
    await this.show(this.project, true);
  }

  private async aliasTo(e: Entity, entityPath: string): Promise<void> {
    if (!this.project || !entityPath) return;
    await this.source.alias(this.project, entityPath, e.name);
    this.selection = { kind: "node", id: entityPath };
    await this.reloadProject();
  }

  private async ignore(e: Entity): Promise<void> {
    if (!this.project) return;
    await this.source.ignore(this.project, e.name);
    this.selection = null;
    await this.reloadProject();
  }

  /** Front matter just changed; the project spec must be re-read, not just the graph. */
  private async reloadProject(): Promise<void> {
    const fresh = this.source.projects().find((p) => p.scope === this.project?.scope) ?? this.project;
    await this.show(fresh, true);
  }
}

function f(n: number): string { return n.toFixed(1); }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
/** How far apart (in graph units) the lanes of a multi-edge pair sit. */
const LANE_GAP = 22;

/**
 * Assigns each edge a lane among the edges joining the same two nodes (either direction), centred on zero:
 * a lone edge gets 0, a pair gets -0.5 and 0.5, three get -1, 0, 1 — so "man owns horse" and "horse helps man"
 * bend away from each other instead of painting over one another.
 */
export function edgeLanes(edges: readonly Edge[]): Map<Edge, number> {
  const groups = new Map<string, Edge[]>();
  for (const e of edges) {
    const key = e.from < e.to ? `${e.from}\u0000${e.to}` : `${e.to}\u0000${e.from}`;
    const g = groups.get(key); if (g) g.push(e); else groups.set(key, [e]);
  }
  const lanes = new Map<Edge, number>();
  for (const g of groups.values()) g.forEach((e, i) => lanes.set(e, i - (g.length - 1) / 2));
  return lanes;
}

/**
 * The path for an edge from `a` to `b` in the given lane: straight when alone, a quadratic curve bowing sideways
 * otherwise. `forward` fixes which side is positive regardless of the edge's direction, so two edges of one pair
 * always bend apart. Returns the label anchor (the curve's midpoint) and the angle that keeps the label readable.
 */
export function edgeGeometry(a: Point, b: Point, lane: number, forward: boolean): { d: string; mid: Point; angle: number } {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const sign = forward ? 1 : -1;
  const nx = (-dy / len) * sign, ny = (dx / len) * sign;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180; else if (angle < -90) angle += 180;
  if (lane === 0) return { d: `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`, mid: { x: mx, y: my }, angle };
  const off = lane * LANE_GAP;
  const cx = mx + nx * off, cy = my + ny * off;
  // A quadratic curve passes through the midpoint between its chord centre and its control point.
  return { d: `M${f(a.x)} ${f(a.y)}Q${f(cx)} ${f(cy)} ${f(b.x)} ${f(b.y)}`, mid: { x: mx + nx * off / 2, y: my + ny * off / 2 }, angle };
}

function sameEdge(a: Edge, b: Edge): boolean { return a.kind === b.kind && a.from === b.from && a.to === b.to && a.label === b.label; }
function sameLayout(a: Layout, b: Layout): boolean {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => { const pa = a[k], pb = b[k]; return pa !== undefined && pb !== undefined && pa.x === pb.x && pa.y === pb.y; });
}

export function edgeSummary(edge: Edge): string {
  switch (edge.kind) {
    case "link": return "linked";
    case "appearance": return `appears · ${edge.weight}`;
    case "co-occurrence": return `${edge.weight} scene${edge.weight === 1 ? "" : "s"} together`;
    case "relationship": return edge.label;
    case "reference": return edge.label || "reference";
    case "authored": return edge.label ? `${edge.label} · yours` : "related · yours";
  }
}

function edgeTitle(edge: Edge, g: StoryGraph): string {
  const name = (id: string) => g.entities.find((e) => e.id === id)?.name ?? id;
  const clash = edge.conflict.length ? ` — disagrees with ${edge.kind === "authored" ? "the model" : "what you wrote"}: ${edge.conflict.join(", ")}` : "";
  return `${name(edge.from)} — ${name(edge.to)}: ${edgeSummary(edge)}${edge.stale ? " (stale)" : ""}${clash}`;
}
