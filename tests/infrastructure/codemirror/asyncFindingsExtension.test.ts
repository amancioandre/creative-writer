import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { asyncFindingsExtension } from "../../../src/infrastructure/codemirror/asyncFindingsExtension";
import { findingsTooltip, allFindings } from "../../../src/infrastructure/codemirror/findingsTooltip";
import { styleExtension } from "../../../src/infrastructure/codemirror/styleExtension";
import { AnalyzeParagraphStyle } from "../../../src/application/use-cases/AnalyzeParagraphStyle";
import type { ParagraphAnalyser } from "../../../src/application/ports/ParagraphAnalyser";
import { Finding } from "../../../src/domain/style/Finding";
import { mount, type Harness } from "./helpers";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";

const llmOn = { llm: { ...DEFAULT_SETTINGS.llm, provider: "ollama" as const, onIdle: true } };

const DOC = "The silence bruised him.\n\nSaw plain words here.";

/** Flags the first word of whatever paragraph it is given. */
const firstWordAnalyser: ParagraphAnalyser = {
  async analyse(text, from) {
    const len = text.split(" ")[0]!.length;
    return [Finding.create("metaphor", from, from + len, `m:${text.slice(0, len)}`)];
  },
};
const marks = (h: Harness) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(".czm-style-metaphor"));

describe("asyncFindingsExtension", () => {
  let h: Harness;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { h?.destroy(); vi.useRealTimers(); });

  it("renders async findings for the cursor paragraph after idle", async () => {
    h = mount(DOC, asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), llmOn);
    h.moveCursor(1);
    expect(marks(h)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(marks(h).map((m) => m.textContent)).toEqual(["The"]);
    expect(marks(h)[0]!.getAttribute("data-czm-note")).toBe("m:The");
  });

  it("drops results once the paragraph text changes, then re-analyses", async () => {
    h = mount(DOC, asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), llmOn);
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(marks(h)).toHaveLength(1);
    h.type("x");
    expect(marks(h)).toHaveLength(0); // stale immediately
    await vi.advanceTimersByTimeAsync(100);
    expect(marks(h).map((m) => m.textContent)).toEqual(["Txhe"]);
  });

  it("follows the cursor to another paragraph", async () => {
    h = mount(DOC, asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), llmOn);
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(100);
    h.moveCursor(DOC.length - 1);
    await vi.advanceTimersByTimeAsync(100);
    expect(marks(h).map((m) => m.textContent)).toEqual(["Saw"]);
  });

  it("does nothing when the feature is disabled", async () => {
    h = mount(DOC, asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), { ...llmOn, styleEnabled: false });
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(marks(h)).toHaveLength(0);
  });

  it("filters findings by the per-kind toggle", async () => {
    h = mount(DOC, asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), llmOn);
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(100);
    h.setSettings({ styleChecks: { cliche: true, passive: true, filter: true, adverb: true, repetition: true, metaphor: false, nominalization: true, weakverb: true } });
    expect(marks(h)).toHaveLength(0);
  });

  it("cleans up its scheduler on destroy (no late dispatch on a dead view)", async () => {
    h = mount(DOC, asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), llmOn);
    h.moveCursor(1);
    h.destroy();
    await vi.advanceTimersByTimeAsync(100); // must not throw on a destroyed view
  });
});

describe("findingsTooltip merges sync and async sources", () => {
  let h: Harness;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { h?.destroy(); vi.useRealTimers(); });

  it("allFindings returns both rule findings and async findings", async () => {
    h = mount(DOC, [styleExtension(AnalyzeParagraphStyle.withDefaultRules()), asyncFindingsExtension(firstWordAnalyser, { idleMs: 50 }), findingsTooltip()], llmOn);
    h.moveCursor(DOC.length - 1);
    await vi.advanceTimersByTimeAsync(100);
    const kinds = allFindings(h.view).map((f) => f.kind).sort();
    expect(kinds).toEqual(["filter", "metaphor"]); // "Saw" from both
  });
});
