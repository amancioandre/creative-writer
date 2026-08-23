import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../../src/domain/settings/Settings";

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
    expect(s.styleChecks).toEqual({ cliche: true, passive: true, weak: true, filter: true, adverb: true, repetition: true, metaphor: true, nominalization: true, weakverb: true });
  });
  it("merges partial styleChecks with defaults and drops junk", () => {
    const s = normalizeSettings({ styleChecks: { passive: false, bogus: true, adverb: "no" } });
    expect(s.styleChecks.passive).toBe(false);
    expect(s.styleChecks.adverb).toBe(true);
    expect((s.styleChecks as Record<string, unknown>).bogus).toBeUndefined();
  });
});
