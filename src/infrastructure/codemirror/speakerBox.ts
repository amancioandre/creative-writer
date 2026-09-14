import { Prec, StateEffect, StateField, type ChangeSpec, type EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, hoverTooltip, keymap, showTooltip, type Tooltip, type ViewUpdate } from "@codemirror/view";
import { effectiveSettings } from "./activeNote";
import type { DialogueSpan } from "../../domain/dialogue/DialogueSpans";
import { HOW_LABELS, NOT_SPEECH, isCertain, pinComment, type Attribution, type Pin, type Speaker } from "../../domain/dialogue/Speakers";

/** What the box needs to know about one paragraph: where it is, its spans, who the rules think is speaking, and the writer's pin. */
export interface BoxParagraph {
  readonly from: number;
  readonly to: number;
  readonly spans: readonly DialogueSpan[];
  readonly attribution: Attribution | null;
  readonly pin: Pin | null;
}

export interface BoxData {
  readonly paragraphs: readonly BoxParagraph[];
  readonly roster: readonly Speaker[];
}

/** The dialogue analysis the box reads; null when the lens is off or there is no cast. */
export type BoxSource = (view: EditorView) => BoxData | null;

/** The command: open the box on the cursor's paragraph, armed for the keyboard. */
export const tagSpeaker = StateEffect.define<null>();
const openAt = StateEffect.define<number>();
const closeBox = StateEffect.define<null>();
const select = StateEffect.define<number>();

interface BoxState {
  /** Start of the paragraph the box is about. */
  readonly at: number;
  /** Chip index the keyboard is on; -1 before any key. */
  readonly selected: number;
  /** Opened by the command, or a key pressed since: Enter and the arrows act on the box. */
  readonly armed: boolean;
}

export const BOX_CLASS = "czm-speaker-box";
export const CHIP_CLASS = "czm-speaker-chip";

/** The pin's comment as a change: written, replaced, or removed. `null` unpins. */
export function pinChange(p: BoxParagraph, label: string | null): ChangeSpec {
  if (p.pin) {
    const from = p.from + p.pin.from;
    const to = p.from + p.pin.to;
    return { from, to, insert: label === null ? "" : `${pinComment(label)} ` };
  }
  if (label === null) return { from: p.from, to: p.from, insert: "" };
  return { from: p.from, to: p.from, insert: `${pinComment(label)} ` };
}

function paragraphAt(data: BoxData, pos: number): BoxParagraph | null {
  for (const p of data.paragraphs) if (pos >= p.from && pos <= p.to) return p;
  return null;
}

/** The chips in order: the cast, then "not speech"; an unpin chip when the paragraph is pinned. */
function chipsOf(p: BoxParagraph, roster: readonly Speaker[]): { label: string; colour: string | null; pin: string | null }[] {
  const chips: { label: string; colour: string | null; pin: string | null }[] = roster.map((s) => ({ label: s.name, colour: s.colour, pin: s.name }));
  const a = p.attribution?.speaker;
  if (a && !roster.some((s) => s.id === a.id)) chips.push({ label: a.name, colour: a.colour, pin: a.name });
  chips.push({ label: "Not speech", colour: null, pin: NOT_SPEECH });
  if (p.pin) chips.push({ label: "Unpin", colour: null, pin: null });
  return chips;
}

function defaultChip(p: BoxParagraph, chips: ReturnType<typeof chipsOf>): number {
  const a = p.attribution?.speaker;
  const i = a ? chips.findIndex((c) => c.pin === a.name) : -1;
  return i < 0 ? 0 : i;
}

function render(view: EditorView, p: BoxParagraph, roster: readonly Speaker[], state: { selected: number; armed: boolean }): HTMLElement {
  const dom = createDiv({ cls: BOX_CLASS });
  const head = dom.createDiv({ cls: `${BOX_CLASS}-head` });
  const a = p.attribution;
  if (p.pin?.notSpeech) head.setText("Not speech · pinned by you");
  else if (a && isCertain(a.how)) head.setText(`${a.speaker.name} · ${HOW_LABELS[a.how]}`);
  else if (a) head.setText(`Speaker not certain · guess: ${a.speaker.name} (${HOW_LABELS[a.how]})`);
  else head.setText("Speaker not found");
  const chips = chipsOf(p, roster);
  const row = dom.createDiv({ cls: `${BOX_CLASS}-chips` });
  const current = state.selected >= 0 ? state.selected : state.armed ? defaultChip(p, chips) : -1;
  chips.forEach((c, i) => {
    const chip = row.createEl("button", { cls: CHIP_CLASS, attr: { type: "button" } });
    if (c.colour) chip.createSpan({ cls: `${CHIP_CLASS}-dot` }).setCssProps({ "--czm-speech": c.colour });
    chip.createSpan({ text: c.label });
    const isPinned = p.pin ? (p.pin.notSpeech ? c.pin === NOT_SPEECH : c.pin === p.pin.label) : false;
    chip.classList.toggle("is-pinned", isPinned);
    chip.classList.toggle("is-selected", i === current);
    chip.addEventListener("click", () => { view.dispatch({ changes: pinChange(p, c.pin), effects: closeBox.of(null) }); view.focus(); });
  });
  dom.createDiv({ cls: `${BOX_CLASS}-hint`, text: state.armed ? "← → choose · Enter pins · Esc closes · Ctrl+Z undoes" : "Click a name to pin it · Ctrl+Z undoes" });
  return dom;
}

