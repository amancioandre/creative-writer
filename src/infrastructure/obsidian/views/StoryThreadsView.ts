import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import { couldNot, StatusLine } from "./StatusLine";
import { PanelShell, type Fix, type PanelId } from "./PanelShell";
import { inField, onActivate } from "./keys";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { DEFAULT_THREADS, THREAD_KINDS, type StoryEntityKind, type ThreadKind, type ThreadsSettings } from "../../../domain/settings/Settings";
import { basenameOf } from "../../../domain/story/EntityIndex";
import type { SceneRef } from "../../../domain/story/StoryGraph";
import { DEFAULT_LAYOUT, STRIP_LABEL_HEIGHT, layoutArcs, layoutSlots, layoutStrips, type ArcPath, type LayoutOptions, type SlotBox } from "../../../domain/threads/ArcLayout";
import { EMPTY_THREAD_MODEL, echoThreadId, isLiveContradiction, type Contradiction, type SceneSlot, type StopRole, type Thread, type ThreadModel, type ThreadRef } from "../../../domain/threads/Thread";
import { echoVerdict } from "../../../domain/echoes/Echoes";
import { intentLine } from "../../../domain/threads/Intent";
import type { AnalyzeProgress } from "../../../application/use-cases/AnalyzeSceneRelations";
import type { StopToAdd } from "../../../application/use-cases/EditStoryThread";
import { KIND_LABEL } from "./StoryMapView";

export const STORY_THREADS_VIEW_TYPE = "creative-writer-story-threads";

export interface StoryThreadsSource {
  projects(): ProjectSpec[];
  activeProject(): ProjectSpec | null;
  activeNotePath(): string | null;
  build(project: ProjectSpec): Promise<ThreadModel>;
  openNote(path: string): void;
  reveal(ref: SceneRef): void;
  /** Runs the fact-reading model over one note's scenes, or the project's when `notePath` is null. Throws with a human message when no local model is configured. */
  readFacts(project: ProjectSpec, notePath: string | null, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  /** Asks the local model what each open contradiction means; verdicts land in Story map.md as proposals for the card. */
  readIntent(project: ProjectSpec, contradictions: readonly Contradiction[], signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  /** The echo finder's semantic tier: embeds every sentence with the local model and stores the pairs that say the same thing. */
  readEchoes(project: ProjectSpec, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  dismiss(project: ProjectSpec, key: string): Promise<void>;
  undismiss(project: ProjectSpec, key: string): Promise<void>;
  /** Adds a scene to a hand-drawn thread, starting it if new; `link` is "Note#Heading". */
  addToThread(project: ProjectSpec, thread: string, link: string, note: string): Promise<void>;
  /** Several stops at once, with roles and quotes: a plant and its reversal, a motif's occurrences. */
  addStops(project: ProjectSpec, thread: string, stops: readonly StopToAdd[]): Promise<void>;
  setStopRole(project: ProjectSpec, thread: string, link: string, role: StopRole): Promise<void>;
  removeFromThread(project: ProjectSpec, thread: string, link: string): Promise<void>;
  /** Vault path of the project's `Story threads.md`, whether or not it exists yet. */
  threadsNotePath(project: ProjectSpec): string;
  /** Node colours from the story map, so an entity's thread matches its node. */
  storyColors(): Readonly<Record<StoryEntityKind, string>>;
  settings(): ThreadsSettings;
  updateSettings(next: ThreadsSettings): void;
  /** Opens a sibling panel, for the same project where the panel takes one. */
  jumpTo(to: PanelId, project: ProjectSpec | null): void;
}

const SVG = "http://www.w3.org/2000/svg";
const KIND_TITLE: Record<ThreadKind, string> = { entity: "Where names appear", fact: "Facts the model read", writer: "Threads you drew", echo: "Echoes across the book" };
const KIND_CHIP: Record<ThreadKind, string> = { entity: "Name", fact: "Fact", writer: "Yours", echo: "Echo" };
const MIN_ZOOM = 1, MAX_ZOOM = 8;
const AXIS_GAP = 6;
const BOTTOM_PAD = 8;

type Selection = { kind: "arc"; arc: ArcPath } | { kind: "scene"; index: number } | null;

/**
 * The manuscript as one line, and everything that ties one part of it to
 * another as an arc over that line. Scenes are slots along the bottom,
 * wide in proportion to their words; entity, fact and hand-drawn threads
 * rise above; per-scene story metrics run in strips underneath, on the
 * same axis. Contradictions are the loudest thing on the page on purpose:
 * a manuscript full of red arcs is a manuscript with a problem, and the
 * writer should see that before reading a single card.
 */
export class StoryThreadsView extends ItemView {
  private project: ProjectSpec | null = null;
  private model: ThreadModel = EMPTY_THREAD_MODEL;
  private selection: Selection = null;
  private entityFilter: string | null = null;
  private echoFilter: string | null = null;
  private query = "";
  private generation = 0;
  private running: AbortController | null = null;
  private zoomX = 1;
  private saveTimer: number | null = null;
  private pendingSettings: ThreadsSettings | null = null;
  private slots: SlotBox[] = [];
  private arcs: ArcPath[] = [];
  private baseY = DEFAULT_LAYOUT.bandHeight;

  private root!: HTMLElement;
  private scroller!: HTMLElement;
  private svg!: SVGSVGElement;
  private arcsG!: SVGGElement;
  private axisG!: SVGGElement;
  private stripsG!: SVGGElement;
  private arcEls = new Map<ArcPath, SVGPathElement>();
  private panel!: HTMLElement;
  private card!: HTMLElement;
  private badge!: HTMLElement;
  private status!: StatusLine;
  private shell!: PanelShell;
  private scopeSelect!: HTMLSelectElement;
  private search!: HTMLInputElement;
  private emptyEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly source: StoryThreadsSource) {
    super(leaf);
  }

  getViewType(): string { return STORY_THREADS_VIEW_TYPE; }
  getDisplayText(): string { return "Story threads"; }
  getIcon(): string { return "spline"; }

  async onOpen(): Promise<void> {
    this.mount();
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async onClose(): Promise<void> {
    this.running?.abort();
    this.flushSettings();
  }

  private get settings(): ThreadsSettings { return this.pendingSettings ?? this.source.settings(); }

  async show(project: ProjectSpec | null, keepSelection = false): Promise<void> {
    const generation = ++this.generation;
    if (this.project?.scope !== project?.scope) { this.selection = null; this.entityFilter = null; this.echoFilter = null; this.zoomX = 1; }
    this.project = project;
    if (!project) { this.model = EMPTY_THREAD_MODEL; this.render(); return; }
    const model = await this.source.build(project);
    if (generation !== this.generation) return;
    this.model = model;
    if (!keepSelection) this.selection = null;
    this.render();
  }

  async refresh(): Promise<void> {
    if (this.project) await this.show(this.project, true);
  }

  // --- skeleton ----------------------------------------------------------------

  private mount(): void {
    this.contentEl.empty();
    this.contentEl.addClass("czm-map-host");
    this.shell = new PanelShell(this.contentEl, {
      current: "threads",
      jump: (to) => this.source.jumpTo(to, this.project),
      side: { isOpen: () => this.settings.panelOpen, onToggle: () => this.saveSettings({ ...this.settings, panelOpen: !this.settings.panelOpen }) },
    });
    this.root = this.shell.main;
    this.root.addClass("czm-map"); this.root.addClass("czm-th");
    this.scopeSelect = this.shell.scope.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } });
    this.scopeSelect.addEventListener("change", () => void this.show(this.source.projects().find((p) => p.scope === this.scopeSelect.value) ?? null));
    this.search = this.shell.scope.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Find a thread…", "aria-label": "Find a thread" } });
    this.search.addEventListener("input", () => { this.query = this.search.value; this.renderChart(); this.renderCard(); this.renderHead(); });
    this.scroller = this.root.createDiv({ cls: "czm-th-scroll" });
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", "czm-th-svg");
    this.svg.setAttribute("role", "group");
    this.scroller.appendChild(this.svg);
    // The arrowhead a directed arc ends in; one definition, referenced from the stylesheet.
    const defs = document.createElementNS(SVG, "defs");
    const marker = document.createElementNS(SVG, "marker");
    marker.setAttribute("id", "czm-th-arrow"); marker.setAttribute("class", "czm-th-arrow");
    marker.setAttribute("viewBox", "0 0 8 8"); marker.setAttribute("refX", "6"); marker.setAttribute("refY", "4");
    marker.setAttribute("markerWidth", "6"); marker.setAttribute("markerHeight", "6"); marker.setAttribute("orient", "auto-start-reverse");
    const head = document.createElementNS(SVG, "path"); head.setAttribute("d", "M0,0 L8,4 L0,8 z");
    marker.appendChild(head); defs.appendChild(marker); this.svg.appendChild(defs);
    this.axisG = document.createElementNS(SVG, "g"); this.axisG.setAttribute("class", "czm-th-axis");
    this.arcsG = document.createElementNS(SVG, "g"); this.arcsG.setAttribute("class", "czm-th-arcs");
    this.stripsG = document.createElementNS(SVG, "g"); this.stripsG.setAttribute("class", "czm-th-strips");
    this.svg.appendChild(this.axisG); this.svg.appendChild(this.arcsG); this.svg.appendChild(this.stripsG);
    this.svg.addEventListener("click", (ev) => { if (!(ev.target as Element | null)?.closest?.(".czm-arc, .czm-th-bar")) this.select(null); });
    this.scroller.addEventListener("wheel", (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      this.zoomAt(ev.clientX, Math.exp(-ev.deltaY * 0.0015));
    }, { passive: false });
    this.scroller.addEventListener("scroll", () => this.placeCard());

    this.panel = this.shell.side;
    this.badge = this.root.createDiv({ cls: "czm-th-badge" });
    this.card = this.root.createDiv({ cls: "czm-map-card czm-th-card" });
    this.status = new StatusLine(this.root);
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { this.select(null); return; }
      if (inField(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      // The wheel's zoom, from the keys: + and - about the middle of the view, f or 0 back to one screen.
      if (e.key === "+" || e.key === "=" || e.key === "-") { e.preventDefault(); this.zoomByKey(e.key === "-" ? 0.8 : 1.25); }
      else if (e.key === "f" || e.key === "0") { e.preventDefault(); this.fit(); }
    });
    this.root.tabIndex = -1;
  }

