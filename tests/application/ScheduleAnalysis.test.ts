import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScheduleAnalysis } from "../../src/application/use-cases/ScheduleAnalysis";
import type { ParagraphAnalyser } from "../../src/application/ports/ParagraphAnalyser";
import { Finding } from "../../src/domain/style/Finding";

class FakeAnalyser implements ParagraphAnalyser {
  calls: string[] = [];
  aborted = 0;
  delay = 10;
  async analyse(text: string, paragraphFrom: number, signal: AbortSignal): Promise<Finding[]> {
    this.calls.push(text);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, this.delay);
      signal.addEventListener("abort", () => { clearTimeout(t); this.aborted++; reject(new DOMException("aborted", "AbortError")); });
    });
    return [Finding.create("metaphor", paragraphFrom, paragraphFrom + text.length, `note:${text}`)];
  }
}

describe("ScheduleAnalysis", () => {
  let analyser: FakeAnalyser;
  let delivered: { key: string; findings: Finding[] }[];
  let scheduler: ScheduleAnalysis;

  beforeEach(() => {
    vi.useFakeTimers();
    analyser = new FakeAnalyser();
    delivered = [];
    scheduler = new ScheduleAnalysis(analyser, (key, findings) => delivered.push({ key, findings }), { idleMs: 100, cacheSize: 3 });
  });
  afterEach(() => { scheduler.dispose(); vi.useRealTimers(); });

  it("waits for idle before analysing", async () => {
    scheduler.request("hello", 0);
    await vi.advanceTimersByTimeAsync(50);
    expect(analyser.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(60);
    expect(analyser.calls).toEqual(["hello"]);
    await vi.advanceTimersByTimeAsync(20);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.findings[0]!.note).toBe("note:hello");
  });

  it("debounces: rapid requests collapse into one analysis of the latest text", async () => {
    scheduler.request("a", 0);
    await vi.advanceTimersByTimeAsync(30);
    scheduler.request("ab", 0);
    await vi.advanceTimersByTimeAsync(30);
    scheduler.request("abc", 0);
    await vi.advanceTimersByTimeAsync(200);
    expect(analyser.calls).toEqual(["abc"]);
  });

  it("aborts an in-flight analysis when new text arrives", async () => {
    analyser.delay = 500;
    scheduler.request("first", 0);
    await vi.advanceTimersByTimeAsync(150); // now in flight
    scheduler.request("second", 0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(analyser.aborted).toBe(1);
    expect(delivered.map((d) => d.findings[0]!.note)).toEqual(["note:second"]);
  });

  it("serves repeat text from cache without calling the analyser", async () => {
    scheduler.request("same", 0);
    await vi.advanceTimersByTimeAsync(200);
    scheduler.request("other", 0);
    await vi.advanceTimersByTimeAsync(200);
    scheduler.request("same", 0);
    await vi.advanceTimersByTimeAsync(200);
    expect(analyser.calls).toEqual(["same", "other"]);
    expect(delivered).toHaveLength(3);
  });

  it("cache hit re-bases findings to the new paragraph offset", async () => {
    scheduler.request("same", 0);
    await vi.advanceTimersByTimeAsync(200);
    scheduler.request("same", 50);
    await vi.advanceTimersByTimeAsync(200);
    expect(delivered[1]!.findings[0]!.from).toBe(50);
  });

  it("evicts least-recently-used entries beyond cacheSize", async () => {
    for (const t of ["a", "b", "c", "d"]) { scheduler.request(t, 0); await vi.advanceTimersByTimeAsync(200); }
    scheduler.request("a", 0);
    await vi.advanceTimersByTimeAsync(200);
    expect(analyser.calls).toEqual(["a", "b", "c", "d", "a"]);
  });

  it("keys deliveries by a hash of the text so stale results can be discarded", async () => {
    scheduler.request("x", 0);
    await vi.advanceTimersByTimeAsync(200);
    expect(delivered[0]!.key).toBe(ScheduleAnalysis.keyFor("x"));
    expect(ScheduleAnalysis.keyFor("x")).not.toBe(ScheduleAnalysis.keyFor("y"));
  });

  it("swallows analyser errors other than abort, reporting them via onError", async () => {
    const errors: unknown[] = [];
    scheduler.dispose();
    scheduler = new ScheduleAnalysis({ analyse: async () => { throw new Error("boom"); } }, () => undefined, { idleMs: 10, onError: (e) => errors.push(e) });
    scheduler.request("z", 0);
    await vi.advanceTimersByTimeAsync(50);
    expect(errors).toHaveLength(1);
  });

  it("dispose cancels pending and in-flight work", async () => {
    analyser.delay = 500;
    scheduler.request("p", 0);
    await vi.advanceTimersByTimeAsync(150);
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(delivered).toEqual([]);
    expect(analyser.aborted).toBe(1);
  });

  it("reports busy while a call is in flight", async () => {
    const states: boolean[] = [];
    scheduler.dispose();
    scheduler = new ScheduleAnalysis(analyser, () => undefined, { idleMs: 10, onBusy: (b) => states.push(b) });
    scheduler.request("q", 0);
    await vi.advanceTimersByTimeAsync(15);
    expect(states).toEqual([true]);
    await vi.advanceTimersByTimeAsync(20);
    expect(states).toEqual([true, false]);
  });
});
