import { Facet, RangeSetBuilder, type EditorState, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { activeChanged, effectiveSettings } from "./activeNote";
import { settingsChanged } from "./settingsFacet";
import { findingProviders, type HoverFinding } from "./findingsTooltip";
import { findDialogue, resolveConventions, type DialogueConventions, type DialogueSpan } from "../../domain/dialogue/DialogueSpans";
import { attributeSpeakers, HOW_LABELS, UNATTRIBUTED_COLOUR, UNATTRIBUTED_NOTE, type Attribution, type Speaker } from "../../domain/dialogue/Speakers";
import { pathInScope } from "../../domain/scope/NoteScope";
import type { PluginSettings } from "../../domain/settings/Settings";

/** Project scope → the conventions its project note declares (`dialogue:`, `thoughts:`). */
export type ConventionsByScope = Readonly<Record<string, Partial<DialogueConventions>>>;

export const conventionsFacet = Facet.define<ConventionsByScope, ConventionsByScope>({
  combine: (values) => values[values.length - 1] ?? {},
});

/** Project scope → its cast; the empty key is the vault-wide cast for notes outside every project. */
export type RostersByScope = Readonly<Record<string, readonly Speaker[]>>;

export const rostersFacet = Facet.define<RostersByScope, RostersByScope>({
  combine: (values) => values[values.length - 1] ?? {},
});

export const SPEECH_CLASS = "czm-speech";
export const THOUGHT_CLASS = "czm-thought";
export const NARRATION_CLASS = "czm-narration";

function mostSpecific(keys: readonly string[], path: string | null): string | null {
  let best: string | null = null;
  if (path !== null) for (const scope of keys) if (scope && pathInScope(path, scope) && (best === null || scope.length > best.length)) best = scope;
  return best;
}

/** The vault-wide conventions, with the most specific project's own on top. */
export function conventionsFor(settings: PluginSettings, byScope: ConventionsByScope, path: string | null): DialogueConventions {
  const best = mostSpecific(Object.keys(byScope), path);
  return resolveConventions(settings.dialogue, best === null ? undefined : byScope[best]);
}

/** The cast the note can hear: its project's, else the vault-wide one. */
export function rosterFor(byScope: RostersByScope, path: string | null): readonly Speaker[] {
  const best = mostSpecific(Object.keys(byScope), path);
  return (best === null ? byScope[""] : byScope[best]) ?? [];
}

const narrationMark = Decoration.mark({ class: NARRATION_CLASS });
const plain = { speech: Decoration.mark({ class: SPEECH_CLASS }), thought: Decoration.mark({ class: THOUGHT_CLASS }) };
const coloured = new Map<string, { speech: Decoration; thought: Decoration }>();
function marksFor(colour: string | null) {
  if (colour === null) return plain;
  let m = coloured.get(colour);
  if (!m) {
    const attributes = { style: `--czm-speech: ${colour}` };
    m = { speech: Decoration.mark({ class: SPEECH_CLASS, attributes }), thought: Decoration.mark({ class: THOUGHT_CLASS, attributes }) };
    coloured.set(colour, m);
  }
  return m;
}

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

interface Analysed { readonly from: number; readonly to: number; readonly spans: readonly DialogueSpan[]; readonly attribution: Attribution | null }

/**
 * The Dialogue lens: speech and thought tinted, narration dimmed, by the
 * conventions of the project the note is in. With a cast, each paragraph
 * is attributed and tinted in its speaker's colour, grey when nobody can
 * be pinned to it; the hover says who and how sure. The whole note is
 * analysed (turn-taking needs what came before) on every edit; decorating
 * is bounded by the viewport.
 */
export function dialogueExtension(pathOf: (state: EditorState) => string | null) {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    paragraphs: Analysed[] = [];
    attributed = false;
    constructor(view: EditorView) { this.analyse(view); this.decorate(view); }
    update(u: ViewUpdate) {
      const facetsChanged = u.startState.facet(conventionsFacet) !== u.state.facet(conventionsFacet) || u.startState.facet(rostersFacet) !== u.state.facet(rostersFacet);
      const changed = u.docChanged || settingsChanged(u) || activeChanged(u) || facetsChanged;
      if (changed) this.analyse(u.view);
      if (changed || u.viewportChanged) this.decorate(u.view);
    }
    private analyse(view: EditorView) {
      const settings = effectiveSettings(view.state);
      this.paragraphs = [];
      this.attributed = false;
      if (settings.lens !== "dialogue") return;
      const path = pathOf(view.state);
      const conventions = conventionsFor(settings, view.state.facet(conventionsFacet), path);
      const doc = view.state.doc;
      const found = paragraphsIn(doc, 0, doc.length).map((p) => ({ ...p, text: doc.sliceString(p.from, p.to) })).map((p) => ({ ...p, spans: findDialogue(p.text, conventions) }));
      const roster = settings.dialogue.speakerColours ? rosterFor(view.state.facet(rostersFacet), path) : [];
      this.attributed = roster.length > 0;
      const attributions = this.attributed ? attributeSpeakers(found, roster) : [];
      this.paragraphs = found.map((p, i) => ({ from: p.from, to: p.to, spans: p.spans, attribution: attributions[i] ?? null }));
    }
    private decorate(view: EditorView) {
      if (this.paragraphs.length === 0) { this.decorations = Decoration.none; return; }
      const dim = effectiveSettings(view.state).dialogue.dimNarration;
      const builder = new RangeSetBuilder<Decoration>();
      for (const p of this.visible(view)) {
        const marks = marksFor(this.attributed ? p.attribution?.speaker.colour ?? UNATTRIBUTED_COLOUR : null);
        let at = p.from;
        for (const s of p.spans) {
          const from = p.from + s.from;
          const to = p.from + s.to;
          if (dim && from > at) builder.add(at, from, narrationMark);
          builder.add(from, to, marks[s.kind]);
          at = to;
        }
        if (dim && p.to > at) builder.add(at, p.to, narrationMark);
      }
      this.decorations = builder.finish();
    }
    private visible(view: EditorView): Analysed[] {
      const out: Analysed[] = [];
      for (const r of view.visibleRanges) for (const p of this.paragraphs) if (p.to >= r.from && p.from <= r.to && !out.includes(p)) out.push(p);
      return out;
    }
    /** Who the hover says is speaking, and how that was decided. */
    findings(view: EditorView): HoverFinding[] {
      if (!this.attributed) return [];
      const out: HoverFinding[] = [];
      for (const p of this.visible(view)) {
        const note = p.attribution ? `${p.attribution.speaker.name} · ${HOW_LABELS[p.attribution.how]}` : UNATTRIBUTED_NOTE;
        for (const s of p.spans) out.push({ from: p.from + s.from, to: p.from + s.to, kind: "dialogue", note });
      }
      return out;
    }
  }, { decorations: (v) => v.decorations });

  return [plugin, findingProviders.of((view) => view.plugin(plugin)?.findings(view) ?? [])];
}
