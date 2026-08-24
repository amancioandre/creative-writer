import { Facet } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../domain/settings/Settings";
import { activeChanged } from "./activeNote";

/**
 * Carries plugin settings into editor state. The composition root wraps it in
 * a Compartment and reconfigures on change, so extensions observe updates via
 * `settingsChanged(update)`. Extensions read the *effective* settings through
 * `effectiveSettings(state)` (activeNote.ts), which is all-off in a note the
 * plugin does not run in; a flip of that per-note state counts as a change too.
 */
export const settingsFacet = Facet.define<PluginSettings, PluginSettings>({
  combine: (values) => values[values.length - 1] ?? DEFAULT_SETTINGS,
});

export function settingsChanged(update: ViewUpdate): boolean {
  return update.startState.facet(settingsFacet) !== update.state.facet(settingsFacet) || activeChanged(update);
}
