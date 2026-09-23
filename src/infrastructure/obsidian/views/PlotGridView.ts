import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import { NO_GAUGE, type GaugePrefs, type PlotGridSettings, type StoryMapSettings } from "../../../domain/settings/Settings";
import { EMPTY_PLOT_GRID, GROUP_TOKEN, blockOf, blockOrder, type ColumnKind, type GridCell, type GridColumn, type GridRow, type PlotGrid, type SpecialColumn } from "../../../domain/plot/PlotGrid";
import type { Entity, SceneRef } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import { ARC_ROLES, THREAD_ROLES, type StopRole, type ThreadRef } from "../../../domain/threads/Thread";
import type { StopToAdd } from "../../../application/use-cases/EditStoryThread";
import { KIND_LABEL } from "./StoryMapView";
import { PanelShell, showOverflow, type MenuEntry, type PanelId } from "./PanelShell";
import { COLUMN_KINDS } from "../../../domain/threads/StoryThreadsNote";
import { rankSentences, type SnapshotTable } from "../../../domain/plot/Snapshot";
import type { AnalyzeProgress } from "../../../application/use-cases/AnalyzeSceneRelations";
import type { ProposalsResult } from "../../../application/use-cases/ProposeColumns";
import type { ColumnProposal } from "../../../domain/plot/Proposals";
import { StatusLine, couldNot } from "./StatusLine";
import { inField, onActivate } from "./keys";
import { insertAct, insertChapter, insertScene, moveHeading, removeHeading, renameHeading, setLogline } from "../../../domain/plot/Outline";
import { describeScaffold, type ScaffoldPlan, type ScaffoldShape } from "../../../domain/plot/Scaffold";
import type { ScaffoldResult } from "../../../application/use-cases/ScaffoldManuscript";
import type { ApplyResult } from "../../../application/use-cases/ApplyTemplate";
import type { ApplyChoices, ApplyPlan, StoryTemplate } from "../../../domain/plot/Templates";
import { findGaps, type Gap } from "../../../domain/plot/Gaps";
import { MAX_LANES, chargeOf, describeScaleProblem, disagreements, checkScale, gaugeLane, pipesOf, readScale, type Lane } from "../../../domain/plot/Gauge";

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
  setProjectKey(project: ProjectSpec, key: "plot-pov" | "plot-time" | "plot-theme" | "plot-beats" | "plot-order", value: string | null): Promise<void>;
  /** The grid's layout as the writer last left it, and where it is kept. */
  gridSettings(): PlotGridSettings;
  updateGridSettings(next: PlotGridSettings): void;
  /** The scene's prose as sentences, for the anchor picker. */
  sentences(project: ProjectSpec, scene: SceneRef): Promise<string[]>;
  /** Writes the grid as a dated table beside the project; resolves to the path written. */
  snapshot(project: ProjectSpec): Promise<string>;
  /** The same table as `Plot grid.md`, refreshed in place: for a print or a spreadsheet. */
  exportGrid(project: ProjectSpec): Promise<string>;
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
  /** Where the project's outline note is, or would be. */
  outlinePath(project: ProjectSpec): string;
  /** Read, change, write the outline note, creating it the first time; both texts come back so a row action can be undone exactly. */
  updateOutline(project: ProjectSpec, change: (markdown: string) => string): Promise<{ before: string; after: string }>;
  /** Points every stop at one scene link to another, after a planned scene is renamed. Resolves to how many lines changed. */
  relinkStops(project: ProjectSpec, from: string, to: string): Promise<number>;
  /** What Build the manuscript would write, for the sheet: nothing is touched. Null without an outline. */
  scaffoldPreview(project: ProjectSpec, shape: ScaffoldShape): Promise<ScaffoldPlan | null>;
  /** The build: notes written, stops relinked, the outline marked built. The result carries its undo. */
  scaffold(project: ProjectSpec, shape: ScaffoldShape): Promise<ScaffoldResult>;
  /** The templates on offer: the built-ins, then the writer's own from the templates folder. */
  templates(): Promise<readonly StoryTemplate[]>;
  /** What applying a template with these choices would write; nothing is touched. */
  planTemplate(project: ProjectSpec, template: StoryTemplate, choices: ApplyChoices, cast: readonly { name: string; kind: string; path: string | null }[]): Promise<ApplyPlan>;
  /** Writes the plan: headings to the threads note, structure to the outline, jobs to the project note. The result carries its undo. */
  applyTemplate(project: ProjectSpec, plan: ApplyPlan): Promise<ApplyResult>;
  /** The grid as it stands saved as a template note; resolves to the path written. */
  saveTemplate(project: ProjectSpec, name: string, parts: { columns: boolean; rows: boolean }): Promise<string>;
  templatesFolder(): string;
  /** The project's dated snapshots, newest first, as the tabs list them. */
  snapshots(project: ProjectSpec): Promise<readonly { path: string; day: string; label: string }[]>;
  /** A snapshot note read back as its table. */
  readSnapshot(path: string): Promise<SnapshotTable>;
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

/** One stretch of the header: a single column with a job, an open group of columns, or a folded group drawn as one narrow cell. */
interface Segment { readonly kind: ColumnKind; readonly block: string; readonly single: GridColumn | null; readonly columns: GridColumn[]; readonly folded: boolean }

export type PlotGridAction = "clear-search" | "toggle-cast" | "open-note" | "toggle-panel" | "new-column" | "new-scene" | "new-chapter" | "new-act" | "open-outline" | "build-manuscript" | "start-template" | "save-template" | "fold-arcs" | "fold-themes" | "fold-subplots" | "fold-threads" | "hide-column" | "show-hidden" | "focus-search" | "help" | "toggle-unmoved" | "audit" | "snapshot" | "next-issue" | "previous-issue" | "anchor" | "read-column" | "check-column" | "read-all" | "dismiss-reading" | "stop-reading" | "propose-columns" | "export" | "toggle-gauge" | "gauge-column";

/** Rows are drawn this many at a time; past the first chunk, the next is drawn as the last row comes into view. */
export const ROW_CHUNK = 60;

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

const SPECIAL_LABEL: Record<SpecialColumn, string> = { pov: "POV", time: "Time", "main-theme": "Main theme", beats: "Plot point" };
const SPECIAL_KEY: Record<SpecialColumn, "plot-pov" | "plot-time" | "plot-theme" | "plot-beats"> = { pov: "plot-pov", time: "plot-time", "main-theme": "plot-theme", beats: "plot-beats" };
/** The jobs drawn in the derived block after Plot, rather than among the kinds. */
const DERIVED: readonly (SpecialColumn | null)[] = ["time", "pov", "beats"];

const SVG_NS = "http://www.w3.org/2000/svg";
/** A gauge lane's width, its centreline, and the pitch of its pipes: one step of the scale is one pipe, and the line shares the unit. */
export const LANE_W = 140, LANE_CX = 70, LANE_STEP = 8, PIPE_W = 4, PIPE_H = 14;

