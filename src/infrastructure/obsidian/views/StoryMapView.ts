import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { DEFAULT_FORCES, DEFAULT_STORY_COLORS, FORCE_RANGES, STORY_KINDS, STORY_LAYERS, type ForceSettings, type StoryEntityKind, type StoryLayer, type StoryMapSettings } from "../../../domain/settings/Settings";
import { applyFilter, neighbours, type GraphFilter } from "../../../domain/story/Filter";
import { Simulation, type Point } from "../../../domain/story/Simulation";
import { EMPTY_GRAPH, type Edge, type Entity, type EntityKind, type SceneRef, type StoryGraph } from "../../../domain/story/StoryGraph";
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
  /** Remembers, in the project note's front matter, that a name is not a name. */
  ignore(project: ProjectSpec, name: string): Promise<void>;
  unignore(project: ProjectSpec, name: string): Promise<void>;
  /** Adds a name to an existing entity note's `aliases`. */
  alias(project: ProjectSpec, entityPath: string, name: string): Promise<void>;
  /** Runs the model over one note's scenes, or the whole project's when `notePath` is null. Throws with a human message when no local model is configured. */
  analyse(project: ProjectSpec, notePath: string | null, graph: StoryGraph, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  settings(): StoryMapSettings;
  updateSettings(next: StoryMapSettings): void;
  /** Opens the timeline view for the same project. */
  openTimeline(project: ProjectSpec): void;
}

const SVG = "http://www.w3.org/2000/svg";
export const LAYER_LABEL: Record<StoryLayer, string> = { explicit: "Links", internal: "Scenes", external: "References" };
export const KIND_LABEL: Record<StoryEntityKind, string> = { character: "Characters", location: "Places", item: "Items", faction: "Factions", event: "Events", note: "Notes", candidate: "Unnamed", reference: "Outside" };
const FORCE_LABEL: Record<keyof ForceSettings, string> = { repulsion: "Repulsion", linkDistance: "Link distance", linkStrength: "Link strength", gravity: "Centre pull" };
const MIN_ZOOM = 0.15, MAX_ZOOM = 5;

