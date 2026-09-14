import { effectiveSettings } from "./activeNote";
import { StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { KIND_PHRASES, suppressComment, suppressedKinds } from "../../domain/style/Suppress";
import type { HoverFinding } from "./findingsTooltip";
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
    const enabled = enabledStyleKinds(effectiveSettings(state));
    if (enabled.size === 0) return [];
    const p = cursorParagraph(state);
    if (!p) return [];
    const not = suppressedKinds(p.text);
    const found = analyze.execute({ text: p.text, paragraphFrom: p.from, enabled });
    return not.size ? found.filter((f) => !not.has(f.kind)) : found;
  };

  /** Each finding with its one action: "not a cliché here", a hidden comment at the end of the paragraph, one editor change. */
  const withActions = (view: EditorView): HoverFinding[] =>
    view.state.field(field).map((f) => ({
      ...f,
      actions: [{ label: `Not ${KIND_PHRASES[f.kind]} here`, run: () => { const p = cursorParagraph(view.state); if (p) view.dispatch({ changes: { from: p.to, insert: ` ${suppressComment(f.kind)}` } }); } }],
    }));

  const field = StateField.define<Finding[]>({
    create: (state) => compute(state),
    update(value, tr) {
      const settingsChanged = effectiveSettings(tr.startState) !== effectiveSettings(tr.state);
      return tr.docChanged || tr.selection || settingsChanged ? compute(tr.state) : value;
    },
  });

  return [
    field,
    EditorView.decorations.from(field, (fs) => (fs.length ? decorateFindings(fs) : Decoration.none)),
    findingProviders.of(withActions),
    syncFindingsField.of(field),
  ];
}

import { Facet } from "@codemirror/state";
/** Lets other extensions find the sync findings field without importing this module's instance. */
export const syncFindingsField = Facet.define<StateField<Finding[]>>();
