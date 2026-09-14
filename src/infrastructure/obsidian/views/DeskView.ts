import { ItemView, type WorkspaceLeaf } from "obsidian";
import { renderJumps, type PanelId } from "./PanelShell";
import type { ProseProfile } from "../../../application/use-cases/ProfileProse";
import type { WritingLog } from "../../../domain/progress/WritingLog";
import { addDays, type Day, weekday } from "../../../domain/progress/Dates";
import { heatmap, sessionKind, streak, summarizeDay, totals, type HeatmapCell } from "../../../domain/progress/ProgressSummary";
import type { Scene } from "../../../domain/text/Scenes";
import type { ProjectStatus } from "../../../domain/progress/Project";
import { echoVerdict, type EchoGroup } from "../../../domain/echoes/Echoes";
import type { SceneRef } from "../../../domain/story/StoryGraph";

/** The active project's echoes, for the list on the desk. */
export interface DeskEchoes {
  readonly project: string;
  readonly groups: readonly EchoGroup[];
}

/** How many echoes the desk lists. */
export const DESK_ECHOES = 10;

export const DESK_VIEW_TYPE = "creative-writer-desk";
const HEATMAP_WEEKS = 12;

export interface DeskSource {
  /** Opens a sibling panel. */
  jumpTo(to: PanelId): void;
  /** How many rhythm tiers the editor colours, for the key. */
  rhythmTiers(): number;
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
  /** The echo finder's phrases for the project the active note is in; null when it is in none. Async: reads the project. */
  echoes(): Promise<DeskEchoes | null>;
  /** Opens a scene of the project in the editor. */
  revealScene(ref: SceneRef): void;
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
    renderJumps(root.createDiv({ cls: "czm-desk-jumps" }), "desk", (to) => this.source.jumpTo(to));

    root.createEl("h4", { text: "Today" });
    renderProgress(root, this.source.log(), this.source.today(), this.source.dailyGoal());

    const projects = root.createDiv({ attr: { "aria-live": "polite" } });
    const generation = ++this.generation;
    void this.source.projects().then((list) => {
      if (generation !== this.generation) return;
      renderProjects(projects, list);
    });

    const echoes = root.createDiv();
    void this.source.echoes().then((found) => {
      if (generation !== this.generation || !found) return;
      renderEchoes(echoes, found, (ref) => this.source.revealScene(ref));
    });

    root.createEl("h4", { text: "Readability" });
    const active = this.source.activeProfile();
    if (!active) {
      // The row stays; only its body waits.
      root.createEl("p", { text: "Open a note and this fills in.", cls: "czm-desk-hint" });
      return;
    }
    root.createEl("p", { text: active.name, cls: "czm-desk-title" });
    renderProfile(root, active.profile);
    renderEditorKey(root, this.source.rhythmTiers());

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
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(scene.line); } });
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

/**
 * What the writer overuses, ranked the way it matters: a phrase spread
 * over many scenes before one used often in a single place. The list
 * is a view over the threads model's echoes; the threads view draws the
 * same pairs and is where a motif is kept.
 */
