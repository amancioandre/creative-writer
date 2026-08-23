import { StateEffect, StateField } from "@codemirror/state";
import { type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, Decoration } from "@codemirror/view";
import { settingsFacet, settingsChanged } from "./settingsFacet";
import { cursorParagraph } from "./cursorParagraph";
import { decorateFindings } from "./findingDecorations";
import { findingProviders } from "./findingsTooltip";
import { enabledStyleKinds } from "../../domain/settings/Settings";
import { Finding } from "../../domain/style/Finding";
import type { ParagraphAnalyser } from "../../application/ports/ParagraphAnalyser";
import { ScheduleAnalysis, type ScheduleOptions } from "../../application/use-cases/ScheduleAnalysis";

interface AsyncResult {
  readonly key: string;
  readonly findings: readonly Finding[];
}

const setResult = StateEffect.define<AsyncResult>();
const EMPTY: AsyncResult = { key: "", findings: [] };

/**
 * Findings from a slow analyser (tagger, model). Results live in a
 * StateField keyed by the paragraph's text hash; when the paragraph under
 * the cursor no longer matches that key, nothing is rendered — so stale
 * results never appear on edited text.
 */
export function asyncFindingsExtension(analyser: ParagraphAnalyser, options: ScheduleOptions = {}) {
  const results = StateField.define<AsyncResult>({
    create: () => EMPTY,
    update(value, tr) {
      for (const e of tr.effects) if (e.is(setResult)) return e.value;
      if (!tr.docChanged) return value;
      // Edits elsewhere in the document shift offsets; edits inside the paragraph change its key and hide it anyway.
      const mapped: Finding[] = [];
      for (const f of value.findings) {
        const from = tr.changes.mapPos(f.from, 1);
        const to = tr.changes.mapPos(f.to, -1);
        if (to > from) mapped.push(Finding.create(f.kind, from, to, f.note));
      }
      return { key: value.key, findings: mapped };
    },
  });

  /** What is currently valid to show: results whose key matches the cursor paragraph, filtered by settings. */
  function visible(state: { facet: EditorView["state"]["facet"]; field: EditorView["state"]["field"] } & Parameters<typeof cursorParagraph>[0]): Finding[] {
    const enabled = enabledStyleKinds(state.facet(settingsFacet));
    if (enabled.size === 0) return [];
    const p = cursorParagraph(state);
    if (!p) return [];
    const r = state.field(results);
    if (r.key !== ScheduleAnalysis.keyFor(p.text)) return [];
    return r.findings.filter((f) => enabled.has(f.kind));
  }

  const decorations = EditorView.decorations.compute([results, settingsFacet, "selection", "doc"], (state) => {
    const fs = visible(state);
    return fs.length ? decorateFindings(fs) : Decoration.none;
  });

  const driver = ViewPlugin.fromClass(
    class {
      private readonly scheduler: ScheduleAnalysis;

      constructor(private readonly view: EditorView) {
        this.scheduler = new ScheduleAnalysis(
          analyser,
          (key, findings) => view.dispatch({ effects: setResult.of({ key, findings }) }),
          options,
        );
        this.request(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || settingsChanged(u)) this.request(u.view);
      }

      destroy() {
        this.scheduler.dispose();
      }

      private request(view: EditorView) {
        if (enabledStyleKinds(view.state.facet(settingsFacet)).size === 0) return;
        const p = cursorParagraph(view.state);
        if (!p) return;
        if (view.state.field(results).key === ScheduleAnalysis.keyFor(p.text)) return; // already have it
        this.scheduler.request(p.text, p.from);
      }
    },
  );

  return [results, decorations, driver, findingProviders.of((view) => visible(view.state))];
}