/** An SVG element with its attributes, since the gauge is drawn in the row rather than laid over it. */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** A total as the gauge labels it: a sign on every non-zero number, the minus a real minus. */
export function signed(n: number): string { return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0"; }

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
  /** The build sheet: the shape chosen and what that shape would write, until it is built or put away. */
  private sheet: { shape: ScaffoldShape; plan: ScaffoldPlan | null; loading: boolean } | null = null;
  /** The template sheet: the templates on offer, the one chosen, the writer's choices about it, and what they would write. */
  private templateSheet: { list: readonly StoryTemplate[]; chosen: number; choices: { rows: boolean; columns: boolean; ticked: Set<string>; names: Record<string, string>; bindings: Record<string, string> }; plan: ApplyPlan | null; loading: boolean } | null = null;
  /** The save sheet: a name for the template and which parts of the grid go into it. */
  private saveSheet: { name: string; columns: boolean; rows: boolean } | null = null;
  /** What the grid can count for itself: thin columns and unmoved stretches, over the written scenes. */
  private gaps: readonly Gap[] = [];
  /** The templates, fetched once for the column picker; null until asked for. */
  private templateList: readonly StoryTemplate[] | null = null;
  /** The block being dragged by its header: a single column with a job, or a whole kind group. */
  private dragging: string | null = null;
  /** The snapshots the tabs offer, and which one is open: null is the grid itself. */
  private snapshots: readonly { path: string; day: string; label: string }[] = [];
  private tab: string | null = null;
  private snapshotTable: SnapshotTable | null = null;
  /** How many rows are in the table so far, and what draws the next chunk. */
  private drawn = 0;
  private drawMore: ((upTo?: number) => void) | null = null;
  private sentinel: IntersectionObserver | null = null;
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
  /** The gauge's lanes as drawn at the right edge, in the grid's order; empty while the gauge is off. */
  private lanes: readonly Lane[] = [];
  /** Row positions where the first lane and another carry opposite signs. */
  private disagree: ReadonlySet<number> = new Set();

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
  /** The heading of the last column frozen beside Scene and Plot in this project, or null for the two alone. */
  private get frozenHeading(): string | null { return this.project ? this.settings.frozen[this.project.scope] ?? null : null; }
  private setFrozen(heading: string | null): void {
    if (!this.project) return;
    const frozen = { ...this.settings.frozen };
    if (heading) frozen[this.project.scope] = heading; else delete frozen[this.project.scope];
    this.save({ frozen });
  }

  /** The gauge as the writer left it in this project. */
  private get gaugePrefs(): GaugePrefs { return this.project ? this.settings.gauge[this.project.scope] ?? NO_GAUGE : NO_GAUGE; }
  private setGauge(next: Partial<GaugePrefs>): void {
    if (!this.project) return;
    this.save({ gauge: { ...this.settings.gauge, [this.project.scope]: { ...this.gaugePrefs, ...next } } });
  }

  getViewType(): string { return PLOT_GRID_VIEW_TYPE; }
  getDisplayText(): string { return "Plot grid"; }
  getIcon(): string { return "table"; }

  async onOpen(): Promise<void> {
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async show(project: ProjectSpec | null, keepStatus = false): Promise<void> {
    const generation = ++this.generation;
    // The spec is read again by scope, so a key just written to the project note (a job given to a column) is seen on the next draw.
    const fresh = project ? this.source.projects().find((p) => p.scope === project.scope) ?? project : null;
    this.project = fresh;
    if (!fresh) { this.grid = EMPTY_PLOT_GRID; this.render(); return; }
    const [grid, snapshots] = await Promise.all([this.source.build(fresh), this.source.snapshots(fresh).catch(() => [])]);
    if (generation !== this.generation) return;
    this.grid = grid;
    this.snapshots = snapshots;
    if (this.tab && !snapshots.some((s) => s.path === this.tab)) { this.tab = null; this.snapshotTable = null; }
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
      { label: "New scene", icon: "file-plus", command: "plot-grid-new-scene", disabled: !this.project || !!this.grid.plan?.outline.built, onClick: () => this.run("new-scene") },
      { label: "New chapter", command: "plot-grid-new-chapter", disabled: !this.project || !!this.grid.plan?.outline.built, onClick: () => this.run("new-chapter") },
      { label: "New act", command: "plot-grid-new-act", disabled: !this.project || !!this.grid.plan?.outline.built, onClick: () => this.run("new-act") },
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
      { label: "Show gauge", icon: "activity", command: "plot-grid-toggle-gauge", checked: this.gaugePrefs.shown, disabled: !this.project, onClick: () => this.run("toggle-gauge") },
      { label: "Next broken anchor", command: "plot-grid-next-issue", disabled: this.grid.broken === 0, onClick: () => this.run("next-issue") },
      { label: "Start from a template…", icon: "layout-template", command: "plot-grid-start-template", disabled: !this.project, onClick: () => this.run("start-template") },
      { label: "Save as template…", command: "plot-grid-save-template", disabled: !this.project || (this.grid.columns.length === 0 && !this.grid.plan), onClick: () => this.run("save-template") },
      { label: "Build the manuscript…", icon: "folder-plus", command: "plot-grid-build-manuscript", disabled: !this.grid.plan, onClick: () => this.run("build-manuscript") },
      { label: "Snapshot the grid", icon: "camera", command: "plot-grid-snapshot", disabled: !this.project, onClick: () => this.run("snapshot") },
      { label: "Export the grid to a note", icon: "file-output", command: "plot-grid-export", disabled: !this.project, onClick: () => this.run("export") },
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
      { label: "Open Outline.md", command: "plot-grid-open-outline", disabled: !this.grid.plan, onClick: () => this.run("open-outline") },
      "-",
      { label: "Clear the search", icon: "x", command: "story-timeline-clear-search", disabled: !this.query.trim(), onClick: () => this.run("clear-search") },
    ];
  }

  /** Opens the side column and the section an action is about to use, and puts the focus where it asks. */
  private openSide(section: string, focus?: string): void {
    this.save({ panelOpen: true });
    this.shell?.setSideOpen(true);
    this.renderSide();
    this.shell?.reveal(section);
    if (focus) this.shell?.side.querySelector<HTMLElement>(focus)?.focus();
  }

  /** The head's actions, as the commands and the ⋯ menu reach them. */
  run(action: PlotGridAction): void {
    const fold = (kind: ColumnKind) => { this.save({ folded: { ...this.settings.folded, [kind]: !this.settings.folded[kind] } }); this.renderTable(); };
    switch (action) {
      case "clear-search": this.clearSearch(); break;
      case "toggle-cast": this.save({ castExpanded: !this.castExpanded }); this.renderTable(); break;
      case "open-note": if (this.project) this.source.openNote(this.source.threadsNotePath(this.project)); break;
      case "open-outline": if (this.project && this.grid.plan) this.source.openNote(this.grid.plan.path); break;
      case "new-scene": void this.newScene(null); break;
      case "new-chapter": void this.newChapter(null); break;
      case "new-act": void this.newAct(); break;
      case "build-manuscript": void this.openBuildSheet(); break;
      case "start-template": void this.openTemplateSheet(); break;
      case "save-template": this.saveSheet = { name: this.project?.name ?? "", columns: this.grid.columns.length > 0, rows: !!this.grid.plan && !this.grid.plan.outline.built }; this.openSide("pg-save-template", ".czm-pg-save-name"); break;
      case "toggle-panel": this.save({ panelOpen: !this.panelOpen }); this.shell?.setSideOpen(this.panelOpen); break;
      case "new-column": this.openSide("pg-columns", ".czm-pg-new-name"); break;
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
      case "export": void this.snapshot(false); break;
      case "next-issue": this.walk(1); break;
      case "previous-issue": this.walk(-1); break;
      case "anchor": void this.openPicker(); break;
      case "read-column": { const c = this.current(); if (c) void this.readColumns([c], "reading"); break; }
      case "check-column": { const c = this.current(); if (c) void this.readColumns([c], "checking"); break; }
      case "read-all": void this.readColumns(this.grid.columns.filter((c) => !DERIVED.includes(c.special)), "reading"); break;
      case "dismiss-reading": void this.dismissReading(); break;
      case "stop-reading": this.running?.controller.abort(); break;
      case "propose-columns": void this.proposeColumns(); break;
      case "toggle-gauge": { const on = !this.gaugePrefs.shown; this.setGauge({ shown: on }); this.renderTable(); this.status?.say(on ? (this.lanes.length ? `Gauge on: ${this.lanes.map((l) => l.column.heading.name).join(", ")}.` : "Gauge on, but no column has a scale yet: Set scale… in a column's menu grades its stops.") : "Gauge off."); break; }
      case "gauge-column": { const c = this.current(); if (c) this.gaugeColumn(c); break; }
    }
  }

  /** Ticks or unticks a graded column as a lane of the gauge, turning the gauge on with the first tick. */
  private gaugeColumn(c: GridColumn): void {
    if (!c.scale) { this.status?.fail(`“${c.heading.name}” has no scale yet: Set scale… in its menu grades its stops.`); return; }
    const problem = checkScale(c.scale);
    if (problem) { this.status?.fail(`“${c.heading.name}” cannot be gauged: ${describeScaleProblem(problem)}. Edit the scale line under its heading.`); return; }
    const on = this.laneHeadings().includes(c.heading.heading);
    const lanes = on ? this.laneHeadings().filter((h) => h !== c.heading.heading) : [...this.laneHeadings(), c.heading.heading];
    if (!on && lanes.length > MAX_LANES) { this.status?.fail(`The gauge draws ${MAX_LANES} lanes at most: untick one in the Gauge section first.`); return; }
    this.setGauge({ lanes, shown: true });
    this.renderTable();
    this.status?.say(on ? `“${c.heading.name}” taken off the gauge.` : `“${c.heading.name}” gauged.`);
  }

  /** The columns ticked as lanes: what the settings say, or the main theme (else the first graded column) when nothing is ticked. */
  private laneHeadings(): string[] {
    const graded = this.grid.columns.filter((c) => c.scale && !checkScale(c.scale));
    const ticked = this.gaugePrefs.lanes.filter((h) => graded.some((c) => c.heading.heading === h));
    if (ticked.length) return ticked;
    const first = graded.find((c) => c.special === "main-theme") ?? graded.find((c) => c.heading.kind === "theme") ?? graded[0];
    return first ? [first.heading.heading] : [];
  }

  /** The lanes drawn: the ticked columns in the grid's order, at most three, each read down the rows as shown. */
  private lanesFor(rows: readonly GridRow[]): Lane[] {
    if (!this.gaugePrefs.shown) return [];
    const headings = this.laneHeadings();
    return this.grid.columns.filter((c) => headings.includes(c.heading.heading)).slice(0, MAX_LANES).map((c) => gaugeLane(c, rows)).filter((l): l is Lane => l !== null);
  }

  /** The state line's word on the gauge: how much is charged, where the total flips, and where two lanes disagree. */
  private gaugeSummary(rows: readonly GridRow[]): string {
    const first = this.lanes[0];
    if (!first) return "";
    const at = (l: Lane) => l.inversions.map((p) => `${p + 1} ${rows[p]?.scene.title || basenameOf(rows[p]?.scene.path ?? "")}`).join(", ");
    const parts = [`gauge: ${first.charged} of ${rows.length} charged${first.unread ? ` · ${first.unread} unread` : ""}`, first.inversions.length ? `${plural(first.inversions.length, "inversion")} at ${at(first)}` : "no inversion"];
    if (this.lanes.length > 1) parts.push(`${this.lanes.length} lanes · ${plural(this.disagree.size, "disagreement")}`);
    return parts.join(" · ");
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
      if (result.canRead) this.status?.action("Nothing to propose from yet: no scene has been read for its events.", "Read the project", () => void this.readProject());
      else this.status?.fail("Nothing to propose from yet: no scene has prose to read, and no planned scene has a logline. Write a line in the Plot column of a few rows, then ask again.");
      return;
    }
    this.proposals = { list: [...result.proposals], picked: new Set(result.proposals.filter((p) => !p.existing).map((p) => p.heading)) };
    this.openSide("pg-proposals");
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

  private async snapshot(dated = true): Promise<void> {
    const project = this.project;
    if (!project) return;
    let path: string;
    try { path = dated ? await this.source.snapshot(project) : await this.source.exportGrid(project); } catch (e) { this.status?.fail(couldNot(dated ? "write the snapshot" : "export the grid", e)); return; }
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
    this.openSide("pg-cell");
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
    this.lanes = []; this.disagree = new Set();
    this.renderTabs(root);
    if (this.tab) { this.renderSnapshot(root); return; }
    // The project note is the container, not a scene of the story.
    const notePath = this.project.notePath;
    const rows = grid.rows.filter((r) => r.scene.path !== notePath);
    this.rows = rows;
    this.lanes = this.lanesFor(rows);
    this.disagree = new Set(this.lanes.slice(1).flatMap((l) => disagreements(this.lanes[0]!, l)));
    const q = this.query.trim().toLowerCase();
    const settings = this.source.settings();
    const hidden = new Set(this.hidden.map((h) => h.toLowerCase()));
    const folded = this.settings.folded;
    const visible = grid.columns
      .filter((c) => !hidden.has(c.heading.heading.toLowerCase()))
      .filter((c) => !q || c.heading.name.toLowerCase().includes(q) || c.heading.heading.toLowerCase().includes(q));
    const columns = visible.filter((c) => DERIVED.includes(c.special) || !folded[c.heading.kind]);
    this.shown = columns;
    // The header walks blocks: a single column with a job, an open group spanning its columns, or a folded group as one narrow cell.
    const segments: Segment[] = [];
    for (const c of visible) {
      const block = blockOf(c);
      const last = segments.at(-1);
      if (DERIVED.includes(c.special)) { segments.push({ kind: c.heading.kind, block, single: c, columns: [c], folded: false }); continue; }
      if (last && last.block === block && !last.single) { last.columns.push(c); continue; }
      segments.push({ kind: c.heading.kind, block, single: null, columns: [c], folded: folded[c.heading.kind] });
    }
    if (this.selection && (this.selection.col >= columns.length || this.selection.row >= rows.length)) this.selection = null;
    if (this.column !== null && this.column >= columns.length) this.column = null;
    const cast = grid.cast
      .filter((e) => settings.kinds[e.kind])
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)));
    const unknown = grid.unknownPrefixes.length ? ` · ${grid.unknownPrefixes.length} heading${grid.unknownPrefixes.length === 1 ? "" : "s"} not read as a kind (${grid.unknownPrefixes.map((p) => `${p}:`).join(", ")})` : "";
    const hid = this.hidden.length ? ` · ${this.hidden.length} hidden` : "";
    const awaiting = grid.readings ? ` · ${plural(grid.readings, "reading")} awaiting you` : "";
    this.gaps = findGaps(grid);
    const gapsLine = this.gaps.length ? ` · ${plural(this.gaps.length, "gap")}` : "";
    const gaugeLine = this.lanes.length ? ` · ${this.gaugeSummary(rows)}` : "";
    root.classList.toggle("is-audit", this.audit);
    const foldedGroups = segments.filter((sg) => sg.folded);
    const foldedLine = foldedGroups.length ? ` · ${foldedGroups.reduce((n, sg) => n + sg.columns.length, 0)} in ${plural(foldedGroups.length, "folded group")}` : "";
    const auditLine = this.audit ? `${plural(grid.cells, "cell")} · ${grid.filled} filled · ${grid.verified} verified · ${grid.broken} broken` : `${rows.length} scene${rows.length === 1 ? "" : "s"} · ${plural(columns.length, "column")}${foldedLine} · ${cast.length} in the cast`;
    shell.setState(`${auditLine}${awaiting}${gapsLine}${gaugeLine}${hid}${q ? ` · “${this.query.trim()}”` : ""}${unknown}`, q ? { label: "Clear", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } } : this.hidden.length ? { label: "Show hidden", cls: "czm-pg-show-hidden", onClick: () => this.run("show-hidden") } : null);
    this.renderSide();
    if (rows.length === 0) {
      const plan = grid.plan;
      shell.empty(plan?.outline.built ? `The outline was built on ${plan.outline.built}, and no chapter note has a heading yet — write one, or start a new outline.` : "No scenes yet — a row is a scene. Start the outline here, and the grid writes it to Outline.md until you build the chapters; start from a shape someone has already worked out; or write headings in a chapter note.", [
        { label: "New scene", cls: "czm-pg-fix-scene", onClick: () => this.run("new-scene") },
        { label: "Start from a template…", cls: "czm-pg-fix-template", onClick: () => this.run("start-template") },
        ...(plan ? [{ label: "Open Outline.md", cls: "czm-pg-fix-outline", onClick: () => this.run("open-outline") }] : []),
      ]);
      return;
    }
    this.renderKey(cast);
    if (columns.length === 0 && grid.columns.length === 0) {
      shell.empty("No columns yet. Name one — Arc: [[Anna]], Theme: what we owe the dead, Subplot: the letter — or let the model propose some from the events it has read.", [{ label: "New column", cls: "czm-pg-fix-new", onClick: () => this.run("new-column") }, { label: "Propose columns…", cls: "czm-pg-fix-propose", onClick: () => this.run("propose-columns") }, { label: "Open Story threads.md", cls: "czm-pg-fix-note", onClick: () => this.run("open-note") }]);
    } else if (columns.length === 0 && cast.length === 0) {
      shell.empty(`Nothing matches “${this.query.trim()}”.`, [{ label: "Clear search", cls: "czm-pg-clear", onClick: () => { this.clearSearch(); } }]);
    }
    this.renderEyebrow(root, grid, cast.length);
    const wrap = root.createDiv({ cls: "czm-pg-wrap" });
    const table = wrap.createEl("table", { cls: "czm-pg-table", attr: { "aria-label": "Plot grid" } });
    const theadEl = table.createEl("thead");
    const thead = theadEl.createEl("tr");
    // Scene and Plot stay put while the threads scroll; the writer can freeze further, up to a column of their choosing.
    const frozenUpTo = this.frozenHeading ? columns.findIndex((c) => c.heading.heading === this.frozenHeading) : -1;
    const frozenCount = 2 + frozenUpTo + 1;
    // Over the columns: one cell per block, with the group's name, its count and a caret; a folded group is one narrow cell with the name written down it.
    const groups = theadEl.createEl("tr", { cls: "czm-pg-groups" });
    theadEl.prepend(groups);
    groups.createEl("th", { cls: "czm-pg-corner czm-pg-group-corner is-frozen", attr: { colspan: "2", "data-fcol": "0" } });
    for (const seg of segments) {
      const th = groups.createEl("th", { cls: `czm-pg-group czm-pg-group-${seg.single ? "single" : seg.kind}${seg.folded ? " is-folded" : ""}`, attr: { colspan: String(seg.folded ? 1 : seg.columns.length), scope: "colgroup" } });
      if (seg.single) { th.createSpan({ text: SPECIAL_LABEL[seg.single.special!], cls: "czm-pg-group-title" }); continue; }
      const btn = th.createEl("button", { cls: "czm-pg-group-toggle", attr: { "aria-expanded": String(!seg.folded), "aria-label": `${KIND_GROUP[seg.kind]}: ${seg.columns.length}, ${seg.folded ? "folded, click to show" : "shown, click to fold"}`, title: seg.folded ? `${KIND_GROUP[seg.kind]}: ${seg.columns.map((c) => c.heading.name).join(", ")}` : `Fold the ${KIND_GROUP[seg.kind].toLowerCase()}` } });
      const caret = btn.createSpan({ cls: "czm-pg-group-caret" });
      setIcon(caret, seg.folded ? "chevron-right" : "chevron-down");
      // Folded, the cell is as narrow as the column under it: the caret alone, the name written down the column header below.
      if (!seg.folded) {
        btn.createSpan({ text: KIND_GROUP[seg.kind], cls: "czm-pg-group-title" });
        btn.createSpan({ text: String(seg.columns.length), cls: "czm-pg-group-count" });
      }
      btn.addEventListener("click", () => this.run(seg.kind === "arc" ? "fold-arcs" : seg.kind === "theme" ? "fold-themes" : seg.kind === "subplot" ? "fold-subplots" : "fold-threads"));
    }
    const castGroup = groups.createEl("th", { cls: `czm-pg-group czm-pg-group-cast${this.castExpanded ? "" : " is-folded"}`, attr: { colspan: String(this.castExpanded ? Math.max(1, cast.length) : 1), scope: "colgroup" } });
    const castToggle = castGroup.createEl("button", { cls: "czm-pg-group-toggle czm-pg-cast-toggle", attr: { "aria-expanded": String(this.castExpanded), "aria-label": `Cast: ${cast.length}, ${this.castExpanded ? "one column per name, click to fold" : "folded into one column, click to expand"}`, title: this.castExpanded ? "Fold the cast into one column of dots" : `Cast: ${cast.map((e) => e.name).join(", ")}. Click to expand into one column per name` } });
    const castCaret = castToggle.createSpan({ cls: "czm-pg-group-caret" });
    setIcon(castCaret, this.castExpanded ? "chevron-down" : "chevron-right");
    // Folded, the caret alone, as every folded group: the name is written down the column header under it.
    if (this.castExpanded) {
      castToggle.createSpan({ text: "Cast", cls: "czm-pg-group-title" });
      castToggle.createSpan({ text: String(cast.length), cls: "czm-pg-group-count" });
    }
    castToggle.addEventListener("click", () => this.run("toggle-cast"));
    groups.createEl("th", { cls: "czm-pg-filler" });
    if (this.lanes.length) groups.createEl("th", { cls: "czm-pg-group czm-pg-group-gauge", attr: { colspan: String(this.lanes.length), scope: "colgroup" } }).createSpan({ text: "Gauge", cls: "czm-pg-group-title" });
    const corner = thead.createEl("th", { cls: `czm-pg-corner is-frozen${frozenCount === 1 ? " is-frozen-edge" : ""}`, attr: { scope: "col", "data-fcol": "0" } });
    corner.createSpan({ text: "Scene" });
    corner.createSpan({ text: "words under the name", cls: "czm-pg-corner-hint" });
    thead.createEl("th", { text: "Plot", cls: `czm-pg-col czm-pg-col-plot is-frozen${frozenCount === 2 ? " is-frozen-edge" : ""}`, attr: { scope: "col", "data-fcol": "1", title: "The model's events for the scene, from Story map.md; a planned scene's logline" } });
    let lastGroup = "";
    const headerOf = (c: GridColumn, col: number) => {
      const group = DERIVED.includes(c.special) ? "derived" : c.heading.kind;
      const frozen = col <= frozenUpTo;
      const block = blockOf(c);
      const th = thead.createEl("th", { cls: `czm-pg-col czm-pg-col-thread czm-pg-kind-${c.heading.kind}${c.special ? ` czm-pg-special-${c.special}` : ""}${group !== lastGroup ? " is-group-start" : ""}${this.column === col ? " is-current" : ""}${frozen ? " is-frozen" : ""}${col === frozenUpTo ? " is-frozen-edge" : ""}`, attr: { scope: "col", draggable: "true", "data-block": block, title: `${c.heading.name} — ${c.special ? SPECIAL_LABEL[c.special] : KIND_GROUP[c.heading.kind]}, ${c.filled} of ${rows.length} scenes. Drag to move ${DERIVED.includes(c.special) ? "this column" : `the ${KIND_GROUP[c.heading.kind].toLowerCase()} together`}`, ...(frozen ? { "data-fcol": String(2 + col) } : {}) } });
      this.dragHandlers(th, block);
      lastGroup = group;
      return th;
    };
    const headers = new Map<GridColumn, HTMLElement>();
    for (const seg of segments) {
      if (seg.folded) {
        // The folded group's own cell: the name written down it, a line the body continues to the last scene.
        const th = thead.createEl("th", { cls: `czm-pg-col czm-pg-fold czm-pg-kind-${seg.kind}`, attr: { scope: "col", title: `${KIND_GROUP[seg.kind]}: ${seg.columns.map((c) => c.heading.name).join(", ")}. Click the caret above to show them.` } });
        th.createSpan({ text: `${KIND_GROUP[seg.kind]} · ${seg.columns.length}`, cls: "czm-pg-fold-name", attr: { "aria-hidden": "true" } });
        continue;
      }
      for (const c of seg.columns) headers.set(c, headerOf(c, columns.indexOf(c)));
    }
    columns.forEach((c, col) => {
      const th = headers.get(c)!;
      const name = th.createDiv({ cls: "czm-pg-col-name", attr: { role: "button", tabindex: "0", "aria-label": `${c.heading.name}: select the column` } });
      if (c.entity) { const dot = name.createSpan({ cls: "czm-pg-dot", attr: { "aria-label": KIND_LABEL[c.entity.kind] } }); dot.setCssProps({ "--czm-kind": settings.colors[c.entity.kind] }); }
      name.createSpan({ text: c.heading.name, cls: "czm-pg-col-title" });
      onActivate(name, () => this.pickColumn(col));
      name.addEventListener("dblclick", (ev) => { ev.preventDefault(); this.renameColumnInPlace(c); });
      const sub = th.createDiv({ cls: "czm-pg-col-sub" });
      const audit = this.audit ? ` · ${c.verified} ${STATE_GLYPH.verified}${c.broken ? ` · ${c.broken} ${STATE_GLYPH.broken}` : ""}` : "";
      sub.createSpan({ text: `${c.special ? `${SPECIAL_LABEL[c.special].toLowerCase()} · ` : ""}${c.filled} of ${rows.length}${audit}`, cls: "czm-pg-col-count" });
      const more = sub.createEl("button", { cls: "clickable-icon czm-pg-col-more", attr: { "aria-label": `${c.heading.name}: column menu`, "aria-haspopup": "menu" } });
      setIcon(more, "more-horizontal");
      more.addEventListener("click", (ev) => { ev.stopPropagation(); this.pickColumn(col, false); showOverflow(ev, this.columnMenu(c)); });
      th.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.pickColumn(col, false); showOverflow(ev, this.columnMenu(c)); });
    });
    // The cast's column headers: one per name when expanded, as the threads have one per column; folded, one quiet cell over the dots.
    if (this.castExpanded && cast.length) {
      for (const e of cast) {
        const th = thead.createEl("th", { cls: "czm-pg-col czm-pg-cast-name", attr: { scope: "col", title: `${e.name} — ${KIND_LABEL[e.kind]}, ${plural(e.appearances.length, "scene")}` } });
        th.setCssProps({ "--czm-kind": settings.colors[e.kind] });
        const span = th.createSpan({ text: e.name });
        if (e.path) { span.addClass("is-link"); onActivate(span, () => this.source.openNote(e.path!)); }
      }
    } else {
      const th = thead.createEl("th", { cls: "czm-pg-col czm-pg-col-cast czm-pg-fold czm-pg-fold-cast", attr: { scope: "col", title: `Cast: ${cast.map((e) => e.name).join(", ")}. Click the caret above to expand.` } });
      th.createSpan({ text: `Cast · ${cast.length}`, cls: "czm-pg-fold-name", attr: { "aria-hidden": "true" } });
    }
    // A filler column takes the slack, so the columns stay close together however wide the pane.
    thead.createEl("th", { cls: "czm-pg-filler" });
    for (const lane of this.lanes) this.renderGaugeHead(thead, lane, rows.length);
    const tbody = table.createEl("tbody");
    const span = 2 + columns.length + segments.filter((sg) => sg.folded).length + (this.castExpanded ? Math.max(1, cast.length) : 1) + 1;
    const scope = this.project.scope;
    let lastChapter = "", lastAct = "";
    this.drawn = 0;
    this.sentinel?.disconnect(); this.sentinel = null;
    // A long manuscript is drawn a chunk at a time: the first sixty rows now, the next sixty as the last one scrolls into view.
    const draw = (upTo: number) => {
      for (let i = this.drawn; i < Math.min(upTo, rows.length); i++) {
        const row = rows[i]!;
        // A row from a chapter note takes its chapter from the note and its act from the folder; a planned row carries both from the outline.
        const group = row.group;
        const act = group ? (group.act ? `${row.scene.path}#act${group.actLine}` : "") : actOf(row.scene.path, scope);
        if (act !== lastAct) {
          lastAct = act;
          if (act) {
            const actTr = tbody.createEl("tr", { cls: `czm-pg-act${group ? " is-outline" : ""}` });
            const th = actTr.createEl("th", { attr: { colspan: String(span), scope: "rowgroup" } });
            th.createSpan({ text: group ? group.act : act, cls: group ? "is-link czm-pg-group-name" : "" });
            if (group) { th.createSpan({ text: "outline · no folder yet", cls: "czm-pg-note-total" }); this.groupControls(th, row, "act"); }
            for (const lane of this.lanes) this.renderGaugePass(actTr, lane, i);
          }
        }
        const chapterKey = group ? `${row.scene.path}#chapter${group.chapterLine}` : row.scene.path;
        if (chapterKey !== lastChapter) {
          lastChapter = chapterKey;
          const tr = tbody.createEl("tr", { cls: `czm-pg-note${group ? " is-outline" : ""}` });
          const th = tr.createEl("th", { attr: { colspan: String(span), scope: "rowgroup" } });
          const link = th.createSpan({ text: group ? group.chapter || "(no chapter)" : basenameOf(row.scene.path), cls: "is-link czm-pg-group-name" });
          onActivate(link, () => { if (group) this.source.reveal({ path: row.scene.path, title: group.chapter, line: Math.max(0, group.chapterLine) }); else this.source.openNote(row.scene.path); });
          // The one structural question the row can answer: how much of the book, and how much of the cast, this chapter holds.
          const chapter = rows.filter((r) => (r.group ? `${r.scene.path}#chapter${r.group.chapterLine}` : r.scene.path) === chapterKey);
          const words = chapter.reduce((n, r) => n + r.words, 0);
          const names = new Set(chapter.flatMap((r) => r.present).filter((id) => cast.some((c) => c.id === id))).size;
          th.createSpan({ text: group ? `${plural(chapter.length, "scene")} · outline · no note yet` : `${plural(chapter.length, "scene")} · ${words.toLocaleString()} words · ${names} of the cast`, cls: "czm-pg-note-total" });
          if (group) this.groupControls(th, row, "chapter");
          for (const lane of this.lanes) this.renderGaugePass(tr, lane, i);
        }
        this.renderRow(tbody, row, columns, cast, settings, frozenUpTo, segments);
        this.drawn = i + 1;
      }
      this.applyFreeze(wrap, table, frozenCount);
      this.sentinel?.disconnect(); this.sentinel = null;
      const last = tbody.lastElementChild;
      if (this.drawn < rows.length && last && typeof IntersectionObserver !== "undefined") {
        this.sentinel = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) draw(this.drawn + ROW_CHUNK); }, { root: wrap });
        this.sentinel.observe(last);
      }
    };
    this.drawMore = (upTo?: number) => draw(upTo ?? this.drawn + ROW_CHUNK);
    draw(rows.length > ROW_CHUNK + 20 ? ROW_CHUNK : rows.length);
  }

  /** Draws the rows up to and including one that is not on the table yet, so a selection or a walk can land on it. */
  private ensureRow(row: number): void {
    if (row >= this.drawn && this.drawMore) this.drawMore(row + 1);
  }

  /**
   * Frozen columns are sticky, each offset by the width of the ones before it, measured from the header once the table is
   * drawn. A freeze that would take more than three fifths of the pane stops at the last column that fits, so the threads
   * always have room to scroll.
   */
  private applyFreeze(wrap: HTMLElement, table: HTMLElement, frozenCount: number): void {
    const heads = [...table.querySelectorAll<HTMLElement>("thead tr:not(.czm-pg-groups) th[data-fcol]")].sort((a, b) => Number(a.dataset.fcol) - Number(b.dataset.fcol));
    const limit = wrap.clientWidth ? wrap.clientWidth * 0.6 : Number.POSITIVE_INFINITY;
    let left = 0, kept = 0;
    const lefts = new Map<string, number>();
    for (const th of heads) {
      const width = th.getBoundingClientRect().width;
      if (kept >= 2 && left + width > limit) break;
      lefts.set(th.dataset.fcol!, left);
      left += width;
      kept++;
    }
    for (const cell of table.querySelectorAll<HTMLElement>("[data-fcol]")) {
      const at = lefts.get(cell.dataset.fcol!);
      if (at === undefined) { cell.classList.remove("is-frozen", "is-frozen-edge"); continue; }
      cell.setCssStyles({ left: `${at}px` });
      cell.classList.toggle("is-frozen-edge", Number(cell.dataset.fcol) === kept - 1);
    }
    if (kept < frozenCount) this.status?.say(`Frozen up to ${kept - 2 >= 0 && this.shown[kept - 2] ? `“${this.shown[kept - 2]!.heading.name}”` : "Plot"}: the pane is too narrow to freeze further.`);
  }

  private renderRow(tbody: HTMLElement, row: GridRow, columns: readonly GridColumn[], cast: readonly Entity[], settings: StoryMapSettings, frozenUpTo = -1, segments: readonly Segment[] | null = null): void {
    const rowIndex = this.rows.indexOf(row);
    const tr = tbody.createEl("tr", { cls: `czm-pg-scene${row.outline ? " is-outline" : ""}`, attr: { "data-row": String(rowIndex) } });
    const th = tr.createEl("th", { cls: `czm-pg-scene-head is-frozen${row.pov ? " has-pov" : ""}${frozenUpTo < 0 ? "" : ""}`, attr: { role: "button", tabindex: "0", scope: "row", "data-fcol": "0" } });
    // A 3px chip in the POV character's colour rides the sticky column, so the eye's owner survives sideways scrolling.
    if (row.pov) { th.setCssProps({ "--czm-pov": row.pov.entity ? settings.colors[row.pov.entity.kind] : "var(--text-faint)" }); th.title = `POV: ${row.pov.name}`; }
    th.createSpan({ text: `${row.bookmarked ? "★ " : ""}${row.scene.title || "(opening)"}`, cls: "czm-map-row-name" });
    if (this.disagree.has(rowIndex)) th.createSpan({ text: "≠", cls: "czm-pg-disagree", attr: { title: `The lanes disagree here: ${this.lanes.map((l) => `${l.column.heading.name} ${signed(l.rows[rowIndex]?.charge ?? 0)}`).join(", ")}` } });
    if (row.outline) th.createSpan({ text: "outline", cls: "czm-map-row-meta", attr: { title: row.group ? "A scene planned in Outline.md, not written: build the manuscript to make it a heading in a chapter note" : "A heading with no prose yet: a scene planned, not written" } });
    onActivate(th, () => this.source.reveal(row.scene));
    if (row.group) {
      const more = th.createEl("button", { cls: "clickable-icon czm-pg-row-more", attr: { "aria-label": `${row.scene.title}: row menu`, "aria-haspopup": "menu" } });
      setIcon(more, "more-horizontal");
      more.addEventListener("click", (ev) => { ev.stopPropagation(); showOverflow(ev, this.rowMenu(row)); });
      th.addEventListener("contextmenu", (ev) => { ev.preventDefault(); showOverflow(ev, this.rowMenu(row)); });
    }
    // The word count sits under the name, so the frozen block is the name and the plot and nothing else.
    if (!row.outline) th.createDiv({ text: `${row.words.toLocaleString()} words`, cls: "czm-pg-scene-words" });
    const plot = tr.createEl("td", { text: row.group ? row.logline ?? "" : row.events.join(" · "), cls: `czm-pg-plot is-frozen${row.group ? " is-logline" : ""}`, attr: { "data-fcol": "1" } });
    if (row.group) {
      plot.setAttribute("title", "The logline, kept as a comment under the heading in Outline.md; click to write it");
      plot.setAttribute("role", "button"); plot.setAttribute("tabindex", "-1");
      plot.addEventListener("click", () => this.editLogline(row, plot));
    }
    const fallback: Segment = { kind: "free", block: "", single: null, columns: [...columns], folded: false };
    for (const seg of segments ?? [fallback]) {
      if (seg.folded) { tr.createEl("td", { cls: `czm-pg-fold-td czm-pg-kind-${seg.kind}`, attr: { "aria-hidden": "true" } }); continue; }
      for (const c of seg.columns) { const col = columns.indexOf(c); this.renderCell(tr, c, c.cells[row.index]!, row, { col, row: rowIndex }, col <= frozenUpTo); }
    }
    if (this.castExpanded) {
      const present = new Set(row.present);
      for (const e of cast) {
        const on = present.has(e.id);
        const td = tr.createEl("td", { cls: `czm-pg-cast-dot${on ? " is-on" : ""}` });
        if (on) { td.setCssProps({ "--czm-kind": settings.colors[e.kind] }); td.setAttribute("aria-label", `${e.name} in ${row.scene.title || basenameOf(row.scene.path)}`); }
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
    for (const lane of this.lanes) this.renderGaugeCell(tr, lane, rowIndex, row);
  }

  // ---- the gauge -------------------------------------------------------------------

  /** Over a lane: the column it reads, its scale as a legend from red to green, and what the lane counts. */
  private renderGaugeHead(thead: HTMLElement, lane: Lane, rowCount: number): void {
    const words = lane.scale.words;
    const th = thead.createEl("th", { cls: "czm-pg-col czm-pg-gauge-head", attr: { scope: "col", title: `Gauge · ${lane.column.heading.name}: ${words.join(" → ")}. Pipes are the scene's charge, the line is the running total, a diamond is where it flips.` } });
    const name = th.createDiv({ cls: "czm-pg-col-name" });
    name.createSpan({ text: "Gauge", cls: "czm-pg-gauge-tag" });
    name.createSpan({ text: lane.column.heading.name, cls: "czm-pg-col-title" });
    const legend = th.createDiv({ cls: "czm-pg-gauge-legend", attr: { "aria-label": `Scale: ${words.join(", ")}` } });
    words.forEach((w, i) => legend.createSpan({ text: w, cls: `czm-pg-gauge-word is-${i < lane.scale.neutral ? "neg" : i > lane.scale.neutral ? "pos" : "neutral"}`, attr: { title: `${w}: ${signed(i - lane.scale.neutral)}` } }));
    const sub = th.createDiv({ cls: "czm-pg-col-sub" });
    sub.createSpan({ text: `${lane.charged} of ${rowCount} · ${plural(lane.inversions.length, "inversion")}${lane.unread ? ` · ${lane.unread} unread` : ""}${lane.unit > 1 ? ` · line: 1 step = ${lane.unit}` : ""}`, cls: "czm-pg-col-count" });
  }

  /** The line's x for a total: the centre, then one pipe's pitch per unit of total, so the line shares the pipes' scale until it would leave the lane. */
  private laneX(lane: Lane, total: number): number { return LANE_CX + (total / lane.unit) * LANE_STEP; }

  /** A band row carries the line straight through, so the total is continuous from the first scene to the last. */
  private renderGaugePass(tr: HTMLElement, lane: Lane, position: number): void {
    const td = tr.createEl("td", { cls: "czm-pg-gauge-td is-pass", attr: { "aria-hidden": "true" } });
    const svg = svgEl("svg", { class: "czm-pg-gauge-svg", width: String(LANE_W), height: "100%" });
    td.createDiv({ cls: "czm-pg-gauge" }).appendChild(svg);
    const x = String(this.laneX(lane, position > 0 ? lane.rows[position - 1]!.total : 0));
    svg.appendChild(svgEl("line", { class: "czm-pg-gauge-centre", x1: String(LANE_CX), x2: String(LANE_CX), y1: "0%", y2: "100%" }));
    svg.appendChild(svgEl("line", { class: "czm-pg-gauge-line", x1: x, x2: x, y1: "0%", y2: "100%" }));
  }

  /** One row of a lane: the pipes for the scene's charge, the running total walking through, the diamond and rule where it flips. */
  private renderGaugeCell(tr: HTMLElement, lane: Lane, position: number, row: GridRow): void {
    const g = lane.rows[position]!;
    const prev = position > 0 ? lane.rows[position - 1]!.total : 0;
    const where = row.scene.title || basenameOf(row.scene.path);
    const what = g.conflict ? `two stops disagree (${g.conflict.join(", ")}), unread` : g.charge === null ? "no word" : `${g.keyword} (${signed(g.charge)})`;
    const td = tr.createEl("td", { cls: `czm-pg-gauge-td${g.inversion ? " is-inversion" : ""}${g.conflict ? " is-unread" : ""}`, attr: { "aria-label": `Gauge, ${lane.column.heading.name} at ${where}: ${what}, total ${signed(g.total)}${g.inversion ? `, inversion${g.marked ? "" : ", no line marks it"}` : ""}` } });
    const svg = svgEl("svg", { class: "czm-pg-gauge-svg", width: String(LANE_W), height: "100%", "aria-hidden": "true" });
    td.createDiv({ cls: "czm-pg-gauge" }).appendChild(svg);
    if (g.inversion) svg.appendChild(svgEl("line", { class: "czm-pg-gauge-rule", x1: "0", x2: String(LANE_W), y1: "50%", y2: "50%" }));
    svg.appendChild(svgEl("line", { class: "czm-pg-gauge-centre", x1: String(LANE_CX), x2: String(LANE_CX), y1: "0%", y2: "100%" }));
    // The charge: one pipe per step to three, then a block of three and singles; left of the line below neutral, right above it.
    if (g.charge !== null && g.charge !== 0) {
      const { block, singles } = pipesOf(g.charge);
      const side = g.charge < 0 ? "neg" : "pos";
      const slotX = (i: number, w: number) => (g.charge! < 0 ? LANE_CX - 2 - i * LANE_STEP - w : LANE_CX + 2 + i * LANE_STEP);
      const pipe = (x: number, w: number) => svg.appendChild(svgEl("rect", { class: `czm-pg-gauge-pipe is-${side}`, x: String(x), width: String(w), y: "50%", height: String(PIPE_H), transform: `translate(0,${-PIPE_H / 2})` }));
      const blockW = 2 * LANE_STEP + PIPE_W;
      if (block) pipe(g.charge < 0 ? LANE_CX - 2 - blockW : LANE_CX + 2, blockW);
      for (let i = block ? 3 : 0; i < (block ? 3 : 0) + singles; i++) pipe(slotX(i, PIPE_W), PIPE_W);
    } else if (g.charge === 0) {
      svg.appendChild(svgEl("line", { class: "czm-pg-gauge-tick", x1: String(LANE_CX - 5), x2: String(LANE_CX + 5), y1: "50%", y2: "50%" }));
    } else if (g.conflict) {
      const q = svgEl("text", { class: "czm-pg-gauge-unread", x: String(LANE_CX + 4), y: "50%", "dominant-baseline": "central" });
      q.textContent = "?";
      svg.appendChild(q);
    }
    // The running total: from where the row above left it to this row's, then down; dotted where nobody has said.
    const x0 = String(this.laneX(lane, prev)), x1 = String(this.laneX(lane, g.total));
    const lineCls = `czm-pg-gauge-line${g.charge === null ? " is-empty" : ""}`;
    svg.appendChild(svgEl("line", { class: lineCls, x1: x0, x2: x1, y1: "0%", y2: "50%" }));
    svg.appendChild(svgEl("line", { class: lineCls, x1: x1, x2: x1, y1: "50%", y2: "100%" }));
    if (g.inversion) {
      const d = svgEl("text", { class: `czm-pg-gauge-diamond${g.marked ? "" : " is-hollow"}`, x: x1, y: "50%", "text-anchor": "middle", "dominant-baseline": "central" });
      d.textContent = g.marked ? "◆" : "◇";
      svg.appendChild(d);
      const label = svgEl("text", { class: "czm-pg-gauge-label", x: "3", y: "50%", dy: "-5" });
      label.textContent = "inversion";
      svg.appendChild(label);
    } else if (g.charge !== null) {
      svg.appendChild(svgEl("circle", { class: "czm-pg-gauge-dot", cx: x1, cy: "50%", r: "2.5" }));
    }
    const total = svgEl("text", { class: "czm-pg-gauge-total", x: String(LANE_W - 2), y: "50%", "text-anchor": "end", "dominant-baseline": "central" });
    total.textContent = signed(g.total);
    svg.appendChild(total);
  }

  /** The Gauge section: the switch, one tick per graded column, and what each lane counts. */
  private renderGaugeSection(section: HTMLElement): void {
    const prefs = this.gaugePrefs;
    const showRow = section.createDiv({ cls: "setting-item mod-toggle" });
    const showInfo = showRow.createDiv({ cls: "setting-item-info" });
    showInfo.createDiv({ text: "Show gauge", cls: "setting-item-name" });
    showInfo.createDiv({ text: "A thermometer per scene at the right edge: pipes for the scene's charge, a line for the running total, a diamond where it flips", cls: "setting-item-description" });
    const showToggle = showRow.createDiv({ cls: "setting-item-control" }).createEl("button", { cls: `czm-pg-toggle czm-pg-gauge-toggle${prefs.shown ? " is-on" : ""}`, attr: { role: "switch", "aria-checked": String(prefs.shown), "aria-label": "Show gauge" } });
    showToggle.addEventListener("click", () => this.run("toggle-gauge"));
    const graded = this.grid.columns.filter((c) => c.scale !== null);
    if (!graded.length) { section.createDiv({ text: "No column has a scale yet. Set scale… in a column's menu writes one line under its heading, hate to love, and the gauge reads the word each stop opens with.", cls: "czm-map-absent" }); return; }
    const ticked = this.laneHeadings();
    const list = section.createDiv({ cls: "czm-pg-gauge-lanes", attr: { role: "group", "aria-label": "Lanes" } });
    for (const c of graded) {
      const problem = c.scale ? checkScale(c.scale) : null;
      const on = ticked.includes(c.heading.heading);
      const row = list.createEl("label", { cls: `czm-pg-gauge-lane${on ? " is-on" : ""}${problem ? " is-problem" : ""}` });
      const box = row.createEl("input", { cls: "czm-pg-gauge-tick", attr: { type: "checkbox", "aria-label": `Lane: ${c.heading.name}` } });
      box.checked = on;
      box.disabled = !!problem || (!on && ticked.length >= MAX_LANES);
      box.addEventListener("change", () => this.gaugeColumn(c));
      const text = row.createDiv({ cls: "czm-pg-gauge-lane-text" });
      text.createDiv({ text: c.heading.name, cls: "czm-pg-gauge-lane-name" });
      text.createDiv({ text: problem ? describeScaleProblem(problem) : (c.scale ?? []).join(" · "), cls: `czm-pg-gauge-lane-scale${problem ? " is-problem" : ""}` });
    }
    if (ticked.length >= MAX_LANES && graded.length > MAX_LANES) list.createDiv({ text: `${MAX_LANES} lanes at most: untick one to pick another.`, cls: "czm-map-absent" });
    for (const lane of this.lanes) {
      const at = lane.inversions.map((p) => `${p + 1} ${this.rows[p]?.scene.title || ""}`.trim()).join(", ");
      section.createDiv({ text: `${lane.column.heading.name}: ${lane.charged} of ${this.rows.length} charged${lane.unread ? `, ${lane.unread} unread` : ""}, total ends at ${signed(lane.rows.at(-1)?.total ?? 0)}${lane.inversions.length ? `, ${plural(lane.inversions.length, "inversion")} at ${at}` : ", no inversion"}${lane.unit > 1 ? ` · line: 1 step = ${lane.unit}` : ""}`, cls: "czm-map-absent czm-pg-gauge-summary" });
    }
    if (this.lanes.length > 1) section.createDiv({ text: this.disagree.size ? `${plural(this.disagree.size, "disagreement")}: opposite signs at ${[...this.disagree].sort((a, b) => a - b).map((p) => p + 1).join(", ")}, marked ≠ on the scene.` : "The lanes never disagree.", cls: "czm-map-absent czm-pg-gauge-summary" });
  }

  private renderCell(tr: HTMLElement, column: GridColumn, cell: GridCell, row: GridRow, at: Selection, frozen = false): void {
    const td = tr.createEl("td", { cls: `czm-pg-cell-td czm-pg-kind-${column.heading.kind}${column.special ? ` czm-pg-special-${column.special}` : ""}${frozen ? " is-frozen" : ""}`, attr: frozen ? { "data-fcol": String(2 + at.col) } : {} });
    const where = `${column.heading.name} at ${row.scene.title || basenameOf(row.scene.path)}`;
    const selected = this.selection?.col === at.col && this.selection?.row === at.row;
    const stop = cell.stop;
    const unmoved = !stop && cell.presentUnmoved && column.armed && this.settings.unmoved;
    const reading = cell.reading;
    const el = td.createDiv({
      cls: `czm-pg-cell is-${stop ? cell.state : "empty"}${unmoved ? " is-unmoved" : ""}${reading ? ` has-reading${reading.stale ? " is-stale" : ""}` : ""}${selected ? " is-selected" : ""}`,
      attr: { role: "button", tabindex: selected || (!this.selection && at.col === 0 && at.row === 0) ? "0" : "-1", "data-col": String(at.col), "data-row": String(at.row), "aria-selected": String(selected), "aria-label": stop ? `${where}: ${stop.role && stop.role !== "touch" ? `${stop.role}, ` : ""}${stop.keyword ? `${stop.keyword}, ` : ""}${stop.note || stop.quote || ""}` : unmoved ? `${where}: ${column.entity?.name ?? "the character"} is on the page, unmoved` : `${where}: empty` },
    });
    if (stop && column.special === "pov") {
      const dot = el.createSpan({ cls: "czm-pg-dot czm-pg-pov-dot" });
      if (row.pov?.entity) dot.setCssProps({ "--czm-kind": this.source.settings().colors[row.pov.entity.kind] });
      el.createSpan({ text: stop.note, cls: "czm-pg-cell-text" });
    } else if (stop) {
      if (this.audit) el.createSpan({ text: STATE_GLYPH[cell.state as "plan" | "verified" | "broken"], cls: `czm-pg-state-glyph is-${cell.state}`, attr: { title: cell.state } });
      const glyph = stop.role ? ROLE_GLYPH[stop.role] : "";
      if (glyph && stop.role) el.createSpan({ text: glyph, cls: `czm-pg-role is-${stop.role}`, attr: { title: stop.role } });
      if (stop.keyword) {
        const scale = readScale(column.scale);
        const charge = scale ? chargeOf(stop.keyword, scale) : null;
        el.createSpan({ text: charge === null ? stop.keyword : `${signed(charge)} ${stop.keyword}`, cls: `czm-pg-keyword is-${charge === null ? "plain" : charge < 0 ? "neg" : charge > 0 ? "pos" : "neutral"}`, attr: { title: charge === null ? `${stop.keyword}: not on the column's scale` : `${stop.keyword}: ${signed(charge)} on the scale` } });
      }
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
    void castCount;
  }

  // ---- snapshots as tabs -----------------------------------------------------------

  /** Over the table: the grid itself, then one tab per dated snapshot, newest first, named by its day and the label the writer gave the note. */
  private renderTabs(root: HTMLElement): void {
    if (!this.snapshots.length) return;
    const bar = root.createDiv({ cls: "czm-pg-tabs", attr: { role: "tablist", "aria-label": "Snapshots" } });
    const tab = (label: string, path: string | null, title: string) => {
      const b = bar.createEl("button", { text: label, cls: `czm-pg-tab${this.tab === path ? " is-active" : ""}`, attr: { role: "tab", "aria-selected": String(this.tab === path), title } });
      b.addEventListener("click", () => void this.openTab(path));
    };
    tab("Now", null, "The grid as it stands");
    for (const snap of this.snapshots) tab(snapshotLabel(snap), snap.path, `${basenameOf(snap.path)} · rename the note to name the tab`);
  }

  private async openTab(path: string | null): Promise<void> {
    if (path === this.tab) return;
    this.tab = path;
    this.snapshotTable = null;
    this.selection = null;
    if (path) {
      try { this.snapshotTable = await this.source.readSnapshot(path); } catch (e) { this.tab = null; this.status?.fail(couldNot("read the snapshot", e)); }
    }
    this.renderTable();
  }

  /** A snapshot drawn as the grid draws itself, read only: chapter bands, scenes with their counts, the cells as text. */
  private renderSnapshot(root: HTMLElement): void {
    const shell = this.shell, snap = this.snapshots.find((s) => s.path === this.tab), table = this.snapshotTable;
    if (!shell || !snap) return;
    this.rows = []; this.shown = [];
    shell.setState(`Snapshot · ${snapshotLabel(snap)} · read only${table ? ` · ${plural(table.rows.length, "scene")} · ${plural(table.columns.length, "column")}` : ""}`, { label: "Open note", cls: "czm-pg-open-snapshot", onClick: () => this.source.openNote(snap.path) });
    this.renderSide();
    if (!table) { shell.empty("Reading the snapshot…"); return; }
    if (!table.rows.length) { shell.empty("This snapshot has no table the grid can read.", [{ label: "Open note", cls: "czm-pg-open-snapshot", onClick: () => this.source.openNote(snap.path) }]); return; }
    const bar = root.createDiv({ cls: "czm-pg-eyebrow" });
    bar.createSpan({ text: table.summary || `${basenameOf(snap.path)}: a snapshot, never read back.`, cls: "czm-pg-theme-label" });
    const wrap = root.createDiv({ cls: "czm-pg-wrap" });
    const t = wrap.createEl("table", { cls: "czm-pg-table is-snapshot", attr: { "aria-label": `Snapshot ${snapshotLabel(snap)}` } });
    const thead = t.createEl("thead").createEl("tr");
    thead.createEl("th", { text: "Scene", cls: "czm-pg-corner is-frozen", attr: { scope: "col", "data-fcol": "0" } });
    for (const c of table.columns) thead.createEl("th", { cls: "czm-pg-col czm-pg-col-thread", attr: { scope: "col" } }).createDiv({ cls: "czm-pg-col-name" }).createSpan({ text: c, cls: "czm-pg-col-title" });
    thead.createEl("th", { cls: "czm-pg-filler" });
    const tbody = t.createEl("tbody");
    let lastChapter: string | null = null;
    for (const row of table.rows) {
      if (row.chapter !== lastChapter) { lastChapter = row.chapter; tbody.createEl("tr", { cls: "czm-pg-note" }).createEl("th", { text: row.chapter, attr: { colspan: String(table.columns.length + 2), scope: "rowgroup" } }); }
      const tr = tbody.createEl("tr", { cls: `czm-pg-scene${row.outline ? " is-outline" : ""}` });
      const th = tr.createEl("th", { cls: "czm-pg-scene-head is-frozen", attr: { scope: "row", "data-fcol": "0" } });
      th.createSpan({ text: row.scene, cls: "czm-map-row-name" });
      if (row.outline) th.createSpan({ text: "outline", cls: "czm-map-row-meta" });
      else if (row.words) th.createDiv({ text: `${row.words} words`, cls: "czm-pg-scene-words" });
      for (const cell of row.cells) {
        const td = tr.createEl("td", { cls: "czm-pg-cell-td" });
        const state = cell.endsWith("✓") ? "verified" : cell.endsWith("✗") ? "broken" : cell ? "plan" : "empty";
        td.createDiv({ text: cell.replace(/\s*[✓✗]\s*$/, ""), cls: `czm-pg-cell is-${state}`, attr: { title: cell } });
      }
      tr.createEl("td", { cls: "czm-pg-filler" });
    }
    this.applyFreeze(wrap, t, 1);
  }

  /** A header or a side-column row picks a column: the side column shows it; with `moveCell` the selection lands in it too. */
  private pickColumn(col: number, moveCell = true): void {
    this.column = col;
    if (moveCell) { this.select({ col, row: this.selection?.row ?? 0 }); return; }
    this.body?.querySelectorAll(".czm-pg-col-thread.is-current").forEach((th) => th.classList.remove("is-current"));
    this.body?.querySelectorAll(".czm-pg-col-thread")[col]?.classList.add("is-current");
    this.renderSide();
  }

  /** Dragging a header moves its block: a single column with a job goes alone, a kind group goes together. The drop side is the pointer's half of the target. */
  private dragHandlers(th: HTMLElement, block: string): void {
    th.addEventListener("dragstart", (ev) => {
      this.dragging = block;
      ev.dataTransfer?.setData("text/plain", block);
      this.body?.querySelectorAll<HTMLElement>(`thead th[data-block="${attrValue(block)}"]`).forEach((el) => el.classList.add("is-dragging"));
    });
    th.addEventListener("dragend", () => { this.dragging = null; this.body?.querySelectorAll(".is-dragging, .is-drop-before, .is-drop-after").forEach((el) => el.classList.remove("is-dragging", "is-drop-before", "is-drop-after")); });
    th.addEventListener("dragover", (ev) => {
      if (!this.dragging || this.dragging === block) return;
      ev.preventDefault();
      const rect = th.getBoundingClientRect();
      const after = ev.clientX > rect.left + rect.width / 2;
      this.body?.querySelectorAll(".is-drop-before, .is-drop-after").forEach((el) => el.classList.remove("is-drop-before", "is-drop-after"));
      const cells = [...(this.body?.querySelectorAll<HTMLElement>(`thead th[data-block="${attrValue(block)}"]`) ?? [])];
      (after ? cells.at(-1) : cells[0])?.classList.add(after ? "is-drop-after" : "is-drop-before");
    });
    th.addEventListener("drop", (ev) => {
      const from = this.dragging;
      if (!from || from === block) return;
      ev.preventDefault();
      const rect = th.getBoundingClientRect();
      void this.moveBlock(from, block, ev.clientX > rect.left + rect.width / 2 ? "after" : "before");
    });
  }

  /** The blocks as drawn, from the project's order and what it left out. */
  private blocks(): string[] {
    const p = this.project;
    return blockOrder({ time: p?.plotTime, pov: p?.plotPov, beats: p?.plotBeats, order: p?.plotOrder });
  }

  /** Writes the new block order to the project note as `plot-order`, with Undo; the grid redraws from it. */
  private async moveBlock(from: string, to: string, side: "before" | "after"): Promise<void> {
    const project = this.project;
    if (!project) return;
    const order = this.blocks().filter((b) => b !== from);
    const at = order.indexOf(to);
    if (at < 0) return;
    order.splice(side === "after" ? at + 1 : at, 0, from);
    await this.writeOrder(project, order, `Moved ${this.blockLabel(from)} ${side} ${this.blockLabel(to)}`);
  }

  /** The column's block one step left or right, for the keyboard. */
  private async nudgeBlock(c: GridColumn, direction: -1 | 1): Promise<void> {
    const project = this.project;
    if (!project) return;
    const order = this.blocks();
    const block = blockOf(c);
    // A group with no column drawn is skipped, so a move is always one the eye can see.
    const drawn = new Set(this.grid.columns.map((col) => blockOf(col)));
    const i = order.indexOf(block);
    let j = i + direction;
    while (j >= 0 && j < order.length && !drawn.has(order[j]!)) j += direction;
    if (i < 0 || j < 0 || j >= order.length) { this.status?.say(`${this.blockLabel(block)} is already at the ${direction < 0 ? "left" : "right"} edge.`); return; }
    const target = order[j]!;
    const next = order.filter((b) => b !== block);
    next.splice(next.indexOf(target) + (direction > 0 ? 1 : 0), 0, block);
    await this.writeOrder(project, next, `Moved ${this.blockLabel(block)} ${direction < 0 ? "left" : "right"}`);
  }

  private blockLabel(block: string): string {
    const kind = (Object.keys(GROUP_TOKEN) as ColumnKind[]).find((k) => GROUP_TOKEN[k] === block);
    return kind ? `the ${KIND_GROUP[kind].toLowerCase()}` : `“${this.grid.columns.find((c) => c.heading.heading === block)?.heading.name ?? block}”`;
  }

  private async writeOrder(project: ProjectSpec, order: readonly string[], what: string): Promise<void> {
    const before = project.plotOrder?.length ? project.plotOrder.join(", ") : null;
    try { await this.source.setProjectKey(project, "plot-order", order.join(", ")); } catch (e) { this.status?.fail(couldNot("write plot-order", e)); return; }
    await new Promise((r) => window.setTimeout(r, 300));
    await this.show(project, true);
    this.status?.undoable(`${what}: plot-order written to the project note`, async () => { await this.source.setProjectKey(project, "plot-order", before); await new Promise((r) => window.setTimeout(r, 300)); await this.show(project, true); });
  }

  /** A column's menu: its kind, its job for the project, and the column itself. Every row names its command where it has one. */
  private columnMenu(c: GridColumn): readonly (MenuEntry | "-")[] {
    const kindRows: MenuEntry[] = COLUMN_KINDS.map((kind) => ({ label: `Kind: ${kind === "free" ? "free thread" : kind}`, checked: c.heading.kind === kind, onClick: () => void this.setKind(c, kind) }));
    const jobRows: MenuEntry[] = (["pov", "time", "beats", "main-theme"] as SpecialColumn[]).map((job) => ({ label: c.special === job ? `Stop using as ${SPECIAL_LABEL[job]}` : `Use as ${SPECIAL_LABEL[job]}`, checked: c.special === job, onClick: () => void this.setSpecial(c, job) }));
    return [
      { label: "Rename…", icon: "pencil", onClick: () => this.renameColumnInPlace(c) },
      { label: DERIVED.includes(c.special) ? "Move left" : `Move the ${KIND_GROUP[c.heading.kind].toLowerCase()} left`, icon: "arrow-left", onClick: () => void this.nudgeBlock(c, -1) },
      { label: DERIVED.includes(c.special) ? "Move right" : `Move the ${KIND_GROUP[c.heading.kind].toLowerCase()} right`, icon: "arrow-right", onClick: () => void this.nudgeBlock(c, 1) },
      "-",
      ...kindRows,
      "-",
      ...jobRows,
      "-",
      { label: "Read this column with the model…", icon: "sparkles", command: "plot-grid-read-column", disabled: !!this.running || DERIVED.includes(c.special), onClick: () => void this.readColumns([c], "reading") },
      { label: "Check this column against the draft…", command: "plot-grid-check-column", disabled: !!this.running || c.filled === 0, onClick: () => void this.readColumns([c], "checking") },
      { label: `Dismiss all readings${c.readings ? ` (${c.readings})` : ""}`, disabled: c.readings === 0, onClick: () => { if (this.project) void this.source.dismissColumnReadings(this.project, c.heading.heading).then(() => this.show(this.project, true)); } },
      "-",
      { label: "Gauge this column", icon: "activity", command: "plot-grid-gauge-column", checked: this.gaugePrefs.shown && this.laneHeadings().includes(c.heading.heading), disabled: !c.scale || DERIVED.includes(c.special), onClick: () => this.gaugeColumn(c) },
      { label: "Freeze up to here", icon: "panel-left", checked: this.frozenHeading === c.heading.heading, onClick: () => { const on = this.frozenHeading === c.heading.heading; this.setFrozen(on ? null : c.heading.heading); this.renderTable(); this.status?.say(on ? "Scene and Plot stay put; the threads scroll." : `Frozen up to “${c.heading.name}”: it stays put with Scene and Plot while the rest scroll.`); } },
      { label: "Hide column", icon: "eye-off", command: "plot-grid-hide-column", onClick: () => this.hideColumn(c) },
      { label: "Delete column…", icon: "x", onClick: () => { this.openSide("pg-columns"); const del = this.shell?.side.querySelector<HTMLButtonElement>(`.czm-pg-col-delete[data-heading="${attrValue(c.heading.heading)}"]`); del?.click(); del?.focus(); } },
    ];
  }

  /** The heading as a field in the column's own header, where the menu was opened: Enter saves, Escape puts it back. The side column's field stays as the other way. */
  private renameColumnInPlace(c: GridColumn): void {
    const col = this.shown.indexOf(c);
    const th = col >= 0 ? this.body?.querySelectorAll<HTMLElement>("thead th.czm-pg-col-thread")[col] : null;
    const name = th?.querySelector<HTMLElement>(".czm-pg-col-name");
    if (!name) { this.openSide("pg-column", ".czm-pg-rename"); return; }
    this.inlineRename(name, c.heading.heading, `Rename the column ${c.heading.name}`, (heading) => this.renameColumn(c, heading));
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
      ...(this.lanes.length ? [
        { label: "below neutral", color: "", cls: "czm-pg-key-gauge is-neg" },
        { label: "above neutral", color: "", cls: "czm-pg-key-gauge is-pos" },
        { label: "running total · inversion", color: "", cls: "czm-pg-key-gauge is-line" },
      ] : []),
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
    this.ensureRow(at.row);
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
    this.renderGaugeSection(shell.section("Gauge", this.gaugePrefs.shown ? (this.lanes.length ? plural(this.lanes.length, "lane") : "on · no scale") : "off", "pg-gauge", false));
    if (this.gaps.length) this.renderGaps(shell.section("Gaps", plural(this.gaps.length, "finding"), "pg-gaps", true));
    const modelSection = shell.section("Model", this.source.modelLabel() || "off", "pg-model", false);
    modelSection.createDiv({ text: this.source.modelLabel() ? `${this.source.modelLabel()}. Read… asks what each thread does in each scene and leaves a reading in the empty cells; you write the cell in your own words, or dismiss it. The model never writes a cell, and never a chapter.` : "No model. Set Model to Local (Ollama) or Claude in Creative Writer settings to read columns.", cls: "czm-map-absent" });
    const rowsSection = shell.section("Rows", [this.grid.plan && !this.grid.plan.outline.built ? `${plural(this.grid.plan.outline.scenes, "planned scene")}` : "", this.settings.unmoved ? "unmoved on" : "", this.audit ? "audit" : ""].filter(Boolean).join(" · "), "pg-rows", false);
    this.renderOutlineBlock(rowsSection);
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
      const del = row.createEl("button", { cls: "clickable-icon czm-pg-col-delete", attr: { "aria-label": `Delete column ${c.heading.name} and every stop under it`, "data-heading": c.heading.heading } });
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
    this.renderColumnPicker(colSection);
    const propose = colSection.createDiv({ cls: "czm-map-panel-actions czm-pg-propose-row" });
    const proposeBtn = propose.createEl("button", { text: "Propose columns…", cls: "czm-pg-propose", attr: { title: "Ask the model which threads run through the book, from the events it has read" } });
    proposeBtn.disabled = !!this.running;
    proposeBtn.addEventListener("click", () => this.run("propose-columns"));
    if (this.proposals) this.renderProposals(shell.section("Proposed columns", `${this.proposals.picked.size} of ${this.proposals.list.length} ticked`, "pg-proposals", true));
    if (this.sheet && this.grid.plan) this.renderBuildSheet(shell.section("Build the manuscript", this.sheet.plan ? `${plural(this.sheet.plan.files.length, "note")}` : "", "pg-build", true));
    if (this.templateSheet) this.renderTemplateSheet(shell.section("Start from a template", this.templateSheet.list[this.templateSheet.chosen]?.name ?? "", "pg-template", true));
    if (this.saveSheet) this.renderSaveSheet(shell.section("Save as template", "", "pg-save-template", true));
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
    for (const job of ["pov", "time", "beats", "main-theme"] as SpecialColumn[]) {
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

  // ---- the outline: rows written before the chapters exist ----------------------

  /** The Rows section's Outline block: where the plan lives, what it holds, and the way to build it or start it. */
  private renderOutlineBlock(section: HTMLElement): void {
    const plan = this.grid.plan;
    const box = section.createDiv({ cls: "czm-pg-outline" });
    const head = box.createDiv({ cls: "czm-pg-outline-head" });
    head.createSpan({ text: "Outline", cls: "czm-pg-field-label" });
    head.createSpan({ text: !plan ? "none yet" : plan.outline.built ? "built" : "not built yet", cls: "czm-map-row-meta" });
    if (!plan) {
      box.createDiv({ text: "No outline yet. New scene starts one in Outline.md: scenes, chapters and acts you plan here, before any chapter note exists.", cls: "czm-map-absent" });
    } else if (plan.outline.built) {
      box.createDiv({ text: `Built on ${plan.outline.built}, Outline.md kept as the record. Rows come from the chapter notes now.`, cls: "czm-map-absent" });
    } else {
      box.createDiv({ text: `${basenameOf(plan.path)}.md · ${plural(plan.outline.scenes, "scene")} in ${plural(plan.outline.chapters, "chapter")}${plan.outline.acts.some((a) => a.title) ? ` and ${plural(plan.outline.acts.filter((a) => a.title).length, "act")}` : ""}`, cls: "czm-map-absent" });
    }
    const actions = box.createDiv({ cls: "czm-map-panel-actions czm-pg-outline-actions" });
    if (!plan?.outline.built) {
      const scene = actions.createEl("button", { text: "New scene", cls: "czm-pg-outline-scene" });
      scene.addEventListener("click", () => this.run("new-scene"));
      const chapter = actions.createEl("button", { text: "New chapter", cls: "czm-pg-outline-chapter" });
      chapter.addEventListener("click", () => this.run("new-chapter"));
      const act = actions.createEl("button", { text: "New act", cls: "czm-pg-outline-act" });
      act.addEventListener("click", () => this.run("new-act"));
    }
    if (plan) {
      const build = actions.createEl("button", { text: plan.outline.built ? "Build again…" : "Build the manuscript…", cls: `czm-pg-outline-build${plan.outline.built ? "" : " mod-cta"}`, attr: { title: plan.outline.built ? "Write any scene the outline has gained since as a heading in its chapter note" : "Turn the outline into folders, chapter notes and scene headings, and point every stop at them" } });
      build.addEventListener("click", () => this.run("build-manuscript"));
      const open = box.createDiv({ cls: "czm-map-panel-actions" }).createSpan({ text: "Open Outline.md", cls: "is-link czm-pg-outline-open" });
      onActivate(open, () => this.run("open-outline"));
    }
  }

  /** The build sheet in the side column: the plan as a small tree, the shape, the promise, Build and Cancel. */
  private async openBuildSheet(shape: ScaffoldShape = this.sheet?.shape ?? "chapters"): Promise<void> {
    const project = this.project;
    if (!project || !this.grid.plan) return;
    this.sheet = { shape, plan: null, loading: true };
    this.openSide("pg-build");
    let plan: ScaffoldPlan | null;
    try { plan = await this.source.scaffoldPreview(project, shape); } catch (e) { this.sheet = null; this.renderSide(); this.status?.fail(couldNot("plan the build", e)); return; }
    if (!this.sheet || this.sheet.shape !== shape) return;
    this.sheet = { shape, plan, loading: false };
    this.openSide("pg-build", ".czm-pg-build-go, .czm-pg-build-cancel");
  }

  private renderBuildSheet(section: HTMLElement): void {
    const sheet = this.sheet, plan = this.grid.plan, project = this.project;
    if (!sheet || !plan || !project) return;
    const folder = plan.path.slice(0, plan.path.lastIndexOf("/") + 1);
    const p = sheet.plan;
    section.createDiv({ text: sheet.loading ? "Reading what is already there…" : !p ? "There is no outline to build from." : p.files.length === 0 ? "Every planned scene is already a heading in its chapter note. Nothing to write." : `This will ${p.created ? `create ${plural(p.created, "note")}${p.folders.length ? ` in ${plural(p.folders.length, "folder")}` : ""}` : "write into existing notes"} from ${basenameOf(plan.path)}.md: ${plural(p.scenes, "scene heading")}${p.skipped.length ? `, ${p.skipped.length} already there` : ""}. Scene headings are written as ## lines with nothing under them${p.files.some((f) => /<!--/.test(f.content)) ? ", the logline as a hidden comment" : ""}.`, cls: "czm-map-absent" });
    if (p && p.files.length) {
      const tree = section.createEl("pre", { cls: "czm-pg-build-tree", attr: { "aria-label": "What will be written" } });
      tree.setText(describeScaffold(p, folder).join("\n"));
    }
    const shapes = section.createDiv({ cls: "czm-pg-field" });
    shapes.createDiv({ text: "Shape", cls: "czm-pg-field-label" });
    const group = shapes.createDiv({ cls: "czm-pg-build-shapes", attr: { role: "radiogroup", "aria-label": "Shape" } });
    const opt = (value: ScaffoldShape, label: string, hint: string) => {
      const row = group.createEl("label", { cls: `czm-pg-build-shape${sheet.shape === value ? " is-on" : ""}` });
      const radio = row.createEl("input", { attr: { type: "radio", name: "czm-pg-build-shape", value } });
      radio.checked = sheet.shape === value;
      radio.addEventListener("change", () => { if (radio.checked) void this.openBuildSheet(value); });
      const text = row.createDiv();
      text.createDiv({ text: label, cls: "czm-pg-build-shape-name" });
      text.createDiv({ text: hint, cls: "czm-map-row-meta" });
    };
    opt("chapters", "One note per chapter", `${plural(plan.outline.chapters, "note")}${plan.outline.acts.some((a) => a.title) ? `, one folder per act` : ""}, story-order in each`);
    opt("one-note", "One note for the whole story", "Draft.md, scenes as headings; chapters and acts fold away");
    section.createDiv({ text: "Every stop in Story threads.md is relinked to the new notes. Nothing that already exists is touched, except a note that gains a heading it lacked. Undo removes only what the build created and that is still exactly as written.", cls: "czm-map-absent" });
    const foot = section.createDiv({ cls: "czm-pg-proposals-foot" });
    const cancel = foot.createEl("button", { text: "Cancel", cls: "czm-pg-build-cancel" });
    cancel.addEventListener("click", () => { this.sheet = null; this.renderSide(); });
    const go = foot.createEl("button", { text: "Build", cls: "czm-pg-build-go mod-cta" });
    go.disabled = sheet.loading || !p || p.files.length === 0;
    go.addEventListener("click", () => { go.disabled = true; void this.build(sheet.shape); });
  }

  /** Findings the grid counted, each followed to its cells with Show: no model, no judgement, an exact number. */
  private renderGaps(section: HTMLElement): void {
    section.createDiv({ text: "Counted from the written scenes: a column with a stop in few of them, a character on the page for a stretch while the arc says nothing. What to do about it is yours.", cls: "czm-map-absent" });
    for (const gap of this.gaps) {
      const box = section.createDiv({ cls: `czm-pg-gap is-${gap.kind}` });
      box.createDiv({ text: gap.text, cls: "czm-pg-gap-text" });
      const acts = box.createDiv({ cls: "czm-map-panel-actions" });
      const show = acts.createEl("button", { text: "Show", cls: "czm-pg-gap-show" });
      show.addEventListener("click", () => {
        const col = this.shown.findIndex((c) => c.heading.heading === gap.column);
        const row = this.rows.findIndex((r) => r.index === gap.rows[0]);
        if (col < 0 || row < 0) { this.status?.say("That column is hidden or folded."); return; }
        this.select({ col, row });
      });
    }
  }

  /** One column from a template, without applying the whole of it: a dropdown grouped by template, an arc placeholder spelled out per character. */
  private renderColumnPicker(section: HTMLElement): void {
    const row = section.createDiv({ cls: "czm-pg-new czm-pg-pick-row" });
    const select = row.createEl("select", { cls: "dropdown czm-pg-pick-column", attr: { "aria-label": "Add a column from a template" } });
    const head = select.createEl("option", { text: this.templateList ? "From a template…" : "From a template… (loading)" });
    head.value = "";
    if (!this.templateList) {
      void this.source.templates().then((list) => { this.templateList = list; if (this.shell?.side.contains(select)) this.renderSide(); }).catch(() => { this.templateList = []; });
      return;
    }
    const have = new Set(this.grid.columns.map((c) => c.heading.heading.toLowerCase()));
    const names = new Set(this.grid.columns.map((c) => `${c.heading.kind}|${c.heading.name.toLowerCase()}`));
    for (const t of this.templateList) {
      const options: { heading: string; job: string }[] = [];
      for (const c of t.columns) {
        const job = t.jobs.time === c.heading ? "time" : t.jobs.pov === c.heading ? "POV" : t.jobs.beats === c.heading ? "plot point" : t.jobs.theme === c.heading ? "main theme" : "";
        const headings = c.placeholder === "every-character" ? this.grid.characters.map((e) => `Arc: [[${basenameOf(e.path!)}]]`) : c.placeholder === "arc" ? this.grid.characters.map((e) => `Arc: [[${basenameOf(e.path!)}]]`) : [c.heading];
        for (const h of headings) {
          if (have.has(h.toLowerCase()) || names.has(`${c.kind}|${(c.placeholder ? h.replace(/^Arc:\s*\[\[|\]\]$/g, "") : c.name).toLowerCase()}`)) continue;
          if (!options.some((o) => o.heading.toLowerCase() === h.toLowerCase())) options.push({ heading: h, job });
        }
      }
      if (!options.length) continue;
      const group = select.createEl("optgroup", { attr: { label: t.name } });
      for (const o of options) { const opt = group.createEl("option", { text: o.job ? `${o.heading} · ${o.job}` : o.heading }); opt.value = `${t.name}\u0000${o.heading}`; }
    }
    select.addEventListener("change", () => {
      const [templateName, heading] = select.value.split("\u0000");
      if (!heading) return;
      const t = this.templateList?.find((x) => x.name === templateName);
      const job: SpecialColumn | null = t?.jobs.time && (t.jobs.time === heading) ? "time" : t?.jobs.pov === heading ? "pov" : t?.jobs.beats === heading ? "beats" : t?.jobs.theme === heading ? "main-theme" : null;
      select.disabled = true;
      void this.addColumn(heading, job);
    });
  }

  // ---- templates: a starting shape, written as headings ----------------------------

  private async openTemplateSheet(): Promise<void> {
    const project = this.project;
    if (!project) return;
    let list: readonly StoryTemplate[];
    try { list = await this.source.templates(); } catch (e) { this.status?.fail(couldNot("list the templates", e)); return; }
    this.templateSheet = { list, chosen: 0, choices: this.defaultChoices(list[0]), plan: null, loading: false };
    this.openSide("pg-template");
    await this.replanTemplate();
    this.openSide("pg-template", ".czm-pg-template-row input");
  }

  private defaultChoices(t: StoryTemplate | undefined): { rows: boolean; columns: boolean; ticked: Set<string>; names: Record<string, string>; bindings: Record<string, string> } {
    return { rows: !!t?.structure, columns: !!t?.columns.length, ticked: new Set(t?.columns.map((c) => c.heading) ?? []), names: {}, bindings: {} };
  }

  private async replanTemplate(): Promise<void> {
    const sheet = this.templateSheet, project = this.project;
    const t = sheet?.list[sheet.chosen];
    if (!sheet || !project || !t) return;
    sheet.loading = true;
    // Every character with a note, on the page or not yet: before any prose, an arc can still be bound.
    const cast = this.grid.characters.map((e) => ({ name: e.name, kind: e.kind, path: e.path }));
    let plan: ApplyPlan | null = null;
    try { plan = await this.source.planTemplate(project, t, { ...sheet.choices }, cast); } catch (e) { this.status?.fail(couldNot("plan the template", e)); }
    if (this.templateSheet !== sheet) return;
    sheet.plan = plan; sheet.loading = false;
    this.renderSide();
    this.shell?.reveal("pg-template");
  }

  private renderTemplateSheet(section: HTMLElement): void {
    const sheet = this.templateSheet, project = this.project;
    if (!sheet || !project) return;
    const t = sheet.list[sheet.chosen];
    const list = section.createDiv({ cls: "czm-pg-template-list", attr: { role: "radiogroup", "aria-label": "Templates" } });
    let lastOwn = false;
    sheet.list.forEach((tpl, i) => {
      const own = tpl.path !== null;
      if (i === 0 || own !== lastOwn) { list.createDiv({ text: own ? `Yours · ${this.source.templatesFolder()}` : "Built in", cls: "czm-pg-side-kind" }); lastOwn = own; }
      const row = list.createEl("label", { cls: `czm-pg-template-row${i === sheet.chosen ? " is-on" : ""}` });
      const radio = row.createEl("input", { attr: { type: "radio", name: "czm-pg-template", value: String(i), "aria-label": tpl.name } });
      radio.checked = i === sheet.chosen;
      radio.addEventListener("change", () => { if (!radio.checked) return; sheet.chosen = i; sheet.choices = this.defaultChoices(tpl); void this.replanTemplate(); });
      row.createSpan({ text: tpl.name, cls: "czm-pg-template-name" });
      row.createSpan({ text: [tpl.outline.scenes ? plural(tpl.outline.scenes, "scene") : "", tpl.columns.length ? plural(tpl.columns.length, "column") : ""].filter(Boolean).join(" · "), cls: "czm-map-row-meta" });
    });
    if (!sheet.list.length) list.createDiv({ text: "No templates.", cls: "czm-map-absent" });
    if (!t) return;
    const parts = section.createDiv({ cls: "czm-pg-field" });
    parts.createDiv({ text: "Apply", cls: "czm-pg-field-label" });
    const partRow = parts.createDiv({ cls: "czm-pg-template-parts" });
    const part = (key: "rows" | "columns", label: string, has: boolean) => {
      const l = partRow.createEl("label", { cls: `czm-pg-template-part${has ? "" : " is-off"}` });
      const box = l.createEl("input", { attr: { type: "checkbox", "aria-label": label } });
      box.checked = has && sheet.choices[key];
      box.disabled = !has;
      box.addEventListener("change", () => { sheet.choices[key] = box.checked; void this.replanTemplate(); });
      l.createSpan({ text: has ? label : `${label} · none in this template` });
    };
    part("rows", "Rows", !!t.structure);
    part("columns", "Columns", t.columns.length > 0);
    if (t.columns.length && sheet.choices.columns) {
      const cols = section.createDiv({ cls: "czm-pg-field" });
      cols.createDiv({ text: "Columns · untick to leave one out, name what is a placeholder", cls: "czm-pg-field-label" });
      const cast = this.grid.characters.map((e) => e.name);
      for (const c of t.columns) {
        const row = cols.createDiv({ cls: "czm-pg-template-col" });
        const tick = row.createEl("input", { attr: { type: "checkbox", "aria-label": `Include ${c.heading}` } });
        tick.checked = sheet.choices.ticked.has(c.heading);
        tick.addEventListener("change", () => { if (tick.checked) sheet.choices.ticked.add(c.heading); else sheet.choices.ticked.delete(c.heading); void this.replanTemplate(); });
        const job = t.jobs.time === c.heading ? "time" : t.jobs.pov === c.heading ? "POV" : t.jobs.beats === c.heading ? "plot point" : t.jobs.theme === c.heading ? "main theme" : "";
        if (c.placeholder === "every-character") {
          row.createSpan({ text: `Arc: every character`, cls: "czm-pg-template-col-name" });
          row.createSpan({ text: `${plural(cast.length, "arc")} from the cast`, cls: "czm-map-row-meta" });
        } else if (c.placeholder === "arc") {
          row.createSpan({ text: "Arc:", cls: "czm-pg-template-col-name" });
          const select = row.createEl("select", { cls: "dropdown czm-pg-template-bind", attr: { "aria-label": `${c.name}: bind to a character` } });
          const none = select.createEl("option", { text: `${c.name} (as written)` }); none.value = "";
          for (const name of cast) { const o = select.createEl("option", { text: name }); o.value = name; }
          select.value = sheet.choices.bindings[c.heading] ?? "";
          select.addEventListener("change", () => { sheet.choices.bindings[c.heading] = select.value; void this.replanTemplate(); });
        } else {
          row.createSpan({ text: c.kind === "free" ? "" : `${c.kind.charAt(0).toUpperCase()}${c.kind.slice(1)}:`, cls: "czm-pg-template-col-name" });
          const field = row.createEl("input", { cls: "czm-pg-template-rename", attr: { type: "text", "aria-label": `${c.heading}: name`, placeholder: c.name } });
          field.value = sheet.choices.names[c.heading] ?? "";
          field.addEventListener("change", () => { sheet.choices.names[c.heading] = field.value.trim(); void this.replanTemplate(); });
          field.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") { ev.preventDefault(); field.blur(); } });
        }
        if (job) row.createSpan({ text: job, cls: "czm-pg-side-job" });
      }
    }
    const p = sheet.plan;
    const preview = section.createDiv({ cls: "czm-pg-field" });
    preview.createDiv({ text: "What gets written", cls: "czm-pg-field-label" });
    const lines: string[] = [];
    if (p) {
      if (p.headings.length) { lines.push("Story threads.md"); lines.push(...p.headings.map((h) => `  ## ${h}`)); }
      if (p.skipped.length) lines.push(`  ${plural(p.skipped.length, "heading")} already there: ${p.skipped.join(", ")}`);
      if (p.structure) { lines.push(`Outline.md · ${plural(p.scenes, "scene")}`); for (const a of t.outline.acts) lines.push(`  ${a.title || "(no act)"}: ${a.chapters.flatMap((c) => c.scenes).map((sc) => sc.title).join(", ")}`); }
      const jobs = Object.entries(p.jobs).map(([k, v]) => `${k === "theme" ? "main theme" : k === "pov" ? "POV" : k === "beats" ? "plot point" : k}: ${v}`);
      if (p.structure && (p.jobs.beats || project.plotBeats)) lines.push(`Plot point · one stop per scene from the template's beats`);
      if (jobs.length) lines.push(`Project note · ${jobs.join(" · ")}`);
    }
    const tree = preview.createEl("pre", { cls: "czm-pg-build-tree", attr: { "aria-label": "What will be written" } });
    tree.setText(sheet.loading ? "Reading what is already there…" : lines.length ? lines.join("\n") : "Nothing to write with these choices.");
    section.createDiv({ text: "Headings only: nothing is written under them, and nothing that exists changes. Columns keep the template's order inside each kind; the grid groups columns by kind.", cls: "czm-map-absent" });
    const foot = section.createDiv({ cls: "czm-pg-proposals-foot" });
    const cancel = foot.createEl("button", { text: "Cancel", cls: "czm-pg-template-cancel" });
    cancel.addEventListener("click", () => { this.templateSheet = null; this.renderSide(); });
    const go = foot.createEl("button", { text: "Apply", cls: "czm-pg-template-go mod-cta" });
    go.disabled = sheet.loading || !p || (p.headings.length === 0 && !p.structure && Object.keys(p.jobs).length === 0);
    go.addEventListener("click", () => { go.disabled = true; void this.applyTemplate(); });
  }

  private async applyTemplate(): Promise<void> {
    const sheet = this.templateSheet, project = this.project;
    const t = sheet?.list[sheet.chosen];
    if (!sheet || !sheet.plan || !project || !t) return;
    let result: ApplyResult;
    try { result = await this.source.applyTemplate(project, sheet.plan); } catch (e) { this.status?.fail(couldNot(`apply “${t.name}”`, e)); this.renderSide(); return; }
    this.templateSheet = null;
    this.selection = null;
    // The project note's keys are read on the next build; a short wait lets the cache catch up before the redraw.
    await new Promise((r) => window.setTimeout(r, Object.keys(result.plan.jobs).length ? 300 : 0));
    await this.show(project, true);
    const jobs = Object.keys(result.plan.jobs).length;
    const what = [result.plan.structure ? `${plural(result.plan.scenes, "scene")} in ${plural(t.outline.acts.filter((a) => a.title).length, "act")}` : "", result.added.length ? plural(result.added.length, "column") : "", jobs ? `${plural(jobs, "job")} set` : "", result.beatStops ? `${plural(result.beatStops, "plot point")} filled` : ""].filter(Boolean).join(", ");
    this.status?.undoable(`Applied ${t.name}: ${what || "nothing new"}`, async () => { await result.undo(); await new Promise((r) => window.setTimeout(r, jobs ? 300 : 0)); await this.show(project, true); });
  }

  private renderSaveSheet(section: HTMLElement): void {
    const sheet = this.saveSheet, project = this.project;
    if (!sheet || !project) return;
    const name = section.createDiv({ cls: "czm-pg-field" });
    name.createDiv({ text: "Name", cls: "czm-pg-field-label" });
    const field = name.createEl("input", { cls: "czm-pg-save-name", attr: { type: "text", "aria-label": "Template name", placeholder: "Noir in five moves" } });
    field.value = sheet.name;
    field.addEventListener("input", () => { sheet.name = field.value; });
    field.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") { ev.preventDefault(); void this.saveTemplate(); } });
    section.createDiv({ text: `Folder · ${this.source.templatesFolder() || "the vault root"} (set in Creative Writer settings)`, cls: "czm-map-absent" });
    const parts = section.createDiv({ cls: "czm-pg-field" });
    parts.createDiv({ text: "Includes", cls: "czm-pg-field-label" });
    const partRow = parts.createDiv({ cls: "czm-pg-template-parts" });
    const part = (key: "columns" | "rows", label: string, has: boolean, hint: string) => {
      const l = partRow.createEl("label", { cls: `czm-pg-template-part${has ? "" : " is-off"}` });
      const box = l.createEl("input", { attr: { type: "checkbox", "aria-label": label } });
      box.checked = has && sheet[key]; box.disabled = !has;
      box.addEventListener("change", () => { sheet[key] = box.checked; });
      l.createSpan({ text: `${label} · ${hint}` });
    };
    part("columns", "Columns", this.grid.columns.length > 0, this.grid.columns.length ? `${plural(this.grid.columns.length, "heading")}, jobs kept` : "none yet");
    part("rows", "Rows", !!this.grid.plan && !this.grid.plan.outline.built, this.grid.plan && !this.grid.plan.outline.built ? `${plural(this.grid.plan.outline.scenes, "scene")} from Outline.md, loglines and beats kept` : "no outline");
    section.createDiv({ text: "Stops, readings and prose are not copied. The note gets creative-writer-template in its front matter and never overwrites one with the same name.", cls: "czm-map-absent" });
    const foot = section.createDiv({ cls: "czm-pg-proposals-foot" });
    const cancel = foot.createEl("button", { text: "Cancel", cls: "czm-pg-save-cancel" });
    cancel.addEventListener("click", () => { this.saveSheet = null; this.renderSide(); });
    const go = foot.createEl("button", { text: "Save", cls: "czm-pg-save-go mod-cta" });
    go.addEventListener("click", () => { go.disabled = true; void this.saveTemplate().finally(() => { go.disabled = false; }); });
  }

  private async saveTemplate(): Promise<void> {
    const sheet = this.saveSheet, project = this.project;
    if (!sheet || !project) return;
    const name = sheet.name.trim();
    if (!name) { this.status?.fail("Give the template a name."); return; }
    let path: string;
    try { path = await this.source.saveTemplate(project, name, { columns: sheet.columns, rows: sheet.rows }); } catch (e) { this.status?.fail(couldNot("save the template", e)); return; }
    this.saveSheet = null;
    this.renderSide();
    this.status?.action(`Saved ${path}`, "Open", () => this.source.openNote(path));
  }

  private async build(shape: ScaffoldShape): Promise<void> {
    const project = this.project;
    if (!project) return;
    let result: ScaffoldResult;
    try { result = await this.source.scaffold(project, shape); } catch (e) { this.status?.fail(couldNot("build the manuscript", e)); this.sheet = null; this.renderSide(); return; }
    this.sheet = null;
    this.selection = null;
    await this.show(project, true);
    const p = result.plan;
    this.status?.undoable(`Built ${plural(p.created, "note")}${p.folders.length ? ` in ${plural(p.folders.length, "folder")}` : ""}, ${plural(p.scenes, "scene")}, ${plural(result.relinked, "stop")} relinked`, async () => { await result.undo(); await this.show(project, true); });
  }

  /** A planned scene's menu: more rows around it, its name, its place, and taking it out. */
  private rowMenu(row: GridRow): readonly (MenuEntry | "-")[] {
    return [
      { label: "New scene below", icon: "file-plus", command: "plot-grid-new-scene", onClick: () => void this.newScene(row) },
      { label: "New chapter below", command: "plot-grid-new-chapter", onClick: () => void this.newChapter(row) },
      { label: "New act", command: "plot-grid-new-act", onClick: () => void this.newAct() },
      "-",
      { label: "Rename…", icon: "pencil", onClick: () => this.renameRow(row) },
      { label: "Logline…", onClick: () => { const td = this.body?.querySelector<HTMLElement>(`.czm-pg-scene[data-row="${this.rows.indexOf(row)}"] .czm-pg-plot`); if (td) this.editLogline(row, td); } },
      { label: "Move up", icon: "arrow-up", onClick: () => void this.moveRow(row, -1) },
      { label: "Move down", icon: "arrow-down", onClick: () => void this.moveRow(row, 1) },
      "-",
      { label: "Delete scene", icon: "x", onClick: () => void this.deleteRow(row) },
    ];
  }

  /** The ⋯ on an outline chapter's or act's header row: rename, move, add after, delete. */
  private groupControls(th: HTMLElement, row: GridRow, level: "chapter" | "act"): void {
    const group = row.group;
    if (!group) return;
    const line = level === "chapter" ? group.chapterLine : group.actLine;
    if (line < 0) return;
    const name = level === "chapter" ? group.chapter : group.act;
    const menu = (): readonly (MenuEntry | "-")[] => [
      ...(level === "chapter" ? [{ label: "New chapter below", command: "plot-grid-new-chapter", onClick: () => void this.newChapter(row) } as MenuEntry, "-" as const] : []),
      { label: `Rename ${level}…`, icon: "pencil", onClick: () => this.inlineRename(th.querySelector<HTMLElement>(".czm-pg-group-name") ?? th, name, `Rename the ${level}`, (title) => this.writeOutline(`Renamed “${name}” to “${title}”`, (md) => renameHeading(md, line, title))) },
      { label: `Move ${level} up`, icon: "arrow-up", onClick: () => void this.writeOutline(`Moved “${name}” up`, (md) => moveHeading(md, line, -1)) },
      { label: `Move ${level} down`, icon: "arrow-down", onClick: () => void this.writeOutline(`Moved “${name}” down`, (md) => moveHeading(md, line, 1)) },
      "-",
      { label: `Delete ${level} and its scenes`, icon: "x", onClick: () => void this.writeOutline(`Deleted “${name}” and everything under it`, (md) => removeHeading(md, line)) },
    ];
    const more = th.createEl("button", { cls: "clickable-icon czm-pg-row-more", attr: { "aria-label": `${name || level}: ${level} menu`, "aria-haspopup": "menu" } });
    setIcon(more, "more-horizontal");
    more.addEventListener("click", (ev) => { ev.stopPropagation(); showOverflow(ev, menu()); });
    th.addEventListener("contextmenu", (ev) => { ev.preventDefault(); showOverflow(ev, menu()); });
  }

  /** One write to Outline.md with Undo: the note as it was comes back whole, and anything done alongside is undone with it. */
  private async writeOutline(what: string, change: (markdown: string) => string, alongside: { forward: () => Promise<void>; back: () => Promise<void> } | null = null, then?: () => void): Promise<void> {
    const project = this.project;
    if (!project) return;
    let result: { before: string; after: string };
    try {
      result = await this.source.updateOutline(project, change);
      await alongside?.forward();
    } catch (e) { this.status?.fail(couldNot(what.replace(/^\w/, (c) => c.toLowerCase()), e)); return; }
    if (result.before === result.after) { this.status?.say("Nothing to change there."); return; }
    await this.show(project, true);
    then?.();
    this.status?.undoable(what, async () => { await this.source.updateOutline(project, () => result.before); await alongside?.back(); await this.show(project, true); });
  }

  /** A scene after this row, or at the end of the plan; the new row opens for its name. */
  private async newScene(after: GridRow | null): Promise<void> {
    const at = after?.group ? after.scene.line : null;
    await this.writeOutline("New scene written to Outline.md", (md) => insertScene(md, at), null, () => this.openNewRow(after));
  }

  private async newChapter(after: GridRow | null): Promise<void> {
    const at = after?.group && after.group.chapterLine >= 0 ? after.group.chapterLine : null;
    await this.writeOutline("New chapter written to Outline.md, with a first scene", (md) => insertChapter(md, at), null, () => this.openNewRow(after));
  }

  private async newAct(): Promise<void> {
    await this.writeOutline("New act written to Outline.md, with a chapter and a scene", (md) => insertAct(md), null, () => this.openNewRow(null));
  }

  /** The row just written, "New scene" nearest after the one it was added from, or the last: focus lands on it and its name opens for typing. */
  private openNewRow(after: GridRow | null): void {
    const fresh = this.rows.filter((r) => r.group && r.scene.title === "New scene" && (!after || r.scene.line > after.scene.line));
    const row = after ? fresh[0] : fresh.at(-1);
    if (!row) return;
    this.renameRow(row);
  }

  /** The scene's name as a field in its row; Enter saves, Escape puts it back. A renamed scene keeps its stops: the threads note is relinked. */
  private renameRow(row: GridRow): void {
    const i = this.rows.indexOf(row);
    if (i < 0 || !row.group) return;
    this.ensureRow(i);
    const th = this.body?.querySelector<HTMLElement>(`.czm-pg-scene[data-row="${i}"] .czm-pg-scene-head`);
    if (!th) return;
    const project = this.project;
    this.inlineRename(th, row.scene.title, "Rename the scene", async (title) => {
      if (!project) return;
      const from = sceneLink(row.scene), to = `${basenameOf(row.scene.path)}#${title}`;
      await this.writeOutline(`Renamed “${row.scene.title}” to “${title}”`, (md) => renameHeading(md, row.scene.line, title), { forward: async () => { await this.source.relinkStops(project, from, to); }, back: async () => { await this.source.relinkStops(project, to, from); } });
    });
  }

  /** A field in place of a name; a blur saves like Enter, so a click elsewhere is not a lost rename. */
  private inlineRename(host: HTMLElement, current: string, label: string, save: (title: string) => Promise<void>): void {
    if (this.editing) return;
    this.editing = true;
    host.empty();
    host.addClass("is-renaming");
    const input = host.createEl("input", { cls: "czm-pg-row-rename", attr: { type: "text", "aria-label": label } });
    input.value = current;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      this.editing = false;
      const title = input.value.trim();
      if (ok && title && title !== current) void save(title); else this.renderTable();
    };
    input.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") { ev.preventDefault(); finish(false); } else if (ev.key === "Enter") { ev.preventDefault(); finish(true); } });
    input.addEventListener("click", (ev) => ev.stopPropagation());
    input.addEventListener("blur", () => finish(true));
    input.focus();
    input.select();
  }

  /** The logline as a field in the Plot cell: a comment under the heading in Outline.md, never prose. */
  private editLogline(row: GridRow, td: HTMLElement): void {
    if (this.editing || !row.group) return;
    this.editing = true;
    td.empty();
    td.addClass("is-editing");
    const field = td.createEl("textarea", { cls: "czm-pg-editor czm-pg-logline-field", attr: { rows: "1", "aria-label": `Logline for ${row.scene.title}`, placeholder: "What happens here, in a line" } });
    field.value = row.logline ?? "";
    const grow = () => { field.setCssStyles({ height: "auto" }); field.setCssStyles({ height: `${field.scrollHeight}px` }); };
    field.addEventListener("input", grow);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return;
      done = true;
      this.editing = false;
      const text = field.value.trim();
      if (save && text !== (row.logline ?? "")) void this.writeOutline(text ? `Logline written for “${row.scene.title}”` : `Logline removed from “${row.scene.title}”`, (md) => setLogline(md, row.scene.line, text));
      else this.renderTable();
    };
    field.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") { ev.preventDefault(); finish(false); } else if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); finish(true); } });
    field.addEventListener("click", (ev) => ev.stopPropagation());
    field.addEventListener("blur", () => finish(true));
    field.focus();
    grow();
    field.setSelectionRange(field.value.length, field.value.length);
  }

  private async moveRow(row: GridRow, direction: -1 | 1): Promise<void> {
    if (!row.group) return;
    await this.writeOutline(`Moved “${row.scene.title}” ${direction < 0 ? "up" : "down"}`, (md) => moveHeading(md, row.scene.line, direction));
  }

  private async deleteRow(row: GridRow): Promise<void> {
    if (!row.group) return;
    await this.writeOutline(`Deleted “${row.scene.title}” from Outline.md; its stops stay in Story threads.md until you take them out`, (md) => removeHeading(md, row.scene.line));
  }

  /** Writes the heading; a column picked from a template with a job takes the job too, unless the project already gave it to another column. */
  private async addColumn(name: string, job: SpecialColumn | null = null): Promise<void> {
    const project = this.project;
    if (!project) return;
    try {
      await this.source.addThread(project, name);
    } catch (e) { this.status?.fail(couldNot(`add “${name}”`, e)); return; }
    const taken = job === "time" ? project.plotTime : job === "pov" ? project.plotPov : job === "beats" ? project.plotBeats : job === "main-theme" ? project.plotTheme : undefined;
    const given = job && !taken;
    if (given) { await this.source.setProjectKey(project, SPECIAL_KEY[job], name).catch(() => undefined); await new Promise((r) => window.setTimeout(r, 300)); }
    await this.show(project, true);
    this.status?.say(`Column “${name}” written to Story threads.md${given ? `, and it is the ${SPECIAL_LABEL[job]} column` : job && taken ? ` (the ${SPECIAL_LABEL[job]} job stays with “${taken}”)` : ""}.`);
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

/** "13 Sept" from the snapshot's day, and the label the writer gave the note after it: "13 Sept · before the rewrite". */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
function snapshotLabel(snap: { day: string; label: string }): string {
  const [, m, d] = snap.day.split("-").map(Number);
  const date = m && d && MONTHS[m - 1] ? `${d} ${MONTHS[m - 1]}` : snap.day;
  return snap.label ? `${date} · ${snap.label}` : date;
}

/** A value inside a quoted attribute selector: the two characters that would end it are escaped. */
function attrValue(v: string): string { return v.replace(/["\\]/g, "\\$&"); }

/** The folder a note sits in below the project, read as its act; a note in the project's root has none. */
export function actOf(path: string, scope: string): string {
  const rel = path.startsWith(scope) ? path.slice(scope.length) : path;
  const parts = rel.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join(" · ") : "";
}
