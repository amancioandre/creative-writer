import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ProseProfile } from "../../../application/use-cases/ProfileProse";
import type { WritingLog } from "../../../domain/progress/WritingLog";
import { addDays, type Day, weekday } from "../../../domain/progress/Dates";
import { heatmap, sessionKind, streak, summarizeDay, totals } from "../../../domain/progress/ProgressSummary";
import type { Scene } from "../../../domain/text/Scenes";
import type { ProjectStatus } from "../../../domain/progress/Project";

export const DESK_VIEW_TYPE = "creative-writer-desk";
const HEATMAP_WEEKS = 12;

export interface DeskSource {
  /** Profile of the active note, or null when no markdown note is active. */
  activeProfile(): { name: string; profile: ProseProfile } | null;
  log(): WritingLog;
  today(): Day;
  dailyGoal(): number;
  /** Every project declared in front matter, with current totals. Async: totals need file reads. */
  projects(): Promise<ProjectStatus[]>;
  /** The active note split at its headings, each with its prose profile. */
  scenes(): { scene: Scene; profile: ProseProfile }[];
  /** Puts the cursor on a line of the active note. */
  revealLine(line: number): void;
}

/**
 * The writing desk: everything about the work that is not the work itself.
 * Lives in a side leaf so Zen Mode hides it with the rest of the chrome.
 */
export class DeskView extends ItemView {
  private generation = 0;

  constructor(leaf: WorkspaceLeaf, private readonly source: DeskSource) {
    super(leaf);
  }

  getViewType(): string {
    return DESK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Writing desk";
  }

  getIcon(): string {
    return "feather";
  }

  async onOpen(): Promise<void> {
    this.refresh();
  }

  refresh(): void {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "czm-desk" });

    root.createEl("h4", { text: "Today" });
    renderProgress(root, this.source.log(), this.source.today(), this.source.dailyGoal());

    const projects = root.createDiv();
    const generation = ++this.generation;
    void this.source.projects().then((list) => {
      if (generation !== this.generation) return;
      renderProjects(projects, list);
    });

    root.createEl("h4", { text: "Readability" });
    const active = this.source.activeProfile();
    if (!active) {
      root.createEl("p", { text: "Open a note to see how it reads.", cls: "czm-desk-hint" });
      return;
    }
    root.createEl("p", { text: active.name, cls: "czm-desk-title" });
    renderProfile(root, active.profile);

    const scenes = this.source.scenes();
    if (scenes.length > 1 || (scenes.length === 1 && scenes[0]!.scene.level > 0)) {
      root.createEl("h4", { text: "Scenes" });
      renderScenes(root, scenes, (line) => this.source.revealLine(line));
    }
  }
}

export function renderScenes(root: HTMLElement, scenes: readonly { scene: Scene; profile: ProseProfile }[], reveal: (line: number) => void): void {
  const list = root.createDiv({ cls: "czm-desk-scenes" });
  const maxWords = Math.max(1, ...scenes.map((s) => s.profile.wordCount));
  for (const { scene, profile } of scenes) {
    const row = list.createDiv({ cls: `czm-desk-scene czm-desk-scene-l${Math.min(scene.level, 3)}` });
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.addEventListener("click", () => reveal(scene.line));
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") reveal(scene.line); });
    const head = row.createDiv({ cls: "czm-desk-band-head" });
    head.createSpan({ text: scene.title || "(before first heading)", cls: "czm-desk-scene-title" });
    head.createSpan({ text: `${profile.wordCount.toLocaleString()} w`, cls: "czm-desk-band-name" });
    const bar = row.createDiv({ cls: "czm-desk-bar czm-desk-scene-bar" });
    bar.createDiv({ cls: "czm-desk-bar-fill" }).style.width = `${Math.round((profile.wordCount / maxWords) * 100)}%`;
    const meta: string[] = [];
    if (profile.readingEase) meta.push(profile.readingEase.band.label);
    if (profile.wordCount > 0) meta.push(`${Math.round(profile.dialogue.ratio * 100)}% dialogue`);
    if (meta.length) row.createDiv({ text: meta.join(" · "), cls: "czm-desk-band-detail" });
  }
}