export function renderEchoes(root: HTMLElement, found: DeskEchoes, reveal: (ref: SceneRef) => void): void {
  root.empty();
  root.createEl("h4", { text: "Echoes" });
  if (found.groups.length === 0) {
    root.createEl("p", { text: `No repeated phrases heard in ${found.project}.`, cls: "czm-desk-hint" });
    return;
  }
  const ranked = [...found.groups].sort((a, b) => b.scenes - a.scenes || b.stops.length - a.stops.length || a.nearest - b.nearest || a.text.localeCompare(b.text)).slice(0, DESK_ECHOES);
  const list = root.createDiv({ cls: "czm-desk-echoes" });
  for (const g of ranked) {
    const row = list.createDiv({ cls: `czm-desk-echo is-${echoVerdict(g)}`, attr: { role: "button", tabindex: "0", title: `“${g.text}” — ${g.stops.map((s) => s.scene.title || s.scene.path).join(", ")}` } });
    const go = () => reveal(g.stops[0]!.scene);
    row.addEventListener("click", go);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    const head = row.createDiv({ cls: "czm-desk-band-head" });
    head.createSpan({ text: g.text, cls: "czm-desk-echo-text" });
    head.createSpan({ text: `${g.stops.length}×`, cls: "czm-desk-band-name" });
    const verdict = echoVerdict(g);
    row.createDiv({ text: `${g.scenes} scene${g.scenes === 1 ? "" : "s"} · ${g.nearest === 0 ? "twice in one scene" : `nearest ${g.nearest} apart`} · ${verdict === "habit" ? "a habit" : verdict === "tic" ? "a tic" : "an echo"}`, cls: "czm-desk-band-detail" });
  }
  if (found.groups.length > ranked.length) root.createDiv({ text: `+${found.groups.length - ranked.length} more in the story threads view`, cls: "czm-desk-hint" });
}

export function renderProgress(root: HTMLElement, log: WritingLog, today: Day, goal: number): void {
  const day = summarizeDay(log, today, goal);
  const kind = sessionKind(day.added, day.removed);
  // The headline is the decision, not the measurement: how far to go, or that the goal is met.
  const head = root.createDiv({ cls: "czm-desk-today" });
  const toGo = Math.max(0, goal - day.added);
  const headline = goal > 0 ? (day.goalMet ? "Goal met" : `${toGo.toLocaleString()} to go`) : `${day.added.toLocaleString()} words`;
  head.createSpan({ text: headline, cls: "czm-desk-verdict" });
  const pace = goal > 0
    ? (day.goalMet ? "Done today" : kind === "revising" ? "Revision day" : day.added >= goal / 2 ? "Halfway" : day.added > 0 ? "Under way" : "Not started")
    : (kind === "revising" ? "Revision day" : day.added > 0 ? "Writing" : "Not started");
  head.createSpan({ text: pace, cls: `czm-desk-pace-word is-${pace.toLowerCase().replace(/\s+/g, "-")}` });
  const sub = goal > 0 ? `${day.added.toLocaleString()} of ${goal.toLocaleString()}` : `${day.added.toLocaleString()} added · no daily goal`;
  root.createDiv({ text: day.removed > 0 ? `${sub} · ${day.removed.toLocaleString()} cut` : sub, cls: "czm-desk-today-sub czm-desk-mono" });
  if (goal > 0) {
    const bar = root.createDiv({ cls: "czm-desk-bar" });
    const fill = bar.createDiv({ cls: `czm-desk-bar-fill${day.goalMet ? " is-met" : ""}` });
    fill.style.width = `${Math.round(day.progress * 100)}%`;
  }
  if (kind === "revising") root.createDiv({ text: `Revision day: ${day.removed.toLocaleString()} cut. Cutting is work; the streak counts it when the goal is 0.`, cls: "czm-desk-legend" });

  // The streak facts on one line, in figures that line up.
  const s = streak(log, today, goal);
  const weekStart = addDays(today, -weekday(today));
  const week = totals(log, weekStart, today, goal);
  root.createDiv({ text: `Streak ${s.current} · best ${s.longest} · week ${week.added.toLocaleString()}`, cls: "czm-desk-streak czm-desk-mono" });

  renderHeatmap(root, log, today, goal);
}

