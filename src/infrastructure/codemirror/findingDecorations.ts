import { Decoration, type DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { Finding } from "../../domain/style/Finding";

export const STYLE_MARK_CLASS_PREFIX = "czm-style-";
export const STYLE_NOTE_ATTR = "data-czm-note";

/** Findings → mark decorations. Shared by the sync and async extensions. Input must be sorted by `from`. */
export function decorateFindings(findings: readonly Finding[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const f of findings) {
    builder.add(f.from, f.to, Decoration.mark({ class: `${STYLE_MARK_CLASS_PREFIX}${f.kind}`, attributes: { [STYLE_NOTE_ATTR]: f.note } }));
  }
  return builder.finish();
}
