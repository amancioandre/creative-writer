import { type Day, addDays, weekday } from "./Dates";
import type { WritingLog } from "./WritingLog";

export interface DaySummary {
  readonly day: Day;
  readonly added: number;
  readonly removed: number;
  readonly net: number;
  /** 0 when there is no goal. */
  readonly goal: number;
  /** Fraction of the goal reached, capped at 1; 0 without a goal. */
  readonly progress: number;
  readonly goalMet: boolean;
}

/** A day counts as written when it meets the goal, or, with no goal, when anything was added. */
export function summarizeDay(log: WritingLog, day: Day, goal: number): DaySummary {
  const e = log.days[day];
  const added = e?.added ?? 0;
  const removed = e?.removed ?? 0;
  const progress = goal > 0 ? Math.min(1, added / goal) : 0;
  return { day, added, removed, net: added - removed, goal, progress, goalMet: goal > 0 ? added >= goal : added > 0 };
}

export interface Streak {
  /** Consecutive written days ending today or yesterday (today is still in play). */
  readonly current: number;
  readonly longest: number;
}

export function streak(log: WritingLog, today: Day, goal: number): Streak {
  const written = (day: Day) => summarizeDay(log, day, goal).goalMet;

  let current = 0;
  let day = written(today) ? today : addDays(today, -1);
  while (written(day)) {
    current += 1;
    day = addDays(day, -1);
  }

  let longest = 0;
  let run = 0;
  let prev: Day | null = null;
  for (const d of Object.keys(log.days).sort()) {
    if (!written(d)) {
      run = 0;
      prev = null;
      continue;
    }
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    longest = Math.max(longest, run);
  }
  return { current, longest: Math.max(longest, current) };
}

export interface HeatmapCell {
  readonly day: Day;
  readonly added: number;
  readonly removed: number;
  /** 0 (nothing) to 4 (top quartile of the period). */
  readonly level: number;
  readonly goalMet: boolean;
}

export interface Heatmap {
  /** Column-major: `columns[week][weekday]`, Monday first, ending on `today`'s week. */
  readonly columns: readonly (readonly (HeatmapCell | null)[])[];
  readonly max: number;
}

/** The last `weeks` weeks, laid out like a contributions calendar. Future days in the last week are null. */
export function heatmap(log: WritingLog, today: Day, weeks: number, goal: number): Heatmap {
  const end = addDays(today, 6 - weekday(today));
  const start = addDays(end, -(weeks * 7 - 1));
  const cells: HeatmapCell[] = [];
  let max = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    if (day > today) break;
    const s = summarizeDay(log, day, goal);
    max = Math.max(max, s.added);
    cells.push({ day, added: s.added, removed: s.removed, level: 0, goalMet: s.goalMet });
  }
  const levelled = cells.map((c) => ({ ...c, level: level(c.added, max) }));
  const columns: (HeatmapCell | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    columns.push(Array.from({ length: 7 }, (_, d) => levelled[w * 7 + d] ?? null));
  }
  return { columns, max };
}

function level(added: number, max: number): number {
  if (added <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((added / max) * 4));
}

export interface PeriodTotals {
  readonly added: number;
  readonly removed: number;
  readonly daysWritten: number;
}

export function totals(log: WritingLog, from: Day, to: Day, goal: number): PeriodTotals {
  let added = 0;
  let removed = 0;
  let daysWritten = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const s = summarizeDay(log, day, goal);
    added += s.added;
    removed += s.removed;
    if (s.goalMet) daysWritten += 1;
  }
  return { added, removed, daysWritten };
}