export function renderProgress(root: HTMLElement, log: WritingLog, today: Day, goal: number): void {
  const day = summarizeDay(log, today, goal);
  const head = root.createDiv({ cls: "czm-desk-today" });
  head.createSpan({ text: `${day.added.toLocaleString()} words`, cls: "czm-desk-today-words" });
  head.createSpan({ text: goal > 0 ? `of ${goal.toLocaleString()}` : "no daily goal", cls: "czm-desk-today-goal" });
  if (goal > 0) {
    const bar = root.createDiv({ cls: "czm-desk-bar" });
    const fill = bar.createDiv({ cls: `czm-desk-bar-fill${day.goalMet ? " is-met" : ""}` });
    fill.style.width = `${Math.round(day.progress * 100)}%`;
  }
  const kind = sessionKind(day.added, day.removed);
  if (kind === "revising") root.createDiv({ text: `Revision day: ${day.removed.toLocaleString()} cut. Cutting is work; the streak counts it when the goal is 0.`, cls: "czm-desk-legend" });
  else if (day.removed > 0) root.createDiv({ text: `${day.removed.toLocaleString()} cut along the way.`, cls: "czm-desk-legend" });

  const s = streak(log, today, goal);
  const weekStart = addDays(today, -weekday(today));
  const week = totals(log, weekStart, today, goal);
  const row = root.createDiv({ cls: "czm-desk-streak" });
  row.createSpan({ text: `Streak ${s.current} day${s.current === 1 ? "" : "s"}` });
  row.createSpan({ text: `Best ${s.longest}` });
  row.createSpan({ text: `This week ${week.added.toLocaleString()}` });

  renderHeatmap(root, log, today, goal);
}

export function renderHeatmap(root: HTMLElement, log: WritingLog, today: Day, goal: number): void {
  const map = heatmap(log, today, HEATMAP_WEEKS, goal);
  const grid = root.createDiv({ cls: "czm-desk-heatmap" });
  grid.setAttribute("aria-label", `Words added per day, last ${HEATMAP_WEEKS} weeks`);
  for (const column of map.columns) {
    for (const cell of column) {
      const el = grid.createDiv({ cls: "czm-desk-cell" });
      if (!cell) {
        el.addClass("is-future");
        continue;
      }
      if (cell.level > 0) el.addClass(`czm-level-${cell.level}`);
      if (cell.kind === "revising") el.addClass("is-revising");
      if (cell.goalMet) el.addClass("is-met");
      el.setAttribute("aria-label", `${cell.day}: ${cell.added} added, ${cell.removed} cut`);
      el.title = `${cell.day}: +${cell.added} −${cell.removed}`;
    }
  }
  root.createDiv({ text: map.max > 0 ? `Busiest day: ${map.max.toLocaleString()} words added or cut. Outlined days met the goal; purple days were mostly revision.` : "Nothing logged yet — write and the calendar fills in.", cls: "czm-desk-legend" });
}

