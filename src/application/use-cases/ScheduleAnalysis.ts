import type { Finding } from "../../domain/style/Finding";
import type { ParagraphAnalyser } from "../ports/ParagraphAnalyser";

export interface ScheduleOptions {
  /** Quiet time after the last request before analysing. */
  readonly idleMs?: number;
  /** Paragraph results kept in the LRU. */
  readonly cacheSize?: number;
  readonly onError?: (error: unknown) => void;
}

export type Deliver = (key: string, findings: Finding[]) => void;

/**
 * Turns a stream of "the paragraph is now X" requests into the minimum
 * number of analyser calls:
 *   - debounce: only the latest text after `idleMs` of quiet is analysed;
 *   - cancel: a new request aborts the in-flight call;
 *   - cache: results are keyed by a hash of the text and re-based to the
 *     requested offset, so moving the cursor back into a paragraph is free.
 *
 * Delivery is keyed by the text hash so the consumer can discard results for
 * a paragraph that has since changed.
 */
export class ScheduleAnalysis {
  private readonly idleMs: number;
  private readonly cacheSize: number;
  private readonly onError: (e: unknown) => void;
  private readonly cache = new Map<string, Finding[]>(); // insertion order = LRU order
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: AbortController | null = null;
  private pending: { text: string; from: number } | null = null;
  private disposed = false;

  constructor(
    private readonly analyser: ParagraphAnalyser,
    private readonly deliver: Deliver,
    options: ScheduleOptions = {},
  ) {
    this.idleMs = options.idleMs ?? 600;
    this.cacheSize = options.cacheSize ?? 200;
    this.onError = options.onError ?? (() => undefined);
  }

  /** Stable, cheap content hash (FNV-1a). Not cryptographic; collisions only cost a wrong cache hit. */
  static keyFor(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return `${text.length}:${(h >>> 0).toString(16)}`;
  }

  request(text: string, paragraphFrom: number): void {
    if (this.disposed) return;
    this.pending = { text, from: paragraphFrom };
    this.inflight?.abort();
    this.inflight = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), this.idleMs);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.inflight?.abort();
    this.inflight = null;
    this.pending = null;
  }

  private async run(): Promise<void> {
    this.timer = null;
    const job = this.pending;
    this.pending = null;
    if (!job) return;

    const key = ScheduleAnalysis.keyFor(job.text);
    const cached = this.cacheGet(key);
    if (cached) {
      this.deliver(key, rebase(cached, job.from));
      return;
    }

    const controller = new AbortController();
    this.inflight = controller;
    try {
      const findings = await this.analyser.analyse(job.text, job.from, controller.signal);
      if (controller.signal.aborted || this.disposed) return;
      this.cacheSet(key, rebase(findings, -job.from)); // store paragraph-relative
      this.deliver(key, findings);
    } catch (e) {
      if (!isAbort(e) && !this.disposed) this.onError(e);
    } finally {
      if (this.inflight === controller) this.inflight = null;
    }
  }

  private cacheGet(key: string): Finding[] | undefined {
    const v = this.cache.get(key);
    if (v) {
      this.cache.delete(key);
      this.cache.set(key, v); // refresh recency
    }
    return v;
  }

  private cacheSet(key: string, v: Finding[]): void {
    this.cache.set(key, v);
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
    }
  }
}

const rebase = (fs: readonly Finding[], by: number) => fs.map((f) => f.shifted(by));
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
