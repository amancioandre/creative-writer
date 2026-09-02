import { ItemView, Setting, setIcon, type WorkspaceLeaf } from "obsidian";
import type { WriterSettings } from "../../../domain/settings/Settings";
import { EMPTY_BOARD, type Board, type Card } from "../../../domain/writer/Board";
import { FRAMEWORKS, UNSORTED, groupsOf, type GroupDef } from "../../../domain/writer/Framework";
import { CARD_H, CARD_W, GROUP_HEAD, GROUP_PAD, MIN_GROUP_H, MIN_GROUP_W, type BoardLayout, type PlacedCard, type PlacedGroup, cardCentre, groupAt, layoutBoard, reorderedGroup } from "../../../domain/writer/Layout";
import { EMPTY_WRITER_FILE, type Point, type Rect, type WriterFile, placeCard, placeGroup, setColour, setFramework, setView } from "../../../domain/writer/WriterFile";
import { normalizePrefix } from "../../../domain/writer/Tags";
import { GraphCanvas, f } from "./GraphCanvas";

export const WRITER_VIEW_TYPE = "creative-writer-writer";

export interface WriterSource {
  /** The board and the file it was built from. */
  build(): Promise<{ board: Board; file: WriterFile }>;
  /** Read, change, write the writer file. */
  update(change: (file: WriterFile) => WriterFile): Promise<WriterFile>;
  /** The writer file's path, or null before the first save. */
  filePath(): string | null;
  openNote(path: string): void;
  /** Rewrites a note's writer tag: `from` null adds, `to` null removes, both replace. Group ids as tagged. */
  retag(path: string, from: string | null, to: string | null): Promise<void>;
  /** A picker over the vault's notes; null when dismissed. */
  pickNote(): Promise<string | null>;
  /** Creates a note tagged into a group and returns its path. */
  createNote(title: string, group: string): Promise<string>;
  copySchema(): Promise<void>;
  settings(): WriterSettings;
  updateSettings(next: WriterSettings): void;
}

const SVG = "http://www.w3.org/2000/svg";
const MIN_ZOOM = 0.08, MAX_ZOOM = 3;
/** Above this zoom a card shows its first lines. */
const READ_ZOOM = 0.85;
type Selection = { kind: "card"; path: string } | { kind: "group"; id: string } | null;

/**
 * The writer board: the vault's tagged notes as cards inside the groups of
 * a framework, layers stacked down the page. Fits, zooms, pans and drags
 * like the story map. Dragging a card into another group rewrites its
 * tag; positions, sizes, colours and the view go to the writer file.
 */
export class WriterView extends ItemView {
  private board: Board = EMPTY_BOARD;
  private file: WriterFile = EMPTY_WRITER_FILE;
  private layout: BoardLayout = layoutBoard(EMPTY_BOARD);
  private selection: Selection = null;
  private query = "";
  private hiddenLayers = new Set<string>();
  /** The group the panel adds new cards to; follows a selected group, survives a rebuild. */
  private into: string | null = null;
  private generation = 0;
  private fitted = false;
  private status = "";
  /** Positions and rectangles while a drag is in flight. */
  private cardOverride = new Map<string, Point>();
  private groupOverride = new Map<string, Rect>();
  private pending: ((file: WriterFile) => WriterFile)[] = [];
  private saveTimer: number | null = null;
  private viewTimer: number | null = null;

