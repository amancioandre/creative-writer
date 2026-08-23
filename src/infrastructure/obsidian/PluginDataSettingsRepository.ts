import type { Plugin } from "obsidian";
import type { SettingsRepository } from "../../application/ports/SettingsRepository";
import { normalizeSettings, type PluginSettings } from "../../domain/settings/Settings";

/** Persists settings in `.obsidian/plugins/creative-zen-mode/data.json`. */
export class PluginDataSettingsRepository implements SettingsRepository {
  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<PluginSettings> {
    return normalizeSettings(await this.plugin.loadData());
  }

  async save(settings: PluginSettings): Promise<void> {
    await this.plugin.saveData(settings);
  }
}
