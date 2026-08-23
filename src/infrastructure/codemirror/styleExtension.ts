import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, hoverTooltip, type Tooltip } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { settingsFacet, settingsChanged } from "./settingsFacet";
import { DocLineSource } from "./DocLineSource";
import { locateParagraph } from "../../domain/text/Paragraph";
import { enabledStyleKinds } from "../../domain/settings/Settings";
import type { Finding } from "../../domain/style/Finding";
import type { AnalyzeParagraphStyle } from "../../application/use-cases/AnalyzeParagraphStyle";

export const STYLE_MARK_CLASS_PREFIX = "czm-style-";
export const STYLE_NOTE_ATTR = "data-czm-note";

/** Hover lookup. End-inclusive so the tooltip still shows at the last character. */
export function findingAt(findings: readonly Finding[], pos: number): Finding | null {
  for (const f of findings) if (pos >= f.from && pos <= f.to) return f;
  return null;
}

/**
 * Highlights style findings in the cursor's paragraph and explains each one
 * on hover. Findings are recomputed on edit/cursor/settings changes; the
 * tooltip reads from the same plugin instance, so there is one source of truth.
 */
export function styleExtension(analyze: AnalyzeParagraphStyle) {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      findings: Finding[] = [];

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || settingsChanged(u)) this.decorations = this.build(u.view);
      }

      private build(view: EditorView): DecorationSet {
        this.findings = compute(view);
        const builder = new RangeSetBuilder<Decoration>();
        for (const f of this.findings) {
          builder.add(
            f.from,
            f.to,
            Decoration.mark({ class: `${STYLE_MARK_CLASS_PREFIX}${f.kind}`, attributes: { [STYLE_NOTE_ATTR]: f.note } }),
          );
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );

  function compute(view: EditorView): Finding[] {
    const settings = view.state.facet(settingsFacet);
    const enabled = enabledStyleKinds(settings);
    if (enabled.size === 0) return [];

    const doc = view.state.doc;
    const cursorLine = doc.lineAt(view.state.selection.main.head).number - 1;
    const paragraph = locateParagraph(new DocLineSource(doc), cursorLine);
    if (!paragraph) return [];

    const from = doc.line(paragraph.firstLine + 1).from;
    const to = doc.line(paragraph.lastLine + 1).to;
    return analyze.execute({ text: doc.sliceString(from, to), paragraphFrom: from, enabled });
  }

  const source: TooltipSource = (view, pos) => {
    const instance = view.plugin(plugin);
    const f = instance ? findingAt(instance.findings, pos) : null;
    return f ? tooltipFor(f) : null;
  };

  return Object.assign([plugin, hoverTooltip(source, { hoverTime: 250 })], { source });
}

export type TooltipSource = (view: EditorView, pos: number) => Tooltip | null;

/** Builds the hover card for one finding. Exported for tests; no CM state involved. */
export function tooltipFor(f: Finding): Tooltip {
  return {
    pos: f.from,
    end: f.to,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = `czm-style-tooltip czm-style-tooltip-${f.kind}`;
      const kind = dom.appendChild(document.createElement("div"));
      kind.className = "czm-style-tooltip-kind";
      kind.textContent = f.kind;
      const note = dom.appendChild(document.createElement("div"));
      note.textContent = f.note;
      return { dom };
    },
  };
}
