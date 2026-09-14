import { Facet, RangeSetBuilder, type EditorState, type Text } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { activeChanged, effectiveSettings } from "./activeNote";
import { settingsChanged } from "./settingsFacet";
import { findingProviders, type HoverFinding } from "./findingsTooltip";
import { findDialogue, resolveConventions, type DialogueConventions, type DialogueSpan } from "../../domain/dialogue/DialogueSpans";
import { attributeSpeakers, isCertain, pinOf, UNATTRIBUTED_COLOUR, type Attribution, type Pin, type Speaker } from "../../domain/dialogue/Speakers";
import { speakerBox, type BoxData } from "./speakerBox";
import { WordMatcher } from "../../domain/words/WordList";
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
export const ACCENT_USES_CLASS = "czm-accent-uses";
export const ACCENT_NEVER_CLASS = "czm-accent-never";

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
const usesMark = Decoration.mark({ class: ACCENT_USES_CLASS });
const neverMark = Decoration.mark({ class: ACCENT_NEVER_CLASS });
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

/** A speaker's accent lists as matchers, built once per speaker. */
const accentMatchers = new WeakMap<Speaker, { uses: WordMatcher; never: WordMatcher }>();
function accentsOf(s: Speaker) {
  let m = accentMatchers.get(s);
  if (!m) {
    m = { uses: new WordMatcher([{ name: "accent", colour: null, terms: s.accent }]), never: new WordMatcher([{ name: "accent-never", colour: null, terms: s.accentNever }]) };
    accentMatchers.set(s, m);
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

interface AccentHit { readonly from: number; readonly to: number; readonly never: boolean; readonly term: string }
interface Analysed { readonly from: number; readonly to: number; readonly spans: readonly DialogueSpan[]; readonly attribution: Attribution | null; readonly pin: Pin | null; readonly accents: readonly AccentHit[] }

/** The accent words inside a speaker's own speech: what they use, and what they never say. Absolute offsets, in order. */
function accentHits(p: { from: number; text: string; spans: readonly DialogueSpan[] }, speaker: Speaker): AccentHit[] {
  const { uses, never } = accentsOf(speaker);
  if (uses.empty && never.empty) return [];
  const out: AccentHit[] = [];
  for (const s of p.spans) {
    if (s.kind !== "speech") continue;
    const text = p.text.slice(s.from, s.to);
    const base = p.from + s.from;
    const hits = [
      ...uses.findAll(text).map((m) => ({ from: base + m.from, to: base + m.to, never: false, term: m.term })),
      ...never.findAll(text).map((m) => ({ from: base + m.from, to: base + m.to, never: true, term: m.term })),
    ].sort((a, b) => a.from - b.from || a.to - b.to);
    let at = -1;
    for (const h of hits) { if (h.from >= at) { out.push(h); at = h.to; } }
  }
  return out;
}

/**
 * The Dialogue and Accents lenses. Dialogue: speech and thought tinted,
 * narration dimmed, by the conventions of the project the note is in;
 * with a cast, each paragraph is attributed and tinted in its speaker's
 * colour, grey when nobody can be pinned, the hover saying who and how
 * sure. Only a tag, a name in the paragraph or the writer's own pin
 * colours a line; a turn is a guess, grey on the page and offered in the
 * speaker box. Accents: the same page at a faint tint, and inside each
 * speaker's own speech the words their character note says they use and
 * the words they never say; never in narration, never in speech nobody
 * is sure about. The whole note is analysed (turn-taking needs what came
 * before) on every edit; decorating is bounded by the viewport.
 */
export function dialogueExtension(pathOf: (state: EditorState) => string | null) {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    paragraphs: Analysed[] = [];
    attributed = false;
    accents = false;
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
      this.accents = settings.lens === "accents";
      if (settings.lens !== "dialogue" && settings.lens !== "accents") return;
      const path = pathOf(view.state);
      const conventions = conventionsFor(settings, view.state.facet(conventionsFacet), path);
      const doc = view.state.doc;
      const found = paragraphsIn(doc, 0, doc.length).map((p) => {
        const text = doc.sliceString(p.from, p.to);
        const pin = pinOf(text);
        // The pin comment is blanked, not cut, so a thought paragraph still opens with its italic and offsets hold.
        const body = pin ? " ".repeat(pin.to) + text.slice(pin.to) : text;
        return { ...p, text, pin, spans: pin?.notSpeech ? [] : findDialogue(body, conventions) };
      });
      const roster = settings.dialogue.speakerColours || this.accents ? rosterFor(view.state.facet(rostersFacet), path) : [];
      this.attributed = roster.length > 0;
      const attributions = this.attributed ? attributeSpeakers(found, roster) : [];
      this.paragraphs = found.map((p, i) => {
        const attribution = attributions[i] ?? null;
        return { from: p.from, to: p.to, spans: p.spans, attribution, pin: p.pin, accents: this.accents && attribution && isCertain(attribution.how) ? accentHits(p, attribution.speaker) : [] };
      });
    }
    private decorate(view: EditorView) {
      if (this.paragraphs.length === 0) { this.decorations = Decoration.none; return; }
      const dim = effectiveSettings(view.state).dialogue.dimNarration;
      const builder = new RangeSetBuilder<Decoration>();
      for (const p of this.visible(view)) {
        const a = p.attribution;
        const marks = marksFor(this.attributed ? (a && isCertain(a.how) ? a.speaker.colour : UNATTRIBUTED_COLOUR) : null);
        let at = p.from;
        let hit = 0;
        for (const s of p.spans) {
          const from = p.from + s.from;
          const to = p.from + s.to;
          if (dim && from > at) builder.add(at, from, narrationMark);
          builder.add(from, to, marks[s.kind]);
          // Accent words nest inside the speech mark; the builder takes them in order after it.
          for (; hit < p.accents.length && p.accents[hit]!.from < to; hit++) { const h = p.accents[hit]!; builder.add(h.from, h.to, h.never ? neverMark : usesMark); }
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
    /** The accent words on hover; who is speaking is the speaker box's to say. */
    findings(view: EditorView): HoverFinding[] {
      if (!this.attributed) return [];
      const words: HoverFinding[] = [];
      for (const p of this.visible(view)) {
        const who = p.attribution;
        for (const h of p.accents) words.push({ from: h.from, to: h.to, kind: h.never ? "accent-never" : "accent", note: h.never ? `${who!.speaker.name} never says this · accent-never in the character note` : `${who!.speaker.name} · accent` });
      }
      return words;
    }
    /** What the speaker box reads; null when there is nothing to tag. */
    boxData(view: EditorView): BoxData | null {
      if (!this.attributed) return null;
      return { paragraphs: this.paragraphs, roster: rosterFor(view.state.facet(rostersFacet), pathOf(view.state)) };
    }
  }, { decorations: (v) => v.decorations });

  return [
    plugin,
    findingProviders.of((view) => view.plugin(plugin)?.findings(view) ?? []),
    speakerBox((view) => view.plugin(plugin)?.boxData(view) ?? null),
  ];
}
