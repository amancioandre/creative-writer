import { Facet } from "@codemirror/state";
import { EditorView, hoverTooltip, type Tooltip } from "@codemirror/view";
import type { Finding } from "../../domain/style/Finding";

export type FindingProvider = (view: EditorView) => readonly Finding[];

/** Every extension that produces findings registers a provider; the one tooltip reads them all. */
export const findingProviders = Facet.define<FindingProvider>();

export function allFindings(view: EditorView): Finding[] {
  return view.state.facet(findingProviders).flatMap((p) => p(view));
}

/** Hover lookup. End-inclusive so the tooltip still shows at the last character. */
export function findingAt(findings: readonly Finding[], pos: number): Finding | null {
  for (const f of findings) if (pos >= f.from && pos <= f.to) return f;
  return null;
}

/** Builds the hover card for one finding. The returned element becomes the `.cm-tooltip` itself. */
export function tooltipFor(f: Finding): Tooltip {
  return {
    pos: f.from,
    end: f.to,
    above: true,
    create() {
      const dom = createDiv({ cls: `czm-style-tooltip czm-style-tooltip-${f.kind}` });
      dom.createDiv({ cls: "czm-style-tooltip-kind", text: f.kind });
      dom.createDiv({ text: f.note });
      return { dom };
    },
  };
}

export const tooltipSource = (view: EditorView, pos: number): Tooltip | null => {
  const f = findingAt(allFindings(view), pos);
  return f ? tooltipFor(f) : null;
};

export function findingsTooltip() {
  return hoverTooltip(tooltipSource, { hoverTime: 250 });
}
