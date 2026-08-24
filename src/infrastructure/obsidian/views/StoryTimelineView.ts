import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ProjectSpec } from "../../../domain/progress/Project";
import type { StoryMapSettings } from "../../../domain/settings/Settings";
import { EMPTY_GRAPH, type Entity, type SceneRef, type StoryGraph } from "../../../domain/story/StoryGraph";
import { basenameOf } from "../../../domain/story/EntityIndex";
import { KIND_LABEL } from "./StoryMapView";

export const STORY_TIMELINE_VIEW_TYPE = "creative-writer-story-timeline";

export interface StoryTimelineSource {
  projects(): ProjectSpec[];
  activeProject(): ProjectSpec | null;
  build(project: ProjectSpec): Promise<StoryGraph>;
  openNote(path: string): void;
  reveal(ref: SceneRef): void;
  settings(): StoryMapSettings;
}

/**
 * Who is where: every scene of the project in reading order down the
 * side, the cast across the top, a dot where someone is present. The
 * shape a story's absences make — "Marta vanishes for forty pages" —
 * shows here before it shows anywhere else.
 */
export class StoryTimelineView extends ItemView {
  private project: ProjectSpec | null = null;
  private graph: StoryGraph = EMPTY_GRAPH;
  private query = "";
  private generation = 0;

  constructor(leaf: WorkspaceLeaf, private readonly source: StoryTimelineSource) {
    super(leaf);
  }

  getViewType(): string { return STORY_TIMELINE_VIEW_TYPE; }
  getDisplayText(): string { return this.project ? `Timeline · ${this.project.name}` : "Story timeline"; }
  getIcon(): string { return "gantt-chart"; }

  async onOpen(): Promise<void> {
    await this.show(this.project ?? this.source.activeProject() ?? this.source.projects()[0] ?? null);
  }

  async show(project: ProjectSpec | null): Promise<void> {
    const generation = ++this.generation;
    this.project = project;
    if (!project) { this.graph = EMPTY_GRAPH; this.render(); return; }
    const graph = await this.source.build(project);
    if (generation !== this.generation) return;
    this.graph = graph;
    this.render();
  }

  async refresh(): Promise<void> {
    if (this.project) await this.show(this.project);
  }

  render(): void {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "czm-tl" });
    const head = root.createDiv({ cls: "czm-tl-head" });
    const projects = this.source.projects();
    const select = head.createEl("select", { cls: "dropdown", attr: { "aria-label": "Project" } }) as HTMLSelectElement;
    for (const p of projects) {
      const opt = select.createEl("option", { text: p.name }) as HTMLOptionElement;
      opt.value = p.scope;
      if (this.project?.scope === p.scope) opt.selected = true;
    }
    select.addEventListener("change", () => void this.show(projects.find((p) => p.scope === select.value) ?? null));
    const search = head.createEl("input", { cls: "czm-map-search", attr: { type: "search", placeholder: "Filter the cast…", "aria-label": "Filter the cast" } }) as HTMLInputElement;
    search.value = this.query;
    search.addEventListener("input", () => { this.query = search.value; this.render(); this.contentEl.querySelector<HTMLInputElement>(".czm-map-search")?.focus(); });

    if (!this.project) { root.createEl("p", { text: "No project yet — put story: true (or writing-target: 50000) in a note's front matter and its folder becomes one.", cls: "czm-map-hint" }); return; }
    const rows = this.graph.timeline;
    const q = this.query.trim().toLowerCase();
    const settings = this.source.settings();
    const columns = this.graph.entities
      .filter((e) => e.appearances.length > 0 && e.kind !== "note" && e.kind !== "reference" && settings.kinds[e.kind])
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)))
      .sort((a, b) => kindOrder(a) - kindOrder(b) || b.mentions - a.mentions);
    if (rows.length === 0 || columns.length === 0) { root.createEl("p", { text: rows.length === 0 ? "No scenes yet — headings with prose under them become scenes." : "Nobody matches.", cls: "czm-map-hint" }); return; }

    head.createSpan({ text: `${rows.length} scene${rows.length === 1 ? "" : "s"} · ${columns.length} in the cast`, cls: "czm-map-hint" });
    const wrap = root.createDiv({ cls: "czm-tl-wrap" });
    const table = wrap.createEl("table", { cls: "czm-tl-table" });
    const thead = table.createEl("thead").createEl("tr");
    thead.createEl("th", { text: "Scene", cls: "czm-tl-corner" });
    for (const c of columns) {
      const th = thead.createEl("th", { cls: "czm-tl-col", attr: { title: `${c.name} — ${KIND_LABEL[c.kind]}, ${c.appearances.length} scene${c.appearances.length === 1 ? "" : "s"}` } });
      th.style.setProperty("--czm-kind", settings.colors[c.kind]);
      const span = th.createSpan({ text: c.name });
      if (c.path) { span.addClass("is-link"); span.addEventListener("click", () => this.source.openNote(c.path!)); }
    }
    const tbody = table.createEl("tbody");
    let lastPath = "";
    for (const row of rows) {
      if (row.scene.path !== lastPath) {
        lastPath = row.scene.path;
        const tr = tbody.createEl("tr", { cls: "czm-tl-note" });
        const th = tr.createEl("th", { attr: { colspan: String(columns.length + 1) } });
        const link = th.createSpan({ text: basenameOf(row.scene.path), cls: "is-link" });
        link.addEventListener("click", () => this.source.openNote(row.scene.path));
      }
      const tr = tbody.createEl("tr", { cls: "czm-tl-scene" });
      const th = tr.createEl("th", { cls: "czm-tl-scene-head", attr: { role: "button", tabindex: "0" } });
      th.createSpan({ text: `${row.bookmarked ? "★ " : ""}${row.scene.title || "(opening)"}`, cls: "czm-map-row-name" });
      th.createSpan({ text: `${row.words.toLocaleString()} w`, cls: "czm-map-row-meta" });
      if (row.events.length) th.createDiv({ text: row.events.join(" · "), cls: "czm-tl-events" });
      th.addEventListener("click", () => this.source.reveal(row.scene));
      th.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") this.source.reveal(row.scene); });
      const present = new Set(row.present);
      for (const c of columns) {
        const on = present.has(c.id);
        const td = tr.createEl("td", { cls: `czm-tl-dot${on ? " is-on" : ""}` });
        if (on) {
          td.style.setProperty("--czm-kind", settings.colors[c.kind]);
          td.setAttribute("aria-label", `${c.name} in ${row.scene.title || basenameOf(row.scene.path)}`);
          td.title = `${c.name} · ${row.scene.title || basenameOf(row.scene.path)}`;
        }
      }
    }
  }
}

const ORDER: Record<Entity["kind"], number> = { character: 0, candidate: 1, faction: 2, location: 3, item: 4, event: 5, note: 6, reference: 7 };
function kindOrder(e: Entity): number { return ORDER[e.kind]; }
