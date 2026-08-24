import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { DeskView, DESK_VIEW_TYPE } from "../../../src/infrastructure/obsidian/views/DeskView";
import { ProfileProse } from "../../../src/application/use-cases/ProfileProse";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";
import { EMPTY_LOG } from "../../../src/domain/progress/WritingLog";

const profile = new ProfileProse(new IntlSentenceSegmenter("en"));
const progress = { log: () => EMPTY_LOG, today: () => "2026-08-24", dailyGoal: () => 500, projects: async () => [], scenes: () => [], revealLine: () => undefined };

describe("DeskView", () => {
  it("has a stable view type and title", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null, ...progress });
    expect(v.getViewType()).toBe(DESK_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Writing desk");
    expect(v.getIcon()).toBeTruthy();
  });

  it("shows a hint when no note is active", async () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null, ...progress });
    await v.onOpen();
    expect(v.contentEl.textContent).toContain("Open a note");
  });

  it("renders counts and all three bands for a note", () => {
    const text = '"Go home," she said. He did not. The road was long and the night was longer than either of them expected.';
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => ({ name: "Camp", profile: profile.document(text) }), ...progress });
    v.refresh();
    const t = v.contentEl.textContent!;
    expect(t).toContain("Camp");
    expect(t).toMatch(/\d+ words/);
    expect(v.contentEl.querySelectorAll(".czm-desk-band")).toHaveLength(3);
    expect(t).toContain("Flesch");
    expect(t).toMatch(/\d+% of words are spoken/);
  });

  it("says when there is not enough prose", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => ({ name: "Empty", profile: profile.document("# Only a heading") }), ...progress });
    v.refresh();
    expect(v.contentEl.textContent).toContain("Not enough prose");
  });

  it("marks rhythm as unmeasured under three sentences", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => ({ name: "Short", profile: profile.document("One sentence. Two.") }), ...progress });
    v.refresh();
    expect(v.contentEl.textContent).toContain("at least three sentences");
  });
});

describe("DeskView progress", () => {
  it("renders today's words, goal bar, streak and a 12-week heatmap", async () => {
    const { baselineWordCount, recordWordCount } = await import("../../../src/domain/progress/WritingLog");
    let log = baselineWordCount(EMPTY_LOG, "a.md", 0);
    log = recordWordCount(log, "a.md", 300, "2026-08-23");
    log = recordWordCount(log, "a.md", 250, "2026-08-24");
    log = recordWordCount(log, "a.md", 900, "2026-08-24");
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null, ...progress, log: () => log });
    v.refresh();
    const t = v.contentEl.textContent!;
    expect(t).toContain("650 words");
    expect(t).toContain("of 500");
    expect(t).toContain("50 cut");
    expect(t).toContain("Streak 1 day");
    expect(v.contentEl.querySelector(".czm-desk-bar-fill.is-met")).not.toBeNull();
    expect(v.contentEl.querySelectorAll(".czm-desk-cell")).toHaveLength(12 * 7);
    expect(v.contentEl.querySelectorAll(".czm-desk-cell.is-future")).toHaveLength(6);
    expect(v.contentEl.querySelectorAll(".czm-desk-cell.czm-level-4")).toHaveLength(1);
  });

  it("omits the bar without a goal and explains an empty calendar", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null, ...progress, dailyGoal: () => 0 });
    v.refresh();
    expect(v.contentEl.querySelector(".czm-desk-bar")).toBeNull();
    expect(v.contentEl.textContent).toContain("no daily goal");
    expect(v.contentEl.textContent).toContain("Nothing logged yet");
  });
});

describe("DeskView projects", () => {
  it("renders each project with a bar and a pace line", async () => {
    const { projectStatus } = await import("../../../src/domain/progress/Project");
    const spec = { name: "Camp", scope: "Camp/", targetWords: 10000, deadline: "2026-09-03", dailyWords: 400, notePath: "Camp/Project.md", ignoredNames: [] };
    const list = [projectStatus(spec, 7000, [500], "2026-08-24", 2), projectStatus({ ...spec, name: "Slow", dailyWords: 0 }, 7000, [10], "2026-08-24")];
    const v = new DeskView(new WorkspaceLeaf(), { ...progress, activeProfile: () => null, projects: async () => list });
    v.refresh();
    await Promise.resolve();
    const t = v.contentEl.textContent!;
    expect(t).toContain("Projects");
    expect(t).toContain("7,000 / 10,000 · 70%");
    expect(t).toContain("On track");
    expect(t).toContain("after the 2026-09-03 deadline");
    expect(v.contentEl.querySelectorAll(".czm-desk-project.is-behind")).toHaveLength(1);
    expect(v.contentEl.querySelectorAll(".czm-desk-project-daily")).toHaveLength(1);
    expect(t).toContain("Today 500 of 400");
    expect(t).toContain("Streak 2 days");
  });

  it("shows no Projects heading when none are declared", async () => {
    const v = new DeskView(new WorkspaceLeaf(), { ...progress, activeProfile: () => null });
    v.refresh();
    await Promise.resolve();
    expect(v.contentEl.textContent).not.toContain("Projects");
  });
});

describe("DeskView scenes and revision days", () => {
  it("lists scenes with per-scene metrics and jumps on click", async () => {
    const { splitScenes } = await import("../../../src/domain/text/Scenes");
    const md = '# One\nShort scene. "Hi," she said.\n\n## Two\nA much longer scene that goes on and on with several sentences. It keeps going. And going.';
    const scenes = splitScenes(md).map((scene) => ({ scene, profile: profile.paragraph(scene.prose) }));
    const revealed: number[] = [];
    const v = new DeskView(new WorkspaceLeaf(), { ...progress, activeProfile: () => ({ name: "N", profile: profile.document(md) }), scenes: () => scenes, revealLine: (l) => revealed.push(l) });
    v.refresh();
    const rows = v.contentEl.querySelectorAll<HTMLElement>(".czm-desk-scene");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.textContent).toContain("Two");
    expect(rows[1]!.textContent).toMatch(/\d+% dialogue/);
    expect(rows[1]!.className).toContain("czm-desk-scene-l2");
    rows[1]!.click();
    expect(revealed).toEqual([3]);
  });

  it("hides the Scenes section for a note without headings", () => {
    const v = new DeskView(new WorkspaceLeaf(), { ...progress, activeProfile: () => ({ name: "N", profile: profile.document("plain") }), scenes: () => [{ scene: { title: "", level: 0, line: 0, prose: "plain" }, profile: profile.paragraph("plain") }] });
    v.refresh();
    expect(v.contentEl.textContent).not.toContain("Scenes");
  });

  it("marks a mostly-deleting day as revision", async () => {
    const { baselineWordCount, recordWordCount } = await import("../../../src/domain/progress/WritingLog");
    let log = baselineWordCount(EMPTY_LOG, "a.md", 1000);
    log = recordWordCount(log, "a.md", 400, "2026-08-24");
    const v = new DeskView(new WorkspaceLeaf(), { ...progress, activeProfile: () => null, log: () => log, dailyGoal: () => 0 });
    v.refresh();
    expect(v.contentEl.textContent).toContain("Revision day: 600 cut");
    expect(v.contentEl.querySelectorAll(".czm-desk-cell.is-revising")).toHaveLength(1);
    expect(v.contentEl.querySelectorAll(".czm-desk-cell.czm-level-4")).toHaveLength(1);
  });
});
