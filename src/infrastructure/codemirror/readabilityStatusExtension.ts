import { effectiveSettings } from "./activeNote";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { settingsChanged } from "./settingsFacet";
import { cursorParagraph } from "./cursorParagraph";
import type { ProfileProse, ProseProfile } from "../../application/use-cases/ProfileProse";

/**
 * Profiles the paragraph under the cursor and reports it outward (the
 * status bar lives outside the editor). Reports null when disabled or on a
 * blank line so the host can clear its display.
 */
export function readabilityStatusExtension(profile: ProfileProse, report: (p: ProseProfile | null) => void) {
  return ViewPlugin.fromClass(
    class {
      private lastText: string | null = null;

      constructor(view: EditorView) {
        this.emit(view);
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.focusChanged || settingsChanged(u)) this.emit(u.view);
      }

      destroy() {
        report(null);
      }

      private emit(view: EditorView) {
        if (!effectiveSettings(view.state).readabilityEnabled) {
          this.lastText = null;
          report(null);
          return;
        }
        const p = cursorParagraph(view.state);
        const text = p?.text ?? null;
        if (text === this.lastText) return;
        this.lastText = text;
        report(text === null ? null : profile.paragraph(text));
      }
    },
  );
}

/** Compact status-bar rendering: "Plain · Varied · 62%" style, only what fits in a glance. */
export function statusLabel(p: ProseProfile | null): string {
  if (!p || !p.readingEase) return "";
  const parts = [p.readingEase.band.label];
  if (p.variety) parts.push(p.variety.band.label);
  return parts.join(" · ");
}
