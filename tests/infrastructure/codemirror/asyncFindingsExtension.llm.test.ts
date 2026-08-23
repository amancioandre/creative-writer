import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { asyncFindingsExtension, analyseNow } from "../../../src/infrastructure/codemirror/asyncFindingsExtension";
import { styleExtension } from "../../../src/infrastructure/codemirror/styleExtension";
import { AnalyzeParagraphStyle } from "../../../src/application/use-cases/AnalyzeParagraphStyle";
import type { ParagraphAnalyser } from "../../../src/application/ports/ParagraphAnalyser";
import { Finding } from "../../../src/domain/style/Finding";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";
import { mount, type Harness } from "./helpers";

const DOC = "It was very cold and the silence bruised him.";
const analyser = (calls: string[]): ParagraphAnalyser => ({
  async analyse(text, from) {
    calls.push(text);
    return [
      Finding.create("weak", from + 7, from + 11, "model: very"),          // duplicates the sync rule
      Finding.create("metaphor", from + 25, from + 40, "model: silence"),  // new
    ];
  },
});
const marks = (h: Harness, kind: string) => Array.from(h.view.dom.querySelectorAll<HTMLElement>(`.czm-style-${kind}`));
const llmOn = { ...DEFAULT_SETTINGS.llm, provider: "ollama" as const, onIdle: true, idleMs: 50 };

describe("asyncFindingsExtension + llm settings", () => {
  let h: Harness;
  let calls: string[];
  beforeEach(() => { vi.useFakeTimers(); calls = []; });
  afterEach(() => { h?.destroy(); vi.useRealTimers(); });

  const ext = () => [styleExtension(AnalyzeParagraphStyle.withDefaultRules()), asyncFindingsExtension(analyser(calls), { idleMs: 50 })];

  it("does not run on idle unless llm.onIdle is set", async () => {
    h = mount(DOC, ext(), { llm: { ...llmOn, onIdle: false } });
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual([]);
  });

  it("runs on idle when enabled, and a model finding that overlaps a rule finding of the same kind is not rendered twice", async () => {
    h = mount(DOC, ext(), { llm: llmOn });
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual([DOC]);
    expect(marks(h, "weak")).toHaveLength(1);      // the sync one only
    expect(marks(h, "metaphor")).toHaveLength(1);  // the model's
  });

  it("analyseNow runs immediately even when idle analysis is off", async () => {
    h = mount(DOC, ext(), { llm: { ...llmOn, onIdle: false } });
    h.moveCursor(1);
    h.view.dispatch({ effects: analyseNow.of(null) });
    await vi.advanceTimersByTimeAsync(5);
    expect(calls).toEqual([DOC]);
    expect(marks(h, "metaphor")).toHaveLength(1);
  });

  it("does nothing when the provider is off", async () => {
    h = mount(DOC, ext(), { llm: { ...llmOn, provider: "off" } });
    h.moveCursor(1);
    h.view.dispatch({ effects: analyseNow.of(null) });
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual([]);
  });

  it("forgets cached results when the model configuration changes", async () => {
    h = mount(DOC, ext(), { llm: llmOn });
    h.moveCursor(1);
    await vi.advanceTimersByTimeAsync(200);
    h.setSettings({ llm: { ...llmOn, ollamaModel: "other" } });
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual([DOC, DOC]);
  });
});
