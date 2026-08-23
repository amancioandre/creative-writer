import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { settingsFacet, settingsChanged } from "./settingsFacet";
import { editorClassWhen } from "./editorClassToggle";
import { ComputeFocusFade } from "../../application/use-cases/ComputeFocusFade";
import { DEFAULT_MAX_FOCUS_TIER } from "../../domain/focus/FocusTier";

export const FOCUS_EDITOR_CLASS = "czm-focus-fade";
export const FOCUS_LINE_CLASS_PREFIX = "czm-focus-";

const lineDecorations = Array.from({ length: DEFAULT_MAX_FOCUS_TIER + 1 }, (_, tier) =>
  Decoration.line({ class: `${FOCUS_LINE_CLASS_PREFIX}${tier}` }),
);

/**
 * Fades lines by distance from the cursor. Recomputes only for the visible
 * viewport, on cursor/doc/viewport/settings changes.
 */
export function focusFadeExtension() {
  const useCase = new ComputeFocusFade();

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged || settingsChanged(u)) {
          this.decorations = build(u.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );

  function build(view: EditorView): DecorationSet {
    if (!view.state.facet(settingsFacet).focusFadeEnabled) return Decoration.none;

    const doc = view.state.doc;
    const cursorLine = doc.lineAt(view.state.selection.main.head).number - 1;
    const visible: number[] = [];
    for (const { from, to } of view.visibleRanges) {
      for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) visible.push(n - 1);
    }

    const builder = new RangeSetBuilder<Decoration>();
    for (const { line, tier } of useCase.execute({ visibleLines: visible, cursorLine })) {
      const l = doc.line(line + 1);
      builder.add(l.from, l.from, lineDecorations[tier]!);
    }
    return builder.finish();
  }

  return [plugin, editorClassWhen(FOCUS_EDITOR_CLASS, (s) => s.focusFadeEnabled)];
}
