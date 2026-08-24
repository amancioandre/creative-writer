import { describe, it, expect, vi } from "vitest";
import { TrackWriting } from "../../src/application/use-cases/TrackWriting";
import { EMPTY_LOG, type WritingLog } from "../../src/domain/progress/WritingLog";
import type { Timers } from "../../src/application/ports/Timers";

/** Manual timers: tests advance time explicitly. */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const queue = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    set(fn, ms) { const id = nextId++; queue.set(id, { at: now + ms, fn }); return id; },
    clear(id) { queue.delete(id); },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...queue].sort((a, b) => a[1].at - b[1].at)) {
      if (t.at <= now) { queue.delete(id); t.fn(); }
    }
  };
  return { timers, advance, pending: () => queue.size };
}

function setup(initial: WritingLog = EMPTY_LOG) {
  const saved: WritingLog[] = [];
  const repo = { load: vi.fn(async () => initial), save: vi.fn(async (l: WritingLog) => { saved.push(l); }) };
  const clock = fakeTimers();
  const changes: WritingLog[] = [];
  const tracker = new TrackWriting(repo, { timers: clock.timers, today: () => "2026-08-24", debounceMs: 500, saveMs: 5000, onChange: (l) => changes.push(l) });
  return { tracker, repo, clock, saved, changes };
}

describe("TrackWriting", () => {
  it("loads the log on start and announces it", async () => {
    const initial = { days: {}, counts: { "a.md": 3 } };
    const { tracker, changes } = setup(initial);
    await tracker.start();
    expect(tracker.current).toBe(initial);
    expect(changes).toEqual([initial]);
  });

  it("debounces a burst of changes into one delta", async () => {
    const { tracker, clock } = setup();
    await tracker.start();
    tracker.opened("a.md", 100);
    tracker.changed("a.md", 101);
    tracker.changed("a.md", 105);
    tracker.changed("a.md", 130);
    clock.advance(499);
    expect(tracker.current.days).toEqual({});
    clock.advance(1);
    expect(tracker.current.days["2026-08-24"]!.added).toBe(30);
  });

  it("throttles saves and writes the latest log", async () => {
    const { tracker, clock, repo, saved } = setup();
    await tracker.start();
    tracker.opened("a.md", 0);
    tracker.changed("a.md", 10);
    clock.advance(500);
    tracker.changed("a.md", 25);
    clock.advance(500);
    expect(repo.save).not.toHaveBeenCalled();
    clock.advance(5000);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(saved[0]!.counts["a.md"]).toBe(25);
  });

  it("follows renames, including a pending change", async () => {
    const { tracker, clock } = setup();
    await tracker.start();
    tracker.opened("a.md", 0);
    tracker.changed("a.md", 10);
    tracker.renamed("a.md", "b.md");
    clock.advance(500);
    expect(tracker.current.counts).toEqual({ "b.md": 10 });
    expect(tracker.current.days["2026-08-24"]!.files).toEqual({ "b.md": { added: 10, removed: 0 } });
  });

  it("drops a pending change for a deleted file", async () => {
    const { tracker, clock } = setup();
    await tracker.start();
    tracker.opened("a.md", 0);
    tracker.changed("a.md", 10);
    tracker.deleted("a.md");
    clock.advance(500);
    expect(tracker.current.days).toEqual({});
    expect(tracker.current.counts).toEqual({});
  });

  it("flush records pending changes and saves immediately", async () => {
    const { tracker, repo, clock } = setup();
    await tracker.start();
    tracker.opened("a.md", 0);
    tracker.changed("a.md", 42);
    await tracker.flush();
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(tracker.current.days["2026-08-24"]!.added).toBe(42);
    expect(clock.pending()).toBe(0);
    await tracker.flush();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
