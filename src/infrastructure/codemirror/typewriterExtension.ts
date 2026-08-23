import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { settingsFacet } from "./settingsFacet";
import { editorClassWhen } from "./editorClassToggle";

export const TYPEWRITER_EDITOR_CLASS = "czm-typewriter";

export interface RecenterSignal {
  readonly docChanged: boolean;
  readonly selectionSet: boolean;
  readonly hasFocus: boolean;
  readonly enabled: boolean;
}

/**
 * Pure policy: when does a cursor deserve to be recentred? Kept separate from
 * the ViewPlugin so the decision is unit-testable without a DOM.
 */
export function shouldRecenter(s: RecenterSignal): boolean {
  return s.enabled && s.hasFocus && (s.docChanged || s.selectionSet);
}

/**
 * Keeps the cursor line vertically centred. The scroll is dispatched on the
 * next animation frame because CM6 forbids dispatching from inside `update`,
 * and because batching per frame absorbs bursts of keystrokes.
 *
 * Vertical padding on `.cm-content` (so the first/last lines can reach the
 * middle) is applied by CSS, scoped via the editor class.
 */
export function typewriterExtension() {
  const plugin = ViewPlugin.fromClass(
    class {
      private frame: number | null = null;

      constructor(private readonly view: EditorView) {}

      update(u: ViewUpdate) {
        const signal: RecenterSignal = {
          docChanged: u.docChanged,
          selectionSet: u.selectionSet,
          hasFocus: u.view.hasFocus,
          enabled: u.state.facet(settingsFacet).typewriterEnabled,
        };
        if (shouldRecenter(signal)) this.schedule();
      }

      private schedule() {
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = null;
          const head = this.view.state.selection.main.head;
          this.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: "center" }) });
        });
      }

      destroy() {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
      }
    },
  );

  return [plugin, editorClassWhen(TYPEWRITER_EDITOR_CLASS, (s) => s.typewriterEnabled)];
}
