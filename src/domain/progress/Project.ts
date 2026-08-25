import { type Day, addDays, daysBetween, isDay } from "./Dates";
import type { WritingLog } from "./WritingLog";
import { pathInScope } from "../scope/NoteScope";

/**
 * A project is declared in a note's front matter:
 *   writing-target: 50000        (words)
 *   writing-deadline: 2026-10-31 (optional)
 *   writing-scope: note          (optional; default is the note's folder)
 *   writing-daily: 500           (optional; words per day on this project; `writing-goal` is read as the same)
 *   story-ignore: [LOW, POV]     (optional; capitalised words the story map must not take for names)
 * The folder — or that one note — is what gets counted.
 *
 * Any note inside the project may carry `story-order: 3` to fix its place
 * in the manuscript; notes without it follow in path order (see Order.ts).
 *
 * A folder can also be a project with no goal at all:
 *   story: true
 * — a novel being read and mapped rather than written, or a map sketched
 * before a word exists. The story map and timeline see it; the writing
 * desk, which paces words against a target, does not.
 */
export interface ProjectSpec {
  readonly name: string;
  /** The note carrying the front matter — where project-level decisions are written back. */
  readonly notePath: string;
  /** A folder prefix ending in "/" (or "" for the vault root), or a single note's path. */
  readonly scope: string;
  /** 0 for a `story: true` project: nothing to count towards. */
  readonly targetWords: number;
  readonly deadline: Day | null;
  /** Words to add to this project per day; 0 = none. */
  readonly dailyWords: number;
  /** Names the writer said are not names, as written. */
  readonly ignoredNames: readonly string[];
}

export function parseProjectFrontmatter(frontmatter: unknown, notePath: string): ProjectSpec | null {
  const fm = (frontmatter && typeof frontmatter === "object" ? frontmatter : {}) as Record<string, unknown>;
  const target = Number(fm["writing-target"]);
  const hasTarget = Number.isFinite(target) && target > 0;
  const storyOnly = fm["story"] === true || fm["story"] === "true";
  if (!hasTarget && !storyOnly) return null;
  const rawDeadline = fm["writing-deadline"];
  const deadline = isDay(rawDeadline) ? rawDeadline : rawDeadline instanceof Date ? toIso(rawDeadline) : null;
  const slash = notePath.lastIndexOf("/");
  const folder = slash < 0 ? "" : notePath.slice(0, slash + 1);
  const noteScope = fm["writing-scope"] === "note";
  const base = notePath.slice(slash + 1).replace(/\.md$/i, "");
  const name = typeof fm["writing-name"] === "string" && fm["writing-name"].trim() ? fm["writing-name"].trim() : noteScope || !folder ? base : folder.slice(0, -1).split("/").pop()!;
  const daily = Number(fm["writing-daily"] ?? fm["writing-goal"]);
  const rawIgnore = fm["story-ignore"];
  const ignoredNames = (Array.isArray(rawIgnore) ? rawIgnore : typeof rawIgnore === "string" ? rawIgnore.split(",") : []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  return { name, notePath, scope: noteScope ? notePath : folder, targetWords: hasTarget ? Math.floor(target) : 0, deadline, dailyWords: Number.isFinite(daily) && daily > 0 ? Math.floor(daily) : 0, ignoredNames };
}

function toIso(d: Date): Day {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function inScope(spec: ProjectSpec, path: string): boolean {
  return pathInScope(path, spec.scope);
}

/** Words added to the project's files over the `days` days ending today, oldest first. */
export function recentAdded(log: WritingLog, spec: ProjectSpec, today: Day, days: number): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const entry = log.days[addDays(today, -i)];
    let sum = 0;
    if (entry) for (const [path, f] of Object.entries(entry.files)) if (inScope(spec, path)) sum += f.added;
    out.push(sum);
  }
  return out;
}

export interface ProjectStatus {
  readonly spec: ProjectSpec;
  readonly totalWords: number;
  readonly fraction: number;
  readonly remaining: number;
  /** Null without a deadline; negative when it has passed. */
  readonly daysLeft: number | null;
  /** Words per day to hit the deadline; null without one or when done. */
  readonly neededPerDay: number | null;
  /** Average words per day over the recent window. */
  readonly recentPerDay: number;
  /** At the recent pace, the day the target is reached; null when done or pace is zero. */
  readonly projectedDay: Day | null;
  readonly verdict: "done" | "on-track" | "behind" | "no-deadline" | "stalled";
  /** Today's words on this project against its own daily goal; null when the project has none. */
  readonly today: { added: number; goal: number; progress: number; met: boolean; streak: number } | null;
}

/** Consecutive days (ending today or yesterday) on which the project's daily goal was met. */
export function projectStreak(log: WritingLog, spec: ProjectSpec, today: Day): number {
  if (spec.dailyWords <= 0) return 0;
  const addedOn = (day: Day) => recentAdded(log, spec, day, 1)[0]!;
  let streak = 0;
  let day = addedOn(today) >= spec.dailyWords ? today : addDays(today, -1);
  while (addedOn(day) >= spec.dailyWords) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function projectStatus(spec: ProjectSpec, totalWords: number, recent: readonly number[], today: Day, streak = 0): ProjectStatus {
  const remaining = Math.max(0, spec.targetWords - totalWords);
  const fraction = Math.min(1, totalWords / spec.targetWords);
  const recentPerDay = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const daysLeft = spec.deadline ? daysBetween(today, spec.deadline) : null;
  const neededPerDay = remaining === 0 || daysLeft === null ? null : daysLeft <= 0 ? remaining : remaining / daysLeft;
  const projectedDay = remaining === 0 || recentPerDay <= 0 ? null : addDays(today, Math.ceil(remaining / recentPerDay));

  let verdict: ProjectStatus["verdict"];
  if (remaining === 0) verdict = "done";
  else if (recentPerDay <= 0) verdict = "stalled";
  else if (daysLeft === null) verdict = "no-deadline";
  else verdict = projectedDay !== null && projectedDay <= spec.deadline! ? "on-track" : "behind";

  const addedToday = recent[recent.length - 1] ?? 0;
  const todayStatus = spec.dailyWords > 0
    ? { added: addedToday, goal: spec.dailyWords, progress: Math.min(1, addedToday / spec.dailyWords), met: addedToday >= spec.dailyWords, streak }
    : null;
  return { spec, totalWords, fraction, remaining, daysLeft, neededPerDay, recentPerDay, projectedDay, verdict, today: todayStatus };
}