  private render(): void {
    if (this.selection && !this.stillValid(this.selection)) this.selection = null;
    this.renderChart();
    this.renderPanel();
    this.renderBadge();
    this.renderCard();

  }

  /** After a rebuild, point an arc selection at the new model's copy of the same arc. */
  private stillValid(sel: Selection): boolean {
    if (!sel) return false;
    if (sel.kind === "scene") return sel.index < this.model.scenes.length;
    return this.model.threads.some((t) => t.id === sel.arc.threadId);
  }

  // --- what is shown -----------------------------------------------------------

  private visibleThreads(): Thread[] {
    const s = this.settings;
    const q = this.query.trim().toLowerCase();
    return this.model.threads.filter((t) => {
      if (t.kind === "entity") { if (this.entityFilter ? t.entityId !== this.entityFilter : !s.kinds.entity) return false; }
      else if (t.kind === "echo") { if (this.echoFilter ? t.id !== this.echoFilter : !s.kinds.echo) return false; }
      else if (!s.kinds[t.kind]) return false;
      if (s.contradictionsOnly && !this.model.contradictions.some((c) => c.threadId === t.id && !c.explainedBy && (s.showDismissed || !c.dismissed))) return false;
      if (q && !t.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  private visibleContradictions(threads: readonly Thread[]): Contradiction[] {
    const ids = new Set(threads.map((t) => t.id));
    return this.model.contradictions.filter((c) => ids.has(c.threadId) && !c.explainedBy && (this.settings.showDismissed || !c.dismissed));
  }

  private layoutOptions(): LayoutOptions {
    const w = (this.scroller.clientWidth || 800) * this.zoomX;
    return { ...DEFAULT_LAYOUT, width: w };
  }

  // --- chart -------------------------------------------------------------------

  private renderChart(): void {
    const o = this.layoutOptions();
    const { slots, contentWidth, baseY } = layoutSlots(this.model.scenes, o);
    this.slots = slots; this.baseY = baseY;
    const threads = this.visibleThreads();
    const contradictions = this.visibleContradictions(threads);
    this.arcs = layoutArcs(threads, contradictions, slots, baseY, o);
    const strips = this.model.strips.filter((s) => this.settings.strips[s.id] !== false);
    const stripTop = baseY + o.barMax + AXIS_GAP;
    const { rows, bars, height } = layoutStrips(strips, slots, stripTop, o);
    const total = stripTop + height + BOTTOM_PAD;
    this.svg.setAttribute("width", f(contentWidth));
    this.svg.setAttribute("height", f(total));
    this.svg.setAttribute("viewBox", `0 0 ${f(contentWidth)} ${f(total)}`);
    this.svg.setAttribute("aria-label", `Story threads of ${this.model.project}: ${this.model.scenes.length} scenes, ${this.arcs.length} arcs, ${contradictions.filter((c) => !c.dismissed).length} contradictions`);

    // Axis: baseline, one bar per scene hanging below it.
    this.axisG.replaceChildren();
    const line = document.createElementNS(SVG, "line");
    line.setAttribute("class", "czm-th-baseline");
    line.setAttribute("x1", "0"); line.setAttribute("x2", f(contentWidth)); line.setAttribute("y1", f(baseY)); line.setAttribute("y2", f(baseY));
    this.axisG.appendChild(line);
    for (const slot of slots) {
      const scene = this.model.scenes[slot.index]!;
      const rect = document.createElementNS(SVG, "rect");
      rect.setAttribute("class", `czm-th-bar czm-th-shade-${slot.shade}${scene.bookmarked ? " is-bookmarked" : ""}`);
      rect.setAttribute("data-index", String(slot.index));
      rect.setAttribute("x", f(slot.x0)); rect.setAttribute("y", f(baseY));
      rect.setAttribute("width", f(Math.max(1, slot.x1 - slot.x0 - 1))); rect.setAttribute("height", f(Math.max(2, slot.barH)));
      const title = document.createElementNS(SVG, "title");
      title.textContent = `${basenameOf(scene.ref.path)} — ${scene.ref.title || "(opening)"} — ${scene.words.toLocaleString()} words`;
      rect.appendChild(title);
      rect.setAttribute("tabindex", "0"); rect.setAttribute("role", "button"); rect.setAttribute("aria-label", `${scene.ref.title || "(opening)"}, ${scene.words.toLocaleString()} words`);
      onActivate(rect, (ev) => { ev.stopPropagation(); this.select(this.selection?.kind === "scene" && this.selection.index === slot.index ? null : { kind: "scene", index: slot.index }); }, { role: false });
      rect.addEventListener("dblclick", (ev) => { ev.stopPropagation(); this.source.reveal(scene.ref); });
      this.axisG.appendChild(rect);
    }

    // Arcs, in paint order; the layout already put contradictions last.
    this.arcsG.replaceChildren();
    this.arcEls.clear();
    const colors = this.source.storyColors();
    const byId = new Map(this.model.threads.map((t) => [t.id, t]));
    for (const arc of this.arcs) {
      const thread = byId.get(arc.threadId);
      const path = document.createElementNS(SVG, "path");
      const c = arc.contradiction;
      path.setAttribute("class", `czm-arc czm-arc-${arc.kind}${c ? " is-contradiction" : ""}${c?.dismissed ? " is-dismissed" : ""}${(c ? c.stale : thread?.stale) ? " is-stale" : ""}${arc.direction ? " czm-arc-directed" : ""}${arc.dangling ? " is-dangling" : ""}`);
      path.setAttribute("d", arc.d);
      path.setAttribute("data-thread", arc.threadId);
      path.setAttribute("data-from", String(arc.from)); path.setAttribute("data-to", String(arc.to));
      if (thread?.entityKind) path.style.setProperty("--czm-kind", colors[thread.entityKind]);
      const title = document.createElementNS(SVG, "title");
      title.textContent = arcTitle(arc, thread, this.model);
      path.appendChild(title);
      path.addEventListener("pointerenter", () => this.hover(arc, true));
      path.addEventListener("pointerleave", () => this.hover(arc, false));
      path.setAttribute("tabindex", "0"); path.setAttribute("role", "button"); path.setAttribute("aria-label", `${thread?.label ?? arc.threadId}${c ? ", contradiction" : ""}`);
      onActivate(path, (ev) => { ev.stopPropagation(); this.select(this.selection?.kind === "arc" && this.selection.arc === arc ? null : { kind: "arc", arc }); }, { role: false });
      this.arcsG.appendChild(path);
      this.arcEls.set(arc, path);
    }

    // Strips.
    this.stripsG.replaceChildren();
    for (const row of rows) {
      const label = document.createElementNS(SVG, "text");
      label.setAttribute("class", "czm-th-strip-label");
      label.setAttribute("x", "4"); label.setAttribute("y", f(row.y + STRIP_LABEL_HEIGHT - 4));
      label.textContent = `${row.label}${row.max > 0 ? ` · max ${row.max}` : ""}`;
      this.stripsG.appendChild(label);
      const rule = document.createElementNS(SVG, "line");
      rule.setAttribute("class", "czm-th-strip-rule");
      rule.setAttribute("x1", "0"); rule.setAttribute("x2", f(contentWidth)); rule.setAttribute("y1", f(row.base)); rule.setAttribute("y2", f(row.base));
      this.stripsG.appendChild(rule);
    }
    const stripById = new Map(strips.map((s) => [s.id, s]));
    for (const bar of bars) {
      if (bar.h <= 0) continue;
      const strip = stripById.get(bar.stripId)!;
      const rect = document.createElementNS(SVG, "rect");
      rect.setAttribute("class", `czm-th-strip-bar czm-th-strip-${bar.stripId}${strip.higherIsBetter === false ? " is-bad" : ""}`);
      rect.setAttribute("x", f(bar.x0)); rect.setAttribute("y", f(bar.y));
      rect.setAttribute("width", f(Math.max(1, bar.x1 - bar.x0 - 1))); rect.setAttribute("height", f(bar.h));
      const scene = this.model.scenes[bar.index]!;
      const title = document.createElementNS(SVG, "title");
      title.textContent = `${strip.label}: ${bar.value} ${strip.unit} — ${scene.ref.title || basenameOf(scene.ref.path)}`;
      rect.appendChild(title);
      this.stripsG.appendChild(rect);
    }

    this.emptyEl?.remove();
    this.emptyEl = null;
    if (this.model.scenes.length === 0 || this.arcs.length === 0) this.emptyEl = this.renderEmpty();
    this.applySelectionClasses();
  }

  /** Nothing to draw: say why, and offer the click that changes it. */
  private renderEmpty(): HTMLElement {
    const s = this.settings;
    const redraw = () => { this.renderChart(); this.renderPanel(); this.renderCard(); };
    if (!this.project) return this.shell.empty("No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one.");
    if (this.model.scenes.length === 0) return this.shell.empty("No scenes yet — headings with prose under them become scenes.");
    if (this.model.threads.length === 0 && this.model.factsRead === 0) return this.shell.empty("Nothing to draw yet — read the project for facts, draw a thread by hand, or switch on names in the panel.", [{ label: "Show names", cls: "czm-th-fix-names", onClick: () => { this.saveSettings({ ...this.settings, kinds: { ...this.settings.kinds, entity: true } }); redraw(); } }]);
    if (s.contradictionsOnly && this.model.contradictions.length === 0) return this.shell.empty(this.model.factsRead ? "No contradictions in the scenes read so far." : "No facts read yet — read the project for facts to check it for contradictions.", [{ label: "Show every thread", cls: "czm-th-fix-only", onClick: () => { this.saveSettings({ ...this.settings, contradictionsOnly: false }); redraw(); } }]);
    const reasons: string[] = [];
    const fixes: Fix[] = [];
    // Only kinds the writer turned off are worth blaming; one that is off by default (names) is not a filter they set.
    const off = THREAD_KINDS.filter((k) => !s.kinds[k] && DEFAULT_THREADS.kinds[k] && this.model.threads.some((t) => t.kind === k));
    if (off.length) { reasons.push(`${off.map((k) => KIND_TITLE[k].toLowerCase()).join(", ")} ${off.length === 1 ? "is" : "are"} off`); fixes.push({ label: "Show all kinds", cls: "czm-th-fix-kinds", onClick: () => { this.saveSettings({ ...this.settings, kinds: Object.fromEntries(THREAD_KINDS.map((k) => [k, true])) as Record<ThreadKind, boolean> }); redraw(); } }); }
    if (this.query.trim()) { reasons.push(`“${this.query.trim()}” matches no thread`); fixes.push({ label: "Clear search", cls: "czm-th-fix-query", onClick: () => { this.query = ""; this.search.value = ""; redraw(); } }); }
    if (this.entityFilter || this.echoFilter) { reasons.push("one name or echo is followed"); fixes.push({ label: "Follow all", cls: "czm-th-fix-follow", onClick: () => { this.entityFilter = null; this.echoFilter = null; redraw(); } }); }
    if (s.contradictionsOnly) { reasons.push("only contradictions are shown"); fixes.push({ label: "Show every thread", cls: "czm-th-fix-only", onClick: () => { this.saveSettings({ ...this.settings, contradictionsOnly: false }); redraw(); } }); }
    return this.shell.empty(reasons.length ? `Nothing to show: ${reasons.join("; ")}.` : "Nothing matches the current filters.", fixes);
  }

  private hover(arc: ArcPath, on: boolean): void {
    const el = this.arcEls.get(arc);
    if (!el) return;
    if (on) {
      this.arcsG.appendChild(el);
      el.classList.add("is-lifted");
      for (const [other, oel] of this.arcEls) if (other !== arc && other.threadId === arc.threadId) oel.classList.add("is-kin");
      this.arcsG.classList.add("has-hover");
    } else {
      el.classList.remove("is-lifted");
      for (const oel of this.arcEls.values()) oel.classList.remove("is-kin");
      this.arcsG.classList.remove("has-hover");
    }
  }

  private applySelectionClasses(): void {
    const sel = this.selection;
    this.arcsG.classList.toggle("has-selection", sel?.kind === "arc");
    for (const [arc, el] of this.arcEls) {
      el.classList.toggle("is-selected", sel?.kind === "arc" && sel.arc === arc);
      el.classList.toggle("is-touching", sel?.kind === "scene" && (arc.from === sel.index || arc.to === sel.index));
    }
    for (const bar of this.axisG.querySelectorAll<SVGRectElement>(".czm-th-bar")) {
      const i = Number(bar.getAttribute("data-index"));
      bar.classList.toggle("is-selected", (sel?.kind === "scene" && sel.index === i) || (sel?.kind === "arc" && (sel.arc.from === i || sel.arc.to === i)));
    }
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.applySelectionClasses();
    this.renderCard();
  }

  // --- zoom --------------------------------------------------------------------

  /** Horizontal only: the layout is recomputed at the new width and the scroller keeps the slot under the pointer where it was. */
  zoomAt(clientX: number, factor: number): void {
    const rect = this.scroller.getBoundingClientRect();
    const px = clientX - rect.left;
    const before = this.zoomX;
    this.zoomX = clamp(before * factor, MIN_ZOOM, MAX_ZOOM);
    if (this.zoomX === before) return;
    const worldX = this.scroller.scrollLeft + px;
    this.renderChart();
    this.scroller.scrollLeft = worldX * (this.zoomX / before) - px;
    this.placeCard();
  }

  private zoomByKey(factor: number): void {
    const r = this.scroller.getBoundingClientRect();
    this.zoomAt(r.left + (r.width || 800) / 2, factor);
  }

  fit(): void {
    this.zoomX = 1;
    this.renderChart();
    this.scroller.scrollLeft = 0;
    this.placeCard();
  }

  // --- floating panel ----------------------------------------------------------

  /** The head: which project, the search, one line about what is drawn, and the tools. */
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
    if (!this.project) this.shell.setState("No project");
    else {
      const live = this.model.contradictions.filter(isLiveContradiction).length;
      const n = this.model.scenes.length, a = this.arcs.length;
      this.shell.setState(`${n} scene${n === 1 ? "" : "s"} · ${a} arc${a === 1 ? "" : "s"} · ${live} contradiction${live === 1 ? "" : "s"}`);
    }
    this.shell.tools.empty();
    const tool = (icon: string, label: string, cls: string, onClick: () => void) => { const b = this.shell.tool(icon, label, onClick); b.addClass(cls); return b; };
    tool("zoom-in", "Zoom in (+)", "czm-th-zoom-in", () => this.zoomByKey(1.25));
    tool("zoom-out", "Zoom out (−)", "czm-th-zoom-out", () => this.zoomByKey(0.8));
    tool("maximize", "Fit the whole manuscript in the view (f)", "czm-map-fit", () => this.fit());
    if (this.project) tool("file-text", "Open Story threads.md, where hand-drawn threads live", "czm-th-note-btn", () => this.source.openNote(this.source.threadsNotePath(this.project!)));
  }

  private renderPanel(): void {
    const s = this.settings;
    this.renderHead();
    this.panel.empty();
    this.shell.setSideOpen(s.panelOpen);
    if (!s.panelOpen) return;

    if (this.project) {
      // The one filled button: the expensive, opt-in reading, with what it costs beneath; the other readings are plain.
      const read = this.panel.createEl("button", { text: this.running ? "Stop" : "Read project for facts", cls: "czm-map-analyse czm-th-read czm-shell-cta mod-cta" });
      read.addEventListener("click", () => void this.toggleRead(null));
      this.panel.createDiv({ text: "Local model (Ollama) reads each scene for the facts it states, so scenes can be checked against each other. Unchanged scenes are skipped.", cls: "czm-shell-cta-hint" });
      const actions = this.panel.createDiv({ cls: "czm-map-panel-actions" });
      const btn = (text: string, cls: string, onClick: () => void, title: string) => { const b = actions.createEl("button", { text, cls }); b.title = title; b.addEventListener("click", onClick); return b; };
      btn(this.running ? "Stop" : "Read contradictions for intent", "czm-map-analyse czm-th-read-intent", () => void this.toggleIntent(), "Asks the local model what each open contradiction means — a reversal the story intends, an error, or the same thing said twice. A verdict is a proposal on the card; accepting it is your click.");
      btn(this.running ? "Stop" : "Read project for echoes", "czm-map-analyse czm-th-read-echoes", () => void this.toggleEchoes(), "Embeds every sentence with the local model and keeps the pairs that say the same thing in different words. Only the pairs are stored, in Story map.md.");
    }

    const section = (title: string, cls: string, open = true, value = "") => this.shell.section(title, value, cls, open);

    const kindsOn = THREAD_KINDS.filter((k) => s.kinds[k]).length;
    const threads = section("Threads", "filters", true, `${kindsOn} of ${THREAD_KINDS.length} kinds`);
    for (const kind of THREAD_KINDS) {
      const n = this.model.threads.filter((t) => t.kind === kind).length;
      new Setting(threads).setName(`${KIND_TITLE[kind]}${n ? ` · ${n}` : ""}`).setClass(`czm-set-thread-${kind}`).addToggle((t) => t.setValue(s.kinds[kind]).onChange((v) => { this.saveSettings({ ...this.settings, kinds: { ...this.settings.kinds, [kind]: v } }); this.renderChart(); this.renderCard(); }));
    }
    const entities = this.model.threads.filter((t) => t.kind === "entity");
    if (entities.length) {
      const row = threads.createDiv({ cls: "czm-th-entity-row" });
      const pick = row.createEl("select", { cls: "dropdown czm-th-entity", attr: { "aria-label": "Follow one name" } });
      pick.createEl("option", { text: "Follow one name…", attr: { value: "" } });
      for (const t of entities) { const o = pick.createEl("option", { text: `${t.label} · ${t.refs.length}` }); o.value = t.entityId!; if (this.entityFilter === t.entityId) o.selected = true; }
      pick.addEventListener("change", () => { this.entityFilter = pick.value || null; this.renderChart(); this.renderCard(); });
    }
    const echoes = this.model.threads.filter((t) => t.kind === "echo");
    if (echoes.length) {
      const row = threads.createDiv({ cls: "czm-th-entity-row" });
      const pick = row.createEl("select", { cls: "dropdown czm-th-echo", attr: { "aria-label": "Follow one echo" } });
      pick.createEl("option", { text: "Follow one echo…", attr: { value: "" } });
      for (const t of echoes) { const o = pick.createEl("option", { text: `${t.label} · ${t.refs.length}` }); o.value = t.id; if (this.echoFilter === t.id) o.selected = true; }
      pick.addEventListener("change", () => { this.echoFilter = pick.value || null; this.renderChart(); this.renderCard(); });
    } else if (s.kinds.echo) {
      threads.createDiv({ text: "No echoes heard in this project.", cls: "czm-map-hint czm-th-no-echoes" });
    }
    if (this.model.semantic.stored) {
      const { stored, stale } = this.model.semantic;
      threads.createDiv({ text: `${stored} sentence pair${stored === 1 ? "" : "s"} from the model${stale ? `, ${stale} stale — read again` : ""}.`, cls: `czm-map-hint czm-th-semantic${stale ? " is-stale" : ""}` });
    }
    const broken = this.model.threads.filter((t) => t.kind === "writer").flatMap((t) => t.refs.filter((r) => r.unresolved).map((r) => ({ thread: t.label, link: r.unresolved! })));
    for (const b of broken) threads.createDiv({ text: `${b.thread}: “${b.link}” points at no scene.`, cls: "czm-map-warn czm-th-broken" });
    const unanchored = this.model.threads.filter((t) => t.kind === "writer").flatMap((t) => t.refs.filter((r) => r.anchor === null).map((r) => ({ thread: t.label, quote: r.quote ?? "", scene: r.scene.title || basenameOf(r.scene.path) })));
    for (const u of unanchored) threads.createDiv({ text: `${u.thread}: “${u.quote}” is no longer in ${u.scene}.`, cls: "czm-map-warn czm-th-broken czm-th-unanchored" });
    const dangling = this.model.threads.filter((t) => t.kind === "writer").flatMap((t) => t.dangling.map((r) => ({ thread: t.label, scene: r.scene.title || basenameOf(r.scene.path) })));
    for (const d of dangling) threads.createDiv({ text: `${d.thread}: planted in ${d.scene}, no payoff yet.`, cls: "czm-map-hint czm-th-dangling" });

    const clashes = section("Contradictions", "contradictions", true, this.model.factsRead === 0 ? "" : `${this.model.contradictions.filter(isLiveContradiction).length} open`);
    const live = this.model.contradictions.filter(isLiveContradiction).length, explained = this.model.contradictions.filter((c) => c.explainedBy).length, dismissed = this.model.contradictions.length - live - explained;
    clashes.createDiv({ text: this.model.factsRead === 0 ? "No facts read yet." : `${live} open, ${dismissed} dismissed${explained ? `, ${explained} reversal${explained === 1 ? "" : "s"}` : ""}, in ${this.model.factsRead} scene${this.model.factsRead === 1 ? "" : "s"} read.`, cls: "czm-map-hint czm-th-clash-count" });
    new Setting(clashes).setName("Only contradictions").setClass("czm-set-contradictions-only").addToggle((t) => t.setValue(s.contradictionsOnly).onChange((v) => { this.saveSettings({ ...this.settings, contradictionsOnly: v }); this.renderChart(); this.renderCard(); }));
    new Setting(clashes).setName("Show dismissed").setClass("czm-set-show-dismissed").addToggle((t) => t.setValue(s.showDismissed).onChange((v) => { this.saveSettings({ ...this.settings, showDismissed: v }); this.renderChart(); this.renderCard(); }));

    const strips = section("Strips", "strips", false);
    for (const strip of this.model.strips) {
      new Setting(strips).setName(strip.label).setClass(`czm-set-strip-${strip.id}`).addToggle((t) => t.setValue(s.strips[strip.id] !== false).onChange((v) => { this.saveSettings({ ...this.settings, strips: { ...this.settings.strips, [strip.id]: v } }); this.renderChart(); }));
    }
  }

  private renderBadge(): void {
    const live = this.model.contradictions.filter(isLiveContradiction).length, dismissed = this.model.contradictions.filter((c) => c.dismissed).length;
    const show = this.project !== null && this.model.factsRead > 0;
    this.badge.classList.toggle("is-open", show);
    this.badge.classList.toggle("is-alert", live > 0);
    this.badge.setText(!show ? "" : live === 0 ? `No contradictions · ${this.model.factsRead} scene${this.model.factsRead === 1 ? "" : "s"} read` : `${live} contradiction${live === 1 ? "" : "s"}${dismissed ? `, ${dismissed} dismissed` : ""}`);
    this.badge.onclick = () => { this.saveSettings({ ...this.settings, contradictionsOnly: !this.settings.contradictionsOnly }); this.renderPanel(); this.renderChart(); this.renderCard(); };
  }

  /** Settings changes are frequent; write them at most every 400 ms. */
  private saveSettings(next: ThreadsSettings): void {
    this.pendingSettings = next;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.flushSettings(), 400);
  }

  private flushSettings(): void {
    if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.pendingSettings) { const p = this.pendingSettings; this.pendingSettings = null; this.source.updateSettings(p); }
  }

  // --- floating card -----------------------------------------------------------

  private renderCard(): void {
    const sel = this.selection;
    this.card.empty();
    this.card.classList.toggle("is-open", sel !== null);
    if (!sel) return;
    const close = this.card.createEl("button", { cls: "czm-map-card-close clickable-icon", attr: { "aria-label": "Close" } });
    setIcon(close, "x");
    close.addEventListener("click", () => this.select(null));
    if (sel.kind === "scene") this.renderSceneCard(sel.index);
    else this.renderArcCard(sel.arc);
    this.placeCard();
  }

  private renderArcCard(arc: ArcPath): void {
    const thread = this.model.threads.find((t) => t.id === arc.threadId);
    if (!thread) return;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: thread.label, cls: "czm-map-card-name" });
    const kind = head.createSpan({ text: thread.kind === "entity" && thread.entityKind ? KIND_LABEL[thread.entityKind] : KIND_CHIP[thread.kind], cls: `czm-map-kind czm-th-kind-${thread.kind}` });
    if (thread.entityKind) kind.style.color = this.source.storyColors()[thread.entityKind];
    if (thread.stale && !arc.contradiction) this.card.createEl("p", { text: "A scene changed since the model read it — read again to refresh.", cls: "czm-map-warn" });

