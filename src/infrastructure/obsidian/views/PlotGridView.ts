import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import type { StoryMapSettings } from "../../../domain/settings/Settings";
import { EMPTY_PLOT_GRID, type ColumnKind, type GridCell, type GridColumn, type GridRow, type PlotGrid } from "../../../domain/plot/PlotGrid";
import type { Entity, SceneRef } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import type { StopRole } from "../../../domain/threads/Thread";
import { KIND_LABEL } from "./StoryMapView";
import { PanelShell, type MenuEntry, type PanelId } from "./PanelShell";
import { onActivate } from "./keys";

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
  /** Opens a sibling panel, for the same project where the panel takes one. */
  jumpTo(to: PanelId, project: ProjectSpec | null): void;
}

export const KIND_GROUP: Record<ColumnKind, string> = { arc: "Arcs", theme: "Themes", subplot: "Subplots", free: "Threads" };

/** What a stop's role looks like in a cell: a triangle family, one shape per meaning. */
export const ROLE_GLYPH: Record<StopRole, string> = { plant: "▶", touch: "", payoff: "◀", reversal: "▼", want: "▸", lie: "▹", turn: "▼", truth: "◂" };

/**
 * The plot grid: every scene of the project in reading order down the
 * side, the writer's threads across the top, and in each cell what the
 * thread is doing in the scene. The cast the timeline used to spread
 * across the pane folds into one column until it is asked for.
 */
