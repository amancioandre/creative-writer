import { Facet, RangeSetBuilder, type EditorState, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { activeChanged, effectiveSettings } from "./activeNote";
import { settingsChanged } from "./settingsFacet";
import { findDialogue, resolveConventions, type DialogueConventions } from "../../domain/dialogue/DialogueSpans";
import { pathInScope } from "../../domain/scope/NoteScope";
import type { PluginSettings } from "../../domain/settings/Settings";

/** Project scope → the conventions its project note declares (`dialogue:`, `thoughts:`). */
export type ConventionsByScope = Readonly<Record<string, Partial<DialogueConventions>>>;

export const conventionsFacet = Facet.define<ConventionsByScope, ConventionsByScope>({
  combine: (values) => values[values.length - 1] ?? {},
});

export const SPEECH_CLASS = "czm-speech";
export const THOUGHT_CLASS = "czm-thought";
export const NARRATION_CLASS = "czm-narration";

/** The vault-wide conventions, with the most specific project's own on top. */
export function conventionsFor(settings: PluginSettings, byScope: ConventionsByScope, path: string | null): DialogueConventions {
  let best: string | null = null;
  if (path !== null) {
    for (const scope of Object.keys(byScope)) if (pathInScope(path, scope) && (best === null || scope.length > best.length)) best = scope;
  }
  return resolveConventions(settings.dialogue, best === null ? undefined : byScope[best]);
}

const speechMark = Decoration.mark({ class: SPEECH_CLASS });
const thoughtMark = Decoration.mark({ class: THOUGHT_CLASS });
const narrationMark = Decoration.mark({ class: NARRATION_CLASS });

/** Paragraphs (runs of non-blank lines) touching [from, to], as absolute ranges. */
export function paragraphsIn(doc: Text, from: number, to: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let n = doc.lineAt(from).number;
  const last = doc.lineAt(to).number;
  while (n <= last) {
    let line = doc.line(n);
    if (line.text.trim() === "") { n += 1; continue; }
    let first = n;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first -= 1;
    let end = n;
    while (end < doc.lines && doc.line(end + 1).text.trim() !== "") end += 1;
    line = doc.line(first);
    out.push({ from: line.from, to: doc.line(end).to });
    n = end + 1;
  }
  return out;
}

/**
 * The Dialogue lens: speech and thought tinted, narration dimmed, in the
 * visible paragraphs, by the conventions of the project the note is in.
 * One colour for now; the speaker's colour comes with attribution.
 */
export function dialogueExtension(pathOf: (state: EditorState) => string | null) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    constructor(view: EditorView) { this.decorations = compute(view, pathOf); }
    update(u: ViewUpdate) {
      const conventionsChanged = u.startState.facet(conventionsFacet) !== u.state.facet(conventionsFacet);
      if (u.docChanged || u.viewportChanged || settingsChanged(u) || activeChanged(u) || conventionsChanged) this.decorations = compute(u.view, pathOf);
    }
  }, { decorations: (v) => v.decorations });
}

function compute(view: EditorView, pathOf: (state: EditorState) => string | null): DecorationSet {
  const settings = effectiveSettings(view.state);
  if (settings.lens !== "dialogue") return Decoration.none;
  const conventions = conventionsFor(settings, view.state.facet(conventionsFacet), pathOf(view.state));
  const dim = settings.dialogue.dimNarration;
  const builder = new RangeSetBuilder<Decoration>();
  let done = -1;
  for (const range of view.visibleRanges) {
    for (const p of paragraphsIn(view.state.doc, range.from, range.to)) {
      if (p.from <= done) continue;
      done = p.to;
      let at = p.from;
      for (const s of findDialogue(view.state.sliceDoc(p.from, p.to), conventions)) {
        const from = p.from + s.from;
        const to = p.from + s.to;
        if (dim && from > at) builder.add(at, from, narrationMark);
        builder.add(from, to, s.kind === "speech" ? speechMark : thoughtMark);
        at = to;
      }
      if (dim && p.to > at) builder.add(at, p.to, narrationMark);
    }
  }
  return builder.finish();
}
