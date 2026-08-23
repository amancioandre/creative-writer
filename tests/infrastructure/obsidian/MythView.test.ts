import { describe, it, expect } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { MythView, MYTH_VIEW_TYPE } from "../../../src/infrastructure/obsidian/views/MythView";
import { validateMythReport } from "../../../src/domain/myth/MythReport";

const text = "She went down into the cellar where her father had died.";
const report = validateMythReport({
  patterns: [{ name: "Katabasis", evidence: "went down into the cellar", note: "Return must cost something." }],
  archetypes: [{ name: "Threshold guardian", character: "the father", evidence: "her father had died" }],
  summary: "A descent.",
  next: "Bring something back.",
}, text);

describe("MythView", () => {
  it("has a stable view type and title", () => {
    const v = new MythView(new WorkspaceLeaf());
    expect(v.getViewType()).toBe(MYTH_VIEW_TYPE);
    expect(v.getDisplayText()).toMatch(/myth/i);
  });
  it("renders a report with patterns, archetypes, summary and next", () => {
    const v = new MythView(new WorkspaceLeaf());
    v.showReport(report, "deepseek-r1:14b");
    const html = v.contentEl.textContent ?? "";
    expect(html).toContain("Katabasis");
    expect(html).toContain("went down into the cellar");
    expect(html).toContain("Threshold guardian");
    expect(html).toContain("the father");
    expect(html).toContain("A descent.");
    expect(html).toContain("Bring something back.");
    expect(html).toContain("deepseek-r1:14b");
  });
  it("renders busy and error states", () => {
    const v = new MythView(new WorkspaceLeaf());
    v.showBusy("qwen2.5:7b");
    expect(v.contentEl.textContent).toMatch(/analysing/i);
    v.showError("Ollama: connection refused");
    expect(v.contentEl.textContent).toContain("connection refused");
  });
  it("renders an empty report honestly", () => {
    const v = new MythView(new WorkspaceLeaf());
    v.showReport(validateMythReport({}, text), "m");
    expect(v.contentEl.textContent).toMatch(/no clear/i);
  });
  it("never uses innerHTML with model text", () => {
    const v = new MythView(new WorkspaceLeaf());
    v.showReport(validateMythReport({ summary: "<img src=x onerror=alert(1)>", patterns: [], archetypes: [] }, text), "m");
    expect(v.contentEl.querySelector("img")).toBeNull();
    expect(v.contentEl.textContent).toContain("<img");
  });
});
