import { type Day, isDay } from "./Dates";

export interface FileDelta {
  readonly added: number;
  readonly removed: number;
}

export interface DayEntry extends FileDelta {
  readonly files: Readonly<Record<string, FileDelta>>;
}

/**
 * Everything the dashboard knows. `counts` is the last word count seen per
 * file, so the next observation can be turned into a delta; `days` is the
 * history. Deleting words is work too, so removals are kept, not netted.
 */
export interface WritingLog {
  readonly days: Readonly<Record<Day, DayEntry>>;
  readonly counts: Readonly<Record<string, number>>;
}

export const EMPTY_LOG: WritingLog = { days: {}, counts: {} };

/** Records a fresh word count for a file. The first sighting only sets the baseline. */
export function recordWordCount(log: WritingLog, path: string, words: number, day: Day): WritingLog {
  const previous = log.counts[path];
  const counts = { ...log.counts, [path]: words };
  if (previous === undefined || previous === words) return { ...log, counts };

  const delta = words - previous;
  const added = Math.max(0, delta);
  const removed = Math.max(0, -delta);
  const entry = log.days[day] ?? { added: 0, removed: 0, files: {} };
  const file = entry.files[path] ?? { added: 0, removed: 0 };
  return {
    counts,
    days: {
      ...log.days,
      [day]: {
        added: entry.added + added,
        removed: entry.removed + removed,
        files: { ...entry.files, [path]: { added: file.added + added, removed: file.removed + removed } },
      },
    },
  };
}

/**
 * The log seen through a scope: only the files `keep` accepts contribute to
 * each day. The log itself records every note it was shown, so a change of
 * scope re-derives history instead of losing it. Baselines are kept as they are.
 */
export function filterLog(log: WritingLog, keep: (path: string) => boolean): WritingLog {
  const days: Record<Day, DayEntry> = {};
  for (const [day, entry] of Object.entries(log.days)) {
    let added = 0;
    let removed = 0;
    const files: Record<string, FileDelta> = {};
    for (const [path, f] of Object.entries(entry.files)) {
      if (!keep(path)) continue;
      files[path] = f;
      added += f.added;
      removed += f.removed;
    }
    if (Object.keys(files).length > 0) days[day] = { added, removed, files };
  }
  return { days, counts: log.counts };
}

/** Sets the baseline for a file not yet seen, so its first edit is measured from here. */
export function baselineWordCount(log: WritingLog, path: string, words: number): WritingLog {
  if (log.counts[path] !== undefined) return log;
  return { ...log, counts: { ...log.counts, [path]: words } };
}

export function renamePath(log: WritingLog, from: string, to: string): WritingLog {
  if (from === to) return log;
  const counts = { ...log.counts };
  if (from in counts) {
    counts[to] = counts[from]!;
    delete counts[from];
  }
  const days: Record<Day, DayEntry> = {};
  for (const [day, entry] of Object.entries(log.days)) {
    if (!(from in entry.files)) {
      days[day] = entry;
      continue;
    }
    const files = { ...entry.files };
    const moved = files[from]!;
    delete files[from];
    const existing = files[to];
    files[to] = existing ? { added: existing.added + moved.added, removed: existing.removed + moved.removed } : moved;
    days[day] = { ...entry, files };
  }
  return { days, counts };
}

export function forgetPath(log: WritingLog, path: string): WritingLog {
  if (!(path in log.counts)) return log;
  const counts = { ...log.counts };
  delete counts[path];
  return { ...log, counts };
}

const nonNegative = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Anything unreadable is dropped rather than crashing the plugin over a hand-edited file. */
export function normalizeLog(raw: unknown): WritingLog {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const counts: Record<string, number> = {};
  if (r.counts && typeof r.counts === "object") {
    for (const [path, v] of Object.entries(r.counts as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) counts[path] = nonNegative(v);
    }
  }
  const days: Record<Day, DayEntry> = {};
  if (r.days && typeof r.days === "object") {
    for (const [day, v] of Object.entries(r.days as Record<string, unknown>)) {
      if (!isDay(day) || !v || typeof v !== "object") continue;
      const e = v as Record<string, unknown>;
      const files: Record<string, FileDelta> = {};
      if (e.files && typeof e.files === "object") {
        for (const [path, f] of Object.entries(e.files as Record<string, unknown>)) {
          if (!f || typeof f !== "object") continue;
          const fd = f as Record<string, unknown>;
          files[path] = { added: nonNegative(fd.added), removed: nonNegative(fd.removed) };
        }
      }
      days[day] = { added: nonNegative(e.added), removed: nonNegative(e.removed), files };
    }
  }
  return { days, counts };
}
