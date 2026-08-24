import { describe, it, expect, afterEach } from "vitest";
import { readabilityStatusExtension, statusLabel } from "../../../src/infrastructure/codemirror/readabilityStatusExtension";
import { ProfileProse, type ProseProfile } from "../../../src/application/use-cases/ProfileProse";
import { IntlSentenceSegmenter } from "../../../src/infrastructure/segmentation/IntlSentenceSegmenter";
import { mount, type Harness } from "./helpers";

const DOC = "Go. Then a longer sentence follows it. And a third to allow variety.\n\nOther paragraph here.";

describe("readabilityStatusExtension", () => {
  let h: Harness;
  afterEach(() => h?.destroy());

  function setup(settings = {}) {
    const reports: (ProseProfile | null)[] = [];
    h = mount(DOC, readabilityStatusExtension(new ProfileProse(new IntlSentenceSegmenter("en")), (p) => reports.push(p)), settings);
    return reports;
  }

  it("reports the cursor paragraph on mount and when the cursor changes paragraph", () => {
    const reports = setup();
    expect(reports.at(-1)?.sentenceCount).toBe(3);
    h.moveCursor(DOC.length);
    expect(reports.at(-1)?.sentenceCount).toBe(1);
  });

  it("does not re-report when the paragraph text is unchanged", () => {
    const reports = setup();
    const n = reports.length;
    h.moveCursor(5);
    expect(reports.length).toBe(n);
  });

  it("reports null on a blank line and when disabled", () => {
    const reports = setup();
    h.moveCursor(DOC.indexOf("\n\n") + 1);
    expect(reports.at(-1)).toBeNull();
    h.moveCursor(0);
    h.setSettings({ readabilityEnabled: false });
    expect(reports.at(-1)).toBeNull();
  });

  it("reports null on destroy", () => {
    const reports = setup();
    h.destroy();
    expect(reports.at(-1)).toBeNull();
  });
});

describe("statusLabel", () => {
  it("is empty without a measurable profile", () => {
    expect(statusLabel(null)).toBe("");
    expect(statusLabel(new ProfileProse(new IntlSentenceSegmenter("en")).paragraph(""))).toBe("");
  });
  it("joins the ease and variety bands", () => {
    const p = new ProfileProse(new IntlSentenceSegmenter("en")).paragraph("Go. Then a longer sentence follows. And a third one too.");
    expect(statusLabel(p)).toMatch(/^[A-Z][a-z ]+ · [A-Z][a-z]+$/);
  });
});
