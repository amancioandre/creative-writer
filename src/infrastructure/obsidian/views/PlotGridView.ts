import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import type { StoryMapSettings } from "../../../domain/settings/Settings";
import { EMPTY_PLOT_GRID, type ColumnKind, type GridCell, type GridColumn, type GridRow, type PlotGrid } from "../../../domain/plot/PlotGrid";
import type { Entity, SceneRef } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import { ARC_ROLES, THREAD_ROLES, type StopRole, type ThreadRef } from "../../../domain/threads/Thread";
import type { StopToAdd } from "../../../application/use-cases/EditStoryThread";
import { KIND_LABEL } from "./StoryMapView";
import { PanelShell, type MenuEntry, type PanelId } from "./PanelShell";
import { StatusLine, couldNot } from "./StatusLine";
import { inField, onActivate } from "./keys";

/** The timeline's type string, kept so leaves open across the update come back as the grid. */
export const PLOT_GRID_VIEW_TYPE = "creative-writer-story-timeline";
/** A filter redraws the table once the typing pauses. */
const SEARCH_DEBOUNCE_MS = 120;

export interface PlotGridSource {
  projects(): ProjectSpec[];
  activeProject(): ProjectSpec | null;
  build(project: ProjectSpec): Promise<PlotGrid>;
  openNote(path: string): void;
  reveal(ref: SceneRef): void;
  settings(): StoryMapSettings;
  /** Where the project's hand-drawn threads live. */
  threadsNotePath(project: ProjectSpec): string;
  /** Writes or replaces stops on a thread (starting the thread when it is new). */
  addStops(project: ProjectSpec, thread: string, stops: readonly StopToAdd[]): Promise<void>;
  removeFromThread(project: ProjectSpec, thread: string, link: string): Promise<void>;
  /** A thread with no stops: an empty column. */
  addThread(project: ProjectSpec, name: string): Promise<void>;
  /** The heading and everything under it. */
  removeThread(project: ProjectSpec, name: string): Promise<void>;
  /** Opens a sibling panel, for the same project where the panel takes one. */
  jumpTo(to: PanelId, project: ProjectSpec | null): void;
}

export const KIND_GROUP: Record<ColumnKind, string> = { arc: "Arcs", theme: "Themes", subplot: "Subplots", free: "Threads" };

/** What a stop's role looks like in a cell: a triangle family, one shape per meaning. */
export const ROLE_GLYPH: Record<StopRole, string> = { plant: "▶", touch: "", payoff: "◀", reversal: "▼", want: "▸", lie: "▹", turn: "▼", truth: "◂" };

/** `Chapter 3#The station` for a scene, `Chapter 3` for prose before its first heading. */
export function sceneLink(ref: SceneRef): string {
  const name = basenameOf(ref.path);
  return ref.title ? `${name}#${ref.title}` : name;
}

interface Selection { readonly col: number; readonly row: number }

export type PlotGridAction = "clear-search" | "toggle-cast" | "open-note" | "toggle-panel" | "new-column";

/**
 * The plot grid: every scene of the project in reading order down the
 * side, the writer's threads across the top, and in each cell what the
 * thread is doing in the scene. The cast the timeline used to spread
 * across the pane folds into one column until it is asked for. Every
 * cell typed here is a line in `Story threads.md`; the grid writes lines
 * and never owns them.
 */
export class PlotGridView extends ItemView {
  private project: ProjectSpec | null = null;
  private grid: PlotGrid = EMPTY_PLOT_GRID;
  private query = "";
  private castExpanded = false;
  private panelOpen = true;
  private selection: Selection | null = null;
  private editing = false;
  private generation = 0;
  private shell: PanelShell | null = null;
  private body: HTMLElement | null = null;
  private status: StatusLine | null = null;
  private search: HTMLInputElement | null = null;
  private searchTimer: number | null = null;
  /** The columns as drawn, after the search: what the selection indexes. */
  private shown: readonly GridColumn[] = [];
  private rows: readonly GridRow[] = [];

  constructor(leaf: WorkspaceLeaf, private readonly source: PlotGridSource) {
    super(leaf);
  }

  getViewType(): string { return PLOT_GRID_VIEW_TYPE; }
  getDisplayText(): string { return "Plot grid"; }
  getIcon(): string { return "table"; }

