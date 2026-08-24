import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ProseProfile } from "../../../application/use-cases/ProfileProse";
import type { WritingLog } from "../../../domain/progress/WritingLog";
import { addDays, type Day, weekday } from "../../../domain/progress/Dates";
import { heatmap, streak, summarizeDay, totals } from "../../../domain/progress/ProgressSummary";

export const DESK_VIEW_TYPE = "creative-writer-desk";
const HEATMAP_WEEKS = 12;

export interface DeskSource {
  /** Profile of the active note, or null when no markdown note is active. */
  activeProfile(): { name: string; profile: ProseProfile } | null;
  log(): WritingLog;
  today(): Day;
  dailyGoal(): number;
}

/**
 * The writing desk: everything about the work that is not the work itself.
 * Lives in a side leaf so Zen Mode hides it with the rest of the chrome.
 */
export class DeskView extends ItemView {
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

    root.createEl("h4", { text: "Readability" });
    const active = this.source.activeProfile();
    if (!active) {
      root.createEl("p", { text: "Open a note to see how it reads.", cls: "czm-desk-hint" });
      return;
    }
    root.createEl("p", { text: active.name, cls: "czm-desk-title" });
    renderProfile(root, active.profile);
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
  if (day.removed > 0) root.createDiv({ text: `${day.removed.toLocaleString()} cut — revising counts.`, cls: "czm-desk-legend" });

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
      if (cell.goalMet) el.addClass("is-met");
      el.setAttribute("aria-label", `${cell.day}: ${cell.added} added, ${cell.removed} cut`);
      el.title = `${cell.day}: +${cell.added} −${cell.removed}`;
    }
  }
  root.createDiv({ text: map.max > 0 ? `Darkest day: ${map.max.toLocaleString()} words. Outlined days met the goal.` : "Nothing logged yet — write and the calendar fills in.", cls: "czm-desk-legend" });
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
