import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { THREAD_KINDS, type StoryEntityKind, type ThreadKind, type ThreadsSettings } from "../../../domain/settings/Settings";
import { basenameOf } from "../../../domain/story/EntityIndex";
import type { SceneRef } from "../../../domain/story/StoryGraph";
import { DEFAULT_LAYOUT, STRIP_LABEL_HEIGHT, layoutArcs, layoutSlots, layoutStrips, type ArcPath, type LayoutOptions, type SlotBox } from "../../../domain/threads/ArcLayout";
import { EMPTY_THREAD_MODEL, type Contradiction, type SceneSlot, type Thread, type ThreadModel, type ThreadRef } from "../../../domain/threads/Thread";
import type { AnalyzeProgress } from "../../../application/use-cases/AnalyzeSceneRelations";
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
  dismiss(project: ProjectSpec, key: string): Promise<void>;
  undismiss(project: ProjectSpec, key: string): Promise<void>;
  /** Adds a scene to a hand-drawn thread, starting it if new; `link` is "Note#Heading". */
  addToThread(project: ProjectSpec, thread: string, link: string, note: string): Promise<void>;
  removeFromThread(project: ProjectSpec, thread: string, link: string): Promise<void>;
  /** Vault path of the project's `Story threads.md`, whether or not it exists yet. */
  threadsNotePath(project: ProjectSpec): string;
  /** Node colours from the story map, so an entity's thread matches its node. */
  storyColors(): Readonly<Record<StoryEntityKind, string>>;
  settings(): ThreadsSettings;
  updateSettings(next: ThreadsSettings): void;
  openMap(project: ProjectSpec): void;
}