export class PlotGridView extends ItemView {
  private project: ProjectSpec | null = null;
  private grid: PlotGrid = EMPTY_PLOT_GRID;
  private query = "";
  private castExpanded = false;
  private generation = 0;
  private shell: PanelShell | null = null;
  private body: HTMLElement | null = null;
  private search: HTMLInputElement | null = null;
  private searchTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly source: PlotGridSource) {
    super(leaf);
  }

  getViewType(): string { return PLOT_GRID_VIEW_TYPE; }
  getDisplayText(): string { return "Plot grid"; }
  getIcon(): string { return "table"; }

  async onOpen(): Promise<void> {
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async show(project: ProjectSpec | null): Promise<void> {
    const generation = ++this.generation;
    this.project = project;
    if (!project) { this.grid = EMPTY_PLOT_GRID; this.render(); return; }
    const grid = await this.source.build(project);
    if (generation !== this.generation) return;
    this.grid = grid;
    this.render();
  }

  async refresh(): Promise<void> {
    if (this.project) await this.show(this.project);
  }

  render(): void {
    this.contentEl.empty();
    const shell = new PanelShell(this.contentEl, { current: "timeline", jump: (to) => this.source.jumpTo(to, this.project) });
    shell.overflow(() => this.menu());
    this.shell = shell;
    this.body = shell.main.createDiv({ cls: "czm-pg" });
    const head = shell.scope;
    const projects = this.source.projects();
    const select = head.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } });
    for (const p of projects) {
      const opt = select.createEl("option", { text: p.name });
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    select.addEventListener("change", () => void this.show(projects.find((p) => p.scope === select.value) ?? null));
    const search = head.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Filter columns…", "aria-label": "Filter the columns and the cast" } });
    search.value = this.query;
    this.search = search;
    // The field stays put and keeps its caret; only the table under it is redrawn, once the typing pauses.
    search.addEventListener("input", () => { this.query = search.value; if (this.searchTimer !== null) window.clearTimeout(this.searchTimer); this.searchTimer = window.setTimeout(() => { this.searchTimer = null; this.renderTable(); }, SEARCH_DEBOUNCE_MS); });
    this.renderTable();
  }

  private menu(): readonly (MenuEntry | "-")[] {
    return [
      { label: this.castExpanded ? "Fold the cast" : "Expand the cast", icon: "users", command: "plot-grid-toggle-cast", checked: this.castExpanded, onClick: () => this.run("toggle-cast") },
      { label: "Open Story threads.md", icon: "file-text", command: "plot-grid-open-note", disabled: !this.project, onClick: () => this.run("open-note") },
      "-",
      { label: "Clear the search", icon: "x", command: "story-timeline-clear-search", disabled: !this.query.trim(), onClick: () => this.run("clear-search") },
    ];
  }

  /** The head's actions, as the commands and the ⋯ menu reach them. */
  run(action: "clear-search" | "toggle-cast" | "open-note"): void {
    switch (action) {
      case "clear-search": this.clearSearch(); break;
      case "toggle-cast": this.castExpanded = !this.castExpanded; this.renderTable(); break;
      case "open-note": if (this.project) this.source.openNote(this.source.threadsNotePath(this.project)); break;
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
    shell.main.querySelector(".czm-shell-empty")?.remove();
    if (!this.project) { shell.setState("No project"); shell.empty("No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one."); return; }
    const grid = this.grid;
    // The project note is the container, not a scene of the story.
    const notePath = this.project.notePath;
    const rows = grid.rows.filter((r) => r.scene.path !== notePath);
    const q = this.query.trim().toLowerCase();
    const settings = this.source.settings();
    const columns = grid.columns.filter((c) => !q || c.heading.name.toLowerCase().includes(q) || c.heading.heading.toLowerCase().includes(q));
    const cast = grid.cast
      .filter((e) => settings.kinds[e.kind])
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)));
    const unknown = grid.unknownPrefixes.length ? ` · ${grid.unknownPrefixes.length} heading${grid.unknownPrefixes.length === 1 ? "" : "s"} not read as a kind (${grid.unknownPrefixes.map((p) => `${p}:`).join(", ")})` : "";
    shell.setState(`${rows.length} scene${rows.length === 1 ? "" : "s"} · ${plural(columns.length, "column")} · ${cast.length} in the cast${q ? ` · “${this.query.trim()}”` : ""}${unknown}`, q ? { label: "Clear", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } } : null);
    if (rows.length === 0) { shell.empty("No scenes yet — headings become scenes, with prose under them or not."); return; }
    this.renderKey(cast);
    if (columns.length === 0 && grid.columns.length === 0) {
      shell.empty("No columns yet. Name one as a ## heading in Story threads.md — Arc: [[Anna]], Theme: what we owe the dead, Subplot: the letter — and its stops become cells.", [{ label: "Open Story threads.md", cls: "czm-pg-fix-note", onClick: () => this.run("open-note") }]);
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
    for (const c of columns) {
      const th = thead.createEl("th", { cls: `czm-pg-col czm-pg-col-thread czm-pg-kind-${c.heading.kind}${c.heading.kind !== lastKind ? " is-group-start" : ""}`, attr: { scope: "col", title: `${c.heading.name} — ${KIND_GROUP[c.heading.kind]}, ${c.filled} of ${rows.length} scenes` } });
      lastKind = c.heading.kind;
      const name = th.createDiv({ cls: "czm-pg-col-name" });
      if (c.entity) { const dot = name.createSpan({ cls: "czm-pg-dot", attr: { "aria-label": KIND_LABEL[c.entity.kind] } }); dot.setCssProps({ "--czm-kind": settings.colors[c.entity.kind] }); }
      name.createSpan({ text: c.heading.name, cls: "czm-pg-col-title" });
      th.createDiv({ text: `${c.filled} of ${rows.length}`, cls: "czm-pg-col-count" });
    }
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
    const tr = tbody.createEl("tr", { cls: `czm-pg-scene${row.outline ? " is-outline" : ""}` });
    const th = tr.createEl("th", { cls: "czm-pg-scene-head", attr: { role: "button", tabindex: "0", scope: "row" } });
    th.createSpan({ text: `${row.bookmarked ? "★ " : ""}${row.scene.title || "(opening)"}`, cls: "czm-map-row-name" });
    if (row.outline) th.createSpan({ text: "outline", cls: "czm-map-row-meta", attr: { title: "A heading with no prose yet: a scene planned, not written" } });
    onActivate(th, () => this.source.reveal(row.scene));
    tr.createEl("td", { text: row.outline ? "" : row.words.toLocaleString(), cls: "czm-pg-words" });
    tr.createEl("td", { text: row.events.join(" · "), cls: "czm-pg-plot" });
    for (const c of columns) this.renderCell(tr, c, c.cells[row.index]!, row);
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

  private renderCell(tr: HTMLElement, column: GridColumn, cell: GridCell, row: GridRow): void {
    const td = tr.createEl("td", { cls: `czm-pg-cell-td czm-pg-kind-${column.heading.kind}` });
    const where = `${column.heading.name} at ${row.scene.title || basenameOf(row.scene.path)}`;
    if (!cell.stop) {
      const unmoved = cell.presentUnmoved && column.armed;
      const el = td.createDiv({ cls: `czm-pg-cell is-empty${unmoved ? " is-unmoved" : ""}`, attr: { role: "button", tabindex: "0", "aria-label": unmoved ? `${where}: ${column.entity?.name ?? "the character"} is on the page, unmoved` : `${where}: empty` } });
      if (unmoved) el.createSpan({ text: "present, unmoved", cls: "czm-pg-unmoved" });
      onActivate(el, () => this.source.reveal(row.scene));
      return;
    }
    const stop = cell.stop;
    const el = td.createDiv({ cls: `czm-pg-cell is-${cell.state}`, attr: { role: "button", tabindex: "0", "aria-label": `${where}: ${stop.role && stop.role !== "touch" ? `${stop.role}, ` : ""}${stop.note || stop.quote || ""}` } });
    const glyph = stop.role ? ROLE_GLYPH[stop.role] : "";
    if (glyph && stop.role) el.createSpan({ text: glyph, cls: `czm-pg-role is-${stop.role}`, attr: { title: stop.role } });
    el.createSpan({ text: stop.note || (stop.quote ? `“${stop.quote}”` : ""), cls: "czm-pg-cell-text" });
    if (cell.more.length) el.createSpan({ text: `+${cell.more.length}`, cls: "czm-pg-more", attr: { title: cell.more.map((m) => m.note).join("\n") } });
    if (cell.state === "broken") el.title = `“${stop.quote}” is no longer in the scene`;
    else if (cell.state === "verified") el.title = `“${stop.quote}”`;
    onActivate(el, () => this.source.reveal(stop.anchor ? { ...row.scene, line: stop.anchor.line } : row.scene));
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
}

function plural(n: number, word: string): string { return `${n} ${word}${n === 1 ? "" : "s"}`; }

/** The folder a note sits in below the project, read as its act; a note in the project's root has none. */
export function actOf(path: string, scope: string): string {
  const rel = path.startsWith(scope) ? path.slice(scope.length) : path;
  const parts = rel.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join(" · ") : "";
}