export function renderHeatmap(root: HTMLElement, log: WritingLog, today: Day, goal: number): void {
  const map = heatmap(log, today, HEATMAP_WEEKS, goal);
  const cells = map.columns.flat().filter((c): c is HeatmapCell => !!c);
  const written = cells.filter((c) => c.added + c.removed > 0).length;
  const head = root.createDiv({ cls: "czm-desk-band-head czm-desk-heat-head" });
  head.createSpan({ text: `Last ${HEATMAP_WEEKS} weeks`, cls: "czm-desk-band-name" });
  head.createSpan({ text: `${written} of ${cells.length} days written`, cls: "czm-desk-band-name czm-desk-mono" });
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
  if (map.max === 0) { root.createDiv({ text: "Nothing logged yet — write and the calendar fills in.", cls: "czm-desk-legend" }); return; }
  // The key is a key: four swatches for volume, the outline for the goal, the hollow cell for a day that mostly cut.
  const key = root.createDiv({ cls: "czm-desk-key czm-desk-heatmap-key", attr: { "aria-label": "Heatmap key" } });
  const ramp = key.createSpan({ cls: "czm-desk-key-item" });
  ramp.createSpan({ text: "fewer", cls: "czm-desk-key-word" });
  for (const level of [1, 2, 3, 4]) ramp.createSpan({ cls: `czm-desk-key-cell czm-level-${level}` });
  ramp.createSpan({ text: `more, up to ${map.max.toLocaleString()} words touched`, cls: "czm-desk-key-word" });
  const met = key.createSpan({ cls: "czm-desk-key-item" });
  met.createSpan({ cls: "czm-desk-key-cell czm-level-2 is-met" });
  met.createSpan({ text: "goal met", cls: "czm-desk-key-word" });
  const cut = key.createSpan({ cls: "czm-desk-key-item" });
  cut.createSpan({ cls: "czm-desk-key-cell czm-level-2 is-revising" });
  cut.createSpan({ text: "mostly cut", cls: "czm-desk-key-word" });
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
    // One verdict with a dot, then the dates on labelled lines, so a projection is never mistaken for a deadline.
    const pace = item.createDiv({ cls: `czm-desk-pace is-${p.verdict}`, attr: { title: paceLine(p) } });
    pace.createSpan({ cls: "czm-desk-pace-dot" });
    pace.createSpan({ text: paceWord(p), cls: "czm-desk-pace-word" });
    const clause = paceClause(p);
    if (clause) pace.createSpan({ text: ` · ${clause}`, cls: "czm-desk-pace-clause" });
    for (const [label, day] of paceDates(p)) {
      const line = item.createDiv({ cls: "czm-desk-date czm-desk-mono" });
      line.createSpan({ text: label, cls: "czm-desk-date-label" });
      line.createSpan({ text: prettyDay(day) });
    }
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

/** A day for a sentence, "Mon, 7 Sept" in the app's locale (with the year once it is another year), never the raw ISO string. */
export function prettyDay(day: Day, locale?: string, thisYear = new Date().getFullYear()): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", ...(y === thisYear ? {} : { year: "numeric" }) });
}

/** The verdict in a word or two. */
export function paceWord(p: ProjectStatus): string {
  const passed = p.daysLeft !== null && p.daysLeft <= 0;
  switch (p.verdict) {
    case "done": return "Done";
    case "on-track": return "On track";
    case "behind": return passed ? "Deadline passed" : "Behind";
    case "stalled": return passed ? "Deadline passed" : "Stalled";
    case "no-deadline": return "No deadline";
  }
}

/** The one clause after the verdict: what the pace is and what it would take. */
export function paceClause(p: ProjectStatus): string {
  const n = (v: number) => Math.round(v).toLocaleString();
  const passed = p.daysLeft !== null && p.daysLeft <= 0;
  switch (p.verdict) {
    case "done": return "";
    case "on-track": return `${n(p.neededPerDay!)} a day needed, writing ${n(p.recentPerDay)}`;
    case "behind": return passed ? `${n(p.remaining)} words to go, writing ${n(p.recentPerDay)} a day` : `${n(p.neededPerDay!)} a day needed, writing ${n(p.recentPerDay)}`;
    case "stalled": return passed ? `${n(p.remaining)} words to go, nothing added this week` : p.neededPerDay !== null ? `nothing added this week; ${n(p.neededPerDay)} a day would still make it` : "nothing added this week";
    case "no-deadline": return `writing ${n(p.recentPerDay)} a day`;
  }
}

