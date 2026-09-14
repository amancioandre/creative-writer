import { Prec, StateEffect, StateField, type ChangeSpec, type EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, hoverTooltip, keymap, showTooltip, type Tooltip, type ViewUpdate } from "@codemirror/view";
import { effectiveSettings } from "./activeNote";
import type { DialogueSpan } from "../../domain/dialogue/DialogueSpans";
import { HOW_LABELS, NOT_SPEECH, isCertain, pinBefore, pinEdit, type Attribution, type Pin, type Speaker } from "../../domain/dialogue/Speakers";

/** What the box needs to know about one paragraph: where it is, its spans and their voices, and the writer's pins. */
export interface BoxParagraph {
  readonly from: number;
  readonly to: number;
  readonly spans: readonly DialogueSpan[];
  readonly pins: readonly Pin[];
  readonly attribution: Attribution | null;
  /** One per span: its own pin's speaker, else the paragraph's. */
  readonly voices: readonly (Attribution | null)[];
}

export interface BoxData {
  readonly paragraphs: readonly BoxParagraph[];
  readonly roster: readonly Speaker[];
}

/** The dialogue analysis the box reads; null when the lens is off or there is no cast. */
export type BoxSource = (view: EditorView) => BoxData | null;

/** The command: open the box on the sentence at the cursor, armed for the keyboard. */
export const tagSpeaker = StateEffect.define<null>();
const openAt = StateEffect.define<{ at: number; span: number }>();
const closeBox = StateEffect.define<null>();
const select = StateEffect.define<number>();

/** The box is about one sentence: -1 when the paragraph has none (a "not speech" pin to take back), -2 for "the one at the cursor". */
interface BoxState {
  readonly at: number;
  readonly span: number;
  /** Chip index the keyboard is on; -1 before any key. */
  readonly selected: number;
  /** Opened by the command, or a key pressed since: Enter and the arrows act on the box. */
  readonly armed: boolean;
}

export const BOX_CLASS = "czm-speaker-box";
export const CHIP_CLASS = "czm-speaker-chip";

/** The pin's comment as an editor change: written right before the sentence, replaced, or removed. `null` unpins. */
export function pinChange(p: BoxParagraph, span: number, label: string | null): ChangeSpec {
  const target = p.spans[span] ?? startOnly(p);
  if (!target) return { from: p.from, to: p.from, insert: "" };
  const e = pinEdit(p.pins, target, label);
  return { from: p.from + e.from, to: p.from + e.to, insert: e.insert };
}

/** A paragraph pinned "not speech" at its start has no spans left; the pin is the thing to take back. */
function startOnly(p: BoxParagraph): { from: number } | null {
  const pin = p.pins.find((x) => x.notSpeech);
  return pin ? { from: pin.to } : null;
}

function paragraphAt(data: BoxData, pos: number): BoxParagraph | null {
  for (const p of data.paragraphs) if (pos >= p.from && pos <= p.to) return p;
  return null;
}

/** The sentence under a position, else the first; -1 when there is none. */
function spanAt(p: BoxParagraph, pos: number): number {
  const i = p.spans.findIndex((s) => pos >= p.from + s.from && pos <= p.from + s.to);
  return i >= 0 ? i : p.spans.length ? 0 : -1;
}

/** The pin that governs sentence `i`, or the start pin when there is no sentence left. */
function pinFor(p: BoxParagraph, i: number): Pin | null {
  const span = p.spans[i];
  return span ? pinBefore(p.pins, span) : p.pins.find((x) => x.notSpeech) ?? null;
}

/** The chips in order: the cast, then "not speech"; an unpin chip when the sentence is pinned. */
function chipsOf(p: BoxParagraph, i: number, roster: readonly Speaker[]): { label: string; colour: string | null; pin: string | null }[] {
  const chips: { label: string; colour: string | null; pin: string | null }[] = roster.map((s) => ({ label: s.name, colour: s.colour, pin: s.name }));
  const a = p.voices[i]?.speaker;
  if (a && !roster.some((s) => s.id === a.id)) chips.push({ label: a.name, colour: a.colour, pin: a.name });
  chips.push({ label: "Not speech", colour: null, pin: NOT_SPEECH });
  if (pinFor(p, i)) chips.push({ label: "Unpin", colour: null, pin: null });
  return chips;
}

