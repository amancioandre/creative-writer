import { describe, it, expect } from "vitest";
import { inScope, parseProjectFrontmatter, projectStatus, recentAdded } from "../../../src/domain/progress/Project";
import { EMPTY_LOG, baselineWordCount, recordWordCount } from "../../../src/domain/progress/WritingLog";

describe("parseProjectFrontmatter — story-ignore", () => {
  it("reads a list or a comma string, trimmed", () => {
    expect(parseProjectFrontmatter({ "writing-target": 1, "story-ignore": [" LOW", "POV", 3] }, "a/b.md")!.ignoredNames).toEqual(["LOW", "POV"]);
    expect(parseProjectFrontmatter({ "writing-target": 1, "story-ignore": "LOW, POV" }, "a/b.md")!.ignoredNames).toEqual(["LOW", "POV"]);
    expect(parseProjectFrontmatter({ "writing-target": 1 }, "a/b.md")!.ignoredNames).toEqual([]);
  });
});

describe("parseProjectFrontmatter", () => {
  it("reads writing-goal as writing-daily, the key writers reach for", () => {
    expect(parseProjectFrontmatter({ "writing-target": "5000", "writing-goal": "1000" }, "WH/Thesis.md")!.dailyWords).toBe(1000);
  });
  it("scopes to the note's folder by default and names it after the folder", () => {
    const spec = parseProjectFrontmatter({ "writing-target": 50000, "writing-deadline": "2026-10-31" }, "Novels/Camp/notes.md");
    expect(spec).toEqual({ name: "Camp", scope: "Novels/Camp/", targetWords: 50000, deadline: "2026-10-31", dailyWords: 0, notePath: "Novels/Camp/notes.md", ignoredNames: [] });
  });
  it("can scope to the note alone, accepts string numbers and a custom name", () => {
    const spec = parseProjectFrontmatter({ "writing-target": "8000", "writing-scope": "note", "writing-name": "The Creek" }, "Stories/creek.md");
    expect(spec).toEqual({ name: "The Creek", scope: "Stories/creek.md", targetWords: 8000, deadline: null, dailyWords: 0, notePath: "Stories/creek.md", ignoredNames: [] });
  });
  it("handles vault-root notes and Date deadlines", () => {
    const spec = parseProjectFrontmatter({ "writing-target": 100, "writing-deadline": new Date(Date.UTC(2026, 11, 1)) }, "root.md");
    expect(spec).toMatchObject({ name: "root", scope: "", deadline: "2026-12-01" });
  });
  it("accepts story: true as a project with no target — mapped, not paced", () => {
    expect(parseProjectFrontmatter({ story: true }, "Reading/Dune/Dune.md")).toEqual({ name: "Dune", scope: "Reading/Dune/", targetWords: 0, deadline: null, dailyWords: 0, notePath: "Reading/Dune/Dune.md", ignoredNames: [] });
    expect(parseProjectFrontmatter({ story: "true", "story-ignore": ["Bene"] }, "a/b.md")!.ignoredNames).toEqual(["Bene"]);
    expect(parseProjectFrontmatter({ story: true, "writing-target": 500 }, "a/b.md")!.targetWords).toBe(500);
    expect(parseProjectFrontmatter({ story: false }, "a.md")).toBeNull();
    expect(parseProjectFrontmatter({ story: "yes" }, "a.md")).toBeNull();
  });
  it("ignores notes without a positive target or bad deadlines", () => {
    expect(parseProjectFrontmatter({}, "a.md")).toBeNull();
    expect(parseProjectFrontmatter({ "writing-target": 0 }, "a.md")).toBeNull();
    expect(parseProjectFrontmatter({ "writing-target": "lots" }, "a.md")).toBeNull();
    expect(parseProjectFrontmatter({ "writing-target": 10, "writing-deadline": "soon" }, "a.md")!.deadline).toBeNull();
    expect(parseProjectFrontmatter(null, "a.md")).toBeNull();
  });
  it("reads a per-project daily goal, ignoring junk", () => {
    expect(parseProjectFrontmatter({ "writing-target": 10, "writing-daily": "250" }, "a.md")!.dailyWords).toBe(250);
    expect(parseProjectFrontmatter({ "writing-target": 10, "writing-daily": -5 }, "a.md")!.dailyWords).toBe(0);
  });
});

