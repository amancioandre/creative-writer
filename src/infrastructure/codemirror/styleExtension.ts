import { StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { settingsFacet } from "./settingsFacet";
import { cursorParagraph } from "./cursorParagraph";
import { decorateFindings } from "./findingDecorations";
import { findingProviders } from "./findingsTooltip";
import { enabledStyleKinds } from "../../domain/settings/Settings";
import type { Finding } from "../../domain/style/Finding";
import type { AnalyzeParagraphStyle } from "../../application/use-cases/AnalyzeParagraphStyle";

export { STYLE_MARK_CLASS_PREFIX, STYLE_NOTE_ATTR } from "./findingDecorations";

/**
 * Synchronous style findings (rules + tagger) in the cursor's paragraph.
 * Pure function of (doc, selection, settings), so it lives in a StateField:
 * other extensions can read it — the async layer dedupes against it.
 */
export function styleExtension(analyze: AnalyzeParagraphStyle) {
  const compute = (state: Parameters<typeof cursorParagraph>[0] & { facet: EditorView["state"]["facet"] }): Finding[] => {
    const enabled = enabledStyleKinds(state.facet(settingsFacet));
    if (enabled.size === 0) return [];
    const p = cursorParagraph(state);
    if (!p) return [];
    return analyze.execute({ text: p.text, paragraphFrom: p.from, enabled });
  };

  const field = StateField.define<Finding[]>({
    create: (state) => compute(state),
    update(value, tr) {
      const settingsChanged = tr.startState.facet(settingsFacet) !== tr.state.facet(settingsFacet);
      return tr.docChanged || tr.selection || settingsChanged ? compute(tr.state) : value;
    },
  });

  return [
    field,
    EditorView.decorations.from(field, (fs) => (fs.length ? decorateFindings(fs) : Decoration.none)),
    findingProviders.of((view) => view.state.field(field)),
    syncFindingsField.of(field),
  ];
}

import { Facet } from "@codemirror/state";
/** Lets other extensions find the sync findings field without importing this module's instance. */
export const syncFindingsField = Facet.define<StateField<Finding[]>>();