function defaultChip(p: BoxParagraph, i: number, chips: ReturnType<typeof chipsOf>): number {
  const a = p.voices[i]?.speaker;
  const k = a ? chips.findIndex((c) => c.pin === a.name) : -1;
  return k < 0 ? 0 : k;
}

function render(view: EditorView, p: BoxParagraph, i: number, roster: readonly Speaker[], state: { selected: number; armed: boolean }): HTMLElement {
  const dom = createDiv({ cls: BOX_CLASS });
  const head = dom.createDiv({ cls: `${BOX_CLASS}-head` });
  const pin = pinFor(p, i);
  const a = p.voices[i] ?? null;
  if (pin?.notSpeech) head.setText("Not speech · pinned by you");
  else if (a && isCertain(a.how)) head.setText(`${a.speaker.name} · ${HOW_LABELS[a.how]}`);
  else if (a) head.setText(`Speaker not certain · guess: ${a.speaker.name} (${HOW_LABELS[a.how]})`);
  else head.setText("Speaker not found");
  const chips = chipsOf(p, i, roster);
  const row = dom.createDiv({ cls: `${BOX_CLASS}-chips` });
  const current = state.selected >= 0 ? state.selected : state.armed ? defaultChip(p, i, chips) : -1;
  chips.forEach((c, k) => {
    const chip = row.createEl("button", { cls: CHIP_CLASS, attr: { type: "button" } });
    if (c.colour) chip.createSpan({ cls: `${CHIP_CLASS}-dot` }).setCssProps({ "--czm-speech": c.colour });
    chip.createSpan({ text: c.label });
    const isPinned = pin ? (pin.notSpeech ? c.pin === NOT_SPEECH : c.pin === pin.label) : false;
    chip.classList.toggle("is-pinned", isPinned);
    chip.classList.toggle("is-selected", k === current);
    chip.addEventListener("click", () => { view.dispatch({ changes: pinChange(p, i, c.pin), effects: closeBox.of(null) }); view.focus(); });
  });
  dom.createDiv({ cls: `${BOX_CLASS}-hint`, text: state.armed ? "← → choose · Enter pins · Esc closes · Ctrl+Z undoes" : "Click a name to pin it · Ctrl+Z undoes" });
  return dom;
}

/**
 * The speaker box: the cast as chips over a sentence of speech. On hover,
 * and by itself when the cursor rests in a sentence nobody is sure about
 * (a setting), passive: a click pins. Opened by the command it is armed:
 * the arrows choose, Enter pins, Escape closes. A pin is a hidden
 * comment right before the sentence, one editor change, so the editor's
 * undo takes it back.
 */
