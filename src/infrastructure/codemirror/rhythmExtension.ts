import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { settingsFacet, settingsChanged } from "./settingsFacet";
import { DocLineSource } from "./DocLineSource";
import { locateParagraph } from "../../domain/text/Paragraph";
import { RhythmScale } from "../../domain/rhythm/RhythmScale";
import type { AnalyzeParagraphRhythm } from "../../application/use-cases/AnalyzeParagraphRhythm";

export const RHYTHM_MARK_CLASS_PREFIX = "czm-rhythm-";

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
 */
export function rhythmExtension(analyze: AnalyzeParagraphRhythm) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || settingsChanged(u)) {
          this.decorations = build(u.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );

  function build(view: EditorView): DecorationSet {
    const settings = view.state.facet(settingsFacet);
    if (!settings.rhythmEnabled) return Decoration.none;

    const doc = view.state.doc;
    const cursorLine = doc.lineAt(view.state.selection.main.head).number - 1;
    const paragraph = locateParagraph(new DocLineSource(doc), cursorLine);
    if (!paragraph) return Decoration.none;

    const from = doc.line(paragraph.firstLine + 1).from;
    const to = doc.line(paragraph.lastLine + 1).to;
    const annotations = analyze.execute({
      text: doc.sliceString(from, to),
      paragraphFrom: from,
      scale: RhythmScale.withTiers(settings.rhythmTiers),
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const a of annotations) builder.add(a.from, a.to, mark(a.tier));
    return builder.finish();
  }
}
