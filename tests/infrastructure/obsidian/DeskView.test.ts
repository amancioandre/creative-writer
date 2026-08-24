import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { DeskView, DESK_VIEW_TYPE } from "../../../src/infrastructure/obsidian/views/DeskView";
import { ProfileProse } from "../../../src/application/use-cases/ProfileProse";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";

const profile = new ProfileProse(new IntlSentenceSegmenter("en"));

describe("DeskView", () => {
  it("has a stable view type and title", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null });
    expect(v.getViewType()).toBe(DESK_VIEW_TYPE);
    expect(v.getDisplayText()).toBe("Writing desk");
    expect(v.getIcon()).toBeTruthy();
  });

  it("shows a hint when no note is active", async () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => null });
    await v.onOpen();
    expect(v.contentEl.textContent).toContain("Open a note");
  });

  it("renders counts and all three bands for a note", () => {
    const text = '"Go home," she said. He did not. The road was long and the night was longer than either of them expected.';
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => ({ name: "Camp", profile: profile.document(text) }) });
    v.refresh();
    const t = v.contentEl.textContent!;
    expect(t).toContain("Camp");
    expect(t).toMatch(/\d+ words/);
    expect(v.contentEl.querySelectorAll(".czm-desk-band")).toHaveLength(3);
    expect(t).toContain("Flesch");
    expect(t).toMatch(/\d+% of words are spoken/);
  });

  it("says when there is not enough prose", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => ({ name: "Empty", profile: profile.document("# Only a heading") }) });
    v.refresh();
    expect(v.contentEl.textContent).toContain("Not enough prose");
  });

  it("marks rhythm as unmeasured under three sentences", () => {
    const v = new DeskView(new WorkspaceLeaf(), { activeProfile: () => ({ name: "Short", profile: profile.document("One sentence. Two.") }) });
    v.refresh();
    expect(v.contentEl.textContent).toContain("at least three sentences");
  });
});
