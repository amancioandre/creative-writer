import { effectiveSettings } from "./activeNote";
import { Decoration, type DecorationSet, EditorView, layer, RectangleMarker, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { settingsChanged } from "./settingsFacet";
import { DocLineSource } from "./DocLineSource";
import { locateParagraph } from "../../domain/text/Paragraph";
import { RhythmScale } from "../../domain/rhythm/RhythmScale";
import type { AnalyzeParagraphRhythm, RhythmAnnotation } from "../../application/use-cases/AnalyzeParagraphRhythm";

export const RHYTHM_MARK_CLASS_PREFIX = "czm-rhythm-";
export const RHYTHM_GUTTER_LAYER_CLASS = "czm-rhythm-gutter-layer";
export const RHYTHM_TICK_CLASS = "czm-rhythm-tick";

/** Geometry of the margin meter, in CSS pixels. */
export const TICK_MAX_WIDTH = 28;
export const TICK_MIN_WIDTH = 4;
export const TICK_HEIGHT = 3;
export const TICK_GAP = 2;
/** Space between the meter's right edge and the text's left edge. */
export const TICK_GUTTER = 12;

export interface Tick {
  readonly tier: number;
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Pure geometry for the Zen Mode meter: one bar per sentence, stacked down
 * from the paragraph's top, all starting at the same x in the margin and
 * growing towards the text with the sentence's tier.
 */
export function ticksFor(tiers: readonly number[], tierCount: number, anchor: { readonly top: number; readonly left: number }): Tick[] {
  const left = anchor.left - TICK_GUTTER - TICK_MAX_WIDTH;
  return tiers.map((tier, i) => ({
    tier,
    width: Math.max(TICK_MIN_WIDTH, Math.round((TICK_MAX_WIDTH * tier) / Math.max(1, tierCount))),
    height: TICK_HEIGHT,
    top: anchor.top + i * (TICK_HEIGHT + TICK_GAP),
    left,
  }));
}

const markFor = new Map<number, Decoration>();
function mark(tier: number): Decoration {
  let d = markFor.get(tier);
  if (!d) {
    d = Decoration.mark({ class: `${RHYTHM_MARK_CLASS_PREFIX}${tier}` });
    markFor.set(tier, d);
  }
  return d;
}

/**
 * Colours sentences in the paragraph under the cursor by rhythm tier.
 * Only that paragraph is segmented and decorated, so cost is bounded by
 * paragraph length, not document length.
 *
 * Two renderings share one analysis: a tint behind each sentence (the
 * everyday view) and a meter in the margin (a layer that the stylesheet
 * shows only in Zen Mode, where the text stays plain).
 */
export function rhythmExtension(analyze: AnalyzeParagraphRhythm) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      annotations: RhythmAnnotation[] = [];

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || settingsChanged(u)) {
          this.decorations = this.build(u.view);
        }
      }

      private build(view: EditorView): DecorationSet {
        this.annotations = analyseCursorParagraph(view);
        const builder = new RangeSetBuilder<Decoration>();
        for (const a of this.annotations) builder.add(a.from, a.to, mark(a.tier));
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );

  const gutter = layer({
    above: false,
    class: RHYTHM_GUTTER_LAYER_CLASS,
    update: (u) => u.docChanged || u.selectionSet || u.geometryChanged || u.viewportChanged || settingsChanged(u),
    markers(view: EditorView) {
      const annotations = view.plugin(plugin)?.annotations ?? [];
      if (annotations.length === 0) return [];
      const first = annotations[0]!.from;
      const head = view.state.selection.main.head;
      // Layer coordinates = client coordinates + a constant; the cursor marker gives that constant.
      const [cursor] = RectangleMarker.forRange(view, RHYTHM_TICK_CLASS, view.state.selection.main);
      const client = view.coordsAtPos(head);
      const lineStart = view.coordsAtPos(view.state.doc.lineAt(first).from);
      if (!cursor || !client || !lineStart) return [];
      const block = view.lineBlockAt(first);
      const anchor = { top: view.documentTop + block.top + (cursor.top - client.top), left: lineStart.left + (cursor.left - client.left) };
      return ticksFor(annotations.map((a) => a.tier), effectiveSettings(view.state).rhythmTiers, anchor)
        .map((t) => new RectangleMarker(`${RHYTHM_TICK_CLASS} ${RHYTHM_MARK_CLASS_PREFIX}${t.tier}`, t.left, t.top, t.width, t.height));
    },
  });

  return [plugin, gutter];

  function analyseCursorParagraph(view: EditorView): RhythmAnnotation[] {
    const settings = effectiveSettings(view.state);
    if (!settings.rhythmEnabled) return [];

    const doc = view.state.doc;
    const cursorLine = doc.lineAt(view.state.selection.main.head).number - 1;
    const paragraph = locateParagraph(new DocLineSource(doc), cursorLine);
    if (!paragraph) return [];

    const from = doc.line(paragraph.firstLine + 1).from;
    const to = doc.line(paragraph.lastLine + 1).to;
    return analyze.execute({
      text: doc.sliceString(from, to),
      paragraphFrom: from,
      scale: RhythmScale.withTiers(settings.rhythmTiers),
    });
  }
}
