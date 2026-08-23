import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { settingsFacet } from "../../../src/infrastructure/codemirror/settingsFacet";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../../src/domain/settings/Settings";

export interface Harness {
  view: EditorView;
  setSettings(patch: Partial<PluginSettings>): void;
  moveCursor(pos: number): void;
  type(text: string): void;
  lineEls(): HTMLElement[];
  destroy(): void;
}

export function mount(doc: string, extension: Extension, settings: Partial<PluginSettings> = {}): Harness {
  const compartment = new Compartment();
  let current: PluginSettings = { ...DEFAULT_SETTINGS, ...settings };
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [compartment.of(settingsFacet.of(current)), extension] }),
    parent: document.body,
  });
  view.contentDOM.focus();
  return {
    view,
    setSettings(patch) {
      current = { ...current, ...patch };
      view.dispatch({ effects: compartment.reconfigure(settingsFacet.of(current)) });
    },
    moveCursor(pos) {
      view.dispatch({ selection: { anchor: pos }, userEvent: "select" });
    },
    type(text) {
      const head = view.state.selection.main.head;
      view.dispatch({ changes: { from: head, insert: text }, selection: { anchor: head + text.length }, userEvent: "input.type" });
    },
    lineEls: () => Array.from(view.dom.querySelectorAll<HTMLElement>(".cm-line")),
    destroy: () => view.destroy(),
  };
}
