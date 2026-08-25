import { effectiveSettings } from "./activeNote";
import { EditorView } from "@codemirror/view";
import type { PluginSettings } from "../../domain/settings/Settings";

/**
 * Adds `className` to the editor root whenever `isOn(settings)` holds.
 * CSS then scopes feature styling (padding, opacity) to enabled editors only.
 */
export function editorClassWhen(className: string, isOn: (s: PluginSettings) => boolean) {
  return EditorView.editorAttributes.of((view) =>
    isOn(effectiveSettings(view.state)) ? { class: className } : null,
  );
}