    const c = arc.contradiction;
    if (c) this.renderContradiction(c);
    if (thread.kind === "echo") this.renderEcho(thread, arc);

    const from = thread.refs.find((r) => r.index === arc.from), to = thread.refs.find((r) => r.index === arc.to);
    this.card.createEl("h4", { text: c ? "Between" : thread.kind === "entity" ? "Consecutive appearances" : "Between" });
    this.stopList([c ? c.a : from, c ? c.b : to].filter((r): r is ThreadRef => !!r), thread);

    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    const btn = (text: string, cls: string, onClick: () => void, title?: string) => { const b = actions.createEl("button", { text, cls }); if (title) b.title = title; b.addEventListener("click", onClick); return b; };
    if (c && this.project) {
      if (!c.dismissed) btn(c.intent?.verdict === "reversal" ? "Accept as a reversal" : "This is a reversal", "czm-act-reversal", () => void this.addReversal(c), "The story means this change: the earlier scene plants it, the later one reverses it. Written to Story threads.md as a directed thread, anchored to both quotes.");
      btn(c.dismissed ? "Restore" : "Dismiss", c.dismissed ? "czm-act-undismiss" : "czm-act-dismiss", () => void this.toggleDismiss(c), c.dismissed ? "Show this pair as a contradiction again." : "Not a contradiction — two ways of saying one thing. Remembered in Story map.md.");
    }
    if (thread.kind === "entity" && thread.entityId) btn(this.entityFilter === thread.entityId ? "Show all names" : "Follow", "czm-act-follow", () => { this.entityFilter = this.entityFilter === thread.entityId ? null : thread.entityId!; this.renderPanel(); this.renderChart(); this.renderCard(); });
    if (thread.kind === "writer" && this.project) {
      if (arc.dangling) this.card.createEl("p", { text: "Planted here, and nothing keeps the promise yet.", cls: "czm-map-hint czm-th-dangling-note" });
      const stops = arc.dangling ? [from] : [from, to];
      for (const r of stops) {
        if (!r) continue;
        const name = r.scene.title || basenameOf(r.scene.path);
        if (r.role !== "plant") btn(`Promise: ${name}`, "czm-act-plant", () => void this.setRole(thread, r, "plant"), "Mark this stop as the plant — a promise to the reader.");
        if (r.role !== "payoff" && !arc.dangling) btn(`Pays off: ${name}`, "czm-act-payoff", () => void this.setRole(thread, r, "payoff"), "Mark this stop as the payoff that keeps the promise.");
      }
      for (const r of stops) if (r) btn(`Remove ${r.scene.title || basenameOf(r.scene.path)}`, "czm-act-remove-stop", () => void this.removeStop(thread, r), "Take this scene out of the thread (edits Story threads.md).");
      btn("Open note", "czm-act-open-threads", () => this.source.openNote(this.source.threadsNotePath(this.project!)));
    }
    if (thread.kind === "fact" && !c && this.project) btn(this.running ? "Stop" : "Read again", "czm-act-read-facts", () => void this.toggleRead(null));
    if (thread.kind === "echo") {
      btn(this.echoFilter === thread.id ? "Show all echoes" : "Follow", "czm-act-follow-echo", () => { this.echoFilter = this.echoFilter === thread.id ? null : thread.id; this.renderPanel(); this.renderChart(); this.renderCard(); });
      if (this.project) btn("Keep as a motif", "czm-act-motif", () => void this.keepMotif(thread), "This repetition is yours on purpose. Written to Story threads.md as a thread with a stop at every occurrence; it stops being an echo.");
    }

