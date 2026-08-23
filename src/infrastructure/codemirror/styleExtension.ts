import { type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { settingsFacet, settingsChanged } from "./settingsFacet";
import { cursorParagraph } from "./cursorParagraph";
import { decorateFindings } from "./findingDecorations";
import { findingProviders } from "./findingsTooltip";
import { enabledStyleKinds } from "../../domain/settings/Settings";
import type { Finding } from "../../domain/style/Finding";
import type { AnalyzeParagraphStyle } from "../../application/use-cases/AnalyzeParagraphStyle";

export { STYLE_MARK_CLASS_PREFIX, STYLE_NOTE_ATTR } from "./findingDecorations";

/**
 * Synchronous style findings (Tier 1 rules) in the cursor's paragraph.
 * Recomputed on edit/cursor/settings changes; registers as a finding
 * provider so the shared tooltip can explain each mark.
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
        return decorateFindings(this.findings);
      }
    },
    { decorations: (v) => v.decorations },
  );

  function compute(view: EditorView): Finding[] {
    const enabled = enabledStyleKinds(view.state.facet(settingsFacet));
    if (enabled.size === 0) return [];
    const p = cursorParagraph(view.state);
    if (!p) return [];
    return analyze.execute({ text: p.text, paragraphFrom: p.from, enabled });
  }

  return [plugin, findingProviders.of((view) => view.plugin(plugin)?.findings ?? [])];
}
