import { describe, it, expect } from "vitest";
import { Plugin } from "obsidian";
import { PluginDataSettingsRepository } from "../../../src/infrastructure/obsidian/PluginDataSettingsRepository";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";

describe("PluginDataSettingsRepository", () => {
  it("returns defaults when nothing was saved", async () => {
    const repo = new PluginDataSettingsRepository(new Plugin());
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips settings and normalises on the way out", async () => {
    const plugin = new Plugin();
    const repo = new PluginDataSettingsRepository(plugin);
    await repo.save({ ...DEFAULT_SETTINGS, rhythmTiers: 4, typewriterEnabled: false });
    const loaded = await repo.load();
    expect(loaded.rhythmTiers).toBe(4);
    expect(loaded.typewriterEnabled).toBe(false);
  });

  it("tolerates corrupt persisted data", async () => {
    const plugin = new Plugin();
    await plugin.saveData({ rhythmTiers: "lots" });
    expect((await new PluginDataSettingsRepository(plugin).load()).rhythmTiers).toBe(DEFAULT_SETTINGS.rhythmTiers);
  });
});
