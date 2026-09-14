import { EditorView } from "@codemirror/view";
import { effectiveSettings } from "./activeNote";
import { editorClassWhen } from "./editorClassToggle";

export const LENS_SOLO_CLASS = "czm-lens-solo";
export const LENS_CLASS_PREFIX = "czm-lens-";

/**
 * Names the active lens on the editor root (`czm-lens-words`) and, when the
 * writer wants the lens alone on the page, adds `czm-lens-solo`, which
 * styles.css uses to hide the rhythm tint underneath.
 */
export function lensExtension() {
  return [
    EditorView.editorAttributes.of((view) => ({ class: `${LENS_CLASS_PREFIX}${effectiveSettings(view.state).lens}` })),
    editorClassWhen(LENS_SOLO_CLASS, (s) => s.lens !== "none" && !s.rhythmUnderLens),
  ];
}
