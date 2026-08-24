import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { DeskView, DESK_VIEW_TYPE } from "../../../src/infrastructure/obsidian/views/DeskView";
import { ProfileProse } from "../../../src/application/use-cases/ProfileProse";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";
import { EMPTY_LOG } from "../../../src/domain/progress/WritingLog";

const profile = new ProfileProse(new IntlSentenceSegmenter("en"));
const progress = { log: () => EMPTY_LOG, today: () => "2026-08-24", dailyGoal: () => 500 };

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
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null, log: () => log, today: () => "2026-08-24", dailyGoal: () => 500 });
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
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null, log: () => EMPTY_LOG, today: () => "2026-08-24", dailyGoal: () => 0 });
    v.refresh();
    expect(v.contentEl.querySelector(".czm-desk-bar")).toBeNull();
    expect(v.contentEl.textContent).toContain("no daily goal");
    expect(v.contentEl.textContent).toContain("Nothing logged yet");
  });
});
