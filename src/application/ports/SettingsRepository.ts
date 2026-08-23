import type { PluginSettings } from "../../domain/settings/Settings";

export interface SettingsRepository {
  load(): Promise<PluginSettings>;
  save(settings: PluginSettings): Promise<void>;
}