/**
 * The speaker box: the cast as chips over a line of speech. On hover, and
 * by itself when the cursor rests in a line nobody is sure about (a
 * setting), passive: a click pins. Opened by the command it is armed: the
 * arrows choose, Enter pins, Escape closes. A pin is a hidden comment at
 * the start of the paragraph, one editor change, so the editor's undo
 * takes it back.
 */
export function speakerBox(source: BoxSource) {
  const field = StateField.define<BoxState | null>({
    create: () => null,
    update(value, tr) {
      let v = value;
      if (tr.docChanged) v = null;
      for (const e of tr.effects) {
        if (e.is(closeBox)) v = null;
        else if (e.is(openAt)) v = { at: e.value, selected: -1, armed: false };
        else if (e.is(tagSpeaker)) { const line = tr.state.doc.lineAt(tr.state.selection.main.head); v = { at: v?.at ?? line.from, selected: -1, armed: true }; }
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
        // A paragraph pinned "not speech" has no spans but must still open, so the pin can be taken back.
        const dom = p && (p.spans.length || p.pin) ? render(view, p, data!.roster, box) : createDiv({ cls: BOX_CLASS, text: data ? "No speech in this paragraph" : "The dialogue lens needs to be on, with a cast, to tag a speaker" });
        return { dom, mount: () => dom.parentElement?.classList.add(`${BOX_CLASS}-host`) };
      },
    };
  }

  /** Opens the box by itself when the cursor rests in an unpinned, uncertain line; closes it when the cursor leaves. */
  const auto = ViewPlugin.fromClass(class {
    private timer: number | null = null;
    constructor(private readonly view: EditorView) {}
    update(u: ViewUpdate) {
      if (!u.selectionSet || u.docChanged) return;
      this.cancel();
      const box = u.state.field(field);
      const data = effectiveSettings(u.state).dialogue.autoBox ? source(u.view) : null;
      const p = data ? paragraphAt(data, u.state.selection.main.head) : null;
      const uncertain = !!p && p.spans.length > 0 && !p.pin && !(p.attribution && isCertain(p.attribution.how));
      if (!p || !uncertain) { if (box && !box.armed) queueMicrotask(() => this.view.dispatch({ effects: closeBox.of(null) })); return; }
      if (box?.at === p.from) return;
      const at = p.from;
      this.timer = window.setTimeout(() => { this.timer = null; this.view.dispatch({ effects: openAt.of(at) }); }, 600);
    }
    private cancel() { if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; } }
    destroy() { this.cancel(); }
  });

  const keys = Prec.highest(keymap.of([
    { key: "Escape", run: (view) => { if (!view.state.field(field)) return false; view.dispatch({ effects: closeBox.of(null) }); return true; } },
    { key: "ArrowRight", run: (view) => step(view, 1) },
    { key: "ArrowLeft", run: (view) => step(view, -1) },
    { key: "Enter", run: (view) => {
      const box = view.state.field(field);
      if (!box?.armed) return false;
      const data = source(view);
      const p = data ? data.paragraphs.find((q) => q.from === box.at) : null;
      if (!p) return false;
      const chips = chipsOf(p, data!.roster);
      const chip = chips[box.selected >= 0 ? box.selected : defaultChip(p, chips)];
      if (!chip) return false;
      view.dispatch({ changes: pinChange(p, chip.pin), effects: closeBox.of(null) });
      return true;
    } },
  ]));

  function step(view: EditorView, by: number): boolean {
    const box = view.state.field(field);
    if (!box?.armed) return false;
    const data = source(view);
    const p = data ? data.paragraphs.find((q) => q.from === box.at) : null;
    if (!p) return false;
    const n = chipsOf(p, data!.roster).length;
    const current = box.selected >= 0 ? box.selected : defaultChip(p, chipsOf(p, data!.roster));
    view.dispatch({ effects: select.of((current + by + n) % n) });
    return true;
  }

  const hover = hoverTooltip((view, pos) => {
    const data = source(view);
    const p = data ? paragraphAt(data, pos) : null;
    if (!p) return null;
    const span = p.spans.find((s) => pos >= p.from + s.from && pos <= p.from + s.to) ?? (p.pin?.notSpeech ? { from: 0, to: p.to - p.from } : null);
    if (!span) return null;
    return { pos: p.from + span.from, end: p.from + span.to, above: true, create: () => { const dom = render(view, p, data!.roster, { selected: -1, armed: false }); return { dom, mount: () => dom.parentElement?.classList.add(`${BOX_CLASS}-host`) }; } };
  }, { hoverTime: 250 });

  return [field, auto, keys, hover];
}
