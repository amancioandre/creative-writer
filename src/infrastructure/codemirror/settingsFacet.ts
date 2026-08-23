import { Facet } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../domain/settings/Settings";

/**
 * Carries plugin settings into editor state. The composition root wraps it in
 * a Compartment and reconfigures on change, so extensions observe updates via
 * `settingsChanged(update)`.
 */
export const settingsFacet = Facet.define<PluginSettings, PluginSettings>({
  combine: (values) => values[values.length - 1] ?? DEFAULT_SETTINGS,
});

export function settingsChanged(update: ViewUpdate): boolean {
  return update.startState.facet(settingsFacet) !== update.state.facet(settingsFacet);
}