const SVG = "http://www.w3.org/2000/svg";
const KIND_TITLE: Record<ThreadKind, string> = { entity: "Where names appear", fact: "Facts the model read", writer: "Threads you drew" };
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
  private query = "";
  private generation = 0;
  private running: AbortController | null = null;
  private status = "";
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
  private statusEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly source: StoryThreadsSource) {
    super(leaf);
  }

  getViewType(): string { return STORY_THREADS_VIEW_TYPE; }
  getDisplayText(): string { return this.project ? `Story threads · ${this.project.name}` : "Story threads"; }
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
    if (this.project?.scope !== project?.scope) { this.selection = null; this.entityFilter = null; this.zoomX = 1; }
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
    this.root = this.contentEl.createDiv({ cls: "czm-map czm-th" });
    this.scroller = this.root.createDiv({ cls: "czm-th-scroll" });
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", "czm-th-svg");
    this.svg.setAttribute("role", "img");
    this.scroller.appendChild(this.svg);
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

    const corner = this.root.createDiv({ cls: "czm-map-corner" });
    const toggle = corner.createEl("button", { cls: "czm-map-icon clickable-icon", attr: { "aria-label": "Toggle panel" } });
    setIcon(toggle, "sliders-horizontal");
    toggle.addEventListener("click", () => { this.saveSettings({ ...this.settings, panelOpen: !this.settings.panelOpen }); this.renderPanel(); });
    this.panel = this.root.createDiv({ cls: "czm-map-panel" });
    this.badge = this.root.createDiv({ cls: "czm-th-badge" });
    this.card = this.root.createDiv({ cls: "czm-map-card czm-th-card" });
    this.statusEl = this.root.createDiv({ cls: "czm-map-status" });
    this.root.addEventListener("keydown", (e) => { if (e.key === "Escape") this.select(null); });
    this.root.tabIndex = -1;
  }

  private render(): void {
    if (this.selection && !this.stillValid(this.selection)) this.selection = null;
    this.renderChart();
    this.renderPanel();
    this.renderBadge();
    this.renderCard();
    this.renderStatus();
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
      else if (!s.kinds[t.kind]) return false;
      if (s.contradictionsOnly && !this.model.contradictions.some((c) => c.threadId === t.id && (s.showDismissed || !c.dismissed))) return false;
      if (q && !t.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  private visibleContradictions(threads: readonly Thread[]): Contradiction[] {
    const ids = new Set(threads.map((t) => t.id));
    return this.model.contradictions.filter((c) => ids.has(c.threadId) && (this.settings.showDismissed || !c.dismissed));
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
      rect.addEventListener("click", (ev) => { ev.stopPropagation(); this.select(this.selection?.kind === "scene" && this.selection.index === slot.index ? null : { kind: "scene", index: slot.index }); });
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
      path.setAttribute("class", `czm-arc czm-arc-${arc.kind}${c ? " is-contradiction" : ""}${c?.dismissed ? " is-dismissed" : ""}${(c ? c.stale : thread?.stale) ? " is-stale" : ""}`);
      path.setAttribute("d", arc.d);
      path.setAttribute("data-thread", arc.threadId);
      path.setAttribute("data-from", String(arc.from)); path.setAttribute("data-to", String(arc.to));
      if (thread?.entityKind) path.style.setProperty("--czm-kind", colors[thread.entityKind]);
      const title = document.createElementNS(SVG, "title");
      title.textContent = arcTitle(arc, thread, this.model);
      path.appendChild(title);
      path.addEventListener("pointerenter", () => this.hover(arc, true));
      path.addEventListener("pointerleave", () => this.hover(arc, false));
      path.addEventListener("click", (ev) => { ev.stopPropagation(); this.select(this.selection?.kind === "arc" && this.selection.arc === arc ? null : { kind: "arc", arc }); });
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

    if (this.model.scenes.length === 0 || this.arcs.length === 0) this.renderEmpty(contentWidth, baseY);
    this.applySelectionClasses();
  }

  private renderEmpty(width: number, baseY: number): void {
    const t = document.createElementNS(SVG, "text");
    t.setAttribute("class", "czm-map-empty"); t.setAttribute("text-anchor", "middle");
    t.setAttribute("x", f(width / 2)); t.setAttribute("y", f(baseY / 2));
    const s = this.settings;
    t.textContent = !this.project
      ? "No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one."
      : this.model.scenes.length === 0 ? "No scenes yet — headings with prose under them become scenes."
      : this.model.threads.length === 0 && this.model.factsRead === 0 ? "Nothing to draw yet — read the project for facts, draw a thread by hand, or switch on names in the panel."
      : s.contradictionsOnly && this.model.contradictions.length === 0 ? (this.model.factsRead ? "No contradictions in the scenes read so far." : "No facts read yet — read the project for facts to check it for contradictions.")
      : "Nothing matches the current filters.";
    this.arcsG.appendChild(t);
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

  fit(): void {
    this.zoomX = 1;
    this.renderChart();
    this.scroller.scrollLeft = 0;
    this.placeCard();
  }

  // --- floating panel ----------------------------------------------------------

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
    const search = head.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Find a thread…", "aria-label": "Find a thread" } }) as HTMLInputElement;
    search.value = this.query;
    search.addEventListener("input", () => { this.query = search.value; this.renderChart(); this.renderCard(); });

    const actions = this.panel.createDiv({ cls: "czm-map-panel-actions" });
    const btn = (text: string, cls: string, onClick: () => void, title?: string) => {
      const b = actions.createEl("button", { text, cls });
      if (title) b.title = title;
      b.addEventListener("click", onClick);
      return b;
    };
    if (this.project) {
      btn(this.running ? "Stop" : "Read project for facts", "czm-map-analyse czm-th-read", () => void this.toggleRead(null), "Asks the local model (Ollama) for the concrete facts each scene states — eye colours, ages, places, who knows what — so scenes can be checked against each other. Unchanged scenes are skipped.");
      btn("Story map", "czm-th-map-btn", () => this.source.openMap(this.project!), "Open the story map for this project.");
      btn("Threads note", "czm-th-note-btn", () => this.source.openNote(this.source.threadsNotePath(this.project!)), "Open Story threads.md, where hand-drawn threads live.");
    }
    btn("Fit", "czm-map-fit", () => this.fit());

    const section = (title: string, cls: string, open = true) => {
      const d = this.panel.createEl("details", { cls: `czm-map-section czm-map-section-${cls}` }) as HTMLDetailsElement;
      d.open = open;
      d.createEl("summary", { text: title });
      return d;
    };

    const threads = section("Threads", "filters");
    for (const kind of THREAD_KINDS) {
      const n = this.model.threads.filter((t) => t.kind === kind).length;
      new Setting(threads).setName(`${KIND_TITLE[kind]}${n ? ` · ${n}` : ""}`).setClass(`czm-set-thread-${kind}`).addToggle((t) => t.setValue(s.kinds[kind]).onChange((v) => { this.saveSettings({ ...this.settings, kinds: { ...this.settings.kinds, [kind]: v } }); this.renderChart(); this.renderCard(); }));
    }
    const entities = this.model.threads.filter((t) => t.kind === "entity");
    if (entities.length) {
      const row = threads.createDiv({ cls: "czm-th-entity-row" });
      const pick = row.createEl("select", { cls: "dropdown czm-th-entity", attr: { "aria-label": "Follow one name" } }) as HTMLSelectElement;
      pick.createEl("option", { text: "Follow one name…", attr: { value: "" } });
      for (const t of entities) { const o = pick.createEl("option", { text: `${t.label} · ${t.refs.length}` }) as HTMLOptionElement; o.value = t.entityId!; if (this.entityFilter === t.entityId) o.selected = true; }
      pick.addEventListener("change", () => { this.entityFilter = pick.value || null; this.renderChart(); this.renderCard(); });
    }
    const broken = this.model.threads.filter((t) => t.kind === "writer").flatMap((t) => t.refs.filter((r) => r.unresolved).map((r) => ({ thread: t.label, link: r.unresolved! })));
    for (const b of broken) threads.createDiv({ text: `${b.thread}: “${b.link}” points at no scene.`, cls: "czm-map-warn czm-th-broken" });

    const clashes = section("Contradictions", "contradictions");
    const live = this.model.contradictions.filter((c) => !c.dismissed).length, dismissed = this.model.contradictions.length - live;
    clashes.createDiv({ text: this.model.factsRead === 0 ? "No facts read yet." : `${live} open, ${dismissed} dismissed, in ${this.model.factsRead} scene${this.model.factsRead === 1 ? "" : "s"} read.`, cls: "czm-map-hint czm-th-clash-count" });
    new Setting(clashes).setName("Only contradictions").setClass("czm-set-contradictions-only").addToggle((t) => t.setValue(s.contradictionsOnly).onChange((v) => { this.saveSettings({ ...this.settings, contradictionsOnly: v }); this.renderChart(); this.renderCard(); }));
    new Setting(clashes).setName("Show dismissed").setClass("czm-set-show-dismissed").addToggle((t) => t.setValue(s.showDismissed).onChange((v) => { this.saveSettings({ ...this.settings, showDismissed: v }); this.renderChart(); this.renderCard(); }));

    const strips = section("Strips", "strips", false);
    for (const strip of this.model.strips) {
      new Setting(strips).setName(strip.label).setClass(`czm-set-strip-${strip.id}`).addToggle((t) => t.setValue(s.strips[strip.id] !== false).onChange((v) => { this.saveSettings({ ...this.settings, strips: { ...this.settings.strips, [strip.id]: v } }); this.renderChart(); }));
    }
  }

  private renderBadge(): void {
    const live = this.model.contradictions.filter((c) => !c.dismissed).length, dismissed = this.model.contradictions.length - live;
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
    const kind = head.createSpan({ text: thread.kind === "entity" && thread.entityKind ? KIND_LABEL[thread.entityKind] : thread.kind === "writer" ? "Yours" : "Fact", cls: `czm-map-kind czm-th-kind-${thread.kind}` });
    if (thread.entityKind) kind.style.color = this.source.storyColors()[thread.entityKind];
    if (thread.stale && !arc.contradiction) this.card.createEl("p", { text: "A scene changed since the model read it — read again to refresh.", cls: "czm-map-warn" });

    const c = arc.contradiction;
    if (c) this.renderContradiction(c);

    const from = thread.refs.find((r) => r.index === arc.from), to = thread.refs.find((r) => r.index === arc.to);
    this.card.createEl("h4", { text: c ? "Between" : thread.kind === "entity" ? "Consecutive appearances" : "Between" });
    this.stopList([c ? c.a : from, c ? c.b : to].filter((r): r is ThreadRef => !!r), thread);

    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    const btn = (text: string, cls: string, onClick: () => void, title?: string) => { const b = actions.createEl("button", { text, cls }); if (title) b.title = title; b.addEventListener("click", onClick); return b; };
    if (c && this.project) {
      btn(c.dismissed ? "Restore" : "Dismiss", c.dismissed ? "czm-act-undismiss" : "czm-act-dismiss", () => void this.toggleDismiss(c), c.dismissed ? "Show this pair as a contradiction again." : "Not a contradiction — a change the story means, or two ways of saying one thing. Remembered in Story map.md.");
    }
    if (thread.kind === "entity" && thread.entityId) btn(this.entityFilter === thread.entityId ? "Show all names" : "Follow", "czm-act-follow", () => { this.entityFilter = this.entityFilter === thread.entityId ? null : thread.entityId!; this.renderPanel(); this.renderChart(); this.renderCard(); });
    if (thread.kind === "writer" && this.project) {
      for (const r of [from, to]) if (r) btn(`Remove ${r.scene.title || basenameOf(r.scene.path)}`, "czm-act-remove-stop", () => void this.removeStop(thread, r), "Take this scene out of the thread (edits Story threads.md).");
      btn("Open note", "czm-act-open-threads", () => this.source.openNote(this.source.threadsNotePath(this.project!)));
    }
    if (thread.kind === "fact" && !c && this.project) btn(this.running ? "Stop" : "Read again", "czm-act-read-facts", () => void this.toggleRead(null));

    if (thread.refs.length > 2) {
      this.card.createEl("h4", { text: `All ${thread.refs.length} stops` });
      this.stopList(thread.refs, thread);
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
        row.addEventListener("click", () => { const arc = this.arcs.find((a) => a.threadId === t.id && !a.contradiction && (a.from === index || a.to === index)); if (arc) this.select({ kind: "arc", arc }); });
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
    const pick = row.createEl("select", { cls: "dropdown czm-th-add-pick", attr: { "aria-label": "Thread" } }) as HTMLSelectElement;
    for (const t of mine) { const o = pick.createEl("option", { text: t.label }) as HTMLOptionElement; o.value = t.label; }
    pick.createEl("option", { text: "New thread…", attr: { value: " new" } });
    if (mine.length === 0) pick.value = " new";
    const name = row.createEl("input", { cls: "czm-th-add-name", attr: { type: "text", placeholder: "Thread name", "aria-label": "New thread name" } }) as HTMLInputElement;
    const note = row.createEl("input", { cls: "czm-th-add-note", attr: { type: "text", placeholder: "What happens here (optional)", "aria-label": "Note" } }) as HTMLInputElement;
    const sync = () => { name.style.display = pick.value === " new" ? "" : "none"; };
    pick.addEventListener("change", sync); sync();
    const add = row.createEl("button", { text: "Add", cls: "czm-act-add-to-thread" });
    const submit = () => {
      const thread = pick.value === " new" ? name.value.trim() : pick.value;
      if (!thread) { name.focus(); return; }
      void this.addStop(thread, scene, note.value.trim());
    };
    add.addEventListener("click", submit);
    name.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
    note.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(); });
  }

  private stopList(refs: readonly ThreadRef[], thread: Thread): void {
    const list = this.card.createDiv({ cls: "czm-map-list" });
    for (const r of refs) {
      const row = list.createDiv({ cls: `czm-map-row${r.unresolved ? " is-broken" : ""}`, attr: { role: "button", tabindex: "0" } });
      row.createSpan({ text: r.unresolved ? `“${r.unresolved}” — not found` : r.scene.title || "(opening)", cls: "czm-map-row-name" });
      row.createSpan({ text: r.unresolved ? "" : thread.kind === "fact" ? r.value ?? "" : r.note || basenameOf(r.scene.path), cls: "czm-map-row-meta" });
      if (!r.unresolved) {
        row.addEventListener("click", () => this.source.reveal(r.scene));
        row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") this.source.reveal(r.scene); });
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

  private renderStatus(): void {
    this.statusEl.setText(this.status);
    this.statusEl.classList.toggle("is-open", this.status.length > 0);
  }

  private flash(message: string): void {
    this.status = message;
    this.renderStatus();
    window.setTimeout(() => { if (this.status === message) { this.status = ""; this.renderStatus(); } }, 4000);
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
    this.status = "Reading…";
    this.renderStatus(); this.renderPanel(); this.renderCard();
    try {
      const n = await this.source.readFacts(project, path, this.running.signal, (p) => {
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

  private async toggleDismiss(c: Contradiction): Promise<void> {
    if (!this.project) return;
    try {
      if (c.dismissed) await this.source.undismiss(this.project, c.key); else await this.source.dismiss(this.project, c.key);
    } catch (e) { this.flash(e instanceof Error ? e.message : String(e)); return; }
    const sel = this.selection;
    await this.show(this.project, true);
    // Reselect the same pair in the rebuilt model, if it is still drawn.
    if (sel?.kind === "arc") {
      const again = this.arcs.find((a) => a.contradiction?.key === c.key);
      this.select(again ? { kind: "arc", arc: again } : null);
    }
  }

  private async addStop(thread: string, scene: SceneSlot, note: string): Promise<void> {
    if (!this.project) return;
    try {
      await this.source.addToThread(this.project, thread, sceneLink(scene.ref), note);
    } catch (e) { this.flash(e instanceof Error ? e.message : String(e)); return; }
    this.flash(`Added to “${thread}”.`);
    await this.show(this.project, true);
  }

  private async removeStop(thread: Thread, ref: ThreadRef): Promise<void> {
    if (!this.project) return;
    try {
      await this.source.removeFromThread(this.project, thread.label, ref.unresolved ?? sceneLink(ref.scene));
    } catch (e) { this.flash(e instanceof Error ? e.message : String(e)); return; }
    this.selection = null;
    await this.show(this.project, true);
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
