import { EditorView } from "@codemirror/view";
import { settingsFacet } from "./settingsFacet";
import type { PluginSettings } from "../../domain/settings/Settings";

/**
 * Adds `className` to the editor root whenever `isOn(settings)` holds.
 * CSS then scopes feature styling (padding, opacity) to enabled editors only.
 */
export function editorClassWhen(className: string, isOn: (s: PluginSettings) => boolean) {
  return EditorView.editorAttributes.of((view) =>
    isOn(view.state.facet(settingsFacet)) ? { class: className } : null,
  );
}
