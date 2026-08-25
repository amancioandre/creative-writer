import { describe, it, expect } from "vitest";
import { EMPTY_LOG, baselineWordCount, filterLog, forgetPath, normalizeLog, recordWordCount, renamePath } from "../../../src/domain/progress/WritingLog";

const D = "2026-08-24";

describe("recordWordCount", () => {
  it("only sets the baseline on first sight", () => {
    const log = recordWordCount(EMPTY_LOG, "a.md", 100, D);
    expect(log.counts["a.md"]).toBe(100);
    expect(log.days).toEqual({});
  });

  it("records additions and removals separately", () => {
    let log = recordWordCount(EMPTY_LOG, "a.md", 100, D);
    log = recordWordCount(log, "a.md", 150, D);
    log = recordWordCount(log, "a.md", 120, D);
    expect(log.days[D]).toEqual({ added: 50, removed: 30, files: { "a.md": { added: 50, removed: 30 } } });
    expect(log.counts["a.md"]).toBe(120);
  });

  it("returns the same object when nothing changed", () => {
    const log = recordWordCount(EMPTY_LOG, "a.md", 100, D);
    const same = recordWordCount(log, "a.md", 100, D);
    expect(same.days).toBe(log.days);
  });

  it("keeps files and days apart", () => {
    let log = baselineWordCount(baselineWordCount(EMPTY_LOG, "a.md", 0), "b.md", 0);
    log = recordWordCount(log, "a.md", 10, D);
    log = recordWordCount(log, "b.md", 20, "2026-08-25");
    expect(log.days[D]!.added).toBe(10);
    expect(log.days["2026-08-25"]!.files["b.md"]!.added).toBe(20);
  });
});

describe("baselineWordCount", () => {
  it("does not overwrite a known count", () => {
    const log = baselineWordCount(EMPTY_LOG, "a.md", 100);
    expect(baselineWordCount(log, "a.md", 999)).toBe(log);
  });
});

describe("renamePath / forgetPath", () => {
  it("moves the count and per-file history to the new path", () => {
    let log = baselineWordCount(EMPTY_LOG, "old.md", 0);
    log = recordWordCount(log, "old.md", 40, D);
    log = renamePath(log, "old.md", "new.md");
    expect(log.counts).toEqual({ "new.md": 40 });
    expect(log.days[D]!.files).toEqual({ "new.md": { added: 40, removed: 0 } });
  });

  it("merges into an existing target and ignores no-op renames", () => {
    let log = baselineWordCount(baselineWordCount(EMPTY_LOG, "a.md", 0), "b.md", 0);
    log = recordWordCount(log, "a.md", 10, D);
    log = recordWordCount(log, "b.md", 5, D);
    expect(renamePath(log, "a.md", "a.md")).toBe(log);
    const merged = renamePath(log, "a.md", "b.md");
    expect(merged.days[D]!.files).toEqual({ "b.md": { added: 15, removed: 0 } });
  });

  it("forgets a deleted file's count but keeps its history", () => {
    let log = baselineWordCount(EMPTY_LOG, "a.md", 0);
    log = recordWordCount(log, "a.md", 10, D);
    const gone = forgetPath(log, "a.md");
    expect(gone.counts).toEqual({});
    expect(gone.days[D]!.added).toBe(10);
    expect(forgetPath(gone, "a.md")).toBe(gone);
  });
});

describe("normalizeLog", () => {
  it("round-trips a valid log", () => {
    let log = baselineWordCount(EMPTY_LOG, "a.md", 0);
    log = recordWordCount(log, "a.md", 10, D);
    expect(normalizeLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
  });
  it("drops garbage instead of throwing", () => {
    expect(normalizeLog(null)).toEqual(EMPTY_LOG);
    expect(normalizeLog("x")).toEqual(EMPTY_LOG);
    const out = normalizeLog({ counts: { a: "no", b: -3, c: 4.7 }, days: { bad: {}, "2026-01-01": { added: "x", removed: 2, files: { f: { added: 1 }, g: null } } } });
    expect(out.counts).toEqual({ b: 0, c: 4 });
    expect(out.days).toEqual({ "2026-01-01": { added: 0, removed: 2, files: { f: { added: 1, removed: 0 } } } });
  });
});

describe("filterLog", () => {
  it("keeps only the files the scope accepts and re-totals each day; days left empty disappear", () => {
    let log = recordWordCount(recordWordCount(EMPTY_LOG, "Novel/a.md", 0, D), "Journal/j.md", 0, D);
    log = recordWordCount(log, "Novel/a.md", 100, D);
    log = recordWordCount(log, "Journal/j.md", 40, D);
    log = recordWordCount(log, "Journal/j.md", 10, "2026-08-25");
    const seen = filterLog(log, (p) => p.startsWith("Novel/"));
    expect(seen.days[D]).toEqual({ added: 100, removed: 0, files: { "Novel/a.md": { added: 100, removed: 0 } } });
    expect(seen.days["2026-08-25"]).toBeUndefined();
    expect(seen.counts).toBe(log.counts);
  });
  it("is the identity in content for an all-accepting scope", () => {
    const log = recordWordCount(recordWordCount(EMPTY_LOG, "a.md", 1, D), "a.md", 5, D);
    expect(filterLog(log, () => true)).toEqual(log);
  });
});
