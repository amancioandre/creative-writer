import { describe, it, expect } from "vitest";
import { EMPTY_LOG, baselineWordCount, recordWordCount, type WritingLog } from "../../../src/domain/progress/WritingLog";
import { heatmap, streak, summarizeDay, totals } from "../../../src/domain/progress/ProgressSummary";

/** Builds a log where each listed day had `added` words written to one file. */
function logOf(entries: Record<string, number>): WritingLog {
  let log = baselineWordCount(EMPTY_LOG, "a.md", 0);
  let count = 0;
  for (const [day, added] of Object.entries(entries)) {
    count += added;
    log = recordWordCount(log, "a.md", count, day);
  }
  return log;
}

describe("summarizeDay", () => {
  it("reports progress against a goal", () => {
    const s = summarizeDay(logOf({ "2026-08-24": 250 }), "2026-08-24", 500);
    expect(s).toMatchObject({ added: 250, removed: 0, net: 250, progress: 0.5, goalMet: false });
    expect(summarizeDay(logOf({ "2026-08-24": 900 }), "2026-08-24", 500).progress).toBe(1);
  });
  it("without a goal, any addition counts as a written day", () => {
    expect(summarizeDay(logOf({ "2026-08-24": 1 }), "2026-08-24", 0)).toMatchObject({ progress: 0, goalMet: true });
    expect(summarizeDay(EMPTY_LOG, "2026-08-24", 0).goalMet).toBe(false);
  });
});

describe("streak", () => {
  it("counts consecutive goal-met days ending today", () => {
    const log = logOf({ "2026-08-22": 500, "2026-08-23": 600, "2026-08-24": 500 });
    expect(streak(log, "2026-08-24", 500)).toEqual({ current: 3, longest: 3 });
  });
  it("keeps the streak alive if today is not yet written", () => {
    const log = logOf({ "2026-08-22": 500, "2026-08-23": 600 });
    expect(streak(log, "2026-08-24", 500).current).toBe(2);
    expect(streak(log, "2026-08-25", 500).current).toBe(0);
  });
  it("a short day breaks the streak and longest remembers the past", () => {
    const log = logOf({ "2026-08-10": 500, "2026-08-11": 500, "2026-08-12": 500, "2026-08-13": 10, "2026-08-24": 500 });
    expect(streak(log, "2026-08-24", 500)).toEqual({ current: 1, longest: 3 });
  });
  it("is empty for an empty log", () => {
    expect(streak(EMPTY_LOG, "2026-08-24", 500)).toEqual({ current: 0, longest: 0 });
  });
});

describe("heatmap", () => {
  it("lays out Monday-first columns ending in today's week, future days null", () => {
    const map = heatmap(logOf({ "2026-08-24": 100 }), "2026-08-26", 2, 0); // Wednesday
    expect(map.columns).toHaveLength(2);
    expect(map.columns[1]!.map((c) => c?.day)).toEqual(["2026-08-24", "2026-08-25", "2026-08-26", undefined, undefined, undefined, undefined]);
    expect(map.columns[0]![0]!.day).toBe("2026-08-17");
  });
  it("levels cells by quartile of the period's max", () => {
    const map = heatmap(logOf({ "2026-08-20": 100, "2026-08-21": 50, "2026-08-22": 10 }), "2026-08-24", 2, 60);
    const by = Object.fromEntries(map.columns.flat().filter(Boolean).map((c) => [c!.day, c!]));
    expect(map.max).toBe(100);
    expect(by["2026-08-20"]!.level).toBe(4);
    expect(by["2026-08-21"]!.level).toBe(2);
    expect(by["2026-08-22"]!.level).toBe(1);
    expect(by["2026-08-23"]!.level).toBe(0);
    expect(by["2026-08-20"]!.goalMet).toBe(true);
    expect(by["2026-08-21"]!.goalMet).toBe(false);
  });
});

describe("totals", () => {
  it("sums a period inclusively", () => {
    const log = logOf({ "2026-08-20": 100, "2026-08-24": 500, "2026-08-25": 5 });
    expect(totals(log, "2026-08-20", "2026-08-24", 200)).toEqual({ added: 600, removed: 0, daysWritten: 1 });
  });
});

describe("sessionKind", () => {
  it("classifies days by whether deletion dominated", async () => {
    const { sessionKind } = await import("../../../src/domain/progress/ProgressSummary");
    expect(sessionKind(0, 0)).toBe("none");
    expect(sessionKind(100, 20)).toBe("drafting");
    expect(sessionKind(50, 50)).toBe("revising");
    expect(sessionKind(0, 300)).toBe("revising");
  });
});
