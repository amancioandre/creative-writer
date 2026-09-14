import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import type { PlotGridSettings, StoryMapSettings } from "../../../domain/settings/Settings";
import { EMPTY_PLOT_GRID, type ColumnKind, type GridCell, type GridColumn, type GridRow, type PlotGrid, type SpecialColumn } from "../../../domain/plot/PlotGrid";
import type { Entity, SceneRef } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import { ARC_ROLES, THREAD_ROLES, type StopRole, type ThreadRef } from "../../../domain/threads/Thread";
import type { StopToAdd } from "../../../application/use-cases/EditStoryThread";
import { KIND_LABEL } from "./StoryMapView";
import { PanelShell, showOverflow, type MenuEntry, type PanelId } from "./PanelShell";
import { COLUMN_KINDS } from "../../../domain/threads/StoryThreadsNote";
import { rankSentences } from "../../../domain/plot/Snapshot";
import type { AnalyzeProgress } from "../../../application/use-cases/AnalyzeSceneRelations";
import type { ProposalsResult } from "../../../application/use-cases/ProposeColumns";
import type { ColumnProposal } from "../../../domain/plot/Proposals";
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
  /** The heading rewritten: a rename, or a kind set by its prefix. */
  renameThread(project: ProjectSpec, from: string, to: string): Promise<void>;
  /** Writes or clears a text key in the project note's front matter: `plot-pov`, `plot-time`, `plot-theme`. */
  setProjectKey(project: ProjectSpec, key: "plot-pov" | "plot-time" | "plot-theme", value: string | null): Promise<void>;
  /** The grid's layout as the writer last left it, and where it is kept. */
  gridSettings(): PlotGridSettings;
  updateGridSettings(next: PlotGridSettings): void;
  /** The scene's prose as sentences, for the anchor picker. */
  sentences(project: ProjectSpec, scene: SceneRef): Promise<string[]>;
  /** Writes the grid as a dated table beside the project; resolves to the path written. */
  snapshot(project: ProjectSpec): Promise<string>;
  /** The model reads one column, scene by scene, writing readings the writer will answer. Resolves to how many scenes were read. */
  readColumn(project: ProjectSpec, column: GridColumn, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  /** The model checks a column's plans against the draft. */
  checkColumn(project: ProjectSpec, column: GridColumn, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
  /** The writer's no to a reading: remembered, skipped until the scene changes. */
  dismissReading(project: ProjectSpec, scene: SceneRef, column: string): Promise<void>;
  dismissColumnReadings(project: ProjectSpec, column: string): Promise<void>;
  /** What the model is, for the head: "Ollama · qwen2.5:7b", "Claude · claude-haiku-4-5", or "" when off. */
  modelLabel(): string;
  /** The model's suggestion of which threads deserve a column, from the events the map holds. */
  proposeColumns(project: ProjectSpec, signal: AbortSignal): Promise<ProposalsResult>;
  /** The relation reading over the project, so there are events to propose from. */
  readProject(project: ProjectSpec, signal: AbortSignal, onProgress: (p: AnalyzeProgress) => void): Promise<number>;
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

export type PlotGridAction = "clear-search" | "toggle-cast" | "open-note" | "toggle-panel" | "new-column" | "fold-arcs" | "fold-themes" | "fold-subplots" | "fold-threads" | "hide-column" | "show-hidden" | "focus-search" | "help" | "toggle-unmoved" | "audit" | "snapshot" | "next-issue" | "previous-issue" | "anchor" | "read-column" | "check-column" | "read-all" | "dismiss-reading" | "stop-reading" | "propose-columns";

/** The keys of the grid, as `?` lists them: the loop a writer runs all day. Folds, hiding and the search are commands, bindable in Settings → Hotkeys. */
export const KEY_HELP: readonly (readonly [string, string])[] = [
  ["← → ↑ ↓", "Move between cells"],
  ["Home End · PgUp PgDn", "First or last column · ten rows"],
  ["Enter", "Edit the cell in place"],
  ["Escape", "Editing: put the line back · Cell: back to the row's name"],
  ["Shift + Enter", "Editing: a new line"],
  ["Delete", "Take the stop out, with Undo"],
  ["\"", "Anchor: pick a sentence of the scene; on a broken stop, the near matches first"],
  ["n · p", "Next and previous reading awaiting you, or broken anchor"],
  ["x", "Dismiss the reading in the cell"],
  ["o", "Open the scene, at the anchor when there is one"],
  ["v", "Audit view: every cell by its state, every header by its count"],
  ["?", "This list"],
];

/** What a cell's state looks like in audit view: one shape, filled as certainty increases. */
export const STATE_GLYPH: Record<"plan" | "verified" | "broken", string> = { plan: "◇", verified: "◆", broken: "◈" };

const SPECIAL_LABEL: Record<SpecialColumn, string> = { pov: "POV", time: "Time", "main-theme": "Main theme" };
const SPECIAL_KEY: Record<SpecialColumn, "plot-pov" | "plot-time" | "plot-theme"> = { pov: "plot-pov", time: "plot-time", "main-theme": "plot-theme" };

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
  private selection: Selection | null = null;
  /** A column picked from its header or the side column, with no cell: the side column's Column section follows it. */
  private column: number | null = null;
  private help: HTMLElement | null = null;
  /** Audit view: cells drawn by their state, headers by their counts. Not remembered: it is a lens, put on to look. */
  private audit = false;
  /** The anchor picker's sentences, once asked for; keyed by scene. */
  private picker: { key: string; sentences: string[] } | null = null;
  /** A model pass in flight, with the column it reads and what to call it. */
  private running: { controller: AbortController; column: GridColumn | null; what: string } | null = null;
  /** The model's proposals, with the writer's ticks, until they are added or put away. */
  private proposals: { list: ColumnProposal[]; picked: Set<string> } | null = null;
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

  private get settings(): PlotGridSettings { return this.source.gridSettings(); }
  private save(next: Partial<PlotGridSettings>): void { this.source.updateGridSettings({ ...this.settings, ...next }); }
  private get castExpanded(): boolean { return this.settings.castExpanded; }
  private get panelOpen(): boolean { return this.settings.panelOpen; }
  /** The headings hidden in this project. */
  private get hidden(): readonly string[] { return this.project ? this.settings.hidden[this.project.scope] ?? [] : []; }
  private setHidden(names: readonly string[]): void { if (this.project) this.save({ hidden: { ...this.settings.hidden, [this.project.scope]: names } }); }

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
      side: { isOpen: () => this.panelOpen, onToggle: () => { this.save({ panelOpen: !this.panelOpen }); } },
      sections: { isOpen: (cls) => this.settings.sections[cls], onToggle: (cls, open) => this.save({ sections: { ...this.settings.sections, [cls]: open } }) },
    });
    shell.overflow(() => this.menu());
    this.shell = shell;
    this.body = shell.main.createDiv({ cls: "czm-pg" });
    this.body.addEventListener("keydown", (ev) => this.onKey(ev));
    this.status = new StatusLine(shell.main);
    if (statusText) this.status.hold(statusText);
    this.help = shell.main.createDiv({ cls: "czm-writer-help czm-pg-help", attr: { role: "dialog", "aria-label": "Keyboard shortcuts" } });
    this.help.createDiv({ text: "Keyboard", cls: "czm-map-card-name" });
    const table = this.help.createEl("table");
    for (const [keys, what] of KEY_HELP) { const tr = table.createEl("tr"); tr.createEl("td", { text: keys, cls: "czm-writer-help-keys" }); tr.createEl("td", { text: what }); }
    this.help.createDiv({ text: "Tab moves focus as it does everywhere; Ctrl and Cmd stay with Obsidian. Folding a group, hiding a column, the search and the panel are commands: bind them in Settings → Hotkeys.", cls: "czm-map-hint" });
    const closeHelp = this.help.createEl("button", { text: "Close", cls: "czm-writer-help-close" });
    closeHelp.addEventListener("click", () => this.run("help"));
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
    this.renderTools();
    this.renderTable();
  }

  /** The head's one model tool: Read… for every column, or Stop while a pass runs. */
  private renderTools(): void {
    const shell = this.shell;
    if (!shell) return;
    shell.tools.empty();
    if (this.running) {
      const stop = shell.tools.createEl("button", { text: "Stop", cls: "czm-shell-reset czm-pg-stop", attr: { "aria-label": `Stop ${this.running.what}` } });
      stop.addEventListener("click", () => this.run("stop-reading"));
      return;
    }
    const model = this.source.modelLabel();
    shell.tool("sparkles", model ? `Read every column with the model (${model})` : "Read… needs a model: set one in Creative Writer settings", () => this.run("read-all"), false).addClass("czm-pg-read-all");
  }

  private menu(): readonly (MenuEntry | "-")[] {
    const f = this.settings.folded;
    return [
      { label: "New column…", icon: "plus", command: "plot-grid-new-column", disabled: !this.project, onClick: () => this.run("new-column") },
      { label: this.castExpanded ? "Fold the cast" : "Expand the cast", icon: "users", command: "plot-grid-toggle-cast", checked: this.castExpanded, onClick: () => this.run("toggle-cast") },
      { label: "Fold the arcs", command: "plot-grid-fold-arcs", checked: f.arc, onClick: () => this.run("fold-arcs") },
      { label: "Fold the themes", command: "plot-grid-fold-themes", checked: f.theme, onClick: () => this.run("fold-themes") },
      { label: "Fold the subplots", command: "plot-grid-fold-subplots", checked: f.subplot, onClick: () => this.run("fold-subplots") },
      { label: "Fold the free threads", command: "plot-grid-fold-threads", checked: f.free, onClick: () => this.run("fold-threads") },
      "-",
      { label: "Hide the selected column", icon: "eye-off", command: "plot-grid-hide-column", disabled: this.current() === null, onClick: () => this.run("hide-column") },
      { label: `Show hidden columns${this.hidden.length ? ` (${this.hidden.length})` : ""}`, icon: "eye", command: "plot-grid-show-hidden", disabled: this.hidden.length === 0, onClick: () => this.run("show-hidden") },
      { label: "Present, unmoved", command: "plot-grid-toggle-unmoved", checked: this.settings.unmoved, onClick: () => this.run("toggle-unmoved") },
      { label: "Audit view", icon: "scan-search", command: "plot-grid-audit", checked: this.audit, onClick: () => this.run("audit") },
      { label: "Next broken anchor", command: "plot-grid-next-issue", disabled: this.grid.broken === 0, onClick: () => this.run("next-issue") },
      { label: "Snapshot the grid", icon: "camera", command: "plot-grid-snapshot", disabled: !this.project, onClick: () => this.run("snapshot") },
      "-",
      { label: this.running ? `Stop ${this.running.what}` : "Read every column with the model…", icon: "sparkles", command: "plot-grid-read-all", disabled: !this.project, onClick: () => this.run(this.running ? "stop-reading" : "read-all") },
      { label: "Propose columns…", icon: "list-plus", command: "plot-grid-propose-columns", disabled: !this.project || !!this.running, onClick: () => this.run("propose-columns") },
      { label: "Read this column with the model…", command: "plot-grid-read-column", disabled: !this.current() || !!this.running, onClick: () => this.run("read-column") },
      { label: "Check this column against the draft…", command: "plot-grid-check-column", disabled: !this.current() || !!this.running, onClick: () => this.run("check-column") },
      { label: "Dismiss the reading", command: "plot-grid-dismiss-reading", disabled: !this.selected?.cell.reading, onClick: () => this.run("dismiss-reading") },
      "-",
      { label: "Toggle panel", icon: "sliders-horizontal", command: "plot-grid-toggle-panel", checked: this.panelOpen, onClick: () => this.run("toggle-panel") },
      { label: "Find a column", icon: "search", command: "plot-grid-focus-search", onClick: () => this.run("focus-search") },
      { label: "Keyboard shortcuts", icon: "keyboard", command: "plot-grid-help", onClick: () => this.run("help") },
      { label: "Open Story threads.md", icon: "file-text", command: "plot-grid-open-note", disabled: !this.project, onClick: () => this.run("open-note") },
      "-",
      { label: "Clear the search", icon: "x", command: "story-timeline-clear-search", disabled: !this.query.trim(), onClick: () => this.run("clear-search") },
    ];
  }

  /** The head's actions, as the commands and the ⋯ menu reach them. */
  run(action: PlotGridAction): void {
    const fold = (kind: ColumnKind) => { this.save({ folded: { ...this.settings.folded, [kind]: !this.settings.folded[kind] } }); this.renderTable(); };
    switch (action) {
      case "clear-search": this.clearSearch(); break;
      case "toggle-cast": this.save({ castExpanded: !this.castExpanded }); this.renderTable(); break;
      case "open-note": if (this.project) this.source.openNote(this.source.threadsNotePath(this.project)); break;
      case "toggle-panel": this.save({ panelOpen: !this.panelOpen }); this.shell?.setSideOpen(this.panelOpen); break;
      case "new-column": this.save({ panelOpen: true }); this.shell?.setSideOpen(true); this.renderSide(); (this.shell?.side.querySelector(".czm-pg-new-name") as HTMLInputElement | null)?.focus(); break;
      case "fold-arcs": fold("arc"); break;
      case "fold-themes": fold("theme"); break;
      case "fold-subplots": fold("subplot"); break;
      case "fold-threads": fold("free"); break;
      case "hide-column": { const c = this.current(); if (c) this.hideColumn(c); break; }
      case "show-hidden": this.setHidden([]); this.status?.say("Every column shown."); this.renderTable(); break;
      case "focus-search": this.search?.focus(); this.search?.select(); break;
      case "help": { const open = this.help?.classList.toggle("is-open"); if (open) this.help?.querySelector<HTMLButtonElement>(".czm-writer-help-close")?.focus(); else if (this.selection) this.cellEl(this.selection)?.focus(); break; }
      case "toggle-unmoved": this.save({ unmoved: !this.settings.unmoved }); this.renderTable(); break;
      case "audit": this.audit = !this.audit; this.renderTable(); if (this.selection) this.select(this.selection, false); break;
      case "snapshot": void this.snapshot(); break;
      case "next-issue": this.walk(1); break;
      case "previous-issue": this.walk(-1); break;
      case "anchor": void this.openPicker(); break;
      case "read-column": { const c = this.current(); if (c) void this.readColumns([c], "reading"); break; }
      case "check-column": { const c = this.current(); if (c) void this.readColumns([c], "checking"); break; }
      case "read-all": void this.readColumns(this.grid.columns.filter((c) => c.special !== "pov" && c.special !== "time"), "reading"); break;
      case "dismiss-reading": void this.dismissReading(); break;
      case "stop-reading": this.running?.controller.abort(); break;
      case "propose-columns": void this.proposeColumns(); break;
    }
  }

  /** One call over the outline: the proposals land in the side column with a tick each; nothing is written until Add. */
  private async proposeColumns(): Promise<void> {
    const project = this.project;
    if (!project || this.running) return;
    if (!this.source.modelLabel()) { this.status?.fail("Proposing columns needs a model: set Model to Local (Ollama) or Claude in Creative Writer settings."); return; }
    const controller = new AbortController();
    this.running = { controller, column: null, what: "proposing" };
    this.renderTools();
    this.status?.hold("Asking the model which threads run through the book…");
    let result: ProposalsResult;
    try { result = await this.source.proposeColumns(project, controller.signal); }
    catch (e) { this.running = null; this.renderTools(); this.status?.fail(couldNot("propose columns", e)); return; }
    this.running = null;
    this.renderTools();
    if ("needsReading" in result) {
      this.status?.action("Nothing to propose from yet: no scene has been read for its events.", "Read the project", () => void this.readProject());
      return;
    }
    this.proposals = { list: [...result.proposals], picked: new Set(result.proposals.filter((p) => !p.existing).map((p) => p.heading)) };
    this.save({ panelOpen: true }); this.shell?.setSideOpen(true);
    this.renderSide();
    this.status?.say(result.proposals.length ? `${plural(result.proposals.length, "column")} proposed from ${plural(result.scenesRead, "scene")} read. Tick the ones to add.` : `The model proposed nothing from ${plural(result.scenesRead, "scene")} read.`);
    this.shell?.side.querySelector<HTMLElement>(".czm-pg-proposal input")?.focus();
  }

  /** The relation reading, so the events exist to propose from; then the proposal itself. */
  private async readProject(): Promise<void> {
    const project = this.project;
    if (!project || this.running) return;
    const controller = new AbortController();
    this.running = { controller, column: null, what: "reading the project" };
    this.renderTools();
    try {
      const n = await this.source.readProject(project, controller.signal, (p) => this.status?.hold(`Reading scene ${p.done} of ${p.total} for events…`));
      this.running = null;
      this.renderTools();
      this.status?.say(`Read ${plural(n, "scene")} for events.`);
      if (!controller.signal.aborted) await this.proposeColumns();
    } catch (e) { this.running = null; this.renderTools(); this.status?.fail(couldNot("read the project", e)); }
  }

  private async addProposals(): Promise<void> {
    const project = this.project, ps = this.proposals;
    if (!project || !ps) return;
    const chosen = ps.list.filter((p) => ps.picked.has(p.heading) && !p.existing);
    if (!chosen.length) return;
    try { for (const p of chosen) await this.source.addThread(project, p.heading); }
    catch (e) { this.status?.fail(couldNot("add the columns", e)); return; }
    this.proposals = null;
    await this.show(project, true);
    this.status?.undoable(`${plural(chosen.length, "column")} written to Story threads.md: ${chosen.map((p) => p.name).join(", ")}`, async () => { for (const p of chosen) await this.source.removeThread(project, p.heading); await this.show(project, true); });
  }

  /** One pass over the given columns: the state line counts scenes, Stop aborts, and nothing is lost on stop. */
  private async readColumns(columns: readonly GridColumn[], what: "reading" | "checking"): Promise<void> {
    const project = this.project;
    if (!project || this.running || !columns.length) return;
    if (!this.source.modelLabel()) { this.status?.fail("Reading needs a model: set Model to Local (Ollama) or Claude in Creative Writer settings."); return; }
    const controller = new AbortController();
    this.running = { controller, column: columns.length === 1 ? columns[0]! : null, what: what === "reading" ? "reading" : "checking" };
    this.renderTools();
    let read = 0;
    try {
      for (const column of columns) {
        if (controller.signal.aborted) break;
        const onProgress = (p: AnalyzeProgress) => { this.status?.hold(`${what === "reading" ? "Reading" : "Checking"} scene ${p.done} of ${p.total} for ${column.heading.name}…`); };
        read += what === "reading" ? await this.source.readColumn(project, column, controller.signal, onProgress) : await this.source.checkColumn(project, column, controller.signal, onProgress);
      }
      this.running = null;
      await this.show(project, true);
      const open = this.grid.readings;
      this.status?.say(controller.signal.aborted ? `Stopped after ${plural(read, "scene")}; what landed is kept.` : `${what === "reading" ? "Read" : "Checked"} ${plural(read, "scene")} · ${open ? `${plural(open, "reading")} awaiting you` : "nothing new for these columns"}.`);
    } catch (e) {
      this.running = null;
      this.renderTools();
      this.status?.fail(couldNot(what === "reading" ? "read the column" : "check the column", e));
    }
  }

  private async dismissReading(): Promise<void> {
    const sel = this.selected, project = this.project;
    if (!sel || !project || !sel.cell.reading) return;
    try { await this.source.dismissReading(project, sel.row.scene, sel.column.heading.heading); } catch (e) { this.status?.fail(couldNot("dismiss the reading", e)); return; }
    await this.show(project, true);
    this.status?.say(`Reading dismissed: ${sel.column.heading.name} at ${sel.row.scene.title || basenameOf(sel.row.scene.path)}. It stays dismissed until the scene changes.`);
  }

  /** The next or previous cell in reading order whose anchor is broken; wraps around, says so when there is none. */
  private walk(step: 1 | -1): void {
    const cols = this.shown.length, rows = this.rows.length;
    if (!cols || !rows) return;
    const total = cols * rows;
    const start = this.selection ? this.selection.row * cols + this.selection.col : step > 0 ? -1 : total;
    for (let i = 1; i <= total; i++) {
      const at = ((start + step * i) % total + total) % total;
      const col = at % cols, row = Math.floor(at / cols);
      const cell = this.shown[col]!.cells[this.rows[row]!.index]!;
      if (cell.state === "broken" || (cell.reading && !cell.reading.stale)) { this.select({ col, row }); return; }
    }
    this.status?.say("No readings awaiting you, and no broken anchors.");
  }

  private async snapshot(): Promise<void> {
    const project = this.project;
    if (!project) return;
    let path: string;
    try { path = await this.source.snapshot(project); } catch (e) { this.status?.fail(couldNot("write the snapshot", e)); return; }
    this.status?.action(`Wrote ${basenameOf(path)}.md`, "Open", () => this.source.openNote(path));
  }

  /** The anchor picker in the side column: the scene's sentences, the near matches of a lost quote first; Enter attaches one. */
  private async openPicker(): Promise<void> {
    const sel = this.selected, project = this.project;
    if (!sel || !project) return;
    const key = `${sel.row.scene.path}#${sel.row.scene.title}`;
    if (this.picker?.key !== key) {
      let sentences: string[];
      try { sentences = await this.source.sentences(project, sel.row.scene); } catch (e) { this.status?.fail(couldNot("read the scene", e)); return; }
      this.picker = { key, sentences };
    }
    this.save({ panelOpen: true }); this.shell?.setSideOpen(true);
    this.renderSide();
    const list = this.shell?.side.querySelector<HTMLElement>(".czm-pg-picker");
    list?.querySelector<HTMLElement>(".czm-pg-picker-row")?.focus();
    if (!this.picker.sentences.length) this.status?.say(sel.row.outline ? "No prose under this heading yet." : "No sentences found in the scene.");
  }

  /** The column the writer is on: the selected cell's, or the one picked from a header. */
  private current(): GridColumn | null {
    return this.selected?.column ?? (this.column !== null ? this.shown[this.column] ?? null : null);
  }

  private hideColumn(c: GridColumn): void {
    this.setHidden([...this.hidden.filter((h) => h !== c.heading.heading), c.heading.heading]);
    this.selection = null; this.column = null;
    this.renderTable();
    this.status?.undoable(`Column “${c.heading.name}” hidden`, async () => { this.setHidden(this.hidden.filter((h) => h !== c.heading.heading)); this.renderTable(); });
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
    const hidden = new Set(this.hidden.map((h) => h.toLowerCase()));
    const folded = this.settings.folded;
    const columns = grid.columns
      .filter((c) => !hidden.has(c.heading.heading.toLowerCase()))
      .filter((c) => c.special === "pov" || c.special === "time" || !folded[c.heading.kind])
      .filter((c) => !q || c.heading.name.toLowerCase().includes(q) || c.heading.heading.toLowerCase().includes(q));
    this.shown = columns;
    if (this.selection && (this.selection.col >= columns.length || this.selection.row >= rows.length)) this.selection = null;
    if (this.column !== null && this.column >= columns.length) this.column = null;
    const cast = grid.cast
      .filter((e) => settings.kinds[e.kind])
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)));
    const unknown = grid.unknownPrefixes.length ? ` · ${grid.unknownPrefixes.length} heading${grid.unknownPrefixes.length === 1 ? "" : "s"} not read as a kind (${grid.unknownPrefixes.map((p) => `${p}:`).join(", ")})` : "";
    const hid = this.hidden.length ? ` · ${this.hidden.length} hidden` : "";
    const awaiting = grid.readings ? ` · ${plural(grid.readings, "reading")} awaiting you` : "";
    root.classList.toggle("is-audit", this.audit);
    const auditLine = this.audit ? `${plural(grid.cells, "cell")} · ${grid.filled} filled · ${grid.verified} verified · ${grid.broken} broken` : `${rows.length} scene${rows.length === 1 ? "" : "s"} · ${plural(columns.length, "column")} · ${cast.length} in the cast`;
    shell.setState(`${auditLine}${awaiting}${hid}${q ? ` · “${this.query.trim()}”` : ""}${unknown}`, q ? { label: "Clear", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } } : this.hidden.length ? { label: "Show hidden", cls: "czm-pg-show-hidden", onClick: () => this.run("show-hidden") } : null);
    this.renderSide();
    if (rows.length === 0) { shell.empty("No scenes yet — headings become scenes, with prose under them or not."); return; }
    this.renderKey(cast);
    if (columns.length === 0 && grid.columns.length === 0) {
      shell.empty("No columns yet. Name one — Arc: [[Anna]], Theme: what we owe the dead, Subplot: the letter — or let the model propose some from the events it has read.", [{ label: "New column", cls: "czm-pg-fix-new", onClick: () => this.run("new-column") }, { label: "Propose columns…", cls: "czm-pg-fix-propose", onClick: () => this.run("propose-columns") }, { label: "Open Story threads.md", cls: "czm-pg-fix-note", onClick: () => this.run("open-note") }]);
    } else if (columns.length === 0 && cast.length === 0) {
      shell.empty(`Nothing matches “${this.query.trim()}”.`, [{ label: "Clear search", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } }]);
    }
    this.renderEyebrow(root, grid, cast.length);
    const wrap = root.createDiv({ cls: "czm-pg-wrap" });
    const table = wrap.createEl("table", { cls: "czm-pg-table", attr: { "aria-label": "Plot grid" } });
    const thead = table.createEl("thead").createEl("tr");
    thead.createEl("th", { text: "Scene", cls: "czm-pg-corner", attr: { scope: "col" } });
    thead.createEl("th", { text: "Words", cls: "czm-pg-col czm-pg-col-words", attr: { scope: "col" } });
    thead.createEl("th", { text: "Plot", cls: "czm-pg-col czm-pg-col-plot", attr: { scope: "col", title: "The model's events for the scene, from Story map.md" } });
    let lastGroup = "";
    columns.forEach((c, col) => {
      const group = c.special === "pov" || c.special === "time" ? "derived" : c.heading.kind;
      const th = thead.createEl("th", { cls: `czm-pg-col czm-pg-col-thread czm-pg-kind-${c.heading.kind}${c.special ? ` czm-pg-special-${c.special}` : ""}${group !== lastGroup ? " is-group-start" : ""}${this.column === col ? " is-current" : ""}`, attr: { scope: "col", title: `${c.heading.name} — ${c.special ? SPECIAL_LABEL[c.special] : KIND_GROUP[c.heading.kind]}, ${c.filled} of ${rows.length} scenes` } });
      lastGroup = group;
      const name = th.createDiv({ cls: "czm-pg-col-name", attr: { role: "button", tabindex: "0", "aria-label": `${c.heading.name}: select the column` } });
      if (c.entity) { const dot = name.createSpan({ cls: "czm-pg-dot", attr: { "aria-label": KIND_LABEL[c.entity.kind] } }); dot.setCssProps({ "--czm-kind": settings.colors[c.entity.kind] }); }
      name.createSpan({ text: c.heading.name, cls: "czm-pg-col-title" });
      onActivate(name, () => this.pickColumn(col));
      const sub = th.createDiv({ cls: "czm-pg-col-sub" });
      const audit = this.audit ? ` · ${c.verified} ${STATE_GLYPH.verified}${c.broken ? ` · ${c.broken} ${STATE_GLYPH.broken}` : ""}` : "";
      sub.createSpan({ text: `${c.special ? `${SPECIAL_LABEL[c.special].toLowerCase()} · ` : ""}${c.filled} of ${rows.length}${audit}`, cls: "czm-pg-col-count" });
      const more = sub.createEl("button", { cls: "clickable-icon czm-pg-col-more", attr: { "aria-label": `${c.heading.name}: column menu`, "aria-haspopup": "menu" } });
      setIcon(more, "more-horizontal");
      more.addEventListener("click", (ev) => { ev.stopPropagation(); this.pickColumn(col, false); showOverflow(ev, this.columnMenu(c)); });
      th.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.pickColumn(col, false); showOverflow(ev, this.columnMenu(c)); });
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
    const th = tr.createEl("th", { cls: `czm-pg-scene-head${row.pov ? " has-pov" : ""}`, attr: { role: "button", tabindex: "0", scope: "row" } });
    // A 3px chip in the POV character's colour rides the sticky column, so the eye's owner survives sideways scrolling.
    if (row.pov) { th.setCssProps({ "--czm-pov": row.pov.entity ? settings.colors[row.pov.entity.kind] : "var(--text-faint)" }); th.title = `POV: ${row.pov.name}`; }
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
    const td = tr.createEl("td", { cls: `czm-pg-cell-td czm-pg-kind-${column.heading.kind}${column.special ? ` czm-pg-special-${column.special}` : ""}` });
    const where = `${column.heading.name} at ${row.scene.title || basenameOf(row.scene.path)}`;
    const selected = this.selection?.col === at.col && this.selection?.row === at.row;
    const stop = cell.stop;
    const unmoved = !stop && cell.presentUnmoved && column.armed && this.settings.unmoved;
    const reading = cell.reading;
    const el = td.createDiv({
      cls: `czm-pg-cell is-${stop ? cell.state : "empty"}${unmoved ? " is-unmoved" : ""}${reading ? ` has-reading${reading.stale ? " is-stale" : ""}` : ""}${selected ? " is-selected" : ""}`,
      attr: { role: "button", tabindex: selected || (!this.selection && at.col === 0 && at.row === 0) ? "0" : "-1", "data-col": String(at.col), "data-row": String(at.row), "aria-selected": String(selected), "aria-label": stop ? `${where}: ${stop.role && stop.role !== "touch" ? `${stop.role}, ` : ""}${stop.note || stop.quote || ""}` : unmoved ? `${where}: ${column.entity?.name ?? "the character"} is on the page, unmoved` : `${where}: empty` },
    });
    if (stop && column.special === "pov") {
      const dot = el.createSpan({ cls: "czm-pg-dot czm-pg-pov-dot" });
      if (row.pov?.entity) dot.setCssProps({ "--czm-kind": this.source.settings().colors[row.pov.entity.kind] });
      el.createSpan({ text: stop.note, cls: "czm-pg-cell-text" });
    } else if (stop) {
      if (this.audit) el.createSpan({ text: STATE_GLYPH[cell.state as "plan" | "verified" | "broken"], cls: `czm-pg-state-glyph is-${cell.state}`, attr: { title: cell.state } });
      const glyph = stop.role ? ROLE_GLYPH[stop.role] : "";
      if (glyph && stop.role) el.createSpan({ text: glyph, cls: `czm-pg-role is-${stop.role}`, attr: { title: stop.role } });
      el.createSpan({ text: stop.note || (stop.quote ? `“${stop.quote}”` : ""), cls: "czm-pg-cell-text" });
      if (cell.more.length) el.createSpan({ text: `+${cell.more.length}`, cls: "czm-pg-more", attr: { title: cell.more.map((m) => m.note).join("\n") } });
      if (cell.state === "broken") el.title = `“${stop.quote}” is no longer in the scene`;
      else if (cell.state === "verified") el.title = `“${stop.quote}”`;
    } else if (unmoved) {
      el.createSpan({ text: "present, unmoved", cls: "czm-pg-unmoved" });
    }
    // A reading is a note in the cell's corner, never its text: the writer writes the cell, and the reading is the placeholder when they do.
    if (reading) {
      const glyph = el.createSpan({ cls: "czm-pg-reading-glyph", attr: { title: reading.stale ? `The model read this scene before it changed: “${reading.text}”` : `${reading.kind === "check" ? "Checked" : "The model read"}: ${reading.text}` } });
      setIcon(glyph, reading.kind === "check" ? (reading.evidence ? "check" : "circle-help") : "sparkles");
      el.setAttribute("aria-label", `${el.getAttribute("aria-label") ?? where}. ${reading.stale ? "A stale reading" : "A reading awaits you"}: ${reading.text}`);
    }
    // A click selects; a second click on the selected cell, or Enter, edits.
    el.addEventListener("click", () => { if (this.selection?.col === at.col && this.selection?.row === at.row) this.edit(); else this.select(at); });
    el.addEventListener("dblclick", () => { this.select(at); this.edit(); });
    el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !inField(ev)) { ev.preventDefault(); ev.stopPropagation(); this.select(at); this.edit(); } });
  }

  /** Over the table: the main theme, and one pill per group with its count, folded or not. */
  private renderEyebrow(root: HTMLElement, grid: PlotGrid, castCount: number): void {
    const bar = root.createDiv({ cls: "czm-pg-eyebrow" });
    const main = grid.columns.find((c) => c.special === "main-theme");
    const theme = bar.createDiv({ cls: "czm-pg-theme" });
    if (main) { theme.createSpan({ text: "Main theme", cls: "czm-pg-theme-label" }); theme.createSpan({ text: main.heading.name, cls: "czm-pg-theme-name" }); theme.createSpan({ text: `${main.filled} of ${this.rows.length} scenes`, cls: "czm-pg-col-count" }); }
    else theme.createSpan({ text: "No main theme yet — a theme column's menu has Use as main theme.", cls: "czm-pg-theme-label" });
    const pills = bar.createDiv({ cls: "czm-pg-pills", attr: { role: "group", "aria-label": "Column groups" } });
    const hidden = new Set(this.hidden.map((h) => h.toLowerCase()));
    for (const kind of COLUMN_KINDS) {
      const inKind = grid.columns.filter((c) => c.heading.kind === kind && c.special !== "pov" && c.special !== "time" && !hidden.has(c.heading.heading.toLowerCase()));
      if (!inKind.length) continue;
      const folded = this.settings.folded[kind];
      const pill = pills.createEl("button", { cls: `czm-pg-pill${folded ? " is-folded" : ""}`, attr: { "aria-pressed": String(!folded), "aria-label": `${KIND_GROUP[kind]}: ${inKind.length}, ${folded ? "folded" : "shown"}` } });
      pill.createSpan({ text: KIND_GROUP[kind], cls: "czm-pg-pill-name" });
      pill.createSpan({ text: folded ? `${inKind.length} folded` : String(inKind.length), cls: "czm-pg-pill-count" });
      pill.addEventListener("click", () => this.run(kind === "arc" ? "fold-arcs" : kind === "theme" ? "fold-themes" : kind === "subplot" ? "fold-subplots" : "fold-threads"));
    }
    const cast = pills.createEl("button", { cls: `czm-pg-pill${this.castExpanded ? "" : " is-folded"}`, attr: { "aria-pressed": String(this.castExpanded), "aria-label": `Cast: ${castCount}, ${this.castExpanded ? "expanded" : "folded"}` } });
    cast.createSpan({ text: "Cast", cls: "czm-pg-pill-name" });
    cast.createSpan({ text: this.castExpanded ? String(castCount) : `${castCount} folded`, cls: "czm-pg-pill-count" });
    cast.addEventListener("click", () => this.run("toggle-cast"));
  }

  /** A header or a side-column row picks a column: the side column shows it; with `moveCell` the selection lands in it too. */
  private pickColumn(col: number, moveCell = true): void {
    this.column = col;
    if (moveCell) { this.select({ col, row: this.selection?.row ?? 0 }); return; }
    this.body?.querySelectorAll(".czm-pg-col-thread.is-current").forEach((th) => th.classList.remove("is-current"));
    this.body?.querySelectorAll(".czm-pg-col-thread")[col]?.classList.add("is-current");
    this.renderSide();
  }

  /** A column's menu: its kind, its job for the project, and the column itself. Every row names its command where it has one. */
  private columnMenu(c: GridColumn): readonly (MenuEntry | "-")[] {
    const kindRows: MenuEntry[] = COLUMN_KINDS.map((kind) => ({ label: `Kind: ${kind === "free" ? "free thread" : kind}`, checked: c.heading.kind === kind, onClick: () => void this.setKind(c, kind) }));
    const jobRows: MenuEntry[] = (["pov", "time", "main-theme"] as SpecialColumn[]).map((job) => ({ label: c.special === job ? `Stop using as ${SPECIAL_LABEL[job]}` : `Use as ${SPECIAL_LABEL[job]}`, checked: c.special === job, onClick: () => void this.setSpecial(c, job) }));
    return [
      { label: "Rename…", icon: "pencil", onClick: () => { this.save({ panelOpen: true }); this.shell?.setSideOpen(true); this.renderSide(); (this.shell?.side.querySelector(".czm-pg-rename") as HTMLInputElement | null)?.focus(); } },
      ...kindRows,
      "-",
      ...jobRows,
      "-",
      { label: "Read this column with the model…", icon: "sparkles", command: "plot-grid-read-column", disabled: !!this.running || c.special === "pov" || c.special === "time", onClick: () => void this.readColumns([c], "reading") },
      { label: "Check this column against the draft…", command: "plot-grid-check-column", disabled: !!this.running || c.filled === 0, onClick: () => void this.readColumns([c], "checking") },
      { label: `Dismiss all readings${c.readings ? ` (${c.readings})` : ""}`, disabled: c.readings === 0, onClick: () => { if (this.project) void this.source.dismissColumnReadings(this.project, c.heading.heading).then(() => this.show(this.project, true)); } },
      "-",
      { label: "Hide column", icon: "eye-off", command: "plot-grid-hide-column", onClick: () => this.hideColumn(c) },
      { label: "Delete column…", icon: "x", onClick: () => { this.save({ panelOpen: true }); this.shell?.setSideOpen(true); this.renderSide(); const del = this.shell?.side.querySelector<HTMLButtonElement>(`.czm-pg-col-delete[data-heading="${CSS.escape(c.heading.heading)}"]`); del?.click(); del?.focus(); } },
    ];
  }

  /** Rewrites the heading with the kind's prefix, keeping the name; an arc keeps its link. */
  private async setKind(c: GridColumn, kind: ColumnKind): Promise<void> {
    const project = this.project;
    if (!project || c.heading.kind === kind) return;
    const body = kind === "arc" && c.heading.kind !== "arc" && c.entity?.path ? `[[${basenameOf(c.entity.path)}]]` : c.heading.kind === "arc" && c.heading.link ? c.heading.name : c.heading.name;
    const to = kind === "free" ? body : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}: ${kind === "arc" && c.heading.link ? `[[${c.heading.link}]]` : body}`;
    await this.renameColumn(c, to);
  }

  private async renameColumn(c: GridColumn, to: string): Promise<void> {
    const project = this.project;
    if (!project || !to.trim() || to.trim() === c.heading.heading) return;
    const from = c.heading.heading;
    try { await this.source.renameThread(project, from, to.trim()); } catch (e) { this.status?.fail(couldNot(`rename “${c.heading.name}”`, e)); return; }
    // The project note names columns by heading; a renamed heading keeps its job.
    const jobs: SpecialColumn[] = c.special ? [c.special] : [];
    for (const job of jobs) await this.source.setProjectKey(project, SPECIAL_KEY[job], to.trim()).catch(() => undefined);
    if (this.hidden.includes(from)) this.setHidden(this.hidden.map((h) => (h === from ? to.trim() : h)));
    await this.show(project, true);
    this.status?.undoable(`“${from}” is now “${to.trim()}”`, async () => { await this.source.renameThread(project, to.trim(), from); for (const job of jobs) await this.source.setProjectKey(project, SPECIAL_KEY[job], from).catch(() => undefined); await this.show(project, true); });
  }

  /** Names the column in the project note as the grid's POV, Time or main theme, or takes the job away. */
  private async setSpecial(c: GridColumn, job: SpecialColumn): Promise<void> {
    const project = this.project;
    if (!project) return;
    const off = c.special === job;
    try { await this.source.setProjectKey(project, SPECIAL_KEY[job], off ? null : c.heading.heading); } catch (e) { this.status?.fail(couldNot(`write ${SPECIAL_KEY[job]}`, e)); return; }
    this.status?.say(off ? `“${c.heading.name}” is no longer the ${SPECIAL_LABEL[job]} column.` : `“${c.heading.name}” is the ${SPECIAL_LABEL[job]} column: ${SPECIAL_KEY[job]} written to the project note.`);
    // The project spec is read from the note; the rebuild picks the change up once the cache has it.
    window.setTimeout(() => void this.refresh(), 300);
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
    const audit = this.audit ? [
      { label: "plan", color: "", cls: "czm-pg-key-state is-plan" },
      { label: "verified", color: "", cls: "czm-pg-key-state is-verified" },
      { label: "broken", color: "", cls: "czm-pg-key-state is-broken" },
    ] : [];
    shell.key([
      ...audit,
      ...(this.grid.readings ? [{ label: "reading awaiting you", color: "", cls: "czm-pg-key-role is-reading" }] : []),
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
    this.column = at.col;
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
    const hint = sel.cell.reading && !sel.cell.stop ? sel.cell.reading.text : "What the thread does here";
    const field = el.createEl("textarea", { cls: "czm-pg-editor", attr: { rows: "1", "aria-label": `${sel.column.heading.name} at ${sel.row.scene.title || basenameOf(sel.row.scene.path)}`, placeholder: hint } });
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
      case "?": ev.preventDefault(); this.run("help"); break;
      case "v": ev.preventDefault(); this.run("audit"); break;
      case "x": if (this.selected?.cell.reading) { ev.preventDefault(); void this.dismissReading(); } break;
      case "n": ev.preventDefault(); this.walk(1); break;
      case "p": ev.preventDefault(); this.walk(-1); break;
      case '"': ev.preventDefault(); void this.openPicker(); break;
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
    const picked = this.current();
    const colOne = shell.section("Column", picked ? picked.heading.name : "", "pg-column", true);
    if (!picked) colOne.createDiv({ text: "Pick a column from its header to rename it, set its kind, or give it a job.", cls: "czm-map-absent" });
    else this.renderColumnSection(colOne, picked);
    const columns = this.grid.columns;
    const colSection = shell.section("Columns", `${columns.length}${this.hidden.length ? ` · ${this.hidden.length} hidden` : ""}${this.grid.unknownPrefixes.length ? ` · ${this.grid.unknownPrefixes.length} unread` : ""}`, "pg-columns", true);
    const modelSection = shell.section("Model", this.source.modelLabel() || "off", "pg-model", false);
    modelSection.createDiv({ text: this.source.modelLabel() ? `${this.source.modelLabel()}. Read… asks what each thread does in each scene and leaves a reading in the empty cells; you write the cell in your own words, or dismiss it. The model never writes a cell, and never a chapter.` : "No model. Set Model to Local (Ollama) or Claude in Creative Writer settings to read columns.", cls: "czm-map-absent" });
    const rowsSection = shell.section("Rows", [this.settings.unmoved ? "unmoved on" : "", this.audit ? "audit" : ""].filter(Boolean).join(" · "), "pg-rows", false);
    const auditRow = rowsSection.createDiv({ cls: "setting-item mod-toggle" });
    const auditInfo = auditRow.createDiv({ cls: "setting-item-info" });
    auditInfo.createDiv({ text: "Audit view", cls: "setting-item-name" });
    auditInfo.createDiv({ text: `Every cell by its state: ${STATE_GLYPH.plan} plan · ${STATE_GLYPH.verified} verified · ${STATE_GLYPH.broken} broken`, cls: "setting-item-description" });
    const auditToggle = auditRow.createDiv({ cls: "setting-item-control" }).createEl("button", { cls: `czm-pg-toggle czm-pg-audit-toggle${this.audit ? " is-on" : ""}`, attr: { role: "switch", "aria-checked": String(this.audit), "aria-label": "Audit view" } });
    auditToggle.addEventListener("click", () => this.run("audit"));
    const unmovedRow = rowsSection.createDiv({ cls: "setting-item mod-toggle" });
    const info = unmovedRow.createDiv({ cls: "setting-item-info" });
    info.createDiv({ text: "Present, unmoved", cls: "setting-item-name" });
    info.createDiv({ text: "On an arc with a verified stop: the character is on the page, the arc is not", cls: "setting-item-description" });
    const control = unmovedRow.createDiv({ cls: "setting-item-control" });
    const toggle = control.createEl("button", { cls: `czm-pg-toggle${this.settings.unmoved ? " is-on" : ""}`, attr: { role: "switch", "aria-checked": String(this.settings.unmoved), "aria-label": "Present, unmoved" } });
    toggle.addEventListener("click", () => this.run("toggle-unmoved"));
    const list = colSection.createDiv({ cls: "czm-map-list" });
    let lastKind: ColumnKind | null = null;
    for (const c of columns) {
      if (c.heading.kind !== lastKind) { lastKind = c.heading.kind; list.createDiv({ text: KIND_GROUP[c.heading.kind], cls: "czm-pg-side-kind" }); }
      const row = list.createDiv({ cls: `czm-map-row czm-pg-side-col${c.heading.unknownPrefix ? " is-unknown" : ""}`, attr: { tabindex: "0", title: c.heading.heading } });
      const name = row.createSpan({ text: c.heading.name, cls: "czm-map-row-name" });
      if (c.heading.unknownPrefix) name.title = `“${c.heading.unknownPrefix}:” is not a kind — Arc:, Theme: or Subplot: are`;
      row.createSpan({ text: `${c.filled} of ${this.rows.length}${c.readings ? ` · ${c.readings} to answer` : ""}`, cls: "czm-map-row-meta" });
      if (c.special) row.createSpan({ text: SPECIAL_LABEL[c.special].toLowerCase(), cls: "czm-pg-side-job" });
      if (this.hidden.includes(c.heading.heading)) { row.addClass("is-hidden"); const show = row.createEl("button", { cls: "clickable-icon czm-pg-col-show", attr: { "aria-label": `Show column ${c.heading.name}` } }); setIcon(show, "eye-off"); show.addEventListener("click", (ev) => { ev.stopPropagation(); this.setHidden(this.hidden.filter((h) => h !== c.heading.heading)); this.renderTable(); }); }
      const del = row.createEl("button", { cls: "clickable-icon czm-pg-col-delete", attr: { "aria-label": `Delete column ${c.heading.name}`, title: "Delete the column and every stop under it", "data-heading": c.heading.heading } });
      setIcon(del, "x");
      // Two clicks: the first arms, the second deletes. A whole column is the one thing here that is not undone by a line.
      del.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!del.classList.contains("is-armed")) { del.classList.add("is-armed"); del.setText("Delete?"); window.setTimeout(() => { if (del.isConnected) { del.classList.remove("is-armed"); del.empty(); setIcon(del, "x"); } }, 5000); return; }
        void this.deleteColumn(c);
      });
      onActivate(row, () => { const col = this.shown.indexOf(c); if (col >= 0) this.pickColumn(col, false); });
    }
    if (columns.length === 0) list.createDiv({ text: "No columns yet.", cls: "czm-map-absent" });
    const add = colSection.createDiv({ cls: "czm-pg-new" });
    const input = add.createEl("input", { cls: "czm-pg-new-name", attr: { type: "text", placeholder: "Arc: [[Anna]] · Theme: … · Subplot: …", "aria-label": "New column: its heading in Story threads.md" } });
    const button = add.createEl("button", { text: "New column", cls: "czm-pg-new-add" });
    const submit = () => { const name = input.value.trim(); if (!name) return; button.disabled = true; void this.addColumn(name).finally(() => { button.disabled = false; }); };
    button.addEventListener("click", submit);
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
    const propose = colSection.createDiv({ cls: "czm-map-panel-actions czm-pg-propose-row" });
    const proposeBtn = propose.createEl("button", { text: "Propose columns…", cls: "czm-pg-propose", attr: { title: "Ask the model which threads run through the book, from the events it has read" } });
    proposeBtn.disabled = !!this.running;
    proposeBtn.addEventListener("click", () => this.run("propose-columns"));
    if (this.proposals) this.renderProposals(shell.section("Proposed columns", `${this.proposals.picked.size} of ${this.proposals.list.length} ticked`, "pg-proposals", true));
  }

  /** The model's proposals: a tick each, the sentence, the scenes; Add writes the ticked ones as empty headings. */
  private renderProposals(section: HTMLElement): void {
    const ps = this.proposals;
    if (!ps) return;
    section.createDiv({ text: "Threads the model found running through more than one scene. Nothing is added until you say so.", cls: "czm-map-absent" });
    const list = section.createDiv({ cls: "czm-pg-proposals", attr: { role: "group", "aria-label": "Proposed columns" } });
    for (const p of ps.list) {
      const row = list.createEl("label", { cls: `czm-pg-proposal${p.existing ? " is-existing" : ""}` });
      const box = row.createEl("input", { attr: { type: "checkbox", "aria-label": p.heading } });
      box.checked = ps.picked.has(p.heading);
      box.disabled = p.existing;
      box.addEventListener("change", () => { if (box.checked) ps.picked.add(p.heading); else ps.picked.delete(p.heading); const v = this.shell?.side.querySelector(".czm-map-section-pg-proposals .czm-map-section-value"); if (v) v.textContent = `${ps.picked.size} of ${ps.list.length} ticked`; const addBtn = this.shell?.side.querySelector<HTMLButtonElement>(".czm-pg-proposals-add"); if (addBtn) { addBtn.textContent = `Add ${plural(ps.picked.size, "column")}`; addBtn.disabled = ps.picked.size === 0; } });
      const text = row.createDiv({ cls: "czm-pg-proposal-text" });
      const head = text.createDiv({ cls: "czm-pg-proposal-head" });
      head.createSpan({ text: p.name, cls: "czm-pg-proposal-name" });
      head.createSpan({ text: p.existing ? `${p.kind} · already a column` : `${p.kind} · ${plural(p.scenes.length, "scene")}`, cls: "czm-map-row-meta" });
      if (p.why) text.createDiv({ text: p.why, cls: "czm-pg-proposal-why" });
      text.createDiv({ text: p.scenes.join(" · "), cls: "czm-pg-proposal-scenes" });
    }
    if (!ps.list.length) list.createDiv({ text: "Nothing proposed.", cls: "czm-map-absent" });
    const foot = section.createDiv({ cls: "czm-pg-proposals-foot" });
    foot.createSpan({ text: this.source.modelLabel(), cls: "czm-map-row-meta" });
    const cancel = foot.createEl("button", { text: "Put away", cls: "czm-pg-proposals-cancel" });
    cancel.addEventListener("click", () => { this.proposals = null; this.renderSide(); });
    const add = foot.createEl("button", { text: `Add ${plural(ps.picked.size, "column")}`, cls: "czm-pg-proposals-add mod-cta" });
    add.disabled = ps.picked.size === 0;
    add.addEventListener("click", () => { add.disabled = true; void this.addProposals(); });
  }

  /** The picked column: its heading to rename, its kind, its job, and its count. */
  private renderColumnSection(section: HTMLElement, c: GridColumn): void {
    const rename = section.createDiv({ cls: "czm-pg-new" });
    const input = rename.createEl("input", { cls: "czm-pg-rename", attr: { type: "text", "aria-label": "Heading" } });
    input.value = c.heading.heading;
    const button = rename.createEl("button", { text: "Rename", cls: "czm-pg-new-add" });
    const submit = () => { button.disabled = true; void this.renameColumn(c, input.value).finally(() => { button.disabled = false; }); };
    button.addEventListener("click", submit);
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
    const kind = section.createDiv({ cls: "czm-pg-field" });
    kind.createDiv({ text: "Kind", cls: "czm-pg-field-label" });
    const kindSelect = kind.createEl("select", { cls: "dropdown czm-pg-kind-select", attr: { "aria-label": "Kind" } });
    for (const k of COLUMN_KINDS) { const o = kindSelect.createEl("option", { text: k === "free" ? "free thread" : k }); o.value = k; if (c.heading.kind === k) o.selected = true; }
    kindSelect.addEventListener("change", () => void this.setKind(c, kindSelect.value as ColumnKind));
    const jobs = section.createDiv({ cls: "czm-pg-field" });
    jobs.createDiv({ text: "Job for the project", cls: "czm-pg-field-label" });
    const jobRow = jobs.createDiv({ cls: "czm-map-panel-actions czm-pg-jobs" });
    for (const job of ["pov", "time", "main-theme"] as SpecialColumn[]) {
      const b = jobRow.createEl("button", { text: SPECIAL_LABEL[job], cls: `czm-pg-job${c.special === job ? " is-on" : ""}`, attr: { "aria-pressed": String(c.special === job), title: c.special === job ? `Stop using as ${SPECIAL_LABEL[job]}` : `Use as ${SPECIAL_LABEL[job]}: writes ${SPECIAL_KEY[job]} to the project note` } });
      b.addEventListener("click", () => void this.setSpecial(c, job));
    }
    section.createDiv({ text: `${c.filled} of ${this.rows.length} scenes · ${c.verified} verified · ${c.broken} broken${c.entity ? ` · bound to ${c.entity.name}` : c.heading.kind === "arc" ? " · no character of that name on the map" : ""}`, cls: "czm-map-absent" });
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
    if (cell.reading) {
      const r = cell.reading;
      const box = section.createDiv({ cls: `czm-pg-reading${r.stale ? " is-stale" : ""}` });
      const head = box.createDiv({ cls: "czm-pg-reading-head" });
      head.createSpan({ text: r.kind === "check" ? (r.evidence ? "Checked: on the page" : "Checked: not on the page") : "A reading", cls: "czm-pg-reading-label" });
      head.createSpan({ text: "Story map.md", cls: "czm-map-row-meta" });
      if (r.kind !== "check" || !r.evidence) box.createDiv({ text: r.text, cls: "czm-pg-reading-text" });
      if (r.evidence) box.createDiv({ text: `“${r.evidence}”`, cls: "czm-pg-reading-quote" });
      box.createDiv({ text: `${r.model}${r.role ? ` · ${r.role}` : ""}${r.stale ? " · the scene changed since" : ""}`, cls: "czm-map-row-meta" });
      const acts = box.createDiv({ cls: "czm-map-panel-actions czm-pg-reading-actions" });
      const at = acts.createEl("button", { text: "Open scene at the quote", cls: "czm-pg-reading-open" });
      if (!r.evidence) at.disabled = true;
      at.addEventListener("click", () => this.source.reveal(row.scene));
      const no = acts.createEl("button", { text: "Dismiss", cls: "czm-pg-reading-dismiss" });
      no.addEventListener("click", () => void this.dismissReading());
      if (r.kind === "check" && r.evidence && stop) {
        const anchor = acts.createEl("button", { text: "Anchor to it", cls: "czm-pg-reading-anchor mod-cta" });
        anchor.addEventListener("click", () => void this.writeCell(column, row, stop, stop.note, { role: stop.role, quote: r.evidence }));
      }
      box.createDiv({ text: stop ? "" : "Write the cell in your own words; the reading is the placeholder while you type.", cls: "czm-map-absent" });
    }
    const roles = column.heading.kind === "arc" ? [...THREAD_ROLES, ...ARC_ROLES] : THREAD_ROLES;
    const role = section.createDiv({ cls: "czm-pg-field" });
    role.createDiv({ text: "Role", cls: "czm-pg-field-label" });
    const roleSelect = role.createEl("select", { cls: "dropdown czm-pg-role-select", attr: { "aria-label": "Role" } });
    for (const r of roles) { const o = roleSelect.createEl("option", { text: r === "touch" ? "touch (no role)" : `${ROLE_GLYPH[r]} ${r}`.trim() }); o.value = r; if ((stop?.role ?? "touch") === r) o.selected = true; }
    const quote = section.createDiv({ cls: "czm-pg-field" });
    quote.createDiv({ text: "Anchor · a sentence in the scene", cls: "czm-pg-field-label" });
    const quoteRow = quote.createDiv({ cls: "czm-pg-new" });
    const quoteInput = quoteRow.createEl("input", { cls: "czm-pg-quote", attr: { type: "text", placeholder: "a few words quoted from the scene", "aria-label": "Anchor: a quote from the scene" } });
    quoteInput.value = stop?.quote ?? "";
    const pick = quoteRow.createEl("button", { text: "Pick…", cls: "czm-pg-new-add czm-pg-pick", attr: { title: "Pick a sentence of the scene (\")" } });
    pick.addEventListener("click", () => void this.openPicker());
    const key = `${row.scene.path}#${row.scene.title}`;
    if (this.picker?.key === key) {
      const ranked = rankSentences(this.picker.sentences, cell.state === "broken" ? stop?.quote ?? null : null);
      const list = quote.createDiv({ cls: "czm-pg-picker", attr: { role: "listbox", "aria-label": cell.state === "broken" ? "Sentences of the scene, near matches of the lost quote first" : "Sentences of the scene" } });
      if (!ranked.length) list.createDiv({ text: "No sentences here yet.", cls: "czm-map-absent" });
      ranked.slice(0, 40).forEach((r) => {
        const rowEl = list.createDiv({ cls: `czm-pg-picker-row${r.score >= 0.5 ? " is-near" : ""}`, attr: { role: "option", tabindex: "0", title: r.text } });
        rowEl.createSpan({ text: r.text, cls: "czm-pg-picker-text" });
        if (r.score > 0) rowEl.createSpan({ text: `${Math.round(r.score * 100)}%`, cls: "czm-map-row-meta" });
        const attach = () => { this.picker = null; void this.writeCell(column, row, stop, noteInput.value.trim() || stop?.note || "", { role: roleSelect.value as StopRole, quote: r.text.trim() }); };
        rowEl.addEventListener("click", attach);
        rowEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); attach(); }
          else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); this.picker = null; this.renderSide(); if (this.selection) this.cellEl(this.selection)?.focus(); }
          else if (ev.key === "ArrowDown") { ev.preventDefault(); (rowEl.nextElementSibling as HTMLElement | null)?.focus(); }
          else if (ev.key === "ArrowUp") { ev.preventDefault(); (rowEl.previousElementSibling as HTMLElement | null)?.focus(); }
        });
      });
    }
    const note = section.createDiv({ cls: "czm-pg-field" });
    note.createDiv({ text: "Note", cls: "czm-pg-field-label" });
    const noteInput = note.createEl("textarea", { cls: "czm-pg-note-field", attr: { rows: "2", placeholder: cell.reading && !stop ? cell.reading.text : "What the thread does here", "aria-label": "Note" } });
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
