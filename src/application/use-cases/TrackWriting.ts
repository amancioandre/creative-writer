import type { Day } from "../../domain/progress/Dates";
import { EMPTY_LOG, baselineWordCount, forgetPath, recordWordCount, renamePath, type WritingLog } from "../../domain/progress/WritingLog";
import type { ProgressRepository } from "../ports/ProgressRepository";
import type { Timers } from "../ports/Timers";

export interface TrackWritingOptions {
  readonly timers: Timers;
  readonly today: () => Day;
  /** Quiet time after a keystroke before a file's count is recorded. */
  readonly debounceMs: number;
  /** How long a dirty log may sit before it is written to disk. */
  readonly saveMs: number;
  readonly onChange?: (log: WritingLog) => void;
}

/**
 * Turns a stream of "this file now has N words" observations into the
 * writing log. Per-file debounce keeps a burst of keystrokes to one delta;
 * saving is throttled separately so a long session does not thrash disk.
 */
export class TrackWriting {
  private log: WritingLog = EMPTY_LOG;
  private readonly pending = new Map<string, { path: string; timer: number; words: number }>();
  private saveTimer: number | null = null;
  private dirty = false;

  constructor(private readonly repo: ProgressRepository, private readonly options: TrackWritingOptions) {}

  async start(): Promise<void> {
    this.log = await this.repo.load();
    this.options.onChange?.(this.log);
  }

  get current(): WritingLog {
    return this.log;
  }

  /** A file came into view: remember its size so the first edit is measured from here, not from zero. */
  opened(path: string, words: number): void {
    this.apply(baselineWordCount(this.log, path, words));
  }

  changed(path: string, words: number): void {
    const existing = this.pending.get(path);
    if (existing) this.options.timers.clear(existing.timer);
    // The entry is looked up by its current path when the timer fires, so a rename in between is honoured.
    const entry = { path, words, timer: 0 };
    entry.timer = this.options.timers.set(() => {
      this.pending.delete(entry.path);
      this.apply(recordWordCount(this.log, entry.path, entry.words, this.options.today()));
    }, this.options.debounceMs);
    this.pending.set(path, entry);
  }

  renamed(from: string, to: string): void {
    const pending = this.pending.get(from);
    if (pending) {
      this.pending.delete(from);
      pending.path = to;
      this.pending.set(to, pending);
    }
    this.apply(renamePath(this.log, from, to));
  }

  deleted(path: string): void {
    const pending = this.pending.get(path);
    if (pending) {
      this.options.timers.clear(pending.timer);
      this.pending.delete(path);
    }
    this.apply(forgetPath(this.log, path));
  }

  /** Records everything still debouncing and writes to disk. Call on unload. */
  async flush(): Promise<void> {
    for (const [path, p] of this.pending) {
      this.options.timers.clear(p.timer);
      this.log = recordWordCount(this.log, path, p.words, this.options.today());
      this.dirty = true;
    }
    this.pending.clear();
    if (this.saveTimer !== null) {
      this.options.timers.clear(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      this.dirty = false;
      this.options.onChange?.(this.log);
      await this.repo.save(this.log);
    }
  }

  private apply(next: WritingLog): void {
    if (next === this.log) return;
    this.log = next;
    this.dirty = true;
    this.options.onChange?.(next);
    if (this.saveTimer === null) {
      this.saveTimer = this.options.timers.set(() => {
        this.saveTimer = null;
        this.dirty = false;
        void this.repo.save(this.log);
      }, this.options.saveMs);
    }
  }
}
