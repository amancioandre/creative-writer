import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, normalizeNotePath, normalizeSettings } from "../../../src/domain/settings/Settings";

describe("normalizeSettings", () => {
  it("returns defaults for undefined input", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("fills missing keys from defaults and keeps provided ones", () => {
    const s = normalizeSettings({ typewriterEnabled: false });
    expect(s.typewriterEnabled).toBe(false);
    expect(s.focusFadeEnabled).toBe(DEFAULT_SETTINGS.focusFadeEnabled);
  });

  it("clamps rhythm tier count into 4..6", () => {
    expect(normalizeSettings({ rhythmTiers: 1 }).rhythmTiers).toBe(4);
    expect(normalizeSettings({ rhythmTiers: 99 }).rhythmTiers).toBe(6);
    expect(normalizeSettings({ rhythmTiers: 5.7 }).rhythmTiers).toBe(5);
  });

  it("ignores unknown keys and wrong types", () => {
    const s = normalizeSettings({ bogus: 1, typewriterEnabled: "yes" });
    expect((s as unknown as Record<string, unknown>).bogus).toBeUndefined();
    expect(s.typewriterEnabled).toBe(DEFAULT_SETTINGS.typewriterEnabled);
  });
});

describe("style settings", () => {
  it("defaults every style check on and the feature on", () => {
    const s = normalizeSettings(undefined);
    expect(s.styleEnabled).toBe(true);
    expect(s.styleChecks).toEqual({ cliche: true, passive: true, filter: true, adverb: true, repetition: true, metaphor: true, nominalization: true, weakverb: true });
  });
  it("merges partial styleChecks with defaults and drops junk", () => {
    const s = normalizeSettings({ styleChecks: { passive: false, bogus: true, adverb: "no" } });
    expect(s.styleChecks.passive).toBe(false);
    expect(s.styleChecks.adverb).toBe(true);
    expect((s.styleChecks as Record<string, unknown>).bogus).toBeUndefined();
  });
});

describe("llm settings", () => {
  it("defaults to off with sensible Ollama values", () => {
    const s = normalizeSettings(undefined);
    expect(s.llm).toEqual({ provider: "off", onIdle: false, idleMs: 1500, ollamaUrl: "http://localhost:11434", ollamaModel: "qwen2.5:7b", claudeModel: "claude-opus-5", claudeApiKey: "", dailyCapUsd: 1, spend: { day: "", usd: 0 } });
  });
  it("accepts valid providers and rejects junk", () => {
    expect(normalizeSettings({ llm: { provider: "ollama" } }).llm.provider).toBe("ollama");
    expect(normalizeSettings({ llm: { provider: "gpt" } }).llm.provider).toBe("off");
  });
  it("clamps idleMs and keeps strings", () => {
    const s = normalizeSettings({ llm: { idleMs: 10, ollamaUrl: "http://h:1", ollamaModel: "m" } });
    expect(s.llm.idleMs).toBe(500);
    expect(s.llm.ollamaUrl).toBe("http://h:1");
    expect(s.llm.ollamaModel).toBe("m");
  });
  it("validates claude fields", () => {
    const s = normalizeSettings({ llm: { provider: "claude", claudeModel: "claude-haiku-4-5", claudeApiKey: " sk ", dailyCapUsd: 500, spend: { day: "2026-08-23", usd: -1 } } });
    expect(s.llm.provider).toBe("claude");
    expect(s.llm.claudeModel).toBe("claude-haiku-4-5");
    expect(s.llm.claudeApiKey).toBe("sk");
    expect(s.llm.dailyCapUsd).toBe(100);
    expect(s.llm.spend).toEqual({ day: "2026-08-23", usd: 0 });
    expect(normalizeSettings({ llm: { claudeModel: "claude-3" } }).llm.claudeModel).toBe("claude-opus-5");
  });
});

describe("normalizeNotePath", () => {
  it("cleans a vault-relative markdown path", () => {
    expect(normalizeNotePath(" /Creative Writer\\Writing log ")).toBe("Creative Writer/Writing log.md");
    expect(normalizeNotePath("a//b.MD")).toBe("a/b.MD");
    expect(normalizeNotePath("")).toBeNull();
    expect(normalizeNotePath("folder/")).toBeNull();
    expect(normalizeNotePath(3)).toBeNull();
    expect(normalizeSettings({ goals: { logNote: "" } }).goals.logNote).toBe("Creative Writer/Writing log.md");
    expect(normalizeSettings({ goals: { logNote: "Logs/me" } }).goals.logNote).toBe("Logs/me.md");
  });
});

describe("normalizeSettings — story map", () => {
  it("defaults, clamps forces, validates colours and keeps flags", () => {
    const s = normalizeSettings({ storyMap: { layers: { external: false, bogus: true }, kinds: { note: true }, hideIsolated: true, forces: { repulsion: 99, linkDistance: "x", gravity: -1 }, colors: { character: "#ABCDEF", location: "red" }, panelOpen: false } });
    expect(s.storyMap.layers).toEqual({ explicit: true, internal: true, external: false });
    expect(s.storyMap.kinds.note).toBe(true);
    expect(s.storyMap.hideIsolated).toBe(true);
    expect(s.storyMap.forces).toEqual({ repulsion: 4, linkDistance: 90, linkStrength: 0.5, gravity: 0 });
    expect(s.storyMap.colors.character).toBe("#abcdef");
    expect(s.storyMap.colors.location).toBe(DEFAULT_SETTINGS.storyMap.colors.location);
    expect(s.storyMap.panelOpen).toBe(false);
    expect(normalizeSettings({ storyMap: { display: { nodeSize: 9, labelSize: -2, edgeOpacity: "x" } } }).storyMap.display).toEqual({ nodeSize: 2.5, edgeWidth: 1, edgeOpacity: 0.55, labelSize: 0 });
    expect(normalizeSettings({}).storyMap).toEqual(DEFAULT_SETTINGS.storyMap);
  });
});