    if (thread.refs.length > 2) {
      this.card.createEl("h4", { text: `All ${thread.refs.length} stops` });
      this.stopList(thread.refs, thread);
    }
  }

  /** What the echo finder heard: the words, where, how close, and whether it is a tic or a habit. */
  private renderEcho(thread: Thread, arc: ArcPath): void {
    const group = this.model.echoes.groups.find((g) => echoThreadId(g.key) === thread.id);
    const pair = this.model.echoes.pairs.find((p) => echoThreadId(p.key) === thread.id);
    const box = this.card.createDiv({ cls: "czm-map-conflict czm-th-echo-box" });
    if (group) {
      const verdict = echoVerdict(group);
      const line = verdict === "habit" ? `A habit: “${group.text}” in ${group.scenes} scenes, ${group.stops.length} times.` : verdict === "tic" ? `A tic: “${group.text}” ${group.stops.length} times, ${group.nearest === 0 ? "twice in one scene" : `${group.nearest} scene${group.nearest === 1 ? "" : "s"} apart`}.` : `“${group.text}” ${group.stops.length} times, ${group.nearest} scenes apart.`;
      box.createDiv({ text: line, cls: "czm-map-conflict-text czm-th-echo-verdict" });
    } else if (pair) {
      box.createDiv({ text: `Two sentences ${Math.round(pair.similarity * 100)}% alike (${pair.tier}), ${pair.distance === 0 ? "in the same scene" : `${pair.distance} scene${pair.distance === 1 ? "" : "s"} apart`}.`, cls: "czm-map-conflict-text czm-th-echo-verdict" });
    }
    const from = thread.refs.find((r) => r.index === arc.from), to = thread.refs.find((r) => r.index === arc.to && r !== from);
    for (const r of [from, to]) {
      if (!r) continue;
      const q = box.createEl("blockquote", { cls: "czm-th-quote is-echo" });
      q.createSpan({ text: `${r.scene.title || basenameOf(r.scene.path)}: `, cls: "czm-map-row-meta" });
      q.createSpan({ text: r.note || r.quote || "" });
    }
  }

  /** Both readings, both quotes, and the way out — never a silent pick of one side. */
  private renderContradiction(c: Contradiction): void {
    const box = this.card.createDiv({ cls: `czm-map-conflict${c.dismissed ? " is-dismissed" : ""}` });
    box.createDiv({ text: c.dismissed ? `Dismissed: ${c.subject}'s ${c.attribute} reads “${c.a.value}” here and “${c.b.value}” there.` : `${c.subject}'s ${c.attribute}: “${c.a.value}” in one scene, “${c.b.value}” in another.`, cls: "czm-map-conflict-text" });
    for (const r of [c.a, c.b]) {
      const q = box.createEl("blockquote", { cls: "czm-th-quote" });
      q.createSpan({ text: `${r.scene.title || basenameOf(r.scene.path)}: `, cls: "czm-map-row-meta" });
      q.createSpan({ text: r.evidence ?? "" });
    }
    if (c.stale) box.createDiv({ text: "One of these scenes changed since it was read; the quote may be gone.", cls: "czm-map-hint" });
    if (c.intent) box.createDiv({ text: intentLine(c.intent), cls: `czm-th-intent is-${c.intent.verdict}`, attr: { title: `Read by ${c.intent.model}. A proposal: nothing changes until you click.` } });
  }

  private renderSceneCard(index: number): void {
    const scene = this.model.scenes[index];
    if (!scene) return;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: scene.ref.title || "(opening)", cls: "czm-map-card-name" });
    head.createSpan({ text: `${basenameOf(scene.ref.path)} · ${scene.words.toLocaleString()} words${scene.bookmarked ? " · ★" : ""}`, cls: "czm-map-kind" });
    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    const open = actions.createEl("button", { text: "Go to scene", cls: "czm-act-reveal" });
    open.addEventListener("click", () => this.source.reveal(scene.ref));
    if (this.project) {
      const read = actions.createEl("button", { text: this.running ? "Stop" : "Read this note for facts", cls: "czm-act-read-note" });
      read.addEventListener("click", () => void this.toggleRead(scene.ref.path));
    }
    // Only what is drawn: a row here selects an arc, and a hidden thread has none.
    const through = this.visibleThreads().filter((t) => t.refs.some((r) => r.index === index));
    if (through.length) {
      this.card.createEl("h4", { text: "Threads through here" });
      const list = this.card.createDiv({ cls: "czm-map-list" });
      for (const t of through.slice(0, 12)) {
        const row = list.createDiv({ cls: `czm-map-row czm-th-row-${t.kind}`, attr: { role: "button", tabindex: "0" } });
        row.createSpan({ text: t.label, cls: "czm-map-row-name" });
        row.createSpan({ text: t.refs.find((r) => r.index === index)?.note || `${t.refs.length} stops`, cls: "czm-map-row-meta" });
        onActivate(row, () => { const arc = this.arcs.find((a) => a.threadId === t.id && !a.contradiction && (a.from === index || a.to === index)); if (arc) this.select({ kind: "arc", arc }); });
      }
      if (through.length > 12) list.createDiv({ text: `+${through.length - 12} more`, cls: "czm-map-hint" });
    }
    if (this.project) this.renderAddToThread(scene);
  }

  /** The way a thread gets drawn by hand: pick one, or name a new one, and this scene becomes a stop on it. */
  private renderAddToThread(scene: SceneSlot): void {
    this.card.createEl("h4", { text: "Add to a thread" });
    const row = this.card.createDiv({ cls: "czm-th-add" });
    const mine = this.model.threads.filter((t) => t.kind === "writer");
    const pick = row.createEl("select", { cls: "dropdown czm-th-add-pick", attr: { "aria-label": "Thread" } });
    for (const t of mine) { const o = pick.createEl("option", { text: t.label }); o.value = t.label; }
    pick.createEl("option", { text: "New thread…", attr: { value: " new" } });
    if (mine.length === 0) pick.value = " new";
    const name = row.createEl("input", { cls: "czm-th-add-name", attr: { type: "text", placeholder: "Thread name", "aria-label": "New thread name" } });
    const note = row.createEl("input", { cls: "czm-th-add-note", attr: { type: "text", placeholder: "What happens here (optional)", "aria-label": "Note" } });
    const sync = () => { name.hidden = pick.value !== " new"; };
    pick.addEventListener("change", sync); sync();
    const add = row.createEl("button", { text: "Add", cls: "czm-act-add-to-thread" });
    const submit = () => {
      const thread = pick.value === " new" ? name.value.trim() : pick.value;
      if (!thread) { name.focus(); return; }
      if (add.disabled) return; // one write at a time: Enter in a field or a second click waits
      add.disabled = true;
      void this.addStop(thread, scene, note.value.trim()).finally(() => { add.disabled = false; });
    };
    add.addEventListener("click", submit);
    name.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
    note.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
  }

  private stopList(refs: readonly ThreadRef[], thread: Thread): void {
    const list = this.card.createDiv({ cls: "czm-map-list" });
    for (const r of refs) {
      // A broken stop is a line to read, not a button: it goes nowhere.
      const row = list.createDiv({ cls: `czm-map-row${r.unresolved ? " is-broken" : ""}`, attr: r.unresolved ? {} : { role: "button", tabindex: "0" } });
      row.createSpan({ text: r.unresolved ? `“${r.unresolved}” — not found` : r.scene.title || "(opening)", cls: "czm-map-row-name" });
      if (r.role && r.role !== "touch") row.createSpan({ text: r.role, cls: `czm-th-role is-${r.role}` });
      row.createSpan({ text: r.unresolved ? "" : thread.kind === "fact" ? r.value ?? "" : r.note || (r.quote ? `“${r.quote}”` : basenameOf(r.scene.path)), cls: "czm-map-row-meta" });
      if (r.anchor === null) row.createSpan({ text: "quote not found", cls: "czm-map-warn czm-th-role-warn" });
      if (!r.unresolved) {
        onActivate(row, () => this.source.reveal(r.scene));
      }
    }
  }

  /** Beside the arc's apex or under the scene's bar, inside the leaf, allowing for scroll. */
  private placeCard(): void {
    const sel = this.selection;
    if (!sel || !this.card.classList.contains("is-open")) return;
    const rect = this.root.getBoundingClientRect();
    const w = rect.width || 800, h = rect.height || 600;
    let ax: number, ay: number;
    if (sel.kind === "arc") { ax = sel.arc.apex.x; ay = sel.arc.apex.y; }
    else { const slot = this.slots[sel.index]; if (!slot) return; ax = slot.cx; ay = this.baseY + slot.barH; }
    const sx = ax - this.scroller.scrollLeft, sy = ay - this.scroller.scrollTop;
    const cw = this.card.offsetWidth || 260, ch = this.card.offsetHeight || 200;
    let x = sx + 16, y = sel.kind === "arc" ? sy - 12 : sy + 12;
    if (x + cw > w - 8) x = sx - cw - 16;
    if (x < 8) x = 8;
    if (y + ch > h - 8) y = h - ch - 8;
    if (y < 8) y = 8;
    this.card.style.left = `${Math.round(x)}px`;
    this.card.style.top = `${Math.round(y)}px`;
  }

  private flash(message: string): void {
    this.status.say(message);
  }

  // --- actions -----------------------------------------------------------------

  async readActiveNote(): Promise<void> {
    await this.toggleRead(this.source.activeNotePath());
  }

  private async toggleRead(path: string | null): Promise<void> {
    if (this.running) { this.running.abort(); return; }
    const project = this.project;
    if (!project) return;
    this.running = new AbortController();
    this.status.hold("Reading…");
this.renderPanel(); this.renderCard();
    try {
      const n = await this.source.readFacts(project, path, this.running.signal, (p) => {
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

  /** One model run at a time: the same controller, status line and rebuild for facts, intent and echoes. */
  private async runReading(work: (signal: AbortSignal) => Promise<string>): Promise<void> {
    if (this.running) { this.running.abort(); return; }
    const project = this.project;
    if (!project) return;
    this.running = new AbortController();
    this.status.hold("Reading…");
this.renderPanel(); this.renderCard();
    try {
      this.status.hold(await work(this.running.signal));
    } catch (e) {
      this.status.fail(couldNot("read the project", e));
    } finally {
      this.running = null;
      await this.show(project, true);
    }
  }

  async readIntent(): Promise<void> { await this.toggleIntent(); }
  async readEchoes(): Promise<void> { await this.toggleEchoes(); }

  private async toggleIntent(): Promise<void> {
    const project = this.project;
    if (!project) return;
    const open = this.model.contradictions.filter(isLiveContradiction);
    if (!this.running && open.length === 0) { this.flash("No open contradictions to read."); return; }
    await this.runReading(async (signal) => {
      const n = await this.source.readIntent(project, open, signal, (p) => { this.status.hold(`${p.skipped ? "Already read" : "Read"} ${p.done}/${p.total}: ${p.scene.title || basenameOf(p.scene.path)}`);});
      return n === 0 ? "Nothing new to read — every open contradiction already has a verdict." : `Read ${n} contradiction${n === 1 ? "" : "s"}.`;
    });
  }

  private async toggleEchoes(): Promise<void> {
    const project = this.project;
    if (!project) return;
    await this.runReading(async (signal) => {
      const n = await this.source.readEchoes(project, signal, (p) => { this.status.hold(`Embedded ${p.done}/${p.total} sentences…`);});
      return n === 0 ? "No sentence pairs found alike." : `Found ${n} sentence pair${n === 1 ? "" : "s"} that say the same thing.`;
    });
  }

  private async toggleDismiss(c: Contradiction): Promise<void> {
    if (!this.project) return;
    try {
      if (c.dismissed) await this.source.undismiss(this.project, c.key); else await this.source.dismiss(this.project, c.key);
    } catch (e) { this.status.fail(couldNot("remember the dismissal", e)); return; }
    const sel = this.selection;
    await this.show(this.project, true);
    // Reselect the same pair in the rebuilt model, if it is still drawn.
    if (sel?.kind === "arc") {
      const again = this.arcs.find((a) => a.contradiction?.key === c.key);
      this.select(again ? { kind: "arc", arc: again } : null);
    }
  }

  /** A contradiction the story means becomes a directed thread: plant in the earlier scene, reversal in the later, both quotes as anchors. */
  private async addReversal(c: Contradiction): Promise<void> {
    if (!this.project) return;
    const [plant, reversal] = c.a.index <= c.b.index ? [c.a, c.b] : [c.b, c.a];
    const name = `${c.subject}'s ${c.attribute}`;
    try {
      await this.source.addStops(this.project, name, [
        { link: sceneLink(plant.scene), note: plant.value ?? "", role: "plant", quote: plant.evidence ?? null },
        { link: sceneLink(reversal.scene), note: reversal.value ?? "", role: "reversal", quote: reversal.evidence ?? null },
      ]);
    } catch (e) { this.status.fail(couldNot("write the reversal", e)); return; }
    this.flash(`“${name}” is a reversal now — drawn as your thread.`);
    this.selection = null;
    await this.show(this.project, true);
  }

  /** The writer claims an echo: a thread named after it, one stop per occurrence, each anchored to the words. */
  private async keepMotif(thread: Thread): Promise<void> {
    if (!this.project) return;
    const stops = thread.refs.filter((r) => r.index >= 0).map((r) => ({ link: sceneLink(r.scene), note: "", quote: r.quote ?? null }));
    try {
      await this.source.addStops(this.project, thread.label, stops);
    } catch (e) { this.status.fail(couldNot("write the motif", e)); return; }
    this.flash(`“${thread.label}” is a motif now — drawn as your thread.`);
    this.selection = null;
    if (this.echoFilter === thread.id) this.echoFilter = null;
    await this.show(this.project, true);
  }

  private async setRole(thread: Thread, ref: ThreadRef, role: StopRole): Promise<void> {
    if (!this.project) return;
    try {
      await this.source.setStopRole(this.project, thread.label, ref.unresolved ?? sceneLink(ref.scene), role);
    } catch (e) { this.status.fail(couldNot("write the thread", e)); return; }
    await this.show(this.project, true);
  }

  private async addStop(thread: string, scene: SceneSlot, note: string): Promise<void> {
    if (!this.project) return;
    try {
      await this.source.addToThread(this.project, thread, sceneLink(scene.ref), note);
    } catch (e) { this.status.fail(couldNot(`add to “${thread}”`, e)); return; }
    this.flash(`Added to “${thread}”.`);
    await this.show(this.project, true);
  }

  private async removeStop(thread: Thread, ref: ThreadRef): Promise<void> {
    if (!this.project) return;
    const project = this.project;
    const link = ref.unresolved ?? sceneLink(ref.scene);
    try {
      await this.source.removeFromThread(project, thread.label, link);
    } catch (e) { this.status.fail(couldNot("remove the stop", e)); return; }
    this.selection = null;
    await this.show(project, true);
    this.status.undoable(`${ref.scene.title || basenameOf(ref.scene.path)} taken out of “${thread.label}”`, async () => {
      await this.source.addStops(project, thread.label, [{ link, note: ref.note, role: ref.role, quote: ref.quote ?? null }]);
      await this.show(project, true);
    });
  }
}

/** "Chapter 3#The station" — how a scene is named in `Story threads.md`. */
export function sceneLink(ref: SceneRef): string {
  return ref.title ? `${basenameOf(ref.path)}#${ref.title}` : basenameOf(ref.path);
}

function arcTitle(arc: ArcPath, thread: Thread | undefined, model: ThreadModel): string {
  const name = (i: number) => model.scenes[i]?.ref.title || basenameOf(model.scenes[i]?.ref.path ?? "");
  const c = arc.contradiction;
  if (c) return `${c.subject} · ${c.attribute}: “${c.a.value}” in ${name(c.a.index)} vs “${c.b.value}” in ${name(c.b.index)}${c.dismissed ? " (dismissed)" : ""}`;
  return `${thread?.label ?? arc.threadId} · ${name(arc.from)} → ${name(arc.to)}${thread?.stale ? " (stale)" : ""}`;
}

function f(n: number): string { return n.toFixed(1); }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