/** The dates a project has, each with its label. */
export function paceDates(p: ProjectStatus): [string, Day][] {
  const out: [string, Day][] = [];
  if (p.projectedDay && p.verdict !== "done") out.push(["Projected", p.projectedDay]);
  if (p.spec.deadline) out.push(["Deadline", p.spec.deadline]);
  return out;
}

export function paceLine(p: ProjectStatus, locale?: string): string {
  const n = (v: number) => Math.round(v).toLocaleString(locale);
  const when = (day: Day) => prettyDay(day, locale);
  const passed = p.daysLeft !== null && p.daysLeft <= 0;
  switch (p.verdict) {
    case "done":
      return "Target reached.";
    case "stalled":
      if (passed) return `Deadline ${when(p.spec.deadline!)} has passed with ${n(p.remaining)} words to go. Nothing added this week.`;
      return p.neededPerDay !== null ? `Nothing added this week. ${n(p.neededPerDay)} words a day would still make ${when(p.spec.deadline!)}.` : "Nothing added this week.";
    case "no-deadline":
      return `Writing ${n(p.recentPerDay)} a day; at this pace done around ${when(p.projectedDay!)}.`;
    case "on-track":
      return `${n(p.neededPerDay!)} a day needed, writing ${n(p.recentPerDay)}. On track: done around ${when(p.projectedDay!)}, deadline ${when(p.spec.deadline!)}.`;
    case "behind":
      return passed
        ? `Deadline ${when(p.spec.deadline!)} has passed with ${n(p.remaining)} words to go; writing ${n(p.recentPerDay)} a day.`
        : `${n(p.neededPerDay!)} a day needed, writing ${n(p.recentPerDay)}. At this pace done around ${when(p.projectedDay!)}, after the ${when(p.spec.deadline!)} deadline.`;
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

/** Names of the style checks, in the order the key shows them. */
const STYLE_KEY: readonly (readonly [string, string])[] = [["cliche", "cliché"], ["passive", "passive"], ["filter", "filter verb"], ["adverb", "adverb"], ["repetition", "repetition"], ["nominalization", "nominalisation"], ["weakverb", "weak verb"], ["metaphor", "metaphor"]];

/** What the editor's colours mean: the rhythm tiers cool to warm, and the tint of each style check. The one place the encoding is written down. */
export function renderEditorKey(root: HTMLElement, tiers: number): void {
  const key = root.createDiv({ cls: "czm-desk-key czm-desk-editor-key", attr: { "aria-label": "Editor colours" } });
  const rhythm = key.createSpan({ cls: "czm-desk-key-item" });
  rhythm.createSpan({ text: "Rhythm: short", cls: "czm-desk-key-word" });
  for (let t = 1; t <= Math.max(1, Math.min(6, tiers)); t++) rhythm.createSpan({ cls: `czm-desk-key-swatch czm-rhythm-${t}` });
  rhythm.createSpan({ text: "long", cls: "czm-desk-key-word" });
  const style = key.createSpan({ cls: "czm-desk-key-item" });
  style.createSpan({ text: "Style:", cls: "czm-desk-key-word" });
  for (const [kind, name] of STYLE_KEY) style.createSpan({ text: name, cls: `czm-desk-key-tint czm-style-${kind}` });
}

function band(root: HTMLElement, name: string, label: string, hint: string, detail: string): void {
  const row = root.createDiv({ cls: "czm-desk-band" });
  const head = row.createDiv({ cls: "czm-desk-band-head" });
  head.createSpan({ text: name, cls: "czm-desk-band-name" });
  head.createSpan({ text: label, cls: "czm-desk-band-label" });
  row.createDiv({ text: hint, cls: "czm-desk-band-hint" });
  if (detail) row.createDiv({ text: detail, cls: "czm-desk-band-detail" });
}