export function speakerBox(source: BoxSource) {
  const field = StateField.define<BoxState | null>({
    create: () => null,
    update(value, tr) {
      let v = value;
      if (tr.docChanged) v = null;
      for (const e of tr.effects) {
        if (e.is(closeBox)) v = null;
        else if (e.is(openAt)) v = { at: e.value.at, span: e.value.span, selected: -1, armed: false };
        else if (e.is(tagSpeaker)) {
          const line = tr.state.doc.lineAt(tr.state.selection.main.head);
          v = { at: v?.at ?? line.from, span: v?.span ?? -2, selected: -1, armed: true };
        }
        else if (e.is(select) && v) v = { ...v, selected: e.value, armed: true };
      }
      return v;
    },
    provide: (f) => showTooltip.compute([f], (state) => tooltipFor(state.field(f), state)),
  });

  function tooltipFor(box: BoxState | null, state: EditorState): Tooltip | null {
    if (!box) return null;
    return {
      pos: box.at,
      above: true,
      create(view) {
        const data = source(view);
        // The command may land on a line the analysis does not know (no cast, lens off): say so rather than nothing.
        const p = data ? data.paragraphs.find((q) => q.from <= box.at && q.to >= box.at) ?? paragraphAt(data, state.selection.main.head) : null;
        const i = p ? (box.span === -2 ? spanAt(p, state.selection.main.head) : box.span) : -1;
        const anchor = p && i >= 0 ? p.from + p.spans[i]!.from : box.at;
        const dom = p && (p.spans.length || p.pins.length) ? render(view, p, i, data!.roster, box) : createDiv({ cls: BOX_CLASS, text: data ? "No speech in this paragraph" : "The dialogue lens needs to be on, with a cast, to tag a speaker" });
        // Over the sentence, not the paragraph's first line.
        return { dom, mount: () => dom.parentElement?.classList.add(`${BOX_CLASS}-host`), getCoords: () => view.coordsAtPos(anchor) ?? view.coordsAtPos(box.at)! };
      },
    };
  }

  /** Opens the box by itself when the cursor rests in an unpinned, uncertain sentence; closes it when the cursor leaves. */
  const auto = ViewPlugin.fromClass(class {
    private timer: number | null = null;
    constructor(private readonly view: EditorView) {}
    update(u: ViewUpdate) {
      if (!u.selectionSet || u.docChanged) return;
      this.cancel();
      const box = u.state.field(field);
      const data = effectiveSettings(u.state).dialogue.autoBox ? source(u.view) : null;
      const head = u.state.selection.main.head;
      const p = data ? paragraphAt(data, head) : null;
      const i = p ? spanAt(p, head) : -1;
      const voice = p && i >= 0 ? p.voices[i] ?? null : null;
      const uncertain = !!p && i >= 0 && !pinFor(p, i) && !(voice && isCertain(voice.how));
      if (!p || !uncertain) { if (box && !box.armed) queueMicrotask(() => this.view.dispatch({ effects: closeBox.of(null) })); return; }
      if (box?.at === p.from && box.span === i) return;
      const at = { at: p.from, span: i };
      this.timer = window.setTimeout(() => { this.timer = null; this.view.dispatch({ effects: openAt.of(at) }); }, 600);
    }
    private cancel() { if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; } }
    destroy() { this.cancel(); }
  });

  function target(view: EditorView): { p: BoxParagraph; i: number; roster: readonly Speaker[] } | null {
    const box = view.state.field(field);
    const data = box ? source(view) : null;
    const p = data && box ? data.paragraphs.find((q) => q.from === box.at) ?? null : null;
    if (!p || !box || !data) return null;
    return { p, i: box.span === -2 ? spanAt(p, view.state.selection.main.head) : box.span, roster: data.roster };
  }

  const keys = Prec.highest(keymap.of([
    { key: "Escape", run: (view) => { if (!view.state.field(field)) return false; view.dispatch({ effects: closeBox.of(null) }); return true; } },
    { key: "ArrowRight", run: (view) => step(view, 1) },
    { key: "ArrowLeft", run: (view) => step(view, -1) },
    { key: "Enter", run: (view) => {
      const box = view.state.field(field);
      const t = box?.armed ? target(view) : null;
      if (!t || !box) return false;
      const chips = chipsOf(t.p, t.i, t.roster);
      const chip = chips[box.selected >= 0 ? box.selected : defaultChip(t.p, t.i, chips)];
      if (!chip) return false;
      view.dispatch({ changes: pinChange(t.p, t.i, chip.pin), effects: closeBox.of(null) });
      return true;
    } },
  ]));

  function step(view: EditorView, by: number): boolean {
    const box = view.state.field(field);
    const t = box?.armed ? target(view) : null;
    if (!t || !box) return false;
    const chips = chipsOf(t.p, t.i, t.roster);
    const current = box.selected >= 0 ? box.selected : defaultChip(t.p, t.i, chips);
    view.dispatch({ effects: select.of((current + by + chips.length) % chips.length) });
    return true;
  }

  const hover = hoverTooltip((view, pos) => {
    const data = source(view);
    const p = data ? paragraphAt(data, pos) : null;
    if (!p) return null;
    const i = p.spans.findIndex((s) => pos >= p.from + s.from && pos <= p.from + s.to);
    const notSpeech = i < 0 && p.spans.length === 0 && p.pins.some((x) => x.notSpeech);
    if (i < 0 && !notSpeech) return null;
    const span = i >= 0 ? p.spans[i]! : { from: 0, to: p.to - p.from };
    return { pos: p.from + span.from, end: p.from + span.to, above: true, create: () => { const dom = render(view, p, i, data!.roster, { selected: -1, armed: false }); return { dom, mount: () => dom.parentElement?.classList.add(`${BOX_CLASS}-host`) }; } };
  }, { hoverTime: 250 });

  return [field, auto, keys, hover];
}
