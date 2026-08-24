import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { frontmatterFlag, isNoteActive } from "../../domain/scope/NoteScope";
import { DEFAULT_SETTINGS, type PluginSettings } from "../../domain/settings/Settings";
import { settingsFacet } from "./settingsFacet";

/** Per-editor: does the plugin run in this note? Decided by the master switch, scope and front matter. */
export const setActive = StateEffect.define<boolean>();

export const activeField = StateField.define<boolean>({
  create: () => true,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setActive)) return e.value;
    return value;
  },
});

export function isActive(state: EditorState): boolean {
  return state.field(activeField, false) ?? true;
}

const off = new WeakMap<PluginSettings, PluginSettings>();

/**
 * The settings every extension should act on: the real ones when the note
 * is active, otherwise a copy with every feature switched off. One object
 * per settings instance, so identity comparisons keep working.
 */
export function effectiveSettings(state: EditorState): PluginSettings {
  const s = state.facet(settingsFacet);
  if (isActive(state)) return s;
  let d = off.get(s);
  if (!d) {
    d = {
      ...s,
      typewriterEnabled: false,
      currentLineEnabled: false,
      focusFadeEnabled: false,
      rhythmEnabled: false,
      styleEnabled: false,
      readabilityEnabled: false,
      llm: { ...s.llm, provider: "off" },
    };
    off.set(s, d);
  }
  return d;
}

export function activeChanged(u: ViewUpdate): boolean {
  return isActive(u.startState) !== isActive(u.state);
}

/**
 * Recomputes activation on load, on settings changes and on front-matter
 * edits, and dispatches `setActive` when it flips. `pathOf` is supplied by
 * the host (Obsidian's editorInfoField); null when the editor has no file.
 */
export function activeNoteExtension(pathOf: (state: EditorState) => string | null) {
  const resolve = (state: EditorState): boolean => {
    const s = state.facet(settingsFacet) ?? DEFAULT_SETTINGS;
    const head = state.doc.sliceString(0, Math.min(state.doc.length, 4000));
    return isNoteActive({ enabled: s.enabled, scope: s.scope, path: pathOf(state), flag: frontmatterFlag(head) });
  };
  const plugin = ViewPlugin.fromClass(
    class {
      private pending: ReturnType<typeof setTimeout> | null = null;
      constructor(private readonly view: EditorView) {
        this.sync();
      }
      update(u: ViewUpdate) {
        const frontmatterMaybeChanged = u.docChanged && u.changes.touchesRange(0, Math.min(u.state.doc.length, 4000));
        if (frontmatterMaybeChanged || u.startState.facet(settingsFacet) !== u.state.facet(settingsFacet)) this.sync();
      }
      private sync() {
        const want = resolve(this.view.state);
        if (want === isActive(this.view.state) || this.pending !== null) return;
        this.pending = setTimeout(() => {
          this.pending = null;
          if (want !== isActive(this.view.state)) this.view.dispatch({ effects: setActive.of(want) });
        }, 0);
      }
      destroy() {
        if (this.pending !== null) clearTimeout(this.pending);
      }
    },
  );
  return [activeField, plugin];
}