type Selection = { kind: "node"; id: string } | { kind: "edge"; edge: Edge } | null;

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
  private status = "";
  private readonly sim = new Simulation(DEFAULT_FORCES, 0, 0);
  private frame: number | null = null;
  private view = { x: 0, y: 0, k: 1 };
  private fitted = false;
  private saveTimer: number | null = null;
  private pendingSettings: StoryMapSettings | null = null;

  // DOM kept between ticks
  private root!: HTMLElement;
  private svg!: SVGSVGElement;
  private viewport!: SVGGElement;
  private nodeEls = new Map<string, SVGGElement>();
  private edgeEls: { el: SVGLineElement; edge: Edge }[] = [];
  private card!: HTMLElement;
  private panel!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly source: StoryMapSource) {
    super(leaf);
  }

  getViewType(): string { return STORY_MAP_VIEW_TYPE; }
  getDisplayText(): string { return this.project ? `Story map · ${this.project.name}` : "Story map"; }
  getIcon(): string { return "git-fork"; }

  async onOpen(): Promise<void> {
    this.mount();
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async onClose(): Promise<void> {
    this.running?.abort();
    this.stopLoop();
    this.flushSettings();
  }

  private get settings(): StoryMapSettings { return this.pendingSettings ?? this.source.settings(); }

  /** Rebuilds the graph for a project and redraws; positions of surviving nodes are kept. */
  async show(project: ProjectSpec | null, keepSelection = false): Promise<void> {
    const generation = ++this.generation;
    if (this.project?.scope !== project?.scope) { this.selection = null; this.focusId = null; this.fitted = false; }
    this.project = project;
    if (!project) { this.graph = EMPTY_GRAPH; this.rebuild(); return; }
    const graph = await this.source.build(project);
    if (generation !== this.generation) return;
    this.graph = graph;
    if (!keepSelection || !this.stillValid(this.selection)) this.selection = this.stillValid(this.selection) ? this.selection : null;
    this.rebuild(true);
  }

  async refresh(): Promise<void> {
    if (this.project) await this.show(this.project, true);
  }

  private stillValid(sel: Selection): boolean {
    if (!sel) return false;
    if (sel.kind === "node") return this.graph.entities.some((e) => e.id === sel.id);
    return this.graph.edges.some((e) => sameEdge(e, sel.edge));
  }

  // --- skeleton ----------------------------------------------------------------

  private mount(): void {
    this.contentEl.empty();
    this.contentEl.addClass("czm-map-host");
    this.root = this.contentEl.createDiv({ cls: "czm-map" });
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", "czm-map-svg");
    this.svg.setAttribute("role", "img");
    this.root.appendChild(this.svg);
    this.viewport = document.createElementNS(SVG, "g");
    this.svg.appendChild(this.viewport);
    this.attachPanZoom();

    const corner = this.root.createDiv({ cls: "czm-map-corner" });
    const toggle = corner.createEl("button", { cls: "czm-map-icon clickable-icon", attr: { "aria-label": "Toggle panel" } });
    setIcon(toggle, "sliders-horizontal");
    toggle.addEventListener("click", () => { this.saveSettings({ ...this.settings, panelOpen: !this.settings.panelOpen }); this.renderPanel(); });
    this.panel = this.root.createDiv({ cls: "czm-map-panel" });
    this.card = this.root.createDiv({ cls: "czm-map-card" });
    this.statusEl = this.root.createDiv({ cls: "czm-map-status" });
    this.root.addEventListener("keydown", (e) => { if (e.key === "Escape") this.select(null); });
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
    this.shown = applyFilter(this.graph, filter);
    this.sim.setForces(s.forces);
    this.sim.setGraph(this.shown.entities, this.shown.edges);
    if (reheat) this.sim.settle(60);
    this.renderGraph();
    this.renderPanel();
    this.renderCard();
    this.renderStatus();
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
    const edgesG = document.createElementNS(SVG, "g");
    for (const edge of shown.edges) {
      const line = document.createElementNS(SVG, "line");
      line.setAttribute("class", `czm-edge czm-edge-${edge.kind} czm-layer-${edge.layer}${edge.stale ? " is-stale" : ""}`);
      line.setAttribute("stroke-width", f(1 + Math.min(4, Math.sqrt(edge.weight))));
      line.setAttribute("data-from", edge.from); line.setAttribute("data-to", edge.to);
      const title = document.createElementNS(SVG, "title");
      title.textContent = edgeTitle(edge, shown);
      line.appendChild(title);
      line.addEventListener("click", (ev) => { ev.stopPropagation(); this.select({ kind: "edge", edge }); });
      edgesG.appendChild(line);
      this.edgeEls.push({ el: line, edge });
    }
    this.viewport.appendChild(edgesG);

    const maxMentions = Math.max(1, ...shown.entities.map((e) => e.mentions));
    const nodesG = document.createElementNS(SVG, "g");
    for (const e of shown.entities) {
      const g = document.createElementNS(SVG, "g");
      g.setAttribute("class", `czm-node czm-node-${e.kind}${e.bookmarked ? " is-bookmarked" : ""}`);
      g.setAttribute("data-id", e.id);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.style.setProperty("--czm-kind", colors[e.kind]);
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
      this.attachNodeDrag(g, e.id);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); this.select({ kind: "node", id: e.id }); } });
      g.addEventListener("dblclick", (ev) => { ev.stopPropagation(); if (e.path) this.source.openNote(e.path); });
      nodesG.appendChild(g);
      this.nodeEls.set(e.id, g);
    }
    this.viewport.appendChild(nodesG);
    if (shown.entities.length === 0) {
      const t = document.createElementNS(SVG, "text");
      t.setAttribute("class", "czm-map-empty"); t.setAttribute("text-anchor", "middle");
      t.textContent = !this.project
        ? "No project yet — add writing-target: 50000 to a note's front matter and its folder becomes one."
        : this.graph.entities.length === 0 ? "Nothing to map yet — name your characters and places in typed notes, or write until names recur." : "Nothing matches the current filters.";
      this.viewport.appendChild(t);
    }
    this.applySelectionClasses();
    this.paint();
  }

  /** Move every element to the simulation's current positions. Called per frame. */
  private paint(): void {
    for (const [id, g] of this.nodeEls) {
      const p = this.sim.position(id);
      if (p) g.setAttribute("transform", `translate(${f(p.x)} ${f(p.y)})`);
    }
    for (const { el, edge } of this.edgeEls) {
      const a = this.sim.position(edge.from), b = this.sim.position(edge.to);
      if (!a || !b) continue;
      el.setAttribute("x1", f(a.x)); el.setAttribute("y1", f(a.y)); el.setAttribute("x2", f(b.x)); el.setAttribute("y2", f(b.y));
    }
    this.viewport.setAttribute("transform", `translate(${f(this.view.x)} ${f(this.view.y)}) scale(${this.view.k.toFixed(3)})`);
    this.placeCard();
  }

  private startLoop(): void {
    if (this.frame !== null || typeof requestAnimationFrame !== "function") return;
    const step = () => {
      const moving = this.sim.tick();
      this.paint();
      this.frame = moving ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.frame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.frame);
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
    for (const { el, edge } of this.edgeEls) {
      el.classList.toggle("is-selected", sel?.kind === "edge" && sameEdge(sel.edge, edge));
      el.classList.toggle("is-dim", selectedId !== null && edge.from !== selectedId && edge.to !== selectedId);
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
      if (!pan) return;
      const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      this.view = { ...this.view, x: pan.vx + dx, y: pan.vy + dy };
      this.paint();
    });
    const end = () => { if (pan && !moved) this.select(null); pan = null; };
    this.svg.addEventListener("pointerup", end);
    this.svg.addEventListener("pointercancel", end);
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
      if (!moved) this.select(this.selection?.kind === "node" && this.selection.id === id ? null : { kind: "node", id });
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
  }

  // --- floating panel ------------------------------------------------------------

  private renderPanel(): void {
    const s = this.settings;
    this.panel.empty();
    this.panel.classList.toggle("is-open", s.panelOpen);
    if (!s.panelOpen) return;
    const projects = this.source.projects();
    const head = this.panel.createDiv({ cls: "czm-map-panel-head" });
    const select = head.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } }) as HTMLSelectElement;
    for (const p of projects) {
      const opt = select.createEl("option", { text: p.name }) as HTMLOptionElement;
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    if (projects.length === 0) select.createEl("option", { text: "No projects" });
    select.addEventListener("change", () => void this.show(projects.find((p) => p.scope === select.value) ?? null));
    const search = head.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Find a name…", "aria-label": "Find a name" } }) as HTMLInputElement;
    search.value = this.query;
    search.addEventListener("input", () => { this.query = search.value; this.rebuild(); this.panel.querySelector<HTMLInputElement>(".czm-map-search")?.focus(); });

    const actions = this.panel.createDiv({ cls: "czm-map-panel-actions" });
    const btn = (text: string, cls: string, onClick: () => void, title?: string) => {
      const b = actions.createEl("button", { text, cls });
      if (title) b.title = title;
      b.addEventListener("click", onClick);
      return b;
    };
    if (this.project) {
      btn(this.running ? "Stop" : "Read project with model", "czm-map-analyse", () => void this.toggleAnalyse(null), "Asks the local model (Ollama) for relationships, outside references and events in every scene. Unchanged scenes are skipped.");
      btn("Timeline", "czm-map-timeline-btn", () => this.source.openTimeline(this.project!), "Open the Who-is-where timeline for this project.");
    }
    btn("Fit", "czm-map-fit", () => this.fit());
    btn("Shake", "czm-map-shake", () => { for (const id of this.nodeEls.keys()) this.sim.pin(id, false); this.sim.reheat(); this.applySelectionClasses(); this.startLoop(); }, "Unpin everything and let the layout settle again.");
    if (this.focusId) btn("Show all", "czm-map-unfocus", () => { this.focusId = null; this.rebuild(); });

    const section = (title: string, open = true) => {
      const d = this.panel.createEl("details", { cls: "czm-map-section" }) as HTMLDetailsElement;
      d.open = open;
      d.createEl("summary", { text: title });
      return d;
    };

    const filters = section("Filters");
    for (const layer of STORY_LAYERS) {
      new Setting(filters).setName(LAYER_LABEL[layer]).setClass(`czm-set-layer-${layer}`).addToggle((t) => t.setValue(s.layers[layer]).onChange((v) => { this.saveSettings({ ...this.settings, layers: { ...this.settings.layers, [layer]: v } }); this.rebuild(); }));
    }
    new Setting(filters).setName("Hide loners").setDesc("Nodes with no visible edge.").setClass("czm-set-isolated").addToggle((t) => t.setValue(s.hideIsolated).onChange((v) => { this.saveSettings({ ...this.settings, hideIsolated: v }); this.rebuild(); }));

    const kinds = section("Kinds & colours");
    for (const kind of STORY_KINDS) {
      const n = this.graph.entities.filter((e) => e.kind === kind).length;
      const row = new Setting(kinds).setName(`${KIND_LABEL[kind]}${n ? ` · ${n}` : ""}`).setClass(`czm-set-kind-${kind}`);
      row.addColorPicker((c) => c.setValue(s.colors[kind]).onChange((v) => { this.saveSettings({ ...this.settings, colors: { ...this.settings.colors, [kind]: v } }); this.recolor(); }));
      row.addToggle((t) => t.setValue(s.kinds[kind]).onChange((v) => { this.saveSettings({ ...this.settings, kinds: { ...this.settings.kinds, [kind]: v } }); this.rebuild(); }));
    }
    new Setting(kinds).setName("Reset colours").setClass("czm-set-reset-colors").addButton((b) => b.setButtonText("Reset").onClick(() => { this.saveSettings({ ...this.settings, colors: DEFAULT_STORY_COLORS }); this.renderPanel(); this.recolor(); }));

    if (this.project?.ignoredNames.length) {
      const ignored = section("Ignored names", false);
      for (const name of this.project.ignoredNames) {
        new Setting(ignored).setName(name).setClass("czm-set-ignored").addButton((b) => b.setButtonText("Restore").onClick(() => void this.source.unignore(this.project!, name).then(() => this.reloadProject())));
      }
    }

    const forces = section("Forces", false);
    for (const key of Object.keys(FORCE_LABEL) as (keyof ForceSettings)[]) {
      const [min, max, step] = FORCE_RANGES[key];
      new Setting(forces).setName(FORCE_LABEL[key]).setClass(`czm-set-force-${key}`).addSlider((sl) => sl.setLimits(min, max, step).setValue(s.forces[key]).setDynamicTooltip().onChange((v) => {
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
    else this.renderEdgeCard(sel.edge);
    this.placeCard();
  }

  private renderNodeCard(id: string): void {
    const e = this.graph.entities.find((x) => x.id === id);
    if (!e) return;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: e.name, cls: "czm-map-card-name" });
    const kind = head.createSpan({ text: KIND_LABEL[e.kind], cls: "czm-map-kind" });
    kind.style.color = this.settings.colors[e.kind];
    if (e.aliases.length) this.card.createDiv({ text: `also ${e.aliases.join(", ")}`, cls: "czm-map-hint" });
    if (e.mentions) this.card.createDiv({ text: `${e.mentions} mention${e.mentions === 1 ? "" : "s"} in ${e.appearances.length} scene${e.appearances.length === 1 ? "" : "s"}`, cls: "czm-map-hint" });
    if (e.kind === "candidate") this.card.createDiv({ text: "No note yet — make one and it becomes part of the cast.", cls: "czm-map-hint" });

    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    const btn = (text: string, cls: string, onClick: () => void) => { const b = actions.createEl("button", { text, cls }); b.addEventListener("click", onClick); return b; };
    if (e.path) btn("Open note", "czm-act-open", () => this.source.openNote(e.path!));
    if (e.kind === "note" && this.graph.timeline.some((t) => t.scene.path === e.path)) btn(this.running ? "Stop" : "Read with model", "czm-map-analyse-note", () => void this.toggleAnalyse(e.path));
    btn(this.focusId === e.id ? "Show all" : "Focus", "czm-act-focus", () => { this.focusId = this.focusId === e.id ? null : e.id; this.rebuild(); });
    btn(this.sim.isPinned(e.id) ? "Unpin" : "Pin", "czm-act-pin", () => { this.sim.pin(e.id, !this.sim.isPinned(e.id)); this.applySelectionClasses(); this.renderCard(); this.startLoop(); });
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
    const exits: [string, EntityKind, string][] = [["Character", "character", "czm-act-character"], ["Place", "location", "czm-act-place"], ["Item", "item", "czm-act-item"], ["Faction", "faction", "czm-act-faction"], ["Event", "event", "czm-act-event"]];
    for (const [label, kind, cls] of exits) {
      const b = grid.createEl("button", { text: label, cls });
      b.style.setProperty("--czm-kind", this.settings.colors[kind]);
      b.addEventListener("click", () => void this.promote(e, kind));
    }
    const targets = this.graph.entities.filter((x) => x.path && x.kind !== "note" && x.kind !== "candidate" && x.kind !== "reference");
    if (targets.length) {
      const row = this.card.createDiv({ cls: "czm-map-alias" });
      const select = row.createEl("select", { cls: "dropdown czm-act-alias-target", attr: { "aria-label": "Alias of" } }) as HTMLSelectElement;
      select.createEl("option", { text: "Alias of…", attr: { value: "" } });
      for (const t of targets) { const o = select.createEl("option", { text: `${t.name} (${KIND_LABEL[t.kind].toLowerCase()})` }) as HTMLOptionElement; o.value = t.path!; }
      const apply = row.createEl("button", { text: "Apply", cls: "czm-act-alias" }) as HTMLButtonElement;
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
    this.card.createDiv({ text: edgeSummary(edge), cls: `czm-map-kind czm-layer-${edge.layer}` });
    if (edge.stale) this.card.createEl("p", { text: "The scene changed since the model read it — re-read to refresh.", cls: "czm-map-warn" });
    if (edge.kind === "link") this.card.createEl("p", { text: "A link one of these notes makes to the other.", cls: "czm-map-hint" });
    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    for (const end of [a, b]) if (end) {
      const btn = actions.createEl("button", { text: end.name, cls: "czm-act-end" });
      btn.addEventListener("click", () => this.select({ kind: "node", id: end.id }));
    }
    if (edge.evidence.length) {
      this.card.createEl("h4", { text: edge.kind === "co-occurrence" ? "Share these scenes" : "Seen in" });
      this.sceneList(this.card, edge.evidence);
    }
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
      const a = this.sim.position(sel.edge.from), b = this.sim.position(sel.edge.to);
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

  private renderStatus(): void {
    this.statusEl.setText(this.status);
    this.statusEl.classList.toggle("is-open", this.status.length > 0);
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
    this.status = "Reading…";
    this.renderStatus(); this.renderPanel(); this.renderCard();
    try {
      const n = await this.source.analyse(project, path, this.graph, this.running.signal, (p) => {
        this.status = `${p.skipped ? "Unchanged" : "Read"} ${p.done}/${p.total}: ${basenameOf(p.scene.path)} › ${p.scene.title || "(opening)"}`;
        this.renderStatus();
      });
      this.status = n === 0 ? "Nothing new to read — every scene is unchanged since its last reading." : `Read ${n} scene${n === 1 ? "" : "s"}.`;
    } catch (e) {
      this.status = e instanceof Error ? e.message : String(e);
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
function sameEdge(a: Edge, b: Edge): boolean { return a.kind === b.kind && a.from === b.from && a.to === b.to && a.label === b.label; }

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
