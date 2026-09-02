import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { activeChanged, effectiveSettings } from "./activeNote";
import { settingsChanged } from "./settingsFacet";
import { TAG_IN_COMMENT, colorOf } from "../../domain/manuscript/Comments";

export const TAG_CLASS = "czm-tag";

/**
 * Colours the tag word that opens a comment — the `TODO` in
 * `%% TODO: cut this %%` — in the visible part of the editor, the way code
 * editors colour TODO and FIXME. Only the word is marked, so Obsidian's own
 * dimming of the comment stays; only inside `%%`, so a TODO in dialogue is
 * left alone. Work is bounded by the viewport.
 */
export function commentTagExtension() {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = compute(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || settingsChanged(u) || activeChanged(u)) this.decorations = compute(u.view);
    }
  }, { decorations: (v) => v.decorations });
}

function compute(view: EditorView): DecorationSet {
  const settings = effectiveSettings(view.state).manuscript;
  if (!settings.tintTags) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (const m of text.matchAll(TAG_IN_COMMENT)) {
      const word = m[1]!;
      const start = from + m.index + m[0].indexOf(word);
      const color = colorOf(word, settings.tags);
      builder.add(start, start + word.length, Decoration.mark({ class: TAG_CLASS, attributes: color ? { style: `--czm-tag: ${color}` } : {} }));
    }
  }
  return builder.finish();
}