  private root!: HTMLElement;
  private canvas!: GraphCanvas;
  private cardEls = new Map<string, SVGGElement>();
  private groupEls = new Map<string, SVGGElement>();
  private edgeEls: { el: SVGLineElement; from: string; to: string }[] = [];
  private card!: HTMLElement;
  private panel!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private readonly source: WriterSource) {
    super(leaf);
  }

  getViewType(): string { return WRITER_VIEW_TYPE; }
  getDisplayText(): string { return "Writer"; }
  getIcon(): string { return "layout-dashboard"; }
  /** The file the leaf shows, so the workspace can restore the board and the explorer can mark it. */
  getState(): Record<string, unknown> { return { file: this.source.filePath() ?? "" }; }
  async setState(_state: unknown, _result: unknown): Promise<void> { if (this.root) await this.show(); }

  async onOpen(): Promise<void> {
    this.mount();
    await this.show();
  }

  async onClose(): Promise<void> {
    this.flushView();
    await this.flushFile();
  }

  /** Rebuilds from the vault and redraws; the selection survives when its subject does. */
  async show(): Promise<void> {
    const generation = ++this.generation;
    const { board, file } = await this.source.build();
    if (generation !== this.generation) return;
    this.board = board;
    this.file = file;
    this.layout = layoutBoard(board);
    if (!this.stillValid(this.selection)) this.selection = null;
    this.render();
    if (!this.fitted) {
      if (file.view) this.canvas.setView(file.view); else this.fit();
      this.fitted = true;
    }
  }

  async refresh(): Promise<void> {
    if (this.root) await this.show();
  }

  fit(): void {
    this.canvas.fit(this.layout.bounds, 40, 1);
  }

  private stillValid(sel: Selection): boolean {
    if (!sel) return false;
    if (sel.kind === "card") return this.layout.cards.has(sel.path);
    return this.layout.groups.some((g) => g.group.def.id === sel.id);
  }

  // --- skeleton ----------------------------------------------------------------

  private mount(): void {
    this.contentEl.empty();
    this.contentEl.addClass("czm-map-host");
    this.root = this.contentEl.createDiv({ cls: "czm-map czm-writer" });
    this.canvas = new GraphCanvas(this.root, {
      cls: "czm-map-svg czm-writer-svg",
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      interactive: ".czm-writer-card, .czm-writer-group",
      onTap: () => this.select(null),
      onView: () => { this.paint(); this.queueView(); },
    });
    const corner = this.root.createDiv({ cls: "czm-map-corner" });
    const toggle = corner.createEl("button", { cls: "czm-map-icon clickable-icon", attr: { "aria-label": "Toggle panel" } });
    setIcon(toggle, "sliders-horizontal");
    toggle.addEventListener("click", () => { this.source.updateSettings({ ...this.source.settings(), panelOpen: !this.source.settings().panelOpen }); this.renderPanel(); });
    this.panel = this.root.createDiv({ cls: "czm-map-panel czm-writer-panel" });
    this.card = this.root.createDiv({ cls: "czm-map-card czm-writer-side" });
    this.statusEl = this.root.createDiv({ cls: "czm-map-status" });
    this.root.addEventListener("keydown", (e) => { if (e.key === "Escape") this.select(null); });
    this.root.tabIndex = -1;
  }

  private render(): void {
    this.renderGraph();
    this.renderPanel();
    this.renderCard();
    this.renderStatus();
  }

  // --- graph ---------------------------------------------------------------------

  private renderGraph(): void {
    const vp = this.canvas.viewport;
    vp.replaceChildren();
    this.cardEls.clear();
    this.groupEls.clear();
    this.edgeEls = [];
    const shownCards = new Set<string>();
    this.canvas.svg.setAttribute("aria-label", `Writer board: ${this.board.cards.length} cards in ${this.board.framework.name}`);

    const groupsG = document.createElementNS(SVG, "g");
    for (const layer of this.layout.layers) {
      if (this.hiddenLayers.has(layer.name)) continue;
      const first = layer.groups[0];
      if (first) {
        const label = document.createElementNS(SVG, "text");
        label.setAttribute("class", "czm-writer-layer");
        label.setAttribute("x", f(first.rect.x)); label.setAttribute("y", f(first.rect.y - 10));
        label.textContent = layer.name;
        groupsG.appendChild(label);
      }
      for (const pg of layer.groups) {
        groupsG.appendChild(this.groupElement(pg));
        for (const pc of pg.cards) shownCards.add(pc.card.path);
      }
    }
    vp.appendChild(groupsG);

    const edgesG = document.createElementNS(SVG, "g");
    for (const e of this.board.derived) {
      if (!shownCards.has(e.from) || !shownCards.has(e.to)) continue;
      const line = document.createElementNS(SVG, "line");
      line.setAttribute("class", "czm-writer-edge");
      edgesG.appendChild(line);
      this.edgeEls.push({ el: line, from: e.from, to: e.to });
    }
    vp.appendChild(edgesG);

    const cardsG = document.createElementNS(SVG, "g");
    for (const pg of this.layout.groups) {
      if (this.hiddenLayers.has(pg.layer)) continue;
      for (const pc of pg.cards) cardsG.appendChild(this.cardElement(pc, pg));
    }
    vp.appendChild(cardsG);

    if (this.board.cards.length === 0) {
      const t = document.createElementNS(SVG, "text");
      t.setAttribute("class", "czm-map-empty czm-writer-empty");
      t.setAttribute("x", f(this.layout.bounds.x + 8)); t.setAttribute("y", f(this.layout.bounds.y + this.layout.bounds.h + 40));
      t.textContent = `Nothing on the board yet. Tag any note #${this.file.prefix}/theme (or another group) and it appears here; or use Add in the panel.`;
      vp.appendChild(t);
    }
    this.applySelectionClasses();
    this.paint();
  }

  private groupElement(pg: PlacedGroup): SVGGElement {
    const g = document.createElementNS(SVG, "g");
    const id = pg.group.def.id;
    g.setAttribute("class", `czm-writer-group${pg.cards.length ? "" : " is-empty"}`);
    g.setAttribute("data-id", id);
    g.style.setProperty("--czm-group", pg.group.colour);
    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("class", "czm-writer-group-rect");
    rect.setAttribute("rx", "10");
    g.appendChild(rect);
    const head = document.createElementNS(SVG, "text");
    head.setAttribute("class", "czm-writer-group-name");
    head.textContent = pg.cards.length ? `${pg.group.def.name} · ${this.board.cards.filter((c) => c.groups.includes(id)).length}` : pg.group.def.name;
    g.appendChild(head);
    if (!pg.cards.length && pg.group.def.hint) {
      const fo = document.createElementNS(SVG, "foreignObject");
      fo.setAttribute("class", "czm-writer-hint");
      const div = document.createElement("div");
      div.className = "czm-writer-hint-text";
      div.textContent = pg.group.def.hint;
      fo.appendChild(div);
      g.appendChild(fo);
    }
    const handle = document.createElementNS(SVG, "rect");
    handle.setAttribute("class", "czm-writer-resize");
    handle.setAttribute("width", "14"); handle.setAttribute("height", "14"); handle.setAttribute("rx", "3");
    g.appendChild(handle);
    const title = document.createElementNS(SVG, "title");
    title.textContent = pg.group.def.hint ? `${pg.group.def.name}: ${pg.group.def.hint}` : pg.group.def.name;
    g.appendChild(title);
    this.attachGroupDrag(g, pg);
    this.attachResize(handle, pg);
    this.groupEls.set(id, g);
    return g;
  }

  private cardElement(pc: PlacedCard, pg: PlacedGroup): SVGGElement {
    const c = pc.card;
    const g = document.createElementNS(SVG, "g");
    g.setAttribute("class", "czm-writer-card");
    g.setAttribute("data-path", c.path);
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.style.setProperty("--czm-group", pg.group.colour);
    const rect = document.createElementNS(SVG, "rect");
    rect.setAttribute("class", "czm-writer-card-rect");
    rect.setAttribute("width", f(CARD_W)); rect.setAttribute("height", f(CARD_H)); rect.setAttribute("rx", "8");
    g.appendChild(rect);
    const fo = document.createElementNS(SVG, "foreignObject");
    fo.setAttribute("width", f(CARD_W)); fo.setAttribute("height", f(CARD_H));
    const body = document.createElement("div");
    body.className = "czm-writer-card-body";
    const titleEl = document.createElement("div");
    titleEl.className = "czm-writer-card-title";
    titleEl.textContent = c.title;
    body.appendChild(titleEl);
    const chips = document.createElement("div");
    chips.className = "czm-writer-chips";
    for (const gid of c.groups) {
      const chip = document.createElement("span");
      chip.className = "czm-writer-chip";
      chip.style.setProperty("--czm-group", this.colourOf(gid));
      chip.title = this.groupName(gid);
      chips.appendChild(chip);
    }
    body.appendChild(chips);
    const excerpt = document.createElement("div");
    excerpt.className = "czm-writer-card-excerpt";
    excerpt.textContent = c.excerpt;
    body.appendChild(excerpt);
    fo.appendChild(body);
    g.appendChild(fo);
    const title = document.createElementNS(SVG, "title");
    title.textContent = `${c.title} — ${c.groups.map((x) => this.groupName(x)).join(", ")}${c.excerpt ? `\n${c.excerpt}` : ""}`;
    g.appendChild(title);
    this.attachCardDrag(g, pc);
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); this.select({ kind: "card", path: c.path }); } });
    g.addEventListener("dblclick", (ev) => { ev.stopPropagation(); this.source.openNote(c.path); });
    this.cardEls.set(c.path, g);
    return g;
  }

  private colourOf(groupId: string): string {
    return this.layout.groups.find((g) => g.group.def.id === groupId)?.group.colour ?? UNSORTED.colour;
  }

  private groupName(groupId: string): string {
    return this.groupDef(groupId)?.name ?? groupId;
  }

  private groupDef(groupId: string): GroupDef | null {
    return groupId === UNSORTED.id ? UNSORTED : groupsOf(this.board.framework).find((g) => g.id === groupId) ?? null;
  }

  private cardAt(path: string): Point | null {
    const pc = this.layout.cards.get(path);
    if (!pc) return null;
    return this.cardOverride.get(path) ?? { x: pc.x, y: pc.y };
  }

  private rectOf(pg: PlacedGroup): Rect {
    return this.groupOverride.get(pg.group.def.id) ?? pg.rect;
  }

  /** Move every element to its current position. */
  private paint(): void {
    for (const pg of this.layout.groups) {
      const g = this.groupEls.get(pg.group.def.id);
      if (!g) continue;
      const r = this.rectOf(pg);
      const rect = g.querySelector<SVGRectElement>(".czm-writer-group-rect")!;
      rect.setAttribute("x", f(r.x)); rect.setAttribute("y", f(r.y)); rect.setAttribute("width", f(r.w)); rect.setAttribute("height", f(r.h));
      const head = g.querySelector<SVGTextElement>(".czm-writer-group-name")!;
      head.setAttribute("x", f(r.x + 14)); head.setAttribute("y", f(r.y + 23));
      const hint = g.querySelector<SVGForeignObjectElement>(".czm-writer-hint");
      if (hint) { hint.setAttribute("x", f(r.x + GROUP_PAD)); hint.setAttribute("y", f(r.y + GROUP_HEAD + 4)); hint.setAttribute("width", f(Math.max(40, r.w - 2 * GROUP_PAD))); hint.setAttribute("height", f(Math.max(20, r.h - GROUP_HEAD - 8))); }
      const handle = g.querySelector<SVGRectElement>(".czm-writer-resize")!;
      handle.setAttribute("x", f(r.x + r.w - 18)); handle.setAttribute("y", f(r.y + r.h - 18));
    }
    for (const [path, g] of this.cardEls) {
      const p = this.cardAt(path);
      if (p) g.setAttribute("transform", `translate(${f(p.x)} ${f(p.y)})`);
    }
    for (const { el, from, to } of this.edgeEls) {
      const a = this.cardAt(from), b = this.cardAt(to);
      if (!a || !b) continue;
      const ca = cardCentre(a), cb = cardCentre(b);
      el.setAttribute("x1", f(ca.x)); el.setAttribute("y1", f(ca.y)); el.setAttribute("x2", f(cb.x)); el.setAttribute("y2", f(cb.y));
    }
    this.root.classList.toggle("is-zoomed", this.canvas.view.k >= READ_ZOOM);
    this.canvas.paint();
    this.placeCard();
  }

  private applySelectionClasses(): void {
    const sel = this.selection;
    const q = this.query.trim().toLowerCase();
    for (const [path, g] of this.cardEls) {
      const c = this.layout.cards.get(path)?.card;
      const hit = !q || !!c && (c.title.toLowerCase().includes(q) || c.excerpt.toLowerCase().includes(q));
      g.classList.toggle("is-selected", sel?.kind === "card" && sel.path === path);
      g.classList.toggle("is-dim", !hit);
      g.classList.toggle("is-pinned", !!this.layout.cards.get(path)?.pinned);
    }
    for (const [id, g] of this.groupEls) g.classList.toggle("is-selected", sel?.kind === "group" && sel.id === id);
    for (const { el, from, to } of this.edgeEls) el.classList.toggle("is-lit", sel?.kind === "card" && (sel.path === from || sel.path === to));
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.applySelectionClasses();
    this.renderCard();
    this.placeCard();
  }

  // --- dragging ------------------------------------------------------------------

  private attachCardDrag(g: SVGGElement, pc: PlacedCard): void {
    const path = pc.card.path;
    this.canvas.attachDrag(g, {
      onMove: (_w, d) => { this.cardOverride.set(path, { x: pc.x + d.x, y: pc.y + d.y }); this.paint(); },
      onEnd: (moved) => {
        if (!moved) { this.select(this.selection?.kind === "card" && this.selection.path === path ? null : { kind: "card", path }); return; }
        const at = this.cardOverride.get(path) ?? { x: pc.x, y: pc.y };
        void this.dropCard(pc, at);
      },
    });
  }

  /** A card let go: remember where, relative to the group it now belongs to, and if it landed in another group, move its tag there. */
  private async dropCard(pc: PlacedCard, at: Point): Promise<void> {
    const path = pc.card.path;
    const target = groupAt(this.layout, cardCentre(at));
    const home = this.layout.groups.find((g) => g.group.def.id === pc.group);
    const origin = (target ?? home)?.rect ?? { x: 0, y: 0 };
    this.queue((file) => placeCard(file, path, { x: at.x - origin.x, y: at.y - origin.y }));
    if (target && target.group.def.id !== pc.group) {
      const from = pc.card.tagGroups[pc.card.groups.indexOf(pc.group)] ?? pc.group;
      try { await this.source.retag(path, from, target.group.def.id); } catch (e) { this.flash(e instanceof Error ? e.message : String(e)); }
      this.flash(`${pc.card.title}: ${this.groupName(pc.group)} → ${target.group.def.name}`);
    }
    await this.flushFile();
    this.cardOverride.delete(path);
    await this.show();
  }

  private attachGroupDrag(g: SVGGElement, pg: PlacedGroup): void {
    const id = pg.group.def.id;
    let inside: PlacedCard[] = [];
    g.addEventListener("pointerdown", () => { inside = pg.cards.filter((c) => contains(this.rectOf(pg), cardCentre(this.cardAt(c.card.path) ?? c))); });
    this.canvas.attachDrag(g, {
      onMove: (_w, d) => {
        this.groupOverride.set(id, { ...pg.rect, x: pg.rect.x + d.x, y: pg.rect.y + d.y });
        for (const c of inside) this.cardOverride.set(c.card.path, { x: c.x + d.x, y: c.y + d.y });
        this.paint();
      },
      onEnd: (moved) => {
        if (!moved) { this.select(this.selection?.kind === "group" && this.selection.id === id ? null : { kind: "group", id }); return; }
        // Groups flow: the drop reorders the row and every rectangle in it is written, so the order seen is the order kept.
        const dropped = this.groupOverride.get(id) ?? pg.rect;
        for (const r of reorderedGroup(this.layout, id, dropped.x)) this.queue((file) => placeGroup(file, r.id, r.rect));
        void this.flushFile().then(() => { this.groupOverride.delete(id); for (const c of inside) this.cardOverride.delete(c.card.path); return this.show(); });
      },
    });
  }

  private attachResize(handle: SVGRectElement, pg: PlacedGroup): void {
    const id = pg.group.def.id;
    this.canvas.attachDrag(handle, {
      onMove: (_w, d) => { this.groupOverride.set(id, { ...pg.rect, w: Math.max(MIN_GROUP_W, pg.rect.w + d.x), h: Math.max(MIN_GROUP_H, pg.rect.h + d.y) }); this.paint(); },
      onEnd: (moved) => {
        if (!moved) return;
        const rect = this.groupOverride.get(id) ?? pg.rect;
        this.queue((file) => placeGroup(file, id, rect));
        void this.flushFile().then(() => { this.groupOverride.delete(id); return this.show(); });
      },
    });
  }

  // --- persistence ---------------------------------------------------------------

  /** Changes to the file are batched and written a moment later, as one read-change-write. */
  private queue(change: (file: WriterFile) => WriterFile): void {
    this.pending.push(change);
    this.file = change(this.file);
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.flushFile(), 600);
  }

  private async flushFile(): Promise<void> {
    if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (!this.pending.length) return;
    const changes = this.pending;
    this.pending = [];
    try {
      this.file = await this.source.update((file) => changes.reduce((acc, c) => c(acc), file));
    } catch (e) {
      this.flash(e instanceof Error ? e.message : String(e));
    }
  }

  /** The view moves often; write it at most once a second. */
  private queueView(): void {
    if (this.viewTimer !== null) window.clearTimeout(this.viewTimer);
    this.viewTimer = window.setTimeout(() => this.flushView(), 1000);
  }

  private flushView(): void {
    if (this.viewTimer !== null) { window.clearTimeout(this.viewTimer); this.viewTimer = null; }
    const v = this.canvas.view;
    const cur = this.file.view;
    if (cur && Math.abs(cur.x - v.x) < 0.5 && Math.abs(cur.y - v.y) < 0.5 && Math.abs(cur.k - v.k) < 0.001) return;
    this.queue((file) => setView(file, { x: Math.round(v.x), y: Math.round(v.y), k: Number(v.k.toFixed(3)) }));
  }

  private flash(message: string): void {
    this.status = message;
    this.renderStatus();
    window.setTimeout(() => { if (this.status === message) { this.status = ""; this.renderStatus(); } }, 4000);
  }

  private renderStatus(): void {
    this.statusEl.setText(this.status);
    this.statusEl.classList.toggle("is-open", this.status.length > 0);
  }

  // --- panel ---------------------------------------------------------------------

  private renderPanel(): void {
    const s = this.source.settings();
    this.panel.empty();
    this.panel.classList.toggle("is-open", s.panelOpen);
    if (!s.panelOpen) return;
    const head = this.panel.createDiv({ cls: "czm-map-panel-head" });
    const fw = head.createEl("select", { cls: "dropdown czm-writer-framework", attr: { "aria-label": "Framework" } });
    for (const x of FRAMEWORKS) { const o = fw.createEl("option", { text: x.name }); o.value = x.id; }
    if (typeof this.file.framework !== "string") { const o = fw.createEl("option", { text: `${this.board.framework.name} (yours)` }); o.value = "custom"; }
    fw.value = this.board.framework.id;
    fw.addEventListener("change", () => { if (fw.value !== "custom") { this.queue((file) => setFramework(file, fw.value)); void this.flushFile().then(() => this.show()); } });
    const search = head.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Find a card…", "aria-label": "Find a card" } });
    search.value = this.query;
    search.addEventListener("input", () => { this.query = search.value; this.applySelectionClasses(); });

    const actions = this.panel.createDiv({ cls: "czm-map-panel-actions" });
    const btn = (text: string, cls: string, onClick: () => void, title?: string) => { const b = actions.createEl("button", { text, cls }); if (title) b.title = title; b.addEventListener("click", onClick); return b; };
    const groups = groupsOf(this.board.framework);
    const into = actions.createEl("select", { cls: "dropdown czm-writer-into", attr: { "aria-label": "Group for new cards" } });
    for (const g of groups) { const o = into.createEl("option", { text: g.name }); o.value = g.id; }
    const sel = this.selection;
    if (sel?.kind === "group" && groups.some((g) => g.id === sel.id)) this.into = sel.id;
    if (this.into && groups.some((g) => g.id === this.into)) into.value = this.into;
    into.addEventListener("change", () => { this.into = into.value; });
    btn("Add note…", "czm-writer-add", () => void this.addNote(into.value), "Put an existing note on the board, in the group chosen here.");
    btn("New note…", "czm-writer-new", () => this.newNoteForm(into.value), "Write a new note straight into the group chosen here.");
    btn("Fit", "czm-map-fit", () => this.fit());
    btn("Copy schema", "czm-writer-schema", () => void this.source.copySchema(), "Put the writer protocol on the clipboard, for a person or a tool preparing this vault.");

    const section = (title: string, open = true) => { const d = this.panel.createEl("details", { cls: `czm-map-section czm-map-section-${title.split(" ")[0]!.toLowerCase()}` }); d.open = open; d.createEl("summary", { text: title }); return d; };
    const layers = section("Layers", false);
    for (const l of this.layout.layers) {
      new Setting(layers).setName(l.name).setClass("czm-set-layer").addToggle((t) => t.setValue(!this.hiddenLayers.has(l.name)).onChange((v) => { if (v) this.hiddenLayers.delete(l.name); else this.hiddenLayers.add(l.name); this.renderGraph(); }));
    }
    const colours = section("Groups & colours", false);
    for (const pg of this.layout.groups) {
      const n = this.board.cards.filter((c) => c.groups.includes(pg.group.def.id)).length;
      new Setting(colours).setName(`${pg.group.def.name}${n ? ` · ${n}` : ""}`).setClass(`czm-set-group-${pg.group.def.id}`)
        .addColorPicker((c) => c.setValue(pg.group.colour).onChange((v) => { this.queue((file) => setColour(file, pg.group.def.id, v)); this.recolour(); }));
    }
    new Setting(colours).setName("Reset colours").setClass("czm-set-reset-colours").addButton((b) => b.setButtonText("Reset").onClick(() => { this.queue((file) => ({ ...file, colours: {} })); void this.flushFile().then(() => this.show()); }));
    const prefixSec = section("Tag prefix", false);
    new Setting(prefixSec).setName("Prefix").setDesc(`Cards are notes tagged #${this.file.prefix}/<group>.`).setClass("czm-set-prefix")
      .addText((t) => t.setPlaceholder("writer").setValue(this.file.prefix).onChange((v) => { const p = normalizePrefix(v); if (p !== this.file.prefix) { this.queue((file) => ({ ...file, prefix: p })); void this.flushFile().then(() => this.show()); } }));
    if (this.source.filePath()) prefixSec.createDiv({ text: `Layout in ${this.source.filePath()}`, cls: "czm-map-hint" });
  }

  private recolour(): void {
    this.board = { ...this.board };
    this.layout = layoutBoard({ ...this.board, layers: this.board.layers.map((l) => ({ ...l, groups: l.groups.map((g) => ({ ...g, colour: this.file.colours[g.def.id] ?? g.def.colour })) })), unsorted: { ...this.board.unsorted, colour: this.file.colours[UNSORTED.id] ?? UNSORTED.colour } });
    this.renderGraph();
    this.renderCard();
  }

  private async addNote(group: string): Promise<void> {
    const path = await this.source.pickNote();
    if (!path) return;
    const existing = this.layout.cards.get(path)?.card;
    if (existing?.groups.includes(group)) { this.select({ kind: "card", path }); return; }
    try { await this.source.retag(path, null, group); } catch (e) { this.flash(e instanceof Error ? e.message : String(e)); return; }
    this.selection = { kind: "card", path };
    await this.show();
  }

  private newNoteForm(group: string): void {
    this.selection = null;
    this.card.empty();
    this.card.classList.add("is-open");
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: `New ${this.groupName(group).toLowerCase()} note`, cls: "czm-map-card-name" });
    const form = this.card.createDiv({ cls: "czm-map-label" });
    const input = form.createEl("input", { cls: "czm-map-label-input czm-writer-new-title", attr: { type: "text", placeholder: "Title…", "aria-label": "Title of the new note" } });
    const create = () => { const title = input.value.trim(); if (title) void this.createNote(title, group); else input.focus(); };
    const ok = form.createEl("button", { text: "Create", cls: "czm-act-create" });
    ok.addEventListener("click", create);
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") create(); if (ev.key === "Escape") { ev.stopPropagation(); this.select(null); } });
    const no = form.createEl("button", { text: "Cancel", cls: "czm-act-cancel-label" });
    no.addEventListener("click", () => this.select(null));
    this.card.style.left = "50%"; this.card.style.top = "40%";
    input.focus();
  }

  private async createNote(title: string, group: string): Promise<void> {
    let path: string;
    try { path = await this.source.createNote(title, group); } catch (e) { this.flash(e instanceof Error ? e.message : String(e)); return; }
    this.selection = { kind: "card", path };
    await this.show();
    this.source.openNote(path);
  }

  // --- side card -------------------------------------------------------------------

  private renderCard(): void {
    const sel = this.selection;
    this.card.empty();
    this.card.style.left = ""; this.card.style.top = "";
    this.card.classList.toggle("is-open", sel !== null);
    if (!sel) return;
    const close = this.card.createEl("button", { cls: "czm-map-card-close clickable-icon", attr: { "aria-label": "Close" } });
    setIcon(close, "x");
    close.addEventListener("click", () => this.select(null));
    if (sel.kind === "card") this.renderCardCard(sel.path); else this.renderGroupCard(sel.id);
    this.placeCard();
  }

  private renderCardCard(path: string): void {
    const pc = this.layout.cards.get(path);
    if (!pc) return;
    const c = pc.card;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: c.title, cls: "czm-map-card-name" });
    const chips = head.createDiv({ cls: "czm-writer-chips czm-writer-chips-side" });
    for (const gid of c.groups) { const chip = chips.createSpan({ text: this.groupName(gid), cls: "czm-writer-chip-label" }); chip.style.setProperty("--czm-group", this.colourOf(gid)); }
    if (c.excerpt) this.card.createEl("p", { text: c.excerpt, cls: "czm-writer-excerpt" });
    this.card.createDiv({ text: c.path, cls: "czm-map-hint" });
    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    const open = actions.createEl("button", { text: "Open note", cls: "czm-act-open" });
    open.addEventListener("click", () => this.source.openNote(path));
    if (pc.pinned) { const unpin = actions.createEl("button", { text: "Back to grid", cls: "czm-act-unpin" }); unpin.addEventListener("click", () => { this.queue((file) => placeCard(file, path, null)); void this.flushFile().then(() => this.show()); }); }
    this.card.createEl("h4", { text: "Groups" });
    const list = this.card.createDiv({ cls: "czm-map-list" });
    c.groups.forEach((gid, i) => {
      const row = list.createDiv({ cls: "czm-map-row" });
      row.createSpan({ text: this.groupName(gid), cls: "czm-map-row-name" });
      const rm = row.createEl("button", { text: "Remove", cls: "czm-act-remove-group" });
      rm.title = `Remove the #${this.file.prefix}/${c.tagGroups[i] ?? gid} tag from the note.`;
      rm.addEventListener("click", () => void this.source.retag(path, c.tagGroups[i] ?? gid, null).then(() => this.show(), (e: unknown) => this.flash(e instanceof Error ? e.message : String(e))));
    });
    const others = groupsOf(this.board.framework).filter((g) => !c.groups.includes(g.id));
    if (others.length) {
      const row = this.card.createDiv({ cls: "czm-map-alias" });
      const select = row.createEl("select", { cls: "dropdown czm-act-add-group-target", attr: { "aria-label": "Also in" } });
      select.createEl("option", { text: "Also in…", attr: { value: "" } });
      for (const g of others) { const o = select.createEl("option", { text: g.name }); o.value = g.id; }
      const apply = row.createEl("button", { text: "Add", cls: "czm-act-add-group" });
      apply.disabled = true;
      select.addEventListener("change", () => { apply.disabled = !select.value; });
      apply.addEventListener("click", () => void this.source.retag(path, null, select.value).then(() => this.show(), (e: unknown) => this.flash(e instanceof Error ? e.message : String(e))));
    }
    const linked = this.board.derived.filter((e) => e.from === path || e.to === path);
    if (linked.length) {
      this.card.createEl("h4", { text: "Linked to" });
      const links = this.card.createDiv({ cls: "czm-map-list" });
      for (const e of linked) {
        const other = e.from === path ? e.to : e.from;
        const row = links.createDiv({ cls: "czm-map-row", attr: { role: "button", tabindex: "0" } });
        row.createSpan({ text: this.layout.cards.get(other)?.card.title ?? other, cls: "czm-map-row-name" });
        row.addEventListener("click", () => this.select({ kind: "card", path: other }));
      }
    }
  }

  private renderGroupCard(id: string): void {
    const pg = this.layout.groups.find((g) => g.group.def.id === id);
    if (!pg) return;
    const head = this.card.createDiv({ cls: "czm-map-card-head" });
    head.createSpan({ text: pg.group.def.name, cls: "czm-map-card-name" });
    head.createSpan({ text: pg.layer, cls: "czm-map-kind" });
    if (pg.group.def.hint) this.card.createEl("p", { text: pg.group.def.hint, cls: "czm-map-hint" });
    const n = this.board.cards.filter((c) => c.groups.includes(id)).length;
    this.card.createDiv({ text: n ? `${n} card${n === 1 ? "" : "s"}` : "Empty", cls: "czm-map-hint" });
    const actions = this.card.createDiv({ cls: "czm-map-card-actions" });
    if (id !== UNSORTED.id) { const add = actions.createEl("button", { text: "New note here", cls: "czm-act-new-here" }); add.addEventListener("click", () => this.newNoteForm(id)); }
    if (id !== UNSORTED.id) { const pick = actions.createEl("button", { text: "Add note here", cls: "czm-act-add-here" }); pick.addEventListener("click", () => void this.addNote(id)); }
    if (pg.pinned) { const reset = actions.createEl("button", { text: "Reset size", cls: "czm-act-reset-group" }); reset.addEventListener("click", () => { this.queue((file) => placeGroup(file, id, null)); void this.flushFile().then(() => this.show()); }); }
    const colour = this.card.createDiv({ cls: "czm-map-label" });
    colour.createSpan({ text: "Colour", cls: "czm-map-hint" });
    const input = colour.createEl("input", { cls: "czm-writer-colour", attr: { type: "color", "aria-label": "Group colour" } });
    input.value = pg.group.colour;
    input.addEventListener("input", () => { this.queue((file) => setColour(file, id, input.value)); this.recolour(); });
    if (this.file.colours[id]) { const reset = colour.createEl("button", { text: "Default", cls: "czm-act-reset-colour" }); reset.addEventListener("click", () => { this.queue((file) => setColour(file, id, null)); this.recolour(); }); }
  }

  /** Put the card beside its subject, inside the leaf. */
  private placeCard(): void {
    const sel = this.selection;
    if (!sel || !this.card.classList.contains("is-open")) return;
    const rect = this.canvas.svg.getBoundingClientRect();
    const w = rect.width || 800, h = rect.height || 600;
    let anchor: Point | null = null;
    if (sel.kind === "card") { const p = this.cardAt(sel.path); if (p) anchor = { x: p.x + CARD_W, y: p.y }; }
    else { const pg = this.layout.groups.find((g) => g.group.def.id === sel.id); if (pg) { const r = this.rectOf(pg); anchor = { x: r.x + r.w, y: r.y }; } }
    if (!anchor) return;
    const s = this.canvas.toScreen(anchor);
    const cw = this.card.offsetWidth || 260, ch = this.card.offsetHeight || 200;
    let x = s.x + 12, y = s.y;
    if (x + cw > w - 8) x = s.x - (sel.kind === "card" ? CARD_W : 0) * this.canvas.view.k - cw - 24;
    if (x < 8) x = 8;
    if (y + ch > h - 8) y = h - ch - 8;
    if (y < 8) y = 8;
    this.card.style.left = `${Math.round(x)}px`;
    this.card.style.top = `${Math.round(y)}px`;
  }
}

function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export { CARD_W as WRITER_CARD_W, CARD_H as WRITER_CARD_H };
export type { Card as WriterCard };