  async onOpen(): Promise<void> {
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async show(project: ProjectSpec | null, keepStatus = false): Promise<void> {
    const generation = ++this.generation;
    this.project = project;
    if (!project) { this.grid = EMPTY_PLOT_GRID; this.render(); return; }
    const grid = await this.source.build(project);
    if (generation !== this.generation) return;
    this.grid = grid;
    this.render(keepStatus);
  }

  async refresh(): Promise<void> {
    if (this.project && !this.editing) await this.show(this.project, true);
  }

  render(keepStatus = false): void {
    const statusText = keepStatus ? this.status?.text : undefined;
    this.contentEl.empty();
    const shell = new PanelShell(this.contentEl, {
      current: "timeline",
      jump: (to) => this.source.jumpTo(to, this.project),
      side: { isOpen: () => this.panelOpen, onToggle: () => { this.panelOpen = !this.panelOpen; } },
    });
    shell.overflow(() => this.menu());
    this.shell = shell;
    this.body = shell.main.createDiv({ cls: "czm-pg" });
    this.body.addEventListener("keydown", (ev) => this.onKey(ev));
    this.status = new StatusLine(shell.main);
    if (statusText) this.status.hold(statusText);
    const head = shell.scope;
    const projects = this.source.projects();
    const select = head.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } });
    for (const p of projects) {
      const opt = select.createEl("option", { text: p.name });
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    select.addEventListener("change", () => { this.selection = null; void this.show(projects.find((p) => p.scope === select.value) ?? null); });
    const search = head.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Filter columns…", "aria-label": "Filter the columns and the cast" } });
    search.value = this.query;
    this.search = search;
    // The field stays put and keeps its caret; only the table under it is redrawn, once the typing pauses.
    search.addEventListener("input", () => { this.query = search.value; if (this.searchTimer !== null) window.clearTimeout(this.searchTimer); this.searchTimer = window.setTimeout(() => { this.searchTimer = null; this.renderTable(); }, SEARCH_DEBOUNCE_MS); });
    this.renderTable();
  }

  private menu(): readonly (MenuEntry | "-")[] {
    return [
      { label: "New column…", icon: "plus", command: "plot-grid-new-column", disabled: !this.project, onClick: () => this.run("new-column") },
      { label: this.castExpanded ? "Fold the cast" : "Expand the cast", icon: "users", command: "plot-grid-toggle-cast", checked: this.castExpanded, onClick: () => this.run("toggle-cast") },
      { label: "Toggle panel", icon: "sliders-horizontal", command: "plot-grid-toggle-panel", checked: this.panelOpen, onClick: () => this.run("toggle-panel") },
      { label: "Open Story threads.md", icon: "file-text", command: "plot-grid-open-note", disabled: !this.project, onClick: () => this.run("open-note") },
      "-",
      { label: "Clear the search", icon: "x", command: "story-timeline-clear-search", disabled: !this.query.trim(), onClick: () => this.run("clear-search") },
    ];
  }

  /** The head's actions, as the commands and the ⋯ menu reach them. */
  run(action: PlotGridAction): void {
    switch (action) {
      case "clear-search": this.clearSearch(); break;
      case "toggle-cast": this.castExpanded = !this.castExpanded; this.renderTable(); break;
      case "open-note": if (this.project) this.source.openNote(this.source.threadsNotePath(this.project)); break;
      case "toggle-panel": this.panelOpen = !this.panelOpen; this.shell?.setSideOpen(this.panelOpen); break;
      case "new-column": this.panelOpen = true; this.shell?.setSideOpen(true); this.renderSide(); (this.shell?.side.querySelector(".czm-pg-new-name") as HTMLInputElement | null)?.focus(); break;
    }
  }

  private clearSearch(): void {
    this.query = "";
    if (this.search) this.search.value = "";
    this.renderTable();
  }

  /** The grid and the state line for the current project and filter; the shell around them stays. */
  private renderTable(): void {
    const shell = this.shell, root = this.body;
    if (!shell || !root) return;
    root.empty();
    this.editing = false;
    shell.main.querySelector(".czm-shell-empty")?.remove();
    if (!this.project) { shell.setState("No project"); shell.empty("No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one."); this.renderSide(); return; }
    const grid = this.grid;
    // The project note is the container, not a scene of the story.
    const notePath = this.project.notePath;
    const rows = grid.rows.filter((r) => r.scene.path !== notePath);
    this.rows = rows;
    const q = this.query.trim().toLowerCase();
    const settings = this.source.settings();
    const columns = grid.columns.filter((c) => !q || c.heading.name.toLowerCase().includes(q) || c.heading.heading.toLowerCase().includes(q));
    this.shown = columns;
    if (this.selection && (this.selection.col >= columns.length || this.selection.row >= rows.length)) this.selection = null;
    const cast = grid.cast
      .filter((e) => settings.kinds[e.kind])
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)));
    const unknown = grid.unknownPrefixes.length ? ` · ${grid.unknownPrefixes.length} heading${grid.unknownPrefixes.length === 1 ? "" : "s"} not read as a kind (${grid.unknownPrefixes.map((p) => `${p}:`).join(", ")})` : "";
    shell.setState(`${rows.length} scene${rows.length === 1 ? "" : "s"} · ${plural(columns.length, "column")} · ${cast.length} in the cast${q ? ` · “${this.query.trim()}”` : ""}${unknown}`, q ? { label: "Clear", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } } : null);
    this.renderSide();
    if (rows.length === 0) { shell.empty("No scenes yet — headings become scenes, with prose under them or not."); return; }
    this.renderKey(cast);
    if (columns.length === 0 && grid.columns.length === 0) {
      shell.empty("No columns yet. Name one — Arc: [[Anna]], Theme: what we owe the dead, Subplot: the letter — and its stops become cells.", [{ label: "New column", cls: "czm-pg-fix-new", onClick: () => this.run("new-column") }, { label: "Open Story threads.md", cls: "czm-pg-fix-note", onClick: () => this.run("open-note") }]);
    } else if (columns.length === 0 && cast.length === 0) {
      shell.empty(`Nothing matches “${this.query.trim()}”.`, [{ label: "Clear search", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } }]);
    }
    const wrap = root.createDiv({ cls: "czm-pg-wrap" });
    const table = wrap.createEl("table", { cls: "czm-pg-table", attr: { "aria-label": "Plot grid" } });
    const thead = table.createEl("thead").createEl("tr");
    thead.createEl("th", { text: "Scene", cls: "czm-pg-corner", attr: { scope: "col" } });
    thead.createEl("th", { text: "Words", cls: "czm-pg-col czm-pg-col-words", attr: { scope: "col" } });
    thead.createEl("th", { text: "Plot", cls: "czm-pg-col czm-pg-col-plot", attr: { scope: "col", title: "The model's events for the scene, from Story map.md" } });
    let lastKind: ColumnKind | null = null;
    columns.forEach((c, col) => {
      const th = thead.createEl("th", { cls: `czm-pg-col czm-pg-col-thread czm-pg-kind-${c.heading.kind}${c.heading.kind !== lastKind ? " is-group-start" : ""}`, attr: { scope: "col", title: `${c.heading.name} — ${KIND_GROUP[c.heading.kind]}, ${c.filled} of ${rows.length} scenes` } });
      lastKind = c.heading.kind;
      const name = th.createDiv({ cls: "czm-pg-col-name", attr: { role: "button", tabindex: "0", "aria-label": `${c.heading.name}: select the column` } });
      if (c.entity) { const dot = name.createSpan({ cls: "czm-pg-dot", attr: { "aria-label": KIND_LABEL[c.entity.kind] } }); dot.setCssProps({ "--czm-kind": settings.colors[c.entity.kind] }); }
      name.createSpan({ text: c.heading.name, cls: "czm-pg-col-title" });
      onActivate(name, () => { this.select({ col, row: this.selection?.row ?? 0 }); });
      th.createDiv({ text: `${c.filled} of ${rows.length}`, cls: "czm-pg-col-count" });
    });
    const castTh = thead.createEl("th", { cls: `czm-pg-col czm-pg-col-cast${this.castExpanded ? " is-expanded" : ""}`, attr: { scope: "col", colspan: String(this.castExpanded ? Math.max(1, cast.length) : 1) } });
    const castBtn = castTh.createEl("button", { cls: "czm-pg-cast-toggle", attr: { "aria-expanded": String(this.castExpanded), "aria-label": this.castExpanded ? "Fold the cast into one column" : "Expand the cast into one column per name" } });
    castBtn.createSpan({ text: "Cast", cls: "czm-pg-col-title" });
    castBtn.createSpan({ text: String(cast.length), cls: "czm-pg-col-count" });
    const chevron = castBtn.createSpan({ cls: "czm-pg-chevron" });
    setIcon(chevron, this.castExpanded ? "chevron-left" : "chevron-right");
    castBtn.addEventListener("click", () => this.run("toggle-cast"));
    // A filler column takes the slack, so the columns stay close together however wide the pane.
    thead.createEl("th", { cls: "czm-pg-filler" });
    if (this.castExpanded) this.renderCastNames(table, columns.length, cast, settings);
    const tbody = table.createEl("tbody");
    const span = 3 + columns.length + (this.castExpanded ? Math.max(1, cast.length) : 1) + 1;
    let lastPath = "", lastAct = "";
    for (const row of rows) {
      const act = actOf(row.scene.path, this.project.scope);
      if (act !== lastAct) {
        lastAct = act;
        if (act) tbody.createEl("tr", { cls: "czm-pg-act" }).createEl("th", { text: act, attr: { colspan: String(span), scope: "rowgroup" } });
      }
      if (row.scene.path !== lastPath) {
        lastPath = row.scene.path;
        const tr = tbody.createEl("tr", { cls: "czm-pg-note" });
        const th = tr.createEl("th", { attr: { colspan: String(span), scope: "rowgroup" } });
        const link = th.createSpan({ text: basenameOf(row.scene.path), cls: "is-link" });
        onActivate(link, () => this.source.openNote(row.scene.path));
        // The one structural question the row can answer: how much of the book, and how much of the cast, this chapter holds.
        const chapter = rows.filter((r) => r.scene.path === row.scene.path);
        const words = chapter.reduce((n, r) => n + r.words, 0);
        const names = new Set(chapter.flatMap((r) => r.present).filter((id) => cast.some((c) => c.id === id))).size;
        th.createSpan({ text: `${plural(chapter.length, "scene")} · ${words.toLocaleString()} words · ${names} of the cast`, cls: "czm-pg-note-total" });
      }
      this.renderRow(tbody, row, columns, cast, settings);
    }
  }

  private renderRow(tbody: HTMLElement, row: GridRow, columns: readonly GridColumn[], cast: readonly Entity[], settings: StoryMapSettings): void {
    const rowIndex = this.rows.indexOf(row);
    const tr = tbody.createEl("tr", { cls: `czm-pg-scene${row.outline ? " is-outline" : ""}`, attr: { "data-row": String(rowIndex) } });
    const th = tr.createEl("th", { cls: "czm-pg-scene-head", attr: { role: "button", tabindex: "0", scope: "row" } });
    th.createSpan({ text: `${row.bookmarked ? "★ " : ""}${row.scene.title || "(opening)"}`, cls: "czm-map-row-name" });
    if (row.outline) th.createSpan({ text: "outline", cls: "czm-map-row-meta", attr: { title: "A heading with no prose yet: a scene planned, not written" } });
    onActivate(th, () => this.source.reveal(row.scene));
    tr.createEl("td", { text: row.outline ? "" : row.words.toLocaleString(), cls: "czm-pg-words" });
    tr.createEl("td", { text: row.events.join(" · "), cls: "czm-pg-plot" });
    columns.forEach((c, col) => this.renderCell(tr, c, c.cells[row.index]!, row, { col, row: rowIndex }));
    if (this.castExpanded) {
      const present = new Set(row.present);
      for (const e of cast) {
        const on = present.has(e.id);
        const td = tr.createEl("td", { cls: `czm-pg-cast-dot${on ? " is-on" : ""}` });
        if (on) { td.setCssProps({ "--czm-kind": settings.colors[e.kind] }); td.setAttribute("aria-label", `${e.name} in ${row.scene.title || basenameOf(row.scene.path)}`); td.title = `${e.name} · ${row.scene.title || basenameOf(row.scene.path)}`; }
      }
      if (cast.length === 0) tr.createEl("td");
    } else {
      const td = tr.createEl("td", { cls: "czm-pg-cast" });
      const strip = td.createDiv({ cls: "czm-pg-strip", attr: { "aria-label": row.present.length ? cast.filter((e) => row.present.includes(e.id)).map((e) => e.name).join(", ") : "nobody" } });
      for (const e of cast) {
        const on = row.present.includes(e.id);
        const dot = strip.createSpan({ cls: `czm-pg-strip-dot${on ? " is-on" : ""}`, attr: { title: e.name } });
        if (on) dot.setCssProps({ "--czm-kind": settings.colors[e.kind] });
      }
    }
    tr.createEl("td", { cls: "czm-pg-filler" });
  }

  private renderCell(tr: HTMLElement, column: GridColumn, cell: GridCell, row: GridRow, at: Selection): void {
    const td = tr.createEl("td", { cls: `czm-pg-cell-td czm-pg-kind-${column.heading.kind}` });
    const where = `${column.heading.name} at ${row.scene.title || basenameOf(row.scene.path)}`;
    const selected = this.selection?.col === at.col && this.selection?.row === at.row;
    const stop = cell.stop;
    const unmoved = !stop && cell.presentUnmoved && column.armed;
    const el = td.createDiv({
      cls: `czm-pg-cell is-${stop ? cell.state : "empty"}${unmoved ? " is-unmoved" : ""}${selected ? " is-selected" : ""}`,
      attr: { role: "button", tabindex: selected || (!this.selection && at.col === 0 && at.row === 0) ? "0" : "-1", "data-col": String(at.col), "data-row": String(at.row), "aria-selected": String(selected), "aria-label": stop ? `${where}: ${stop.role && stop.role !== "touch" ? `${stop.role}, ` : ""}${stop.note || stop.quote || ""}` : unmoved ? `${where}: ${column.entity?.name ?? "the character"} is on the page, unmoved` : `${where}: empty` },
    });
    if (stop) {
      const glyph = stop.role ? ROLE_GLYPH[stop.role] : "";
      if (glyph && stop.role) el.createSpan({ text: glyph, cls: `czm-pg-role is-${stop.role}`, attr: { title: stop.role } });
      el.createSpan({ text: stop.note || (stop.quote ? `“${stop.quote}”` : ""), cls: "czm-pg-cell-text" });
      if (cell.more.length) el.createSpan({ text: `+${cell.more.length}`, cls: "czm-pg-more", attr: { title: cell.more.map((m) => m.note).join("\n") } });
      if (cell.state === "broken") el.title = `“${stop.quote}” is no longer in the scene`;
      else if (cell.state === "verified") el.title = `“${stop.quote}”`;
    } else if (unmoved) {
      el.createSpan({ text: "present, unmoved", cls: "czm-pg-unmoved" });
    }
    // A click selects; a second click on the selected cell, or Enter, edits.
    el.addEventListener("click", () => { if (this.selection?.col === at.col && this.selection?.row === at.row) this.edit(); else this.select(at); });
    el.addEventListener("dblclick", () => { this.select(at); this.edit(); });
    el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !inField(ev)) { ev.preventDefault(); ev.stopPropagation(); this.select(at); this.edit(); } });
  }

  /** The cast's names, one per expanded column, as a row under the header so they read horizontally. */
  private renderCastNames(table: HTMLElement, before: number, cast: readonly Entity[], settings: StoryMapSettings): void {
    const tr = table.createEl("thead").createEl("tr", { cls: "czm-pg-cast-row" });
    tr.createEl("th", { cls: "czm-pg-corner", attr: { colspan: String(3 + before) } });
    for (const e of cast) {
      const th = tr.createEl("th", { cls: "czm-pg-cast-name", attr: { scope: "col", title: `${e.name} — ${KIND_LABEL[e.kind]}, ${plural(e.appearances.length, "scene")}` } });
      th.setCssProps({ "--czm-kind": settings.colors[e.kind] });
      const span = th.createSpan({ text: e.name });
      if (e.path) { span.addClass("is-link"); onActivate(span, () => this.source.openNote(e.path!)); }
    }
    tr.createEl("th", { cls: "czm-pg-filler" });
  }

  /** The key in the corner: the roles, and the cast's kinds when they are spread out. */
  private renderKey(cast: readonly Entity[]): void {
    const shell = this.shell;
    if (!shell) return;
    const settings = this.source.settings();
    const kinds = this.castExpanded ? (Object.keys(KIND_LABEL) as Entity["kind"][]).filter((k) => cast.some((c) => c.kind === k)).map((k) => ({ label: KIND_LABEL[k], color: settings.colors[k], cls: `czm-key-${k}` })) : [];
    shell.key([
      { label: "plant", color: "", cls: "czm-pg-key-role is-plant" },
      { label: "payoff", color: "", cls: "czm-pg-key-role is-payoff" },
      { label: "reversal · turn", color: "", cls: "czm-pg-key-role is-reversal" },
      { label: "want · lie · truth", color: "", cls: "czm-pg-key-role is-arc" },
      ...kinds,
    ]);
  }

  // ---- selection and editing -------------------------------------------------

  private cellEl(at: Selection): HTMLElement | null {
    return this.body?.querySelector<HTMLElement>(`.czm-pg-cell[data-col="${at.col}"][data-row="${at.row}"]`) ?? null;
  }

  /** Selects a cell: the ring moves, the side column follows, focus lands on it. */
  select(at: Selection, focus = true): void {
    if (this.editing) return;
    if (at.col < 0 || at.row < 0 || at.col >= this.shown.length || at.row >= this.rows.length) return;
    const prev = this.selection ? this.cellEl(this.selection) : null;
    prev?.classList.remove("is-selected"); prev?.setAttribute("aria-selected", "false"); prev?.setAttribute("tabindex", "-1");
    this.selection = at;
    const el = this.cellEl(at);
    el?.classList.add("is-selected"); el?.setAttribute("aria-selected", "true"); el?.setAttribute("tabindex", "0");
    if (focus) el?.focus();
    this.renderSide();
  }

  get selected(): { column: GridColumn; row: GridRow; cell: GridCell } | null {
    const at = this.selection;
    if (!at) return null;
    const column = this.shown[at.col], row = this.rows[at.row];
    if (!column || !row) return null;
    return { column, row, cell: column.cells[row.index]! };
  }

  /** Edits the selected cell in place: a field that grows with the text, saved on Enter or a click elsewhere, cancelled on Escape. */
  edit(): void {
    const sel = this.selected;
    if (!sel || !this.selection || this.editing) return;
    const el = this.cellEl(this.selection);
    if (!el) return;
    this.editing = true;
    el.empty();
    el.addClass("is-editing");
    const field = el.createEl("textarea", { cls: "czm-pg-editor", attr: { rows: "1", "aria-label": `${sel.column.heading.name} at ${sel.row.scene.title || basenameOf(sel.row.scene.path)}`, placeholder: "What the thread does here" } });
    field.value = sel.cell.stop?.note ?? "";
    const grow = () => { field.setCssStyles({ height: "auto" }); field.setCssStyles({ height: `${field.scrollHeight}px` }); };
    field.addEventListener("input", grow);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      this.editing = false;
      const text = field.value;
      if (save && text.trim() !== (sel.cell.stop?.note ?? "")) void this.writeCell(sel.column, sel.row, sel.cell.stop, text.trim());
      else this.renderTable();
      window.setTimeout(() => this.select(this.selection ?? { col: 0, row: 0 }), 0);
    };
    field.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); finish(false); }
      else if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); ev.stopPropagation(); finish(true); }
      else if (ev.key === "Tab") { finish(true); }
    });
    field.addEventListener("blur", () => finish(true));
    field.focus();
    grow();
    field.setSelectionRange(field.value.length, field.value.length);
  }

  /** The keys of the grid: arrows move the selection, Enter edits, Escape steps back to the row, Delete removes the stop, o opens the scene. */
  private onKey(ev: KeyboardEvent): void {
    if (inField(ev) || this.editing) return;
    const at = this.selection;
    const move = (dc: number, dr: number) => { ev.preventDefault(); if (at) this.select({ col: at.col + dc, row: at.row + dr }); else this.select({ col: 0, row: 0 }); };
    switch (ev.key) {
      case "ArrowLeft": move(-1, 0); break;
      case "ArrowRight": move(1, 0); break;
      case "ArrowUp": move(0, -1); break;
      case "ArrowDown": move(0, 1); break;
      case "Home": ev.preventDefault(); if (at) this.select({ col: 0, row: at.row }); break;
      case "End": ev.preventDefault(); if (at) this.select({ col: this.shown.length - 1, row: at.row }); break;
      case "PageUp": ev.preventDefault(); if (at) this.select({ col: at.col, row: Math.max(0, at.row - 10) }); break;
      case "PageDown": ev.preventDefault(); if (at) this.select({ col: at.col, row: Math.min(this.rows.length - 1, at.row + 10) }); break;
      case "Escape": if (at) { ev.preventDefault(); this.body?.querySelector<HTMLElement>(`.czm-pg-scene[data-row="${at.row}"] .czm-pg-scene-head`)?.focus(); } break;
      case "Delete": case "Backspace": if (at && this.selected?.cell.stop) { ev.preventDefault(); void this.removeCell(); } break;
      case "o": if (this.selected) { ev.preventDefault(); const s = this.selected; this.source.reveal(s.cell.stop?.anchor ? { ...s.row.scene, line: s.cell.stop.anchor.line } : s.row.scene); } break;
    }
  }

  /** Writes the cell: the note replaced, the role and quote kept; an emptied cell is a removed stop. Undo in the status line either way. */
  private async writeCell(column: GridColumn, row: GridRow, before: ThreadRef | null, note: string, stop: { role?: StopRole; quote?: string | null } = {}): Promise<void> {
    const project = this.project;
    if (!project) return;
    const link = sceneLink(row.scene);
    const thread = column.heading.heading;
    const quote = stop.quote === undefined ? before?.quote ?? null : stop.quote;
    if (!note && !quote) { if (before) await this.removeCell(); return; }
    try {
      await this.source.addStops(project, thread, [{ link, note, role: stop.role ?? before?.role, quote }]);
    } catch (e) { this.status?.fail(couldNot(`write “${column.heading.name}” at ${row.scene.title || basenameOf(row.scene.path)}`, e)); return; }
    await this.show(project, true);
    this.status?.undoable(`${before ? "Changed" : "Written"}: ${column.heading.name} at ${row.scene.title || basenameOf(row.scene.path)}`, async () => {
      if (before) await this.source.addStops(project, thread, [{ link, note: before.note, role: before.role, quote: before.quote ?? null }]);
      else await this.source.removeFromThread(project, thread, link);
      await this.show(project, true);
    });
  }

  private async removeCell(): Promise<void> {
    const sel = this.selected, project = this.project;
    if (!sel || !project || !sel.cell.stop) return;
    const before = sel.cell.stop, thread = sel.column.heading.heading, link = sceneLink(sel.row.scene);
    try {
      await this.source.removeFromThread(project, thread, link);
    } catch (e) { this.status?.fail(couldNot("remove the stop", e)); return; }
    await this.show(project, true);
    this.status?.undoable(`${sel.row.scene.title || basenameOf(sel.row.scene.path)} taken out of “${sel.column.heading.name}”`, async () => {
      await this.source.addStops(project, thread, [{ link, note: before.note, role: before.role, quote: before.quote ?? null }]);
      await this.show(project, true);
    });
  }

  // ---- the side column ---------------------------------------------------------

  /** CELL: the selected stop's scene, role, anchor and note. COLUMNS: every column with its count, a way to add one and to delete one. */
  private renderSide(): void {
    const shell = this.shell;
    if (!shell) return;
    shell.side.empty();
    shell.setSideOpen(this.panelOpen);
    const sel = this.selected;
    const cellSection = shell.section("Cell", sel ? `${sel.column.heading.name} · ${sel.row.scene.title || basenameOf(sel.row.scene.path)}` : "", "pg-cell", true);
    if (!sel) {
      cellSection.createDiv({ text: "Select a cell to set its role, its anchor in the prose, and a note.", cls: "czm-map-absent" });
    } else {
      this.renderCellSection(cellSection, sel.column, sel.row, sel.cell);
    }
    const columns = this.grid.columns;
    const colSection = shell.section("Columns", `${columns.length}${this.grid.unknownPrefixes.length ? ` · ${this.grid.unknownPrefixes.length} unread` : ""}`, "pg-columns", true);
    const list = colSection.createDiv({ cls: "czm-map-list" });
    let lastKind: ColumnKind | null = null;
    for (const c of columns) {
      if (c.heading.kind !== lastKind) { lastKind = c.heading.kind; list.createDiv({ text: KIND_GROUP[c.heading.kind], cls: "czm-pg-side-kind" }); }
      const row = list.createDiv({ cls: `czm-map-row czm-pg-side-col${c.heading.unknownPrefix ? " is-unknown" : ""}`, attr: { tabindex: "0", title: c.heading.heading } });
      const name = row.createSpan({ text: c.heading.name, cls: "czm-map-row-name" });
      if (c.heading.unknownPrefix) name.title = `“${c.heading.unknownPrefix}:” is not a kind — Arc:, Theme: or Subplot: are`;
      row.createSpan({ text: `${c.filled} of ${this.rows.length}`, cls: "czm-map-row-meta" });
      const del = row.createEl("button", { cls: "clickable-icon czm-pg-col-delete", attr: { "aria-label": `Delete column ${c.heading.name}`, title: "Delete the column and every stop under it" } });
      setIcon(del, "x");
      // Two clicks: the first arms, the second deletes. A whole column is the one thing here that is not undone by a line.
      del.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!del.classList.contains("is-armed")) { del.classList.add("is-armed"); del.setText("Delete?"); window.setTimeout(() => { if (del.isConnected) { del.classList.remove("is-armed"); del.empty(); setIcon(del, "x"); } }, 5000); return; }
        void this.deleteColumn(c);
      });
      onActivate(row, () => { const col = this.shown.indexOf(c); if (col >= 0) this.select({ col, row: this.selection?.row ?? 0 }); });
    }
    if (columns.length === 0) list.createDiv({ text: "No columns yet.", cls: "czm-map-absent" });
    const add = colSection.createDiv({ cls: "czm-pg-new" });
    const input = add.createEl("input", { cls: "czm-pg-new-name", attr: { type: "text", placeholder: "Arc: [[Anna]] · Theme: … · Subplot: …", "aria-label": "New column: its heading in Story threads.md" } });
    const button = add.createEl("button", { text: "New column", cls: "czm-pg-new-add" });
    const submit = () => { const name = input.value.trim(); if (!name) return; button.disabled = true; void this.addColumn(name).finally(() => { button.disabled = false; }); };
    button.addEventListener("click", submit);
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
  }

  private renderCellSection(section: HTMLElement, column: GridColumn, row: GridRow, cell: GridCell): void {
    const stop = cell.stop;
    const scene = section.createDiv({ cls: "czm-pg-field" });
    scene.createDiv({ text: "Scene", cls: "czm-pg-field-label" });
    const sceneRow = scene.createDiv({ cls: "czm-pg-field-box" });
    const link = sceneRow.createSpan({ text: `${basenameOf(row.scene.path)} › ${row.scene.title || "(opening)"}`, cls: "is-link" });
    onActivate(link, () => this.source.reveal(stop?.anchor ? { ...row.scene, line: stop.anchor.line } : row.scene));
    sceneRow.createSpan({ text: row.outline ? "outline" : `${row.words.toLocaleString()} w`, cls: "czm-map-row-meta" });
    const state = section.createDiv({ cls: "czm-pg-field" });
    state.createDiv({ text: "State", cls: "czm-pg-field-label" });
    state.createDiv({ text: !stop ? "empty" : cell.state === "plan" ? "plan — no anchor yet" : cell.state === "verified" ? "verified — the quote is in the scene" : "broken — the quote is no longer in the scene", cls: `czm-pg-field-box czm-pg-state is-${stop ? cell.state : "empty"}` });
    const roles = column.heading.kind === "arc" ? [...THREAD_ROLES, ...ARC_ROLES] : THREAD_ROLES;
    const role = section.createDiv({ cls: "czm-pg-field" });
    role.createDiv({ text: "Role", cls: "czm-pg-field-label" });
    const roleSelect = role.createEl("select", { cls: "dropdown czm-pg-role-select", attr: { "aria-label": "Role" } });
    for (const r of roles) { const o = roleSelect.createEl("option", { text: r === "touch" ? "touch (no role)" : `${ROLE_GLYPH[r]} ${r}`.trim() }); o.value = r; if ((stop?.role ?? "touch") === r) o.selected = true; }
    const quote = section.createDiv({ cls: "czm-pg-field" });
    quote.createDiv({ text: "Anchor · a sentence in the scene", cls: "czm-pg-field-label" });
    const quoteInput = quote.createEl("input", { cls: "czm-pg-quote", attr: { type: "text", placeholder: "a few words quoted from the scene", "aria-label": "Anchor: a quote from the scene" } });
    quoteInput.value = stop?.quote ?? "";
    const note = section.createDiv({ cls: "czm-pg-field" });
    note.createDiv({ text: "Note", cls: "czm-pg-field-label" });
    const noteInput = note.createEl("textarea", { cls: "czm-pg-note-field", attr: { rows: "2", placeholder: "What the thread does here", "aria-label": "Note" } });
    noteInput.value = stop?.note ?? "";
    const actions = section.createDiv({ cls: "czm-map-panel-actions czm-pg-cell-actions" });
    const save = actions.createEl("button", { text: stop ? "Save stop" : "Write stop", cls: "czm-pg-save mod-cta" });
    save.addEventListener("click", () => {
      save.disabled = true;
      void this.writeCell(column, row, stop, noteInput.value.trim(), { role: roleSelect.value as StopRole, quote: quoteInput.value.trim() || null }).finally(() => { save.disabled = false; });
    });
    const open = actions.createEl("button", { text: "Open scene", cls: "czm-pg-open" });
    open.addEventListener("click", () => this.source.reveal(stop?.anchor ? { ...row.scene, line: stop.anchor.line } : row.scene));
    if (stop) {
      const remove = actions.createEl("button", { text: "Remove stop", cls: "czm-pg-remove mod-warning" });
      remove.addEventListener("click", () => void this.removeCell());
    }
    if (cell.more.length) {
      const more = section.createDiv({ cls: "czm-pg-more-list" });
      more.createDiv({ text: `${cell.more.length} more at this scene`, cls: "czm-pg-field-label" });
      for (const m of cell.more) more.createDiv({ text: `${m.role && m.role !== "touch" ? `${m.role}: ` : ""}${m.note}`, cls: "czm-map-absent" });
    }
  }

  private async addColumn(name: string): Promise<void> {
    const project = this.project;
    if (!project) return;
    try {
      await this.source.addThread(project, name);
    } catch (e) { this.status?.fail(couldNot(`add “${name}”`, e)); return; }
    await this.show(project, true);
    this.status?.say(`Column “${name}” written to Story threads.md.`);
    const col = this.shown.findIndex((c) => c.heading.heading.toLowerCase() === name.trim().toLowerCase());
    if (col >= 0) this.select({ col, row: 0 });
  }

  private async deleteColumn(column: GridColumn): Promise<void> {
    const project = this.project;
    if (!project) return;
    const stops: StopToAdd[] = column.thread.refs.map((r) => ({ link: r.unresolved ?? sceneLink(r.scene), note: r.note, role: r.role, quote: r.quote ?? null }));
    try {
      await this.source.removeThread(project, column.heading.heading);
    } catch (e) { this.status?.fail(couldNot(`delete “${column.heading.name}”`, e)); return; }
    this.selection = null;
    await this.show(project, true);
    this.status?.undoable(`Column “${column.heading.name}” deleted, ${plural(stops.length, "stop")} with it`, async () => {
      await this.source.addThread(project, column.heading.heading);
      if (stops.length) await this.source.addStops(project, column.heading.heading, stops);
      await this.show(project, true);
    });
  }
}

function plural(n: number, word: string): string { return `${n} ${word}${n === 1 ? "" : "s"}`; }

/** The folder a note sits in below the project, read as its act; a note in the project's root has none. */
export function actOf(path: string, scope: string): string {
  const rel = path.startsWith(scope) ? path.slice(scope.length) : path;
  const parts = rel.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join(" · ") : "";
}