describe("inScope", () => {
  it("matches folder prefixes and exact notes", () => {
    const folder = { name: "", scope: "Novels/Camp/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "Novels/Camp/Project.md", ignoredNames: [] };
    expect(inScope(folder, "Novels/Camp/ch1.md")).toBe(true);
    expect(inScope(folder, "Novels/Camping/ch1.md")).toBe(false);
    expect(inScope({ ...folder, scope: "" }, "anything.md")).toBe(true);
    expect(inScope({ ...folder, scope: "a.md" }, "a.md")).toBe(true);
    expect(inScope({ ...folder, scope: "a.md" }, "a.md.bak")).toBe(false);
  });
});

describe("recentAdded", () => {
  it("sums in-scope additions per day, oldest first", () => {
    let log = baselineWordCount(baselineWordCount(EMPTY_LOG, "P/a.md", 0), "other.md", 0);
    log = recordWordCount(log, "P/a.md", 100, "2026-08-22");
    log = recordWordCount(log, "other.md", 999, "2026-08-23");
    log = recordWordCount(log, "P/a.md", 150, "2026-08-24");
    expect(recentAdded(log, { name: "P", scope: "P/", targetWords: 1, deadline: null, dailyWords: 0, notePath: "P/Project.md", ignoredNames: [] }, "2026-08-24", 3)).toEqual([100, 0, 50]);
  });
});

describe("projectStatus", () => {
  const spec = { name: "Camp", scope: "Camp/", targetWords: 10000, deadline: "2026-09-03", dailyWords: 0, notePath: "Camp/Project.md", ignoredNames: [] };
  const today = "2026-08-24";

  it("has no today block without a daily goal, and one with it", () => {
    expect(projectStatus(spec, 0, [100], today).today).toBeNull();
    const s = projectStatus({ ...spec, dailyWords: 200 }, 0, [0, 150], today, 3);
    expect(s.today).toEqual({ added: 150, goal: 200, progress: 0.75, met: false, streak: 3 });
  });

  it("is on track when the recent pace reaches the target before the deadline", () => {
    const s = projectStatus(spec, 7000, [500, 500, 500], today);
    expect(s).toMatchObject({ remaining: 3000, fraction: 0.7, daysLeft: 10, neededPerDay: 300, recentPerDay: 500, projectedDay: "2026-08-30", verdict: "on-track" });
  });
  it("is behind when the projection lands after the deadline", () => {
    expect(projectStatus(spec, 7000, [100, 100], today).verdict).toBe("behind");
  });
  it("is stalled with no recent words, done at the target, and no-deadline without one", () => {
    expect(projectStatus(spec, 7000, [0, 0], today)).toMatchObject({ verdict: "stalled", projectedDay: null });
    expect(projectStatus(spec, 12000, [0], today)).toMatchObject({ verdict: "done", remaining: 0, fraction: 1, neededPerDay: null });
    expect(projectStatus({ ...spec, deadline: null }, 7000, [100], today)).toMatchObject({ verdict: "no-deadline", daysLeft: null, neededPerDay: null });
  });
  it("asks for everything today once the deadline has passed", () => {
    expect(projectStatus(spec, 7000, [100], "2026-09-05")).toMatchObject({ daysLeft: -2, neededPerDay: 3000 });
  });
});

describe("projectStreak", () => {
  it("counts consecutive days meeting the project's own goal, in scope only", async () => {
    const { projectStreak } = await import("../../../src/domain/progress/Project");
    let log = baselineWordCount(baselineWordCount(EMPTY_LOG, "P/a.md", 0), "other.md", 0);
    log = recordWordCount(log, "P/a.md", 200, "2026-08-22");
    log = recordWordCount(log, "P/a.md", 400, "2026-08-23");
    log = recordWordCount(log, "other.md", 900, "2026-08-24");
    const spec = { name: "P", notePath: "P/P.md", scope: "P/", targetWords: 1, deadline: null, dailyWords: 200, ignoredNames: [] };
    expect(projectStreak(log, spec, "2026-08-24")).toBe(2);
    expect(projectStreak(log, spec, "2026-08-25")).toBe(0);
    expect(projectStreak(log, { ...spec, dailyWords: 0 }, "2026-08-24")).toBe(0);
  });
});