export function renderProjects(root: HTMLElement, projects: readonly ProjectStatus[]): void {
  root.empty();
  if (projects.length === 0) return;
  root.createEl("h4", { text: "Projects" });
  for (const p of projects) {
    const item = root.createDiv({ cls: `czm-desk-project is-${p.verdict}` });
    const head = item.createDiv({ cls: "czm-desk-band-head" });
    head.createSpan({ text: p.spec.name, cls: "czm-desk-band-label" });
    head.createSpan({ text: `${p.totalWords.toLocaleString()} / ${p.spec.targetWords.toLocaleString()} · ${Math.round(p.fraction * 100)}%`, cls: "czm-desk-band-name" });
    const bar = item.createDiv({ cls: "czm-desk-bar" });
    bar.createDiv({ cls: `czm-desk-bar-fill${p.verdict === "done" ? " is-met" : ""}` }).style.width = `${Math.round(p.fraction * 100)}%`;
    item.createDiv({ text: paceLine(p), cls: "czm-desk-band-hint" });
    if (p.today) {
      const daily = item.createDiv({ cls: "czm-desk-project-daily" });
      const row = daily.createDiv({ cls: "czm-desk-band-head" });
      row.createSpan({ text: `Today ${p.today.added.toLocaleString()} of ${p.today.goal.toLocaleString()}`, cls: "czm-desk-band-name" });
      row.createSpan({ text: `Streak ${p.today.streak} day${p.today.streak === 1 ? "" : "s"}`, cls: "czm-desk-band-name" });
      const bar = daily.createDiv({ cls: "czm-desk-bar czm-desk-scene-bar" });
      bar.createDiv({ cls: `czm-desk-bar-fill${p.today.met ? " is-met" : ""}` }).style.width = `${Math.round(p.today.progress * 100)}%`;
    }
  }
}

export function paceLine(p: ProjectStatus): string {
  const n = (v: number) => Math.round(v).toLocaleString();
  switch (p.verdict) {
    case "done":
      return "Target reached.";
    case "stalled":
      return p.neededPerDay !== null ? `Nothing added this week. ${n(p.neededPerDay)} words a day would still make ${p.spec.deadline}.` : "Nothing added this week.";
    case "no-deadline":
      return `Writing ${n(p.recentPerDay)} a day; at this pace done around ${p.projectedDay}.`;
    case "on-track":
      return `${n(p.neededPerDay!)} a day needed, writing ${n(p.recentPerDay)}. On track: done around ${p.projectedDay}, deadline ${p.spec.deadline}.`;
    case "behind":
      return p.daysLeft! <= 0
        ? `Deadline ${p.spec.deadline} has passed with ${n(p.remaining)} words to go; writing ${n(p.recentPerDay)} a day.`
        : `${n(p.neededPerDay!)} a day needed, writing ${n(p.recentPerDay)}. At this pace done around ${p.projectedDay}, after the ${p.spec.deadline} deadline.`;
  }
}

export function renderProfile(root: HTMLElement, p: ProseProfile): void {
  const counts = root.createDiv({ cls: "czm-desk-counts" });
  counts.createSpan({ text: `${p.wordCount.toLocaleString()} words` });
  counts.createSpan({ text: `${p.sentenceCount.toLocaleString()} sentences` });
  counts.createSpan({ text: `${p.paragraphCount.toLocaleString()} paragraphs` });

  if (!p.readingEase) {
    root.createEl("p", { text: "Not enough prose to measure yet.", cls: "czm-desk-hint" });
    return;
  }
  band(root, "Reading ease", p.readingEase.band.label, p.readingEase.band.hint, `Flesch ${Math.round(p.readingEase.score)} · grade ${Math.max(0, p.readingEase.grade).toFixed(1)}`);
  if (p.variety) band(root, "Sentence rhythm", p.variety.band.label, p.variety.band.hint, `${p.sentenceCount} sentences, variation ${Math.round(p.variety.cv * 100)}%`);
  else band(root, "Sentence rhythm", "—", "Needs at least three sentences.", "");
  band(root, "Dialogue", p.dialogue.band.label, p.dialogue.band.hint, `${Math.round(p.dialogue.ratio * 100)}% of words are spoken`);
}

function band(root: HTMLElement, name: string, label: string, hint: string, detail: string): void {
  const row = root.createDiv({ cls: "czm-desk-band" });
  const head = row.createDiv({ cls: "czm-desk-band-head" });
  head.createSpan({ text: name, cls: "czm-desk-band-name" });
  head.createSpan({ text: label, cls: "czm-desk-band-label" });
  row.createDiv({ text: hint, cls: "czm-desk-band-hint" });
  if (detail) row.createDiv({ text: detail, cls: "czm-desk-band-detail" });
}
