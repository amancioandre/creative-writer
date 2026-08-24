import { effectiveSettings, activeField } from "./activeNote";
import { type EditorState, StateEffect, StateField } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate, Decoration } from "@codemirror/view";
import { settingsFacet, settingsChanged } from "./settingsFacet";
import { cursorParagraph } from "./cursorParagraph";
import { decorateFindings } from "./findingDecorations";
import { findingProviders } from "./findingsTooltip";
import { syncFindingsField } from "./styleExtension";
import { enabledStyleKinds, llmConfigEquals } from "../../domain/settings/Settings";
import { Finding } from "../../domain/style/Finding";
import type { ParagraphAnalyser } from "../../application/ports/ParagraphAnalyser";
import { ScheduleAnalysis, type ScheduleOptions } from "../../application/use-cases/ScheduleAnalysis";
import { windowTimers } from "./windowTimers";

interface AsyncResult {
  readonly key: string;
  readonly findings: readonly Finding[];
}

const setResult = StateEffect.define<AsyncResult>();
/** Dispatch to analyse the cursor paragraph right now, regardless of the idle setting. */
export const analyseNow = StateEffect.define<null>();
const EMPTY: AsyncResult = { key: "", findings: [] };

/**
 * Findings from a model. Results live in a StateField keyed by the
 * paragraph's text hash; when the paragraph under the cursor no longer
 * matches that key, nothing is rendered — stale results never appear on
 * edited text. Model findings that overlap a rule finding of the same kind
 * are dropped: the rule already said it.
 *
 * Runs on idle only if `settings.llm.onIdle`; always on `analyseNow`.
 */
export function asyncFindingsExtension(analyser: ParagraphAnalyser, options: Partial<ScheduleOptions> = {}) {
  const results = StateField.define<AsyncResult>({
    create: () => EMPTY,
    update(value, tr) {
      for (const e of tr.effects) if (e.is(setResult)) return e.value;
      if (!tr.docChanged) return value;
      const mapped: Finding[] = [];
      for (const f of value.findings) {
        const from = tr.changes.mapPos(f.from, 1);
        const to = tr.changes.mapPos(f.to, -1);
        if (to > from) mapped.push(Finding.create(f.kind, from, to, f.note));
      }
      return { key: value.key, findings: mapped };
    },
  });

  function visible(state: EditorState): Finding[] {
    const enabled = enabledStyleKinds(effectiveSettings(state));
    if (enabled.size === 0) return [];
    const p = cursorParagraph(state);
    if (!p) return [];
    const r = state.field(results);
    if (r.key !== ScheduleAnalysis.keyFor(p.text)) return [];
    const sync = state.facet(syncFindingsField).flatMap((f) => state.field(f));
    return r.findings.filter((f) => enabled.has(f.kind) && !sync.some((s) => s.kind === f.kind && f.from < s.to && f.to > s.from));
  }

  const decorations = EditorView.decorations.compute([results, settingsFacet, activeField, "selection", "doc"], (state) => {
    const fs = visible(state);
    return fs.length ? decorateFindings(fs) : Decoration.none;
  });

  const driver = ViewPlugin.fromClass(
    class {
      private readonly scheduler: ScheduleAnalysis;
      private destroyed = false;

      constructor(private readonly view: EditorView) {
        this.scheduler = new ScheduleAnalysis(
          analyser,
          (key, findings) => view.dispatch({ effects: setResult.of({ key, findings }) }),
          { ...options, timers: options.timers ?? windowTimers(view.dom.ownerDocument.defaultView ?? window), idleMs: options.idleMs ?? effectiveSettings(view.state).llm.idleMs },
        );
        this.maybeRequest(view, false);
      }

      update(u: ViewUpdate) {
        const now = u.transactions.some((tr) => tr.effects.some((e) => e.is(analyseNow)));
        if (settingsChanged(u) && options.idleMs === undefined) this.scheduler.setIdleMs(effectiveSettings(u.state).llm.idleMs);
        const modelChanged = settingsChanged(u) && !llmConfigEquals(effectiveSettings(u.startState).llm, effectiveSettings(u.state).llm);
        if (modelChanged) {
          this.scheduler.invalidate();
          // Cannot dispatch inside update(); clear the old model's results on the next tick.
          queueMicrotask(() => { if (!this.destroyed) u.view.dispatch({ effects: setResult.of(EMPTY) }); });
        }
        if (now || modelChanged || u.docChanged || u.selectionSet || settingsChanged(u)) this.maybeRequest(u.view, now, modelChanged);
      }

      destroy() {
        this.destroyed = true;
        this.scheduler.dispose();
      }

      private maybeRequest(view: EditorView, immediate: boolean, force = false) {
        const settings = effectiveSettings(view.state);
        if (settings.llm.provider === "off") return;
        if (!immediate && !settings.llm.onIdle) return;
        if (enabledStyleKinds(settings).size === 0) return;
        const p = cursorParagraph(view.state);
        if (!p) return;
        if (!immediate && !force && view.state.field(results).key === ScheduleAnalysis.keyFor(p.text)) return;
        this.scheduler.request(p.text, p.from, immediate);
      }
    },
  );

  return [results, decorations, driver, findingProviders.of((view) => visible(view.state))];
}
